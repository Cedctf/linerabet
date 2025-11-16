use async_graphql::{Request, Response, Enum};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{ContractAbi, ServiceAbi},
};
use serde::{Deserialize, Serialize};

pub struct BaccaratAbi;

impl ContractAbi for BaccaratAbi {
    type Operation = Operation;
    type Response = ();
}

impl ServiceAbi for BaccaratAbi {
    type Query = Request;
    type QueryResponse = Response;
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct BaccaratInit {
    /// Starting balance for the chain owner at application instantiation.
    pub starting_balance: u64,
    /// Seed for deterministic shuffling.
    pub random_seed: u64,
    /// Number of 52-card decks to use in the shoe (typical: 6 or 8). 0 => default (6).
    pub num_decks: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize, Enum)]
pub enum BetType {
    Player,
    Banker,
    Tie,
}

#[derive(Debug, Deserialize, Serialize, GraphQLMutationRoot)]
pub enum Operation {
    /// Place a bet and resolve a complete Baccarat round.
    PlaceBetAndDeal { bet: u64, bet_type: BetType },
    /// Clear table data after a round is complete.
    ResetRound,
}
