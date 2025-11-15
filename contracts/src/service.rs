#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema};
use linera_sdk::{
    graphql::GraphQLMutationRoot, linera_base_types::WithServiceAbi, views::View, Service,
    ServiceRuntime,
};

use contracts::Operation;

use self::state::{Card, ContractsState, GamePhase, GameRecord, GameResult, ALLOWED_BETS};

pub struct ContractsService {
    state: ContractsState,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(ContractsService);

impl WithServiceAbi for ContractsService {
    type Abi = contracts::ContractsAbi;
}

impl Service for ContractsService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = ContractsState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        ContractsService {
            state,
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        // snapshot values for the query root
        let mut history: Vec<GameRecord> = Vec::new();
        let count = self.state.game_history.count();
        for i in 0..count {
            if let Some(record) = self.state.game_history.get(i).await.ok().flatten() {
                history.push(record);
            }
        }
        let data = QueryData {
            player_balance: *self.state.player_balance.get(),
            current_bet: *self.state.current_bet.get(),
            phase: *self.state.phase.get(),
            last_result: *self.state.last_result.get(),
            player_hand: self.state.player_hand.get().clone(),
            dealer_hand: self.state.dealer_hand.get().clone(),
            allowed_bets: ALLOWED_BETS.to_vec(),
            default_buy_in: *self.state.default_buy_in.get(),
            round_start_time: *self.state.round_start_time.get(),
            game_history: history,
        };

        Schema::build(
            QueryRoot { data },
            Operation::mutation_root(self.runtime.clone()),
            EmptySubscription,
        )
        .finish()
        .execute(query)
        .await
    }
}

#[derive(Clone)]
struct QueryData {
    player_balance: u64,
    current_bet: u64,
    phase: GamePhase,
    last_result: Option<GameResult>,
    player_hand: Vec<Card>,
    dealer_hand: Vec<Card>,
    allowed_bets: Vec<u64>,
    default_buy_in: u64,
    round_start_time: u64,
    game_history: Vec<GameRecord>,
}

struct QueryRoot {
    data: QueryData,
}

#[Object]
impl QueryRoot {
    /// Current player balance
    async fn balance(&self) -> u64 {
        self.data.player_balance
    }

    /// Current bet
    async fn currentBet(&self) -> u64 {
        self.data.current_bet
    }

    /// Allowed bet sizes
    async fn allowedBets(&self) -> Vec<u64> {
        self.data.allowed_bets.clone()
    }

    /// Default buy-in configured at instantiate
    async fn defaultBuyIn(&self) -> u64 {
        self.data.default_buy_in
    }

    /// Current game phase
    async fn phase(&self) -> GamePhase {
        self.data.phase
    }

    /// Last round result if any
    async fn lastResult(&self) -> Option<GameResult> {
        self.data.last_result
    }

    /// Player hand (array of cards)
    async fn playerHand(&self) -> Vec<Card> {
        self.data.player_hand.clone()
    }

    /// Dealer hand (array of cards) - hole card hidden during player turn
    async fn dealerHand(&self) -> Vec<Card> {
        self.data.dealer_hand.clone()
    }

    /// Round start time in microseconds (0 if no active round)
    async fn roundStartTime(&self) -> u64 {
        self.data.round_start_time
    }

    /// Game history (all completed games)
    async fn gameHistory(&self) -> Vec<GameRecord> {
        self.data.game_history.clone()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_graphql::{Request, Value};
    use futures::FutureExt as _;
    use linera_sdk::{util::BlockingWait, views::View, Service, ServiceRuntime};

    use super::{ContractsService, ContractsState};

    #[test]
    fn query_root_basics() {
        let runtime = Arc::new(ServiceRuntime::<ContractsService>::new());
        let mut state = ContractsState::load(runtime.root_view_storage_context())
            .blocking_wait()
            .expect("Failed to read from mock key value store");

        state.player_balance.set(42);
        state.current_bet.set(3);

        let service = ContractsService { state, runtime };
        let request = Request::new("{ balance currentBet allowedBets }");

        let response = service
            .handle_query(request)
            .now_or_never()
            .expect("Query should not await anything");

        let data = response.data.into_json().unwrap();
        assert_eq!(data["balance"], Value::from(42u64));
        assert_eq!(data["currentBet"], Value::from(3u64));
    }
}
