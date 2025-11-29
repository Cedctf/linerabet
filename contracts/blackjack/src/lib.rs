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
    /// Reset the game state to WaitingForBet.
    Reset,
    /// Lock in the bet and start the game (deal cards). Starts a 20-second player turn timer.
    StartGame { bet: u64 },
    /// Request one additional card for the player. Resets the 20-second timer. Auto-stands if timer expires.
    Hit,
    /// Stop drawing player cards and let the dealer resolve the round.
    /// Stop drawing player cards and let the dealer resolve the round.
    Stand,
    /// Request chips to reset balance to 100 (Testnet Faucet).
    RequestChips,
}
