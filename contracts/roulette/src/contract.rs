#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    ensure,
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use roulette::{Bet, BetType, Operation, RouletteInit};

use self::state::{
    BetResult, GameRecord, RouletteState, SpinResult, ROULETTE_NUMBERS, 
    get_payout_multiplier, is_red_number
};

pub struct RouletteContract {
    state: RouletteState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(RouletteContract);

impl WithContractAbi for RouletteContract {
    type Abi = roulette::RouletteAbi;
}

impl Contract for RouletteContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = RouletteInit;
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = RouletteState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        RouletteContract { state, runtime }
    }

    async fn instantiate(&mut self, argument: Self::InstantiationArgument) {
        self.runtime.application_parameters();
        
        self.state.player_balance.set(argument.starting_balance);
        self.state.current_bets.set(Vec::new());
        self.state.last_result.set(None);
        self.state.random_seed.set(if argument.random_seed == 0 {
            0x9e3779b185ebca87
        } else {
            argument.random_seed
        });
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        match operation {
            Operation::PlaceBetsAndSpin { bets } => {
                if let Err(e) = self.place_bets_and_spin(bets) {
                    panic!("{}", e);
                }
            }
            Operation::ResetRound => {
                if let Err(e) = self.reset_round() {
                    panic!("{}", e);
                }
            }
        }
    }

    async fn execute_message(&mut self, _message: Self::Message) {}

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl RouletteContract {
    fn place_bets_and_spin(&mut self, bets: Vec<Bet>) -> Result<(), String> {
        ensure!(!bets.is_empty(), "Must place at least one bet");
        
        let balance = *self.state.player_balance.get();
        let total_bet_amount: u64 = bets.iter().map(|bet| bet.amount).sum();
        
        ensure!(balance >= total_bet_amount, "Insufficient balance for bets");
        ensure!(total_bet_amount > 0, "Total bet amount must be greater than 0");
        
        // Validate each bet
        for bet in &bets {
            ensure!(bet.amount > 0, "Individual bet amount must be greater than 0");
            self.validate_bet(bet)?;
        }
        
        // Deduct bet amounts from balance
        self.state.player_balance.set(balance - total_bet_amount);
        self.state.current_bets.set(bets.clone());
        
        // Spin the wheel
        let winning_number = self.spin_wheel();
        let is_red = is_red_number(winning_number);
        
        // Calculate payouts for each bet
        let mut bet_results = Vec::new();
        let mut total_payout = 0u64;
        
        for bet in &bets {
            let won = self.check_bet_win(bet, winning_number);
            let payout = if won {
                let multiplier = get_payout_multiplier(bet.bet_type);
                bet.amount + (bet.amount * multiplier) // Return bet + winnings
            } else {
                0
            };
            
            total_payout += payout;
            bet_results.push(BetResult {
                bet: bet.clone(),
                won,
                payout,
            });
        }
        
        // Add winnings to balance
        if total_payout > 0 {
            let current_balance = *self.state.player_balance.get();
            self.state.player_balance.set(current_balance + total_payout);
        }
        
        // Record the result
        let spin_result = SpinResult {
            winning_number,
            is_red,
            total_payout,
            bet_results,
        };
        
        self.state.last_result.set(Some(spin_result.clone()));
        
        // Add to game history
        let now_timestamp = self.runtime.system_time();
        let now_micros = now_timestamp.micros();
        let record = GameRecord {
            bets,
            spin_result,
            timestamp: now_micros,
        };
        self.state.game_history.push(record);
        
        Ok(())
    }
    
    fn reset_round(&mut self) -> Result<(), String> {
        self.state.current_bets.set(Vec::new());
        self.state.last_result.set(None);
        Ok(())
    }
    
    fn validate_bet(&self, bet: &Bet) -> Result<(), String> {
        match bet.bet_type {
            BetType::StraightUp => {
                ensure!(bet.selection <= 37, "Straight up bet selection must be 0-36 or 37 (for 00)");
            }
            BetType::Color => {
                ensure!(bet.selection <= 1, "Color bet selection must be 0 (Red) or 1 (Black)");
            }
            BetType::Parity => {
                ensure!(bet.selection <= 1, "Parity bet selection must be 0 (Even) or 1 (Odd)");
            }
            BetType::Range => {
                ensure!(bet.selection <= 1, "Range bet selection must be 0 (Low) or 1 (High)");
            }
            BetType::Dozen => {
                ensure!(bet.selection <= 2, "Dozen bet selection must be 0, 1, or 2");
            }
            BetType::Column => {
                ensure!(bet.selection <= 2, "Column bet selection must be 0, 1, or 2");
            }
        }
        Ok(())
    }
    
    fn check_bet_win(&self, bet: &Bet, winning_number: u8) -> bool {
        match bet.bet_type {
            BetType::StraightUp => bet.selection == winning_number,
            BetType::Color => {
                if winning_number == 0 || winning_number == 37 {
                    false // Green numbers lose color bets
                } else {
                    let is_red = is_red_number(winning_number).unwrap_or(false);
                    (bet.selection == 0 && is_red) || (bet.selection == 1 && !is_red)
                }
            }
            BetType::Parity => {
                if winning_number == 0 || winning_number == 37 {
                    false // Green numbers lose parity bets
                } else {
                    let is_even = winning_number % 2 == 0;
                    (bet.selection == 0 && is_even) || (bet.selection == 1 && !is_even)
                }
            }
            BetType::Range => {
                if winning_number == 0 || winning_number == 37 {
                    false // Green numbers lose range bets
                } else {
                    let is_low = winning_number >= 1 && winning_number <= 18;
                    (bet.selection == 0 && is_low) || (bet.selection == 1 && !is_low)
                }
            }
            BetType::Dozen => {
                if winning_number == 0 || winning_number == 37 {
                    false // Green numbers lose dozen bets
                } else {
                    let dozen = (winning_number - 1) / 12;
                    dozen == bet.selection
                }
            }
            BetType::Column => {
                if winning_number == 0 || winning_number == 37 {
                    false // Green numbers lose column bets
                } else {
                    let column = (winning_number - 1) % 3;
                    column == bet.selection
                }
            }
        }
    }
    
    fn spin_wheel(&mut self) -> u8 {
        let seed = self.bump_seed();
        let mut rng = SimpleRng::new(seed);
        let index = (rng.next() as usize) % ROULETTE_NUMBERS.len();
        ROULETTE_NUMBERS[index]
    }
    
    fn bump_seed(&mut self) -> u64 {
        let current = *self.state.random_seed.get();
        let mut rng = SimpleRng::new(current);
        let next = rng.next();
        self.state.random_seed.set(next);
        next
    }
}

struct SimpleRng(u64);

impl SimpleRng {
    fn new(seed: u64) -> Self {
        let seed = if seed == 0 { 0x9e3779b185ebca87 } else { seed };
        SimpleRng(seed)
    }

    fn next(&mut self) -> u64 {
        let mut value = self.0;
        value ^= value << 7;
        value ^= value >> 9;
        value ^= value << 8;
        self.0 = value;
        self.0
    }
}

#[cfg(test)]
mod tests {
    use futures::FutureExt as _;
    use linera_sdk::{util::BlockingWait, views::View, Contract, ContractRuntime};

    use roulette::{Bet, BetType, Operation, RouletteInit};

    use super::{RouletteContract, RouletteState};

    #[test]
    fn place_straight_up_bet() {
        let init = RouletteInit {
            starting_balance: 1000,
            random_seed: 42,
        };
        let mut app = create_and_instantiate_app(init);

        let bets = vec![Bet {
            bet_type: BetType::StraightUp,
            amount: 10,
            selection: 7, // Bet on number 7
        }];

        let _response = app
            .execute_operation(Operation::PlaceBetsAndSpin { bets })
            .now_or_never()
            .expect("Execution of application operation should not await anything");

        // Balance should be reduced by bet amount initially
        let balance = *app.state.player_balance.get();
        let result = app.state.last_result.get().clone();
        
        assert!(result.is_some());
        let spin_result = result.unwrap();
        
        // Check if the result is valid
        assert!(spin_result.winning_number <= 37);
        
        if spin_result.winning_number == 7 {
            // If we won, balance should be original - bet + payout
            assert_eq!(balance, 1000 - 10 + spin_result.total_payout);
        } else {
            // If we lost, balance should be original - bet
            assert_eq!(balance, 1000 - 10);
        }
    }

    fn create_and_instantiate_app(init: RouletteInit) -> RouletteContract {
        let runtime = ContractRuntime::new().with_application_parameters(());
        let mut contract = RouletteContract {
            state: RouletteState::load(runtime.root_view_storage_context())
                .blocking_wait()
                .expect("Failed to read from mock key value store"),
            runtime,
        };

        contract
            .instantiate(init)
            .now_or_never()
            .expect("Initialization of application state should not await anything");

        contract
    }
}
