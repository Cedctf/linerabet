use async_graphql::{Request, Response, SimpleObject};
use linera_base::identifiers::AccountOwner;
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{ContractAbi, ServiceAbi},
};
use serde::{Deserialize, Serialize};

pub struct SmartcontractAbi;

impl ContractAbi for SmartcontractAbi {
    type Operation = Operation;
    type Response = ContractResponse;
}

impl ServiceAbi for SmartcontractAbi {
    type Query = Request;
    type QueryResponse = Response;
}

pub type GameId = u64;

#[derive(Debug, Deserialize, Serialize, GraphQLMutationRoot)]
pub enum Operation {
    /// Dealer creates a new blackjack table.
    CreateGame {
        max_players: u8,
        min_bet: u64,
        allow_mid_join: bool,
        vrf_public_key: Vec<u8>,
        round_timeout: Option<u64>,
    },
    /// Player joins by locking their commitment hash.
    JoinGame {
        game_id: GameId,
        bet: u64,
        commitment: Vec<u8>,
    },
    /// Player reveals previously committed secret entropy.
    RevealCommitment {
        game_id: GameId,
        secret: Vec<u8>,
    },
    /// Authorized VRF operator submits randomness with proof.
    SubmitVrf {
        game_id: GameId,
        output: Vec<u8>,
        proof: Vec<u8>,
        message: Vec<u8>,
    },
    /// Deterministically deals cards once entropy is in place.
    DealInitialHands {
        game_id: GameId,
    },
    /// Active player issues a move.
    PlayerAction {
        game_id: GameId,
        action: PlayerActionKind,
    },
    /// Runs automatic dealer logic and final settlement.
    ResolveDealer {
        game_id: GameId,
    },
    /// Dealer (or governance) can cancel an idle game.
    CancelGame {
        game_id: GameId,
    },
}

#[derive(Debug, Deserialize, Serialize)]
pub enum ContractResponse {
    GameCreated { game_id: GameId },
    PlayerState { status: PlayerStatus },
    GameSettled { game_id: GameId },
    Acknowledged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConfig {
    pub dealer: AccountOwner,
    pub max_players: u8,
    pub min_bet: u64,
    pub vrf_public_key: Vec<u8>,
    pub allow_mid_join: bool,
    pub round_timeout: Option<u64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, async_graphql::Enum)]
pub enum GamePhase {
    Lobby,
    Reveal,
    AwaitingVrf,
    ReadyToDeal,
    PlayerTurns,
    DealerTurn,
    Settled,
    Cancelled,
}

impl Default for GamePhase {
    fn default() -> Self {
        GamePhase::Lobby
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, async_graphql::Enum)]
pub enum PlayerStatus {
    Pending,
    Active,
    Stood,
    Busted,
    Blackjack,
    Settled,
}

impl Default for PlayerStatus {
    fn default() -> Self {
        PlayerStatus::Pending
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, async_graphql::Enum)]
pub enum PlayerActionKind {
    Hit,
    Stand,
    DoubleDown,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct RoundOutcome {
    pub final_value: u8,
    pub dealer_value: u8,
    /// Multiplier expressed in percentage points (e.g., 100 = 1x bet, -100 = loss).
    pub win_multiplier: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct Card {
    pub rank: u8,
    pub suit: u8,
}

impl Card {
    pub const RANKS: u8 = 13;

    pub fn from_index(index: u8) -> Self {
        let rank = index % Self::RANKS;
        let suit = index / Self::RANKS;
        Self { rank, suit }
    }

    pub fn to_index(&self) -> u8 {
        self.suit * Self::RANKS + self.rank
    }

    pub fn blackjack_value(&self) -> u8 {
        match self.rank {
            0 => 11,            // Ace
            10 | 11 | 12 => 10, // Face cards
            _ => self.rank + 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VrfRecord {
    pub provider: AccountOwner,
    pub public_key: Vec<u8>,
    pub output: [u8; 32],
    pub proof: Vec<u8>,
    pub message: Vec<u8>,
}
