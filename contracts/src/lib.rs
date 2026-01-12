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

    /// Play Roulette with a list of bets
    PlayRoulette { bets: Vec<RouletteBet> },

    /// Report Roulette result for Bank verification
    ReportRouletteResult { game_id: u64, claimed_outcome: u8 },

    /// Start a Baccarat game
    PlayBaccarat { amount: u64, bet_type: BaccaratBetType },
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

    /// Request a Roulette game (player sends bets, bank returns seed)
    RequestRouletteGame {
        player: AccountOwner,
        player_chain: ChainId,
        bets: Vec<RouletteBet>,
    },

    /// Report roulette result for verification (bank uses stored data for player info)
    ReportRouletteResult {
        game_id: u64,
        claimed_outcome: u8,
    },

    /// Request a Baccarat game
    RequestBaccaratGame {
        player: AccountOwner,
        player_chain: ChainId,
        amount: u64,
        bet_type: BaccaratBetType,
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

    /// Roulette game ready - here's your seed
    RouletteGameReady {
        game_id: u64,
        seed: u64,
        bets: Vec<RouletteBet>,
    },

    /// Roulette game settled after verification
    RouletteSettled {
        game_id: u64,
        outcome: u8,
        payout: u64,
        bets: Vec<RouletteBet>,
    },

    /// Baccarat game settled
    BaccaratSettled {
        game_id: u64,
        winner: BaccaratBetType,
        payout: u64,
        player_hand: Vec<Card>,
        banker_hand: Vec<Card>,
        player_score: u8,
        banker_score: u8,
        bet_amount: u64,
        bet_type: BaccaratBetType,
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
    pub number: Option<u8>,           // For single number bets
    pub numbers: Option<Vec<u8>>,     // For split/street/corner bets
    pub amount: u64,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Enum, PartialEq, Eq)]
pub enum RouletteBetType {
    Number,      // Single number (35:1)
    Split,       // 2 adjacent numbers (17:1)
    Street,      // 3 numbers in a row (11:1)
    Corner,      // 4 numbers (8:1)
    Line,        // 6 numbers (2 rows) (5:1)
    Basket,      // First Four: 0, 1, 2, 3 (6:1)
    Red,         // Red numbers (1:1)
    Black,       // Black numbers (1:1)
    Even,        // Even numbers (1:1)
    Odd,         // Odd numbers (1:1)
    Low,         // 1-18 (1:1)
    High,        // 19-36 (1:1)
    Dozen1,      // 1-12 (2:1)
    Dozen2,      // 13-24 (2:1)
    Dozen3,      // 25-36 (2:1)
    Column1,     // Column 1 (3,6,9...) (2:1)
    Column2,     // Column 2 (2,5,8...) (2:1)
    Column3,     // Column 3 (1,4,7...) (2:1)
}
