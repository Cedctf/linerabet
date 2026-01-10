#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use contracts::{CasinoParams, CasinoInit, Operation, Message, GameType, GameAction, GameResult, Card};

use self::state::{ContractsState, PendingGame, ActiveGame, GamePhase, GameRecord, ALLOWED_BETS};

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
    type Message = Message;
    type Parameters = CasinoParams;  // Application Parameters with bank_chain_id
    type InstantiationArgument = CasinoInit;
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = ContractsState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        ContractsContract { state, runtime }
    }

    async fn instantiate(&mut self, argument: Self::InstantiationArgument) {
        // Validate parameters are set
        let _params = self.runtime.application_parameters();

        self.state.default_buy_in.set(argument.starting_balance);
        
        let master_seed = if argument.random_seed == 0 {
            0x9e3779b185ebca87
        } else {
            argument.random_seed
        };
        self.state.master_seed.set(master_seed);
        
        // If this chain IS the bank (chain_id == params.bank_chain_id), init house
        if self.is_bank_chain() {
            self.state.house_balance.set(100000); // 100k chips for house
            self.state.game_counter.set(0);
        }
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        let signer = self.runtime.authenticated_signer().expect("Must be signed in");
        
        match operation {
            Operation::RequestChips => {
                self.handle_request_chips(signer).await;
            }
            
            Operation::PlayBlackjack { bet } => {
                self.handle_play_blackjack(signer, bet).await;
            }
            
            Operation::Hit => {
                self.handle_hit(signer).await;
            }
            
            Operation::Stand => {
                self.handle_stand(signer).await;
            }
            
            Operation::DoubleDown => {
                self.handle_double_down(signer).await;
            }
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        match message {
            // ═══════════════════════════════════════════════════════════════
            // BANK RECEIVES FROM PLAYER
            // ═══════════════════════════════════════════════════════════════
            
            Message::RequestChips { player, player_chain } => {
                self.bank_handle_request_chips(player, player_chain).await;
            }
            
            Message::RequestGame { player, player_chain, game_type, bet } => {
                self.bank_handle_request_game(player, player_chain, game_type, bet).await;
            }
            
            Message::ReportResult { game_id, player, actions } => {
                self.bank_handle_report_result(game_id, player, actions).await;
            }
            
            // ═══════════════════════════════════════════════════════════════
            // PLAYER RECEIVES FROM BANK
            // ═══════════════════════════════════════════════════════════════
            
            Message::ChipsGranted { player: _, amount } => {
                self.player_handle_chips_granted(amount).await;
            }
            
            Message::GameReady { game_id, seed, bet } => {
                self.player_handle_game_ready(game_id, seed, bet).await;
            }
            
            Message::GameSettled { game_id, result, payout, dealer_hand } => {
                self.player_handle_game_settled(game_id, result, payout, dealer_hand).await;
            }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

// ============================================================================
// HELPER: Check if this chain is the Bank
// ============================================================================

impl ContractsContract {
    /// Returns true if the current chain is the Bank chain
    fn is_bank_chain(&mut self) -> bool {
        let params = self.runtime.application_parameters();
        let current_chain = self.runtime.chain_id();
        current_chain == params.bank_chain_id
    }
    
    /// Get the bank chain ID from application parameters
    fn bank_chain_id(&mut self) -> linera_base::identifiers::ChainId {
        self.runtime.application_parameters().bank_chain_id
    }
}

// ============================================================================
// PLAYER-SIDE OPERATION HANDLERS
// ============================================================================

impl ContractsContract {
    /// Player requests chips - sends message to Bank
    async fn handle_request_chips(&mut self, signer: linera_base::identifiers::AccountOwner) {
        let bank_chain_id = self.bank_chain_id();
        let player_chain = self.runtime.chain_id();
        
        self.runtime
            .prepare_message(Message::RequestChips {
                player: signer,
                player_chain,
            })
            .with_tracking()
            .send_to(bank_chain_id);
    }
    
    /// Player starts a Blackjack game - deducts bet and sends to Bank
    async fn handle_play_blackjack(&mut self, signer: linera_base::identifiers::AccountOwner, bet: u64) {
        assert!(ALLOWED_BETS.contains(&bet), "Bet must be 1, 2, 3, 4, or 5");
        
        let balance = *self.state.player_balance.get();
        assert!(balance >= bet, "Insufficient balance");
        
        // Check no active game
        assert!(self.state.current_game.get().is_none(), "Game already in progress");
        
        // Deduct bet (escrow)
        self.state.player_balance.set(balance - bet);
        
        // Send request to Bank
        let bank_chain_id = self.bank_chain_id();
        let player_chain = self.runtime.chain_id();
        
        self.runtime
            .prepare_message(Message::RequestGame {
                player: signer,
                player_chain,
                game_type: GameType::Blackjack,
                bet,
            })
            .with_tracking()
            .send_to(bank_chain_id);
    }
    
    /// Player hits - local computation
    async fn handle_hit(&mut self, _signer: linera_base::identifiers::AccountOwner) {
        let mut game = self.state.current_game.get().clone()
            .expect("No active game");
        assert!(game.phase == GamePhase::PlayerTurn, "Not your turn");
        
        // Draw a card
        let card = game.deck.pop().expect("Deck empty");
        game.player_hand.push(card);
        game.actions.push(GameAction::Hit);
        
        let player_value = calculate_hand_value(&game.player_hand);
        
        if player_value > 21 {
            // Bust - report to Bank immediately
            game.phase = GamePhase::RoundComplete;
            self.state.current_game.set(Some(game.clone()));
            
            // Send result to Bank
            let bank_chain_id = self.bank_chain_id();
            let player = self.runtime.authenticated_signer().expect("Must be signed");
            
            self.runtime
                .prepare_message(Message::ReportResult {
                    game_id: game.game_id,
                    player,
                    actions: game.actions.clone(),
                })
                .with_tracking()
                .send_to(bank_chain_id);
        } else {
            self.state.current_game.set(Some(game));
        }
    }
    
    /// Player stands - report to Bank for verification
    async fn handle_stand(&mut self, _signer: linera_base::identifiers::AccountOwner) {
        let mut game = self.state.current_game.get().clone()
            .expect("No active game");
        assert!(game.phase == GamePhase::PlayerTurn, "Not your turn");
        
        game.actions.push(GameAction::Stand);
        game.phase = GamePhase::RoundComplete;
        self.state.current_game.set(Some(game.clone()));
        
        // Send result to Bank for verification
        let bank_chain_id = self.bank_chain_id();
        let player = self.runtime.authenticated_signer().expect("Must be signed");
        
        self.runtime
            .prepare_message(Message::ReportResult {
                game_id: game.game_id,
                player,
                actions: game.actions.clone(),
            })
            .with_tracking()
            .send_to(bank_chain_id);
    }
    
    /// Player doubles down - double bet, draw one card, then stand
    /// Only allowed on first 2 cards
    async fn handle_double_down(&mut self, _signer: linera_base::identifiers::AccountOwner) {
        let mut game = self.state.current_game.get().clone()
            .expect("No active game");
        assert!(game.phase == GamePhase::PlayerTurn, "Not your turn");
        assert!(game.player_hand.len() == 2, "Double down only allowed on first 2 cards");
        
        // Check if player has enough balance to double
        let balance = *self.state.player_balance.get();
        assert!(balance >= game.bet, "Insufficient balance to double");
        
        // Deduct the additional bet
        self.state.player_balance.set(balance - game.bet);
        game.bet = game.bet * 2; // Double the bet
        
        // Draw exactly one card
        let card = game.deck.pop().expect("Deck empty");
        game.player_hand.push(card);
        
        game.actions.push(GameAction::DoubleDown);
        game.phase = GamePhase::RoundComplete;
        self.state.current_game.set(Some(game.clone()));
        
        // Send result to Bank for verification
        let bank_chain_id = self.bank_chain_id();
        let player = self.runtime.authenticated_signer().expect("Must be signed");
        
        self.runtime
            .prepare_message(Message::ReportResult {
                game_id: game.game_id,
                player,
                actions: game.actions.clone(),
            })
            .with_tracking()
            .send_to(bank_chain_id);
    }
}

// ============================================================================
// PLAYER-SIDE MESSAGE HANDLERS
// ============================================================================

impl ContractsContract {
    /// Player receives chips from Bank
    async fn player_handle_chips_granted(&mut self, amount: u64) {
        let balance = *self.state.player_balance.get();
        self.state.player_balance.set(balance + amount);
    }
    
    /// Player receives game seed from Bank - deal cards and start playing
    async fn player_handle_game_ready(&mut self, game_id: u64, seed: u64, bet: u64) {
        // Create shuffled deck using the seed
        let mut deck = create_deck();
        shuffle(&mut deck, seed);
        
        // Deal initial cards
        let player_card1 = deck.pop().unwrap();
        let player_card2 = deck.pop().unwrap();
        let dealer_up = deck.pop().unwrap();
        let dealer_hole = deck.pop().unwrap();
        
        let player_hand = vec![player_card1, player_card2];
        let dealer_hand = vec![dealer_up]; // Only show up card
        
        let mut phase = GamePhase::PlayerTurn;
        let mut actions = Vec::new();
        
        // Check for instant blackjack
        let player_value = calculate_hand_value(&player_hand);
        if player_value == 21 {
            // Blackjack! Auto-stand and report
            phase = GamePhase::RoundComplete;
            actions.push(GameAction::Stand);
        }
        
        let game = ActiveGame {
            game_id,
            seed,
            bet,
            game_type: GameType::Blackjack,
            phase,
            player_hand,
            dealer_hand,
            dealer_hole_card: Some(dealer_hole),
            deck,
            actions: actions.clone(),
        };
        
        self.state.current_game.set(Some(game.clone()));
        
        // If blackjack, auto-report
        if phase == GamePhase::RoundComplete {
            let bank_chain_id = self.bank_chain_id();
            if let Some(player) = self.runtime.authenticated_signer() {
                self.runtime
                    .prepare_message(Message::ReportResult {
                        game_id,
                        player,
                        actions,
                    })
                    .with_tracking()
                    .send_to(bank_chain_id);
            }
        }
    }
    
    /// Player receives game result from Bank
    async fn player_handle_game_settled(&mut self, game_id: u64, result: GameResult, payout: u64, dealer_hand: Vec<Card>) {
        // Credit payout to player
        let balance = *self.state.player_balance.get();
        self.state.player_balance.set(balance + payout);
        
        // Record in history
        if let Some(game) = self.state.current_game.get().clone() {
            if game.game_id == game_id {
                let now = self.runtime.system_time().micros();
                
                let record = GameRecord {
                    game_id,
                    game_type: game.game_type,
                    player_hand: game.player_hand.clone(),
                    dealer_hand: dealer_hand, // Use full dealer hand from Bank
                    bet: game.bet,
                    result,
                    payout,
                    timestamp: now,
                };
                self.state.game_history.push(record);
            }
        }
        
        // Clear current game
        self.state.current_game.set(None);
    }
}

// ============================================================================
// BANK-SIDE MESSAGE HANDLERS
// ============================================================================

impl ContractsContract {
    /// Bank grants chips to player
    async fn bank_handle_request_chips(&mut self, player: linera_base::identifiers::AccountOwner, player_chain: linera_base::identifiers::ChainId) {
        let amount = *self.state.default_buy_in.get();
        
        // Send chips to player
        self.runtime
            .prepare_message(Message::ChipsGranted { player, amount })
            .with_tracking()
            .send_to(player_chain);
    }
    
    /// Bank receives game request - generate seed and store pending game
    async fn bank_handle_request_game(
        &mut self,
        player: linera_base::identifiers::AccountOwner,
        player_chain: linera_base::identifiers::ChainId,
        game_type: GameType,
        bet: u64,
    ) {
        // Generate unique game ID
        let game_id = *self.state.game_counter.get();
        self.state.game_counter.set(game_id + 1);
        
        // Generate deterministic seed
        let master_seed = *self.state.master_seed.get();
        let seed = generate_game_seed(master_seed, game_id, &player);
        
        // Store pending game
        let now = self.runtime.system_time().micros();
        let pending = PendingGame {
            player,
            player_chain,
            game_type,
            bet,
            seed,
            created_at: now,
        };
        self.state.pending_games.insert(&game_id, pending).expect("Failed to insert pending game");
        
        // Send seed to player
        self.runtime
            .prepare_message(Message::GameReady { game_id, seed, bet })
            .with_tracking()
            .send_to(player_chain);
    }
    
    /// Bank receives result - verify and settle
    async fn bank_handle_report_result(
        &mut self,
        game_id: u64,
        player: linera_base::identifiers::AccountOwner,
        actions: Vec<GameAction>,
    ) {
        // Get pending game
        let pending = self.state.pending_games.get(&game_id).await
            .expect("Failed to get pending game")
            .expect("Game not found");
        
        assert!(pending.player == player, "Not your game");
        
        // Replay game deterministically
        let (result, payout, dealer_hand) = self.replay_and_verify(&pending, &actions);
        
        // Update house balance
        let house = *self.state.house_balance.get();
        if payout > pending.bet {
            // House pays winnings
            self.state.house_balance.set(house.saturating_sub(payout - pending.bet));
        } else {
            // House keeps loss
            self.state.house_balance.set(house + (pending.bet - payout));
        }
        
        // Remove pending game
        self.state.pending_games.remove(&game_id).expect("Failed to remove pending game");
        
        // Send result to player (including full dealer hand)
        self.runtime
            .prepare_message(Message::GameSettled { game_id, result, payout, dealer_hand })
            .with_tracking()
            .send_to(pending.player_chain);
    }
    
    /// Replay game with given seed and actions, return result, payout, and dealer hand
    fn replay_and_verify(&self, pending: &PendingGame, actions: &[GameAction]) -> (GameResult, u64, Vec<Card>) {
        // Recreate deck with same seed
        let mut deck = create_deck();
        shuffle(&mut deck, pending.seed);
        
        // Deal initial cards (same order as player)
        let player_card1 = deck.pop().unwrap();
        let player_card2 = deck.pop().unwrap();
        let dealer_up = deck.pop().unwrap();
        let dealer_hole = deck.pop().unwrap();
        
        let mut player_hand = vec![player_card1, player_card2];
        let mut dealer_hand = vec![dealer_up, dealer_hole];
        
        // Replay player actions
        let mut doubled = false;
        for action in actions {
            match action {
                GameAction::Hit => {
                    let card = deck.pop().expect("Deck empty during replay");
                    player_hand.push(card);
                }
                GameAction::Stand => {
                    break; // Stop drawing
                }
                GameAction::DoubleDown => {
                    // Double down: draw one card, then stop
                    let card = deck.pop().expect("Deck empty during replay");
                    player_hand.push(card);
                    doubled = true;
                    break;
                }
            }
        }
        
        // Adjust bet if doubled
        let final_bet = if doubled { pending.bet * 2 } else { pending.bet };
        
        let player_value = calculate_hand_value(&player_hand);
        
        // Check player bust
        if player_value > 21 {
            return (GameResult::PlayerBust, 0, dealer_hand);
        }
        
        // Check player blackjack
        if player_value == 21 && player_hand.len() == 2 {
            let dealer_value = calculate_hand_value(&dealer_hand);
            if dealer_value == 21 {
                return (GameResult::Push, pending.bet, dealer_hand); // Push
            } else {
                // Blackjack pays 3:2
                return (GameResult::PlayerBlackjack, pending.bet * 5 / 2, dealer_hand);
            }
        }
        
        // Dealer plays (hits until 17+)
        while calculate_hand_value(&dealer_hand) < 17 {
            let card = deck.pop().expect("Deck empty during dealer turn");
            dealer_hand.push(card);
        }
        
        let dealer_value = calculate_hand_value(&dealer_hand);
        
        // Determine result (use final_bet for doubled bets)
        if dealer_value > 21 {
            (GameResult::DealerBust, final_bet * 2, dealer_hand)
        } else if player_value > dealer_value {
            (GameResult::PlayerWin, final_bet * 2, dealer_hand)
        } else if dealer_value > player_value {
            (GameResult::DealerWin, 0, dealer_hand)
        } else {
            (GameResult::Push, final_bet, dealer_hand) // Push - return bet
        }
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn create_deck() -> Vec<Card> {
    let mut deck = Vec::with_capacity(52);
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

fn generate_game_seed(master_seed: u64, game_id: u64, player: &linera_base::identifiers::AccountOwner) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    master_seed.hash(&mut hasher);
    game_id.hash(&mut hasher);
    player.hash(&mut hasher);
    hasher.finish()
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
                let parsed = value.parse::<u8>().unwrap_or(0);
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
