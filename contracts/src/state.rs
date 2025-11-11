use async_graphql::{Enum, SimpleObject};
use linera_sdk::views::{linera_views, RegisterView, RootView, ViewStorageContext};
use serde::{Deserialize, Serialize};

pub const ALLOWED_BETS: [u64; 5] = [1, 2, 3, 4, 5];

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct ContractsState {
    pub deck: RegisterView<Vec<Card>>,
    pub player_hand: RegisterView<Vec<Card>>,
    pub dealer_hand: RegisterView<Vec<Card>>,
    pub player_balance: RegisterView<u64>,
    pub current_bet: RegisterView<u64>,
    pub phase: RegisterView<GamePhase>,
    pub last_result: RegisterView<Option<GameResult>>,
    pub default_buy_in: RegisterView<u64>,
    pub random_seed: RegisterView<u64>,
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
