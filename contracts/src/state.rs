use async_graphql::Enum;
use linera_sdk::views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext, LogView};
use serde::{Deserialize, Serialize};
use linera_base::identifiers::{AccountOwner as Owner, ChainId};

use contracts::{Card, GameAction, GameResult, GameType};

pub const ALLOWED_BETS: [u64; 5] = [1, 2, 3, 4, 5];

// ============================================================================
// MAIN CONTRACT STATE
// ============================================================================

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct ContractsState {
    // Note: bank_chain_id is now in Application Parameters, not state!
    // Access via runtime.application_parameters().bank_chain_id
    
    /// Master seed for RNG (Bank uses this)
    pub master_seed: RegisterView<u64>,
    
    /// Default chip amount for faucet
    pub default_buy_in: RegisterView<u64>,
    
    // ─────────────────────────────────────────────────────────────────────────
    // Bank chain state (used when this chain == bank_chain_id from params)
    // ─────────────────────────────────────────────────────────────────────────
    
    /// House balance (chips available for payouts)
    pub house_balance: RegisterView<u64>,
    
    /// Pending games awaiting player actions or verification
    pub pending_games: MapView<u64, PendingGame>,
    
    /// Counter for generating unique game IDs
    pub game_counter: RegisterView<u64>,
    
    // ─────────────────────────────────────────────────────────────────────────
    // Player chain state (used when this chain != bank_chain_id from params)
    // ─────────────────────────────────────────────────────────────────────────
    
    /// Player's chip balance
    pub player_balance: RegisterView<u64>,
    
    /// Current active game (if any)
    pub current_game: RegisterView<Option<ActiveGame>>,
    
    /// Game history for UI
    pub game_history: LogView<GameRecord>,
}

// ============================================================================
// BANK-SIDE TYPES
// ============================================================================

/// Game pending verification on Bank chain
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PendingGame {
    pub player: Owner,
    pub player_chain: ChainId,
    pub game_type: GameType,
    pub bet: u64,
    pub seed: u64,
    pub created_at: u64,
}

// ============================================================================
// PLAYER-SIDE TYPES
// ============================================================================

/// Active game being played on Player chain
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActiveGame {
    pub game_id: u64,
    pub seed: u64,
    pub bet: u64,
    pub game_type: GameType,
    /// Current phase of the game
    pub phase: GamePhase,
    /// Player's cards
    pub player_hand: Vec<Card>,
    /// Dealer's visible cards (hole card hidden during PlayerTurn)
    pub dealer_hand: Vec<Card>,
    /// Dealer's hole card (revealed on Stand)
    pub dealer_hole_card: Option<Card>,
    /// Remaining deck
    pub deck: Vec<Card>,
    /// Actions taken (for reporting to Bank)
    pub actions: Vec<GameAction>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum GamePhase {
    #[default]
    WaitingForGame,
    PlayerTurn,
    DealerTurn,
    RoundComplete,
}

// ============================================================================
// HISTORY TYPES
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GameRecord {
    pub game_id: u64,
    pub game_type: GameType,
    pub player_hand: Vec<Card>,
    pub dealer_hand: Vec<Card>,
    pub bet: u64,
    pub result: GameResult,
    pub payout: u64,
    pub timestamp: u64,
}
