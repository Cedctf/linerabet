#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    ensure,
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use contracts::{BlackjackInit, Operation};

use self::state::{Card, ContractsState, GamePhase, GameResult, ALLOWED_BETS};

const SUITS: [&str; 4] = ["clubs", "diamonds", "hearts", "spades"];
const VALUES: [&str; 13] = [
    "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king", "ace",
];

pub struct ContractsContract {
    state: ContractsState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(ContractsContract);

impl WithContractAbi for ContractsContract {
    type Abi = contracts::ContractsAbi;
}

impl Contract for ContractsContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = BlackjackInit;
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = ContractsState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        ContractsContract { state, runtime }
    }

    async fn instantiate(&mut self, argument: Self::InstantiationArgument) {
        self.runtime.application_parameters();

        let starting_balance = argument.starting_balance;
        self.state.default_buy_in.set(starting_balance);
        self.state.player_balance.set(starting_balance);
        self.state.random_seed.set(if argument.random_seed == 0 {
            0x9e3779b185ebca87
        } else {
            argument.random_seed
        });
        self.state.current_bet.set(0);
        self.state.phase.set(GamePhase::WaitingForBet);
        self.state.deck.set(Vec::new());
        self.state.player_hand.set(Vec::new());
        self.state.dealer_hand.set(Vec::new());
        self.state.last_result.set(None);
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        match operation {
            Operation::StartRound { bet } => {
                if let Err(e) = self.start_round(bet) {
                    panic!("{}", e);
                }
            }
            Operation::Hit => {
                if let Err(e) = self.hit() {
                    panic!("{}", e);
                }
            }
            Operation::Stand => {
                if let Err(e) = self.stand() {
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

impl ContractsContract {
    // before: fn start_round(&mut self, bet: u64) {
    fn start_round(&mut self, bet: u64) -> Result<(), String> {
        ensure!(ALLOWED_BETS.contains(&bet), "Bet must be one of 1,2,3,4,5");
        let phase = *self.state.phase.get();
        ensure!(
            matches!(phase, GamePhase::WaitingForBet | GamePhase::RoundComplete),
            "Finish the current round before starting a new one"
        );

        let balance = *self.state.player_balance.get();
        ensure!(balance >= bet, "Insufficient balance to place bet");

        let mut deck = self.new_shuffled_deck();
        let mut player_hand = vec![draw_card(&mut deck), draw_card(&mut deck)];
        let mut dealer_hand = vec![draw_card(&mut deck), draw_card(&mut deck)];

        self.state.player_balance.set(balance - bet);
        self.state.current_bet.set(bet);
        self.state.deck.set(deck);
        self.state.player_hand.set(player_hand.clone());
        self.state.dealer_hand.set(dealer_hand.clone());
        self.state.last_result.set(None);

        let player_value = calculate_hand_value(&player_hand);
        let dealer_value = calculate_hand_value(&dealer_hand);

        if player_value == 21 && dealer_value == 21 {
            self.apply_result(GameResult::Push);
        } else if player_value == 21 {
            self.apply_result(GameResult::PlayerBlackjack);
        } else if dealer_value == 21 {
            self.apply_result(GameResult::DealerWin);
        } else {
            self.state.phase.set(GamePhase::PlayerTurn);
        }

        Ok(())
    }

    // before: fn hit(&mut self) {
    fn hit(&mut self) -> Result<(), String> {
        ensure!(
            matches!(*self.state.phase.get(), GamePhase::PlayerTurn),
            "You can only hit during the player's turn"
        );

        let mut deck = self.state.deck.get().clone();
        ensure!(!deck.is_empty(), "The shoe is exhausted");
        let mut player_hand = self.state.player_hand.get().clone();
        player_hand.push(draw_card(&mut deck));

        self.state.deck.set(deck);
        self.state.player_hand.set(player_hand.clone());

        if calculate_hand_value(&player_hand) > 21 {
            self.apply_result(GameResult::PlayerBust);
        }

        Ok(())
    }

    // before: fn stand(&mut self) {
    fn stand(&mut self) -> Result<(), String> {
        ensure!(
            matches!(*self.state.phase.get(), GamePhase::PlayerTurn),
            "You can only stand during the player's turn"
        );

        self.state.phase.set(GamePhase::DealerTurn);

        let mut deck = self.state.deck.get().clone();
        let mut dealer_hand = self.state.dealer_hand.get().clone();

        while calculate_hand_value(&dealer_hand) < 17 {
            ensure!(!deck.is_empty(), "The shoe is exhausted");
            dealer_hand.push(draw_card(&mut deck));
        }

        self.state.deck.set(deck);
        self.state.dealer_hand.set(dealer_hand.clone());

        let player_hand = self.state.player_hand.get().clone();
        let result = determine_winner(&player_hand, &dealer_hand);
        self.apply_result(result);

        Ok(())
    }

    // before: fn reset_round(&mut self) {
    fn reset_round(&mut self) -> Result<(), String> {
        ensure!(
            !matches!(*self.state.phase.get(), GamePhase::PlayerTurn),
            "Cannot reset during an active round"
        );
        self.state.deck.set(Vec::new());
        self.state.player_hand.set(Vec::new());
        self.state.dealer_hand.set(Vec::new());
        self.state.current_bet.set(0);
        self.state.last_result.set(None);
        self.state.phase.set(GamePhase::WaitingForBet);

        Ok(())
    }

    fn apply_result(&mut self, result: GameResult) {
        let bet = *self.state.current_bet.get();
        let balance = *self.state.player_balance.get();
        let updated_balance = match result {
            GameResult::PlayerBlackjack | GameResult::PlayerWin | GameResult::DealerBust => {
                balance.saturating_add(bet.saturating_mul(2))
            }
            GameResult::Push => balance.saturating_add(bet),
            GameResult::DealerWin | GameResult::PlayerBust => balance,
        };

        self.state.player_balance.set(updated_balance);
        self.state.current_bet.set(0);
        self.state.phase.set(GamePhase::RoundComplete);
        self.state.last_result.set(Some(result));
    }

    fn new_shuffled_deck(&mut self) -> Vec<Card> {
        let mut deck = create_deck();
        let seed = self.bump_seed();
        shuffle(&mut deck, seed);
        deck
    }

    fn bump_seed(&mut self) -> u64 {
        let current = *self.state.random_seed.get();
        let mut rng = SimpleRng::new(current);
        let next = rng.next();
        self.state.random_seed.set(next);
        next
    }
}

fn create_deck() -> Vec<Card> {
    let mut deck = Vec::with_capacity(SUITS.len() * VALUES.len());
    for suit in SUITS {
        for value in VALUES {
            deck.push(Card::new(suit, value));
        }
    }
    deck
}

fn shuffle(deck: &mut [Card], seed: u64) {
    let mut rng = SimpleRng::new(seed);
    for i in (1..deck.len()).rev() {
        let j = (rng.next() as usize) % (i + 1);
        deck.swap(i, j);
    }
}

fn draw_card(deck: &mut Vec<Card>) -> Card {
    deck.pop().expect("deck should contain enough cards")
}

fn calculate_hand_value(cards: &[Card]) -> u8 {
    let mut total = 0u8;
    let mut aces = 0u8;

    for card in cards {
        match card.value.as_str() {
            "ace" => {
                aces += 1;
                total = total.saturating_add(11);
            }
            "king" | "queen" | "jack" => total = total.saturating_add(10),
            value => {
                let parsed = value
                    .parse::<u8>()
                    .unwrap_or_else(|_| panic!("invalid card value {value}"));
                total = total.saturating_add(parsed);
            }
        }
    }

    while total > 21 && aces > 0 {
        total -= 10;
        aces -= 1;
    }

    total
}

fn determine_winner(player_hand: &[Card], dealer_hand: &[Card]) -> GameResult {
    let player_value = calculate_hand_value(player_hand);
    let dealer_value = calculate_hand_value(dealer_hand);
    let player_bust = player_value > 21;
    let dealer_bust = dealer_value > 21;

    if player_bust {
        GameResult::PlayerBust
    } else if dealer_bust {
        GameResult::DealerBust
    } else if player_value > dealer_value {
        GameResult::PlayerWin
    } else if dealer_value > player_value {
        GameResult::DealerWin
    } else {
        GameResult::Push
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

    use contracts::{BlackjackInit, Operation};

    use super::{calculate_hand_value, ContractsContract, ContractsState};

    #[test]
    fn deal_initial_round() {
        let init = BlackjackInit {
            starting_balance: 20,
            random_seed: 7,
        };
        let mut app = create_and_instantiate_app(init.clone());

        app.execute_operation(Operation::StartRound { bet: 2 })
            .now_or_never()
            .expect("operation executes");

        assert_eq!(app.state.player_hand.get().len(), 2);
        assert_eq!(app.state.dealer_hand.get().len(), 2);
        assert_eq!(*app.state.player_balance.get(), init.starting_balance - 2);
        assert_eq!(*app.state.current_bet.get(), 2);
    }

    fn create_and_instantiate_app(init: BlackjackInit) -> ContractsContract {
        let runtime = ContractRuntime::new().with_application_parameters(());
        let mut contract = ContractsContract {
            state: ContractsState::load(runtime.root_view_storage_context())
                .blocking_wait()
                .expect("Failed to read from mock key value store"),
            runtime,
        };

        contract
            .instantiate(init)
            .now_or_never()
            .expect("Initialization should not await");

        contract
    }

    #[test]
    fn hand_value_matches_rules() {
        use super::state::Card;

        let hand = vec![
            Card::new("hearts", "ace"),
            Card::new("spades", "king"),
            Card::new("clubs", "5"),
        ];
        assert_eq!(calculate_hand_value(&hand), 16);
    }
}
