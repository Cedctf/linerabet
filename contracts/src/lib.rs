use async_graphql::{Enum, InputObject, Request, Response, SimpleObject};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{AccountOwner, ChainId, ContractAbi, ServiceAbi},
};
use serde::{Deserialize, Serialize};

pub struct ContractsAbi;

impl ContractAbi for ContractsAbi {
    type Operation = Operation;
    type Response = ();
}

impl ServiceAbi for ContractsAbi {
    type Query = Request;
    type QueryResponse = Response;
}

// ============================================================================
// APPLICATION PARAMETERS (shared across ALL chains - set at deploy time)
// ============================================================================

/// Parameters set during `publish-and-create`, shared across all chains.
/// This is the key to multi-chain apps: every chain gets the same bank_chain_id.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CasinoParams {
    /// The Bank chain ID where game verification happens.
    /// All player chains will send messages to this chain.
    pub bank_chain_id: ChainId,
}

// ============================================================================
// INSTANTIATION ARGUMENT (per-chain state initialization)
// ============================================================================

/// Initialization argument for each chain instance.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct CasinoInit {
    /// Starting balance for new players (chips from faucet)
    pub starting_balance: u64,
    /// Master seed for RNG (only used on Bank chain)
    pub random_seed: u64,
}

// ============================================================================
// OPERATIONS (user-triggered on their own chain)
// ============================================================================

#[derive(Debug, Deserialize, Serialize, GraphQLMutationRoot)]
pub enum Operation {
    /// Request chips from the Bank (testnet faucet)
    RequestChips,
    
    /// Start a Blackjack game with given bet (sends escrow to Bank)
    PlayBlackjack { bet: u64 },
    
    /// Hit - draw another card (local computation, then reports to Bank if bust)
    Hit,
    
    /// Stand - finish turn (sends result to Bank for verification)
    Stand,
    
    /// Double Down - double bet, take one card, then stand (only on first 2 cards)
    DoubleDown,
}

// ============================================================================
// MESSAGES (cross-chain communication)
// ============================================================================

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum Message {
    // ─────────────────────────────────────────────────────────────────────────
    // Player → Bank
    // ─────────────────────────────────────────────────────────────────────────
    
    /// Request chips (testnet faucet)
    RequestChips {
        player: AccountOwner,
        player_chain: ChainId,
    },
    
    /// Start a game with escrowed bet
    RequestGame {
        player: AccountOwner,
        player_chain: ChainId,
        game_type: GameType,
        bet: u64,
    },
    
    /// Report game result for verification
    ReportResult {
        game_id: u64,
        player: AccountOwner,
        actions: Vec<GameAction>,
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // Bank → Player
    // ─────────────────────────────────────────────────────────────────────────
    
    /// Chips granted from faucet
    ChipsGranted {
        player: AccountOwner,
        amount: u64,
    },
    
    /// Game ready - here's your seed
    GameReady {
        game_id: u64,
        seed: u64,
        bet: u64,
    },
    
    /// Game settled after verification
    GameSettled {
        game_id: u64,
        result: GameResult,
        payout: u64,
        dealer_hand: Vec<Card>, // Full dealer hand after hitting
    },
}

// ============================================================================
// GAME TYPES
// ============================================================================

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Enum, PartialEq, Eq)]
pub enum GameType {
    Blackjack,
    Roulette,
    Baccarat,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Enum, PartialEq, Eq)]
pub enum GameAction {
    Hit,
    Stand,
    DoubleDown,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Enum, PartialEq, Eq)]
pub enum GameResult {
    PlayerBlackjack,
    PlayerWin,
    DealerWin,
    PlayerBust,
    DealerBust,
    Push,
}

// ============================================================================
// CARD TYPES (shared between chains)
// ============================================================================

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

// ============================================================================
// LEGACY TYPES (for roulette/baccarat - to be migrated later)
// ============================================================================

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Enum, PartialEq, Eq)]
pub enum BaccaratBetType {
    Player,
    Banker,
    Tie,
}

#[derive(Clone, Debug, Deserialize, Serialize, InputObject)]
pub struct RouletteBet {
    pub bet_type: RouletteBetType,
    pub number: Option<u8>,
    pub amount: u64,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Enum, PartialEq, Eq)]
pub enum RouletteBetType {
    Number,
    Red,
    Black,
    Even,
    Odd,
    Low,
    High,
}
