#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema, SimpleObject};
use futures::lock::Mutex;

use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::WithServiceAbi,
    views::View,
    Service, ServiceRuntime,
};

use contracts::{Operation, Card, GameResult, GameType, CasinoParams, RouletteBet, RouletteBetType};

use self::state::{ContractsState, ActiveGame, GamePhase, GameRecord, PendingRouletteGame, ALLOWED_BETS};

pub struct ContractsService {
    state: Arc<Mutex<ContractsState>>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(ContractsService);

impl WithServiceAbi for ContractsService {
    type Abi = contracts::ContractsAbi;
}

impl Service for ContractsService {
    type Parameters = CasinoParams;  // Application Parameters

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = ContractsState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        ContractsService {
            state: Arc::new(Mutex::new(state)),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        Schema::build(
            QueryRoot { 
                state: self.state.clone(),
                runtime: self.runtime.clone(),
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
    state: Arc<Mutex<ContractsState>>,
    runtime: Arc<ServiceRuntime<ContractsService>>,
}

#[Object]
impl QueryRoot {
    /// Get the Bank chain ID from application parameters
    async fn bank_chain_id(&self) -> String {
        let params = self.runtime.application_parameters();
        params.bank_chain_id.to_string()
    }
    
    /// Whether this chain is the Bank chain
    async fn is_bank(&self) -> bool {
        let params = self.runtime.application_parameters();
        let current_chain = self.runtime.chain_id();
        current_chain == params.bank_chain_id
    }
    
    /// Default chip amount for faucet
    async fn default_buy_in(&self) -> u64 {
        let state = self.state.lock().await;
        *state.default_buy_in.get()
    }
    
    /// House balance (only relevant on Bank chain)
    async fn house_balance(&self) -> u64 {
        let state = self.state.lock().await;
        *state.house_balance.get()
    }
    
    /// Player's chip balance
    async fn player_balance(&self) -> u64 {
        let state = self.state.lock().await;
        *state.player_balance.get()
    }
    
    /// Current active game (if any)
    async fn current_game(&self) -> Option<CurrentGameObject> {
        let state = self.state.lock().await;
        state.current_game.get().as_ref().map(|g| CurrentGameObject::from(g.clone()))
    }
    
    /// Game history
    async fn game_history(&self) -> Vec<GameRecordObject> {
        let state = self.state.lock().await;
        let count = state.game_history.count();
        let mut history = Vec::new();
        for i in 0..count {
            if let Ok(Some(record)) = state.game_history.get(i).await {
                history.push(GameRecordObject::from(record));
            }
        }
        history
    }
    
    /// Allowed bet amounts
    async fn allowed_bets(&self) -> Vec<u64> {
        ALLOWED_BETS.to_vec()
    }

    /// Pending roulette game (if any) - for immediate result display
    async fn pending_roulette(&self) -> Option<PendingRouletteObject> {
        let state = self.state.lock().await;
        state.pending_roulette.get().as_ref().map(|g| PendingRouletteObject::from(g.clone()))
    }
}

// ============================================================================
// GraphQL Response Types
// ============================================================================

#[derive(SimpleObject)]
struct CurrentGameObject {
    game_id: u64,
    seed: u64,
    bet: u64,
    game_type: GameType,
    phase: GamePhase,
    player_hand: Vec<CardObject>,
    dealer_hand: Vec<CardObject>,
    player_value: u8,
    dealer_value: u8,
}

impl From<ActiveGame> for CurrentGameObject {
    fn from(g: ActiveGame) -> Self {
        let player_value = calculate_hand_value(&g.player_hand);
        let dealer_value = calculate_hand_value(&g.dealer_hand);
        CurrentGameObject {
            game_id: g.game_id,
            seed: g.seed,
            bet: g.bet,
            game_type: g.game_type,
            phase: g.phase,
            player_hand: g.player_hand.into_iter().map(CardObject::from).collect(),
            dealer_hand: g.dealer_hand.into_iter().map(CardObject::from).collect(),
            player_value,
            dealer_value,
        }
    }
}

#[derive(SimpleObject)]
struct CardObject {
    suit: String,
    value: String,
    id: String,
}

impl From<Card> for CardObject {
    fn from(c: Card) -> Self {
        CardObject {
            suit: c.suit,
            value: c.value,
            id: c.id,
        }
    }
}

#[derive(SimpleObject)]
struct GameRecordObject {
    game_id: u64,
    game_type: GameType,
    player_hand: Vec<CardObject>,
    dealer_hand: Vec<CardObject>,
    bet: u64,
    result: GameResult,
    payout: u64,
    timestamp: u64,
    roulette_bets: Option<Vec<RouletteBetObject>>,
    roulette_outcome: Option<u8>,
}

#[derive(SimpleObject)]
struct RouletteBetObject {
    bet_type: RouletteBetType,
    number: Option<u8>,
    numbers: Option<Vec<u8>>,
    amount: u64,
}

impl From<RouletteBet> for RouletteBetObject {
    fn from(b: RouletteBet) -> Self {
        RouletteBetObject {
            bet_type: b.bet_type,
            number: b.number,
            numbers: b.numbers,
            amount: b.amount,
        }
    }
}

#[derive(SimpleObject)]
struct PendingRouletteObject {
    game_id: u64,
    seed: u64,
    outcome: u8,
    bets: Vec<RouletteBetObject>,
}

impl From<PendingRouletteGame> for PendingRouletteObject {
    fn from(g: PendingRouletteGame) -> Self {
        PendingRouletteObject {
            game_id: g.game_id,
            seed: g.seed,
            outcome: g.outcome,
            bets: g.bets.into_iter().map(RouletteBetObject::from).collect(),
        }
    }
}

impl From<GameRecord> for GameRecordObject {
    fn from(r: GameRecord) -> Self {
        GameRecordObject {
            game_id: r.game_id,
            game_type: r.game_type,
            player_hand: r.player_hand.into_iter().map(CardObject::from).collect(),
            dealer_hand: r.dealer_hand.into_iter().map(CardObject::from).collect(),
            bet: r.bet,
            result: r.result,
            payout: r.payout,
            timestamp: r.timestamp,
            roulette_bets: r.roulette_bets.map(|bets| bets.into_iter().map(RouletteBetObject::from).collect()),
            roulette_outcome: r.roulette_outcome,
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

fn calculate_hand_value(cards: &[Card]) -> u8 {
    let mut total = 0u8;
    let mut aces = 0u8;

    for card in cards {
        match card.value.as_str() {
            "ace" => {
                aces += 1;
                total = total.saturating_add(11);
            }
            "king" | "queen" | "jack" => total = total.saturating_add(10),
            value => {
                let parsed = value.parse::<u8>().unwrap_or(0);
                total = total.saturating_add(parsed);
            }
        }
    }

    while total > 21 && aces > 0 {
        total -= 10;
        aces -= 1;
    }

    total
}
