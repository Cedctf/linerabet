use async_graphql::{Request, Response, Enum, InputObject, SimpleObject};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{ContractAbi, ServiceAbi},
};
use serde::{Deserialize, Serialize};

pub struct RouletteAbi;

impl ContractAbi for RouletteAbi {
    type Operation = Operation;
    type Response = ();
}

impl ServiceAbi for RouletteAbi {
    type Query = Request;
    type QueryResponse = Response;
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RouletteInit {
    /// Starting balance for the chain owner at application instantiation.
    pub starting_balance: u64,
    /// Seed for deterministic random number generation.
    pub random_seed: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize, Enum)]
pub enum BetType {
    /// Straight up bet on a single number (0-36, 00)
    StraightUp,
    /// Red or Black
    Color,
    /// Odd or Even (excludes 0 and 00)
    Parity,
    /// High (19-36) or Low (1-18)
    Range,
    /// Dozens (1-12, 13-24, 25-36)
    Dozen,
    /// Columns (1st, 2nd, 3rd column)
    Column,
}

#[derive(Clone, Debug, Deserialize, Serialize, InputObject, SimpleObject)]
#[graphql(input_name = "BetInput")]
pub struct Bet {
    pub bet_type: BetType,
    pub amount: u64,
    /// For StraightUp: the number (0-36, or 37 for 00)
    /// For Color: 0 = Red, 1 = Black
    /// For Parity: 0 = Even, 1 = Odd
    /// For Range: 0 = Low (1-18), 1 = High (19-36)
    /// For Dozen: 0 = 1st (1-12), 1 = 2nd (13-24), 2 = 3rd (25-36)
    /// For Column: 0 = 1st column, 1 = 2nd column, 2 = 3rd column
    pub selection: u8,
}

#[derive(Debug, Deserialize, Serialize, GraphQLMutationRoot)]
pub enum Operation {
    /// Place multiple bets and spin the wheel
    PlaceBetsAndSpin { bets: Vec<Bet> },
    /// Reset the table for a new round
    ResetRound,
}
