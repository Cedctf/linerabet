use async_graphql::SimpleObject;
use linera_sdk::views::{linera_views, LogView, RegisterView, RootView, ViewStorageContext};
use serde::{Deserialize, Serialize};
use roulette::{Bet, BetType};

#[derive(RootView, SimpleObject)]
#[view(context = ViewStorageContext)]
pub struct RouletteState {
    pub player_balance: RegisterView<u64>,
    pub current_bets: RegisterView<Vec<Bet>>,
    pub last_result: RegisterView<Option<SpinResult>>,
    pub random_seed: RegisterView<u64>,
    pub game_history: LogView<GameRecord>,
}

#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject)]
pub struct SpinResult {
    /// The winning number (0-36, or 37 for 00)
    pub winning_number: u8,
    /// Whether the number is red (true) or black (false). Green for 0/00.
    pub is_red: Option<bool>,
    /// Total amount won from all bets
    pub total_payout: u64,
    /// Individual bet results
    pub bet_results: Vec<BetResult>,
}

#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject)]
pub struct BetResult {
    pub bet: Bet,
    pub won: bool,
    pub payout: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject)]
pub struct GameRecord {
    pub bets: Vec<Bet>,
    pub spin_result: SpinResult,
    pub timestamp: u64,
}

// American roulette wheel layout
pub const ROULETTE_NUMBERS: [u8; 38] = [
    0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, // 37 represents 00
    27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

// Red numbers in American roulette  
pub const RED_NUMBERS: [u8; 18] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 28, 30, 32, 34];

pub fn is_red_number(number: u8) -> Option<bool> {
    if number == 0 || number == 37 { // 0 or 00
        None // Green
    } else if RED_NUMBERS.contains(&number) || number == 36 {
        Some(true) // Red (including 36)
    } else {
        Some(false) // Black
    }
}

pub fn get_payout_multiplier(bet_type: BetType) -> u64 {
    match bet_type {
        BetType::StraightUp => 35, // 35:1
        BetType::Color => 1,       // 1:1
        BetType::Parity => 1,      // 1:1
        BetType::Range => 1,       // 1:1
        BetType::Dozen => 2,       // 2:1
        BetType::Column => 2,      // 2:1
    }
}
