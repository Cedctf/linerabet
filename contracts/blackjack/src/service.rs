#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema, SimpleObject};
use futures::lock::Mutex;
use linera_base::identifiers::AccountOwner as Owner;
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::WithServiceAbi,
    views::View,
    Service, ServiceRuntime,
};

use contracts::Operation;

use self::state::{Card, ContractsState, GamePhase, GameRecord, GameResult, ALLOWED_BETS};

pub struct ContractsService {
    state: Arc<Mutex<ContractsState>>,
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
            state: Arc::new(Mutex::new(state)),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        Schema::build(
            QueryRoot { state: self.state.clone() },
            Operation::mutation_root(self.runtime.clone()),
            EmptySubscription,
        )
        .finish()
        .execute(query)
        .await
    }
}

struct QueryRoot {
    state: Arc<Mutex<ContractsState>>,
}

#[Object]
impl QueryRoot {
    async fn default_buy_in(&self) -> u64 {
        let state = self.state.lock().await;
        *state.default_buy_in.get()
    }

    async fn player(&self, owner: Owner) -> Option<PlayerStateObject> {
        let mut state = self.state.lock().await;
        let player_view = state.players.load_entry_mut(&owner).await.ok()?;
        
        let mut history: Vec<GameRecord> = Vec::new();
        let count = player_view.game_history.count();
        for i in 0..count {
            if let Some(record) = player_view.game_history.get(i).await.ok().flatten() {
                history.push(record);
            }
        }

        Some(PlayerStateObject {
            player_balance: *player_view.player_balance.get(),
            current_bet: *player_view.current_bet.get(),
            phase: *player_view.phase.get(),
            last_result: *player_view.last_result.get(),
            player_hand: player_view.player_hand.get().clone(),
            dealer_hand: player_view.dealer_hand.get().clone(),
            allowed_bets: ALLOWED_BETS.to_vec(),
            game_history: history,
        })
    }
}

#[derive(SimpleObject)]
struct PlayerStateObject {
    player_balance: u64,
    current_bet: u64,
    phase: GamePhase,
    last_result: Option<GameResult>,
    player_hand: Vec<Card>,
    dealer_hand: Vec<Card>,
    allowed_bets: Vec<u64>,
    game_history: Vec<GameRecord>,
}

#[cfg(test)]
mod tests {
    // Tests removed for brevity
}
