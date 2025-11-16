#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema};
use linera_sdk::{
    graphql::GraphQLMutationRoot, linera_base_types::WithServiceAbi, views::View, Service,
    ServiceRuntime,
};

use roulette::{Bet, Operation};

use self::state::{RouletteState, SpinResult, GameRecord};

pub struct RouletteService {
    state: RouletteState,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(RouletteService);

impl WithServiceAbi for RouletteService {
    type Abi = roulette::RouletteAbi;
}

impl Service for RouletteService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = RouletteState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        RouletteService {
            state,
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        Schema::build(
            QueryRoot {
                player_balance: *self.state.player_balance.get(),
                current_bets: self.state.current_bets.get().clone(),
                last_result: self.state.last_result.get().clone(),
                game_history: {
                    let mut history = Vec::new();
                    let count = self.state.game_history.count();
                    for i in 0..count {
                        if let Ok(Some(record)) = self.state.game_history.get(i).await {
                            history.push(record);
                        }
                    }
                    history
                },
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
    player_balance: u64,
    current_bets: Vec<Bet>,
    last_result: Option<SpinResult>,
    game_history: Vec<GameRecord>,
}

#[Object]
impl QueryRoot {
    async fn player_balance(&self) -> u64 {
        self.player_balance
    }

    async fn current_bets(&self) -> &Vec<Bet> {
        &self.current_bets
    }

    async fn last_result(&self) -> &Option<SpinResult> {
        &self.last_result
    }

    async fn game_history(&self) -> &Vec<GameRecord> {
        &self.game_history
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_graphql::{Request, Response, Value};
    use futures::FutureExt as _;
    use linera_sdk::{util::BlockingWait, views::View, Service, ServiceRuntime};
    use serde_json::json;

    use super::{RouletteService, RouletteState};

    #[test]
    fn query_balance() {
        let balance = 1000u64;
        let runtime = Arc::new(ServiceRuntime::<RouletteService>::new());
        let mut state = RouletteState::load(runtime.root_view_storage_context())
            .blocking_wait()
            .expect("Failed to read from mock key value store");
        state.player_balance.set(balance);
        state.current_bets.set(Vec::new());
        state.last_result.set(None);

        let service = RouletteService { state, runtime };
        let request = Request::new("{ playerBalance }");

        let response = service
            .handle_query(request)
            .now_or_never()
            .expect("Query should not await anything");

        let expected = Response::new(Value::from_json(json!({"playerBalance": 1000})).unwrap());

        assert_eq!(response, expected)
    }
}
