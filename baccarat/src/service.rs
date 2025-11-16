#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema};
use linera_sdk::{
    graphql::GraphQLMutationRoot, linera_base_types::WithServiceAbi, views::View, Service,
    ServiceRuntime,
};

use baccarat::Operation;

use self::state::{BaccaratState, Card, RoundResult};

pub struct BaccaratService {
    state: BaccaratState,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(BaccaratService);

impl WithServiceAbi for BaccaratService {
    type Abi = baccarat::BaccaratAbi;
}

impl Service for BaccaratService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = BaccaratState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        BaccaratService {
            state,
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        Schema::build(
            QueryRoot {
                balance: *self.state.player_balance.get(),
                current_bet: *self.state.current_bet.get(),
                player_hand: self.state.player_hand.get().clone(),
                banker_hand: self.state.banker_hand.get().clone(),
                last_result: self.state.last_result.get().clone(),
            },
            Operation::mutation_root(self.runtime.clone()),
            EmptySubscription,
        )
        .finish()
        .execute(query)
        .await
    }
}

struct QueryRoot {
    balance: u64,
    current_bet: u64,
    player_hand: Vec<Card>,
    banker_hand: Vec<Card>,
    last_result: Option<RoundResult>,
}

#[Object]
impl QueryRoot {
    /// Current player balance
    async fn balance(&self) -> u64 {
        self.balance
    }

    /// Current bet
    async fn currentBet(&self) -> u64 {
        self.current_bet
    }

    /// Player hand
    async fn playerHand(&self) -> Vec<Card> {
        self.player_hand.clone()
    }

    /// Banker hand
    async fn bankerHand(&self) -> Vec<Card> {
        self.banker_hand.clone()
    }

    /// Last round result if any
    async fn lastResult(&self) -> Option<RoundResult> {
        self.last_result.clone()
    }
}

#[cfg(test)]
mod tests {}
