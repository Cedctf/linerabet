use std::collections::BTreeMap;

use linera_base::identifiers::AccountOwner;
use linera_sdk::views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext};
use smartcontract::{
    Card, GameConfig, GameId, GamePhase, PlayerActionKind, PlayerStatus, RoundOutcome, VrfRecord,
};
use serde::{Deserialize, Serialize};

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct SmartcontractState {
    #[view(with = "MapView")]
    pub games: MapView<GameId, GameData>,
    pub next_game_id: RegisterView<GameId>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct GameData {
    pub config: GameConfig,
    pub phase: GamePhase,
    pub players: BTreeMap<AccountOwner, PlayerData>,
    pub join_sequence: Vec<AccountOwner>,
    pub turn_order: Vec<AccountOwner>,
    pub dealer_hand: Vec<Card>,
    pub deck: Vec<Card>,
    pub combined_entropy: Option<[u8; 32]>,
    pub vrf: Option<VrfRecord>,
    pub last_updated_at: u64,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct PlayerData {
    pub bet: u64,
    pub commitment: [u8; 32],
    pub revealed_entropy: Option<[u8; 32]>,
    pub hand: Vec<Card>,
    pub status: PlayerStatus,
    pub last_action: Option<PlayerActionKind>,
    pub result: Option<RoundOutcome>,
}
