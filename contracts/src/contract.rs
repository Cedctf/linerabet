#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    ensure,
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use contracts::{BlackjackInit, Operation};

use self::state::{Card, ContractsState, GamePhase, GameRecord, GameResult, ALLOWED_BETS, PLAYER_TURN_TIMER_SECONDS};

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
        self.state.dealer_hole_card.set(None);
        self.state.last_result.set(None);
        self.state.round_start_time.set(0);
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        match operation {
            Operation::EnterBettingPhase => {
                if let Err(e) = self.enter_betting_phase() {
                    panic!("{}", e);
                }
            }
            Operation::StartGame { bet } => {
                if let Err(e) = self.start_game(bet) {
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
        }
    }
    

    async fn execute_message(&mut self, _message: Self::Message) {}

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl ContractsContract {
    // Enter betting phase
    fn enter_betting_phase(&mut self) -> Result<(), String> {
        let phase = *self.state.phase.get();
        ensure!(
            matches!(phase, GamePhase::WaitingForBet | GamePhase::RoundComplete),
            "Cannot enter betting phase during active game"
        );

        self.state.phase.set(GamePhase::BettingPhase);

        // Clear previous round data
        self.state.deck.set(Vec::new());
        self.state.player_hand.set(Vec::new());
        self.state.dealer_hand.set(Vec::new());
        self.state.dealer_hole_card.set(None);
        self.state.current_bet.set(0);

        Ok(())
    }

    // Start game - lock in bet and deal cards
    fn start_game(&mut self, bet: u64) -> Result<(), String> {
        ensure!(ALLOWED_BETS.contains(&bet), "Bet must be one of 1,2,3,4,5");
        let phase = *self.state.phase.get();
        ensure!(
            matches!(phase, GamePhase::WaitingForBet | GamePhase::BettingPhase | GamePhase::RoundComplete),
            "Cannot start game during active round"
        );

        let balance = *self.state.player_balance.get();
        ensure!(balance >= bet, "Insufficient balance to place bet");

        // Deal cards
        let mut deck = self.new_shuffled_deck();
        let player_card1 = draw_card(&mut deck);
        let player_card2 = draw_card(&mut deck);
        let dealer_up_card = draw_card(&mut deck);
        let dealer_hole_card = draw_card(&mut deck);

        let player_hand = vec![player_card1, player_card2];

        // Store hole card separately (hidden from service until dealer turn)
        self.state.dealer_hole_card.set(Some(dealer_hole_card));
        // Only show dealer's up card
        self.state.dealer_hand.set(vec![dealer_up_card.clone()]);

        self.state.player_balance.set(balance - bet);
        self.state.current_bet.set(bet);
        self.state.deck.set(deck);
        self.state.player_hand.set(player_hand.clone());
        self.state.last_result.set(None);

        // Check for instant blackjack (player only, dealer hidden)
        let player_value = calculate_hand_value(&player_hand);
        if player_value == 21 {
            // Player has blackjack - reveal dealer card and resolve
            self.reveal_dealer_hole_card();
            let full_dealer_hand = self.state.dealer_hand.get().clone();
            let dealer_value = calculate_hand_value(&full_dealer_hand);
            if dealer_value == 21 {
                self.apply_result(GameResult::Push);
            } else {
                self.apply_result(GameResult::PlayerBlackjack);
            }
        } else {
            // Start player turn timer (20 seconds)
            let now_timestamp = self.runtime.system_time();
            let now_micros = now_timestamp.micros();
            self.state.round_start_time.set(now_micros);
            self.state.phase.set(GamePhase::PlayerTurn);
        }

        Ok(())
    }

    // Hit - player draws a card
    fn hit(&mut self) -> Result<(), String> {
        ensure!(
            matches!(*self.state.phase.get(), GamePhase::PlayerTurn),
            "You can only hit during the player's turn"
        );

        // Check if player turn timer expired (20 seconds)
        let round_start = *self.state.round_start_time.get();
        if round_start > 0 {
            let now_timestamp = self.runtime.system_time();
            let now_micros = now_timestamp.micros();
            let elapsed_micros = now_micros.saturating_sub(round_start);
            let elapsed_seconds = elapsed_micros / 1_000_000;

            if elapsed_seconds >= PLAYER_TURN_TIMER_SECONDS {
                // Timer expired - auto-stand instead of hit
                return self.stand();
            }
        }

        let mut deck = self.state.deck.get().clone();
        ensure!(!deck.is_empty(), "The shoe is exhausted");
        let mut player_hand = self.state.player_hand.get().clone();
        player_hand.push(draw_card(&mut deck));

        self.state.deck.set(deck);
        self.state.player_hand.set(player_hand.clone());

        // Reset timer after each hit
        let now_timestamp = self.runtime.system_time();
        let now_micros = now_timestamp.micros();
        self.state.round_start_time.set(now_micros);

        if calculate_hand_value(&player_hand) > 21 {
            // Reveal dealer's hole card before ending round
            self.reveal_dealer_hole_card();
            self.apply_result(GameResult::PlayerBust);
        }

        Ok(())
    }

    // Stand - reveal hole card and dealer plays
    fn stand(&mut self) -> Result<(), String> {
        ensure!(
            matches!(*self.state.phase.get(), GamePhase::PlayerTurn),
            "You can only stand during the player's turn"
        );

        // Clear player turn timer
        self.state.round_start_time.set(0);
        self.state.phase.set(GamePhase::DealerTurn);

        // Reveal the dealer's hole card
        self.reveal_dealer_hole_card();

        let mut deck = self.state.deck.get().clone();
        let mut dealer_hand = self.state.dealer_hand.get().clone();

        // Dealer hits until 17 or higher
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

    // Helper to reveal dealer's hole card
    fn reveal_dealer_hole_card(&mut self) {
        if let Some(hole_card) = self.state.dealer_hole_card.get().clone() {
            let mut dealer_hand = self.state.dealer_hand.get().clone();
            dealer_hand.push(hole_card);
            self.state.dealer_hand.set(dealer_hand);
            self.state.dealer_hole_card.set(None);
        }
    }

    fn apply_result(&mut self, result: GameResult) {
        let bet = *self.state.current_bet.get();
        let balance = *self.state.player_balance.get();

        // Calculate payout
        let payout = match result {
            GameResult::PlayerBlackjack => {
                // 1.5x payout for blackjack (bet * 2.5 total = bet + bet * 1.5)
                bet.saturating_mul(5).saturating_div(2)
            }
            GameResult::PlayerWin | GameResult::DealerBust => {
                // Regular win - double the bet
                bet.saturating_mul(2)
            }
            GameResult::Push => {
                // Push - return the bet
                bet
            }
            GameResult::DealerWin | GameResult::PlayerBust => {
                // Loss - no payout
                0
            }
        };

        let updated_balance = balance.saturating_add(payout);

        // Record game in history
        let now_timestamp = self.runtime.system_time();
        let now_micros = now_timestamp.micros();
        let record = GameRecord {
            player_hand: self.state.player_hand.get().clone(),
            dealer_hand: self.state.dealer_hand.get().clone(),
            bet,
            result,
            payout,
            timestamp: now_micros,
        };
        self.state.game_history.push(record);

        self.state.player_balance.set(updated_balance);
        self.state.current_bet.set(0);
        self.state.phase.set(GamePhase::RoundComplete);
        self.state.last_result.set(Some(result));
        self.state.round_start_time.set(0);
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
