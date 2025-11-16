use async_graphql::Enum;
use linera_sdk::views::{linera_views, RegisterView, RootView, ViewStorageContext};
use baccarat::BetType;

#[derive(RootView, async_graphql::SimpleObject)]
#[view(context = ViewStorageContext)]
pub struct BaccaratState {
    pub deck: RegisterView<Vec<Card>>,
    pub player_hand: RegisterView<Vec<Card>>,
    pub banker_hand: RegisterView<Vec<Card>>,
    pub player_balance: RegisterView<u64>,
    pub current_bet: RegisterView<u64>,
    pub current_bet_type: RegisterView<Option<BetType>>,
    pub last_result: RegisterView<Option<RoundResult>>,
    pub random_seed: RegisterView<u64>,
    pub num_decks: RegisterView<u8>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq, async_graphql::SimpleObject)]
pub struct Card {
    pub suit: String,
    pub value: String,
    pub id: String,
    pub point_value: u8,
}

impl Card {
    pub fn new(suit: &str, value: &str, id_suffix: &str) -> Self {
        let point_value = match value {
            "ace" => 1,
            "2" => 2,
            "3" => 3,
            "4" => 4,
            "5" => 5,
            "6" => 6,
            "7" => 7,
            "8" => 8,
            "9" => 9,
            // 10 / J / Q / K are 0 in Baccarat
            _ => 0,
        };
        let id = format!("{}_of_{}{}", value, suit, id_suffix);
        Self {
            suit: suit.to_string(),
            value: value.to_string(),
            id,
            point_value,
        }
    }
}

// Phase tracking can be added later if needed.

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, async_graphql::SimpleObject)]
pub struct RoundResult {
    pub player_value: u8,
    pub banker_value: u8,
    pub winner: Winner,
    pub is_natural: bool,
    pub player_third_card_value: Option<u8>,
    pub banker_drew_third_card: bool,
    /// True if a non-tie bet was pushed due to tie.
    pub pushed: bool,
    /// Net profit relative to the placed bet, signed. Uses integer math (no decimals).
    pub net_profit: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize, Enum)]
pub enum Winner {
    Player,
    Banker,
    Tie,
}
