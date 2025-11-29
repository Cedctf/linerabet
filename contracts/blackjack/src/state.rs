use async_graphql::{Enum, SimpleObject};
use linera_sdk::views::{linera_views, CollectionView, LogView, RegisterView, RootView, ViewStorageContext};
use serde::{Deserialize, Serialize};

pub const ALLOWED_BETS: [u64; 5] = [1, 2, 3, 4, 5];
pub const PLAYER_TURN_TIMER_SECONDS: u64 = 20;

use linera_base::identifiers::AccountOwner as Owner;

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct ContractsState {
    pub players: CollectionView<Owner, PlayerStateView>,
    pub default_buy_in: RegisterView<u64>,
    pub master_seed: RegisterView<u64>,
}

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct PlayerStateView {
    pub deck: RegisterView<Vec<Card>>,
    pub player_hand: RegisterView<Vec<Card>>,
    pub dealer_hand: RegisterView<Vec<Card>>,
    pub dealer_hole_card: RegisterView<Option<Card>>,
    pub player_balance: RegisterView<u64>,
    pub current_bet: RegisterView<u64>,
    pub phase: RegisterView<GamePhase>,
    pub last_result: RegisterView<Option<GameResult>>,
    pub random_seed: RegisterView<u64>,
    pub round_start_time: RegisterView<u64>,
    pub game_history: LogView<GameRecord>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, SimpleObject)]
pub struct Card {
    pub suit: String,
    pub value: String,
    pub id: String,
}

impl Card {
    pub fn new(suit: &str, value: &str) -> Self {
        let id = format!("{}_of_{}", value, suit);
        Self {
            suit: suit.to_string(),
            value: value.to_string(),
            id,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum GamePhase {
    #[default]
    WaitingForBet,
    BettingPhase,
    PlayerTurn,
    DealerTurn,
    RoundComplete,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum GameResult {
    PlayerBlackjack,
    PlayerWin,
    DealerWin,
    PlayerBust,
    DealerBust,
    Push,
}

#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject)]
pub struct GameRecord {
    pub player_hand: Vec<Card>,
    pub dealer_hand: Vec<Card>,
    pub bet: u64,
    pub result: GameResult,
    pub payout: u64,
    pub timestamp: u64,
}
