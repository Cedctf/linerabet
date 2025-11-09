#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema};
use linera_sdk::{
    graphql::GraphQLMutationRoot, linera_base_types::WithServiceAbi, views::View, Service,
    ServiceRuntime,
};

use smartcontract::Operation;

use self::state::SmartcontractState;

pub struct SmartcontractService {
    state: SmartcontractState,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(SmartcontractService);

impl WithServiceAbi for SmartcontractService {
    type Abi = smartcontract::SmartcontractAbi;
}

impl Service for SmartcontractService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = SmartcontractState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        SmartcontractService {
            state,
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        Schema::build(
            QueryRoot {
                value: *self.state.value.get(),
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
    value: u64,
}

#[Object]
impl QueryRoot {
    async fn value(&self) -> &u64 {
        &self.value
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_graphql::{Request, Response, Value};
    use futures::FutureExt as _;
    use linera_sdk::{util::BlockingWait, views::View, Service, ServiceRuntime};
    use serde_json::json;

    use super::{SmartcontractService, SmartcontractState};

    #[test]
    fn query() {
        let value = 60u64;
        let runtime = Arc::new(ServiceRuntime::<SmartcontractService>::new());
        let mut state = SmartcontractState::load(runtime.root_view_storage_context())
            .blocking_wait()
            .expect("Failed to read from mock key value store");
        state.value.set(value);

        let service = SmartcontractService { state, runtime };
        let request = Request::new("{ value }");

        let response = service
            .handle_query(request)
            .now_or_never()
            .expect("Query should not await anything");

        let expected = Response::new(Value::from_json(json!({"value": 60})).unwrap());

        assert_eq!(response, expected)
    }
}
