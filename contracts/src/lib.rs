use async_graphql::{Request, Response};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{ContractAbi, ServiceAbi},
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

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct BlackjackInit {
    /// Starting balance credited to the chain owner when the application is instantiated.
    pub starting_balance: u64,
    /// Seed used for deterministic deck shuffling so tests remain reproducible.
    pub random_seed: u64,
}

#[derive(Debug, Deserialize, Serialize, GraphQLMutationRoot)]
pub enum Operation {
    /// Begin a new round by selecting a bet and dealing cards.
    StartRound { bet: u64 },
    /// Request one additional card for the player.
    Hit,
    /// Stop drawing player cards and let the dealer resolve the round.
    Stand,
    /// Clear the table once the round is over.
    ResetRound,
}
