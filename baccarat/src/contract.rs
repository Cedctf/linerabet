#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    ensure,
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use baccarat::{BetType, BaccaratInit, Operation};

use self::state::{BaccaratState, Card, RoundResult, Winner};

pub struct BaccaratContract {
    state: BaccaratState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(BaccaratContract);

impl WithContractAbi for BaccaratContract {
    type Abi = baccarat::BaccaratAbi;
}

impl Contract for BaccaratContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = BaccaratInit;
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = BaccaratState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        BaccaratContract { state, runtime }
    }

    async fn instantiate(&mut self, argument: Self::InstantiationArgument) {
        self.runtime.application_parameters();
        let num_decks = if argument.num_decks == 0 { 6 } else { argument.num_decks };
        self.state.player_balance.set(argument.starting_balance);
        self.state.current_bet.set(0);
        self.state.current_bet_type.set(None);
        self.state.random_seed.set(if argument.random_seed == 0 {
            0x9e3779b185ebca87
        } else {
            argument.random_seed
        });
        self.state.num_decks.set(num_decks);
        self.state.deck.set(Vec::new());
        self.state.player_hand.set(Vec::new());
        self.state.banker_hand.set(Vec::new());
        self.state.last_result.set(None);
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        match operation {
            Operation::PlaceBetAndDeal { bet, bet_type } => {
                if let Err(e) = self.place_bet_and_deal(bet, bet_type) {
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

const SUITS: [&str; 4] = ["clubs", "diamonds", "hearts", "spades"];
const VALUES: [&str; 13] = [
    "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king", "ace",
];
const BANKER_COMMISSION_BP: u64 = 500; // 5.00% in basis points
const TIE_PAYOUT_MULTIPLIER: u64 = 8; // net profit multiplier

impl BaccaratContract {
    fn place_bet_and_deal(&mut self, bet: u64, bet_type: BetType) -> Result<(), String> {
        ensure!(bet > 0, "Bet must be > 0");
        let balance = *self.state.player_balance.get();
        ensure!(balance >= bet, "Insufficient balance to place bet");

        // Deduct bet upfront
        self.state.player_balance.set(balance - bet);
        self.state.current_bet.set(bet);
        self.state.current_bet_type.set(Some(bet_type));

        // Build and shuffle a fresh shoe
        let mut deck = self.new_shuffled_shoe(*self.state.num_decks.get());

        // Initial deal
        let mut player_hand = vec![draw_card(&mut deck), draw_card(&mut deck)];
        let mut banker_hand = vec![draw_card(&mut deck), draw_card(&mut deck)];

        let mut player_value = calculate_value(&player_hand);
        let mut banker_value = calculate_value(&banker_hand);
        let is_natural = player_value >= 8 || banker_value >= 8;

        let mut player_third_card_value: Option<u8> = None;
        let mut banker_drew_third = false;

        if !is_natural {
            if should_player_draw(player_value) {
                let third = draw_card(&mut deck);
                player_third_card_value = Some(third.point_value);
                player_hand.push(third);
                player_value = calculate_value(&player_hand);
            }

            if should_banker_draw(banker_value, player_third_card_value) {
                let third = draw_card(&mut deck);
                banker_drew_third = true;
                banker_hand.push(third);
                banker_value = calculate_value(&banker_hand);
            } else {
                banker_value = calculate_value(&banker_hand);
            }
        }

        let winner = if player_value > banker_value {
            Winner::Player
        } else if banker_value > player_value {
            Winner::Banker
        } else {
            Winner::Tie
        };

        let (pushed, net_profit_signed, credit_back) = settle(bet, bet_type, winner);
        if credit_back > 0 {
            let bal = *self.state.player_balance.get();
            self.state.player_balance
                .set(bal.saturating_add(credit_back));
        }

        self.state.deck.set(deck);
        self.state.player_hand.set(player_hand.clone());
        self.state.banker_hand.set(banker_hand.clone());
        self.state.last_result.set(Some(RoundResult {
            player_value,
            banker_value,
            winner,
            is_natural,
            player_third_card_value,
            banker_drew_third_card: banker_drew_third,
            pushed,
            net_profit: net_profit_signed,
        }));
        Ok(())
    }

    fn reset_round(&mut self) -> Result<(), String> {
        self.state.deck.set(Vec::new());
        self.state.player_hand.set(Vec::new());
        self.state.banker_hand.set(Vec::new());
        self.state.current_bet.set(0);
        self.state.current_bet_type.set(None);
        self.state.last_result.set(None);
        Ok(())
    }

    fn new_shuffled_shoe(&mut self, num_decks: u8) -> Vec<Card> {
        let d = if num_decks == 0 { 6 } else { num_decks } as usize;
        let mut deck = Vec::with_capacity(d * SUITS.len() * VALUES.len());
        for deck_index in 0..d {
            for suit in SUITS {
                for value in VALUES {
                    let suffix = format!("_deck_{}_{}", deck_index, deck.len());
                    deck.push(Card::new(suit, value, &suffix));
                }
            }
        }
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

fn calculate_value(hand: &[Card]) -> u8 {
    let sum: u16 = hand.iter().map(|c| c.point_value as u16).sum();
    (sum % 10) as u8
}

fn should_player_draw(value: u8) -> bool {
    value <= 5
}

fn should_banker_draw(banker_value: u8, player_third_card_value: Option<u8>) -> bool {
    if banker_value >= 7 {
        return false;
    }
    match player_third_card_value {
        None => banker_value <= 5,
        Some(v) => {
            if banker_value <= 2 {
                true
            } else if banker_value == 3 {
                v != 8
            } else if banker_value == 4 {
                (2..=7).contains(&v)
            } else if banker_value == 5 {
                (4..=7).contains(&v)
            } else if banker_value == 6 {
                v == 6 || v == 7
            } else {
                false
            }
        }
    }
}

fn settle(bet: u64, bet_type: BetType, winner: Winner) -> (bool, i64, u64) {
    match (bet_type, winner) {
        (BetType::Player, Winner::Player) => (false, bet as i64, bet.saturating_mul(2)),
        (BetType::Banker, Winner::Banker) => {
            let commission = bet.saturating_mul(BANKER_COMMISSION_BP) / 10_000;
            let net_profit = bet.saturating_sub(commission);
            (false, net_profit as i64, bet.saturating_add(net_profit))
        }
        (BetType::Tie, Winner::Tie) => {
            let profit = bet.saturating_mul(TIE_PAYOUT_MULTIPLIER);
            (false, profit as i64, bet.saturating_add(profit))
        }
        (BetType::Player, Winner::Tie) | (BetType::Banker, Winner::Tie) => (true, 0, bet),
        _ => (false, -(bet as i64), 0),
    }
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
