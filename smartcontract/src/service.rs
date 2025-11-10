#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema, SimpleObject};
use hex::encode as hex_encode;
use linera_base::identifiers::AccountOwner;
use linera_sdk::{
    graphql::GraphQLMutationRoot, linera_base_types::WithServiceAbi, views::View, Service,
    ServiceRuntime,
};
use smartcontract::{
    Card, GameConfig, GameId, GamePhase, Operation, PlayerStatus, RoundOutcome, VrfRecord,
};

use self::state::{GameData, PlayerData, SmartcontractState};

pub struct SmartcontractService {
    state: SmartcontractState,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(SmartcontractService);

impl WithServiceAbi for SmartcontractService {
    type Abi = smartcontract::SmartcontractAbi;
}

impl Service for SmartcontractService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = SmartcontractState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        SmartcontractService {
            state,
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        let games_snapshot = self
            .state
            .games
            .index_values()
            .await
            .expect("Failed to read games");

        Schema::build(
            QueryRoot {
                games: games_snapshot,
            },
            Operation::mutation_root(self.runtime.clone()),
            EmptySubscription,
        )
        .finish()
        .execute(query)
        .await
    }
}

struct QueryRoot {
    games: Vec<(GameId, GameData)>,
}

#[Object]
impl QueryRoot {
    async fn games(&self) -> async_graphql::Result<Vec<GameSummary>> {
        Ok(self
            .games
            .iter()
            .map(|(game_id, data)| GameSummary::from_game(*game_id, data))
            .collect())
    }

    async fn game(&self, game_id: GameId) -> async_graphql::Result<Option<GameDetails>> {
        Ok(self
            .games
            .iter()
            .find(|(id, _)| *id == game_id)
            .map(|(id, game)| GameDetails::from_game(*id, game)))
    }
}

#[derive(SimpleObject)]
struct GameSummary {
    game_id: GameId,
    phase: GamePhase,
    player_count: usize,
    max_players: u8,
    min_bet: u64,
}

impl GameSummary {
    fn from_game(game_id: GameId, data: &GameData) -> Self {
        Self {
            game_id,
            phase: data.phase,
            player_count: data.players.len(),
            max_players: data.config.max_players,
            min_bet: data.config.min_bet,
        }
    }
}

#[derive(SimpleObject)]
struct GameDetails {
    game_id: GameId,
    phase: GamePhase,
    config: GameConfigView,
    players: Vec<PlayerSnapshot>,
    dealer_hand: Vec<Card>,
    pending_turn: Option<String>,
    deck_remaining: usize,
    vrf: Option<VrfInfo>,
    combined_entropy: Option<String>,
    last_updated_at: u64,
}

impl GameDetails {
    fn from_game(game_id: GameId, data: &GameData) -> Self {
        let players = data
            .join_sequence
            .iter()
            .filter_map(|owner| data.players.get(owner).map(|player| (owner, player)))
            .map(|(owner, player)| PlayerSnapshot::from_player(owner, player))
            .collect();
        Self {
            game_id,
            phase: data.phase,
            config: GameConfigView::from(&data.config),
            players,
            dealer_hand: data.dealer_hand.clone(),
            pending_turn: data
                .turn_order
                .first()
                .map(|owner| format_owner(owner)),
            deck_remaining: data.deck.len(),
            vrf: data.vrf.as_ref().map(VrfInfo::from),
            combined_entropy: data
                .combined_entropy
                .map(|entropy| format!("0x{}", hex_encode(entropy))),
            last_updated_at: data.last_updated_at,
        }
    }
}

#[derive(SimpleObject)]
struct GameConfigView {
    dealer: String,
    max_players: u8,
    min_bet: u64,
    allow_mid_join: bool,
    round_timeout: Option<u64>,
}

impl From<&GameConfig> for GameConfigView {
    fn from(config: &GameConfig) -> Self {
        Self {
            dealer: format_owner(&config.dealer),
            max_players: config.max_players,
            min_bet: config.min_bet,
            allow_mid_join: config.allow_mid_join,
            round_timeout: config.round_timeout,
        }
    }
}

#[derive(SimpleObject)]
struct PlayerSnapshot {
    owner: String,
    bet: u64,
    status: PlayerStatus,
    hand: Vec<Card>,
    result: Option<RoundOutcome>,
}

impl PlayerSnapshot {
    fn from_player(owner: &AccountOwner, data: &PlayerData) -> Self {
        Self {
            owner: format_owner(owner),
            bet: data.bet,
            status: data.status,
            hand: data.hand.clone(),
            result: data.result.clone(),
        }
    }
}

#[derive(SimpleObject)]
struct VrfInfo {
    provider: String,
    public_key: String,
    output: String,
    proof: String,
    message: String,
}

impl From<&VrfRecord> for VrfInfo {
    fn from(value: &VrfRecord) -> Self {
        Self {
            provider: format_owner(&value.provider),
            public_key: format!("0x{}", hex_encode(&value.public_key)),
            output: format!("0x{}", hex_encode(value.output)),
            proof: format!("0x{}", hex_encode(&value.proof)),
            message: format!("0x{}", hex_encode(&value.message)),
        }
    }
}

fn format_owner(owner: &AccountOwner) -> String {
    format!("{owner:?}")
}
