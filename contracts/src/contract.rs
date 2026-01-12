#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use contracts::{CasinoParams, CasinoInit, Operation, Message, GameType, GameAction, GameResult, Card, RouletteBet, RouletteBetType, BaccaratBetType};

use self::state::{ContractsState, PendingGame, ActiveGame, GamePhase, GameRecord, PendingRouletteGame, ALLOWED_BETS};

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

            Operation::PlayRoulette { bets } => {
                self.handle_play_roulette(signer, bets).await;
            }

            Operation::ReportRouletteResult { game_id, claimed_outcome } => {
                self.handle_report_roulette_result(signer, game_id, claimed_outcome).await;
            }

            Operation::PlayBaccarat { amount, bet_type } => {
                self.handle_play_baccarat(signer, amount, bet_type).await;
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

            Message::RequestRouletteGame { player, player_chain, bets } => {
                self.bank_handle_request_roulette(player, player_chain, bets).await;
            }

            Message::ReportRouletteResult { game_id, claimed_outcome } => {
                self.bank_handle_report_roulette_result(game_id, claimed_outcome).await;
            }

            Message::RequestBaccaratGame { player, player_chain, amount, bet_type } => {
                self.bank_handle_request_baccarat(player, player_chain, amount, bet_type).await;
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

            Message::RouletteGameReady { game_id, seed, bets } => {
                self.player_handle_roulette_ready(game_id, seed, bets).await;
            }

            Message::RouletteSettled { game_id, outcome, payout, bets } => {
                self.player_handle_roulette_settled(game_id, outcome, payout, bets).await;
            }



            Message::BaccaratSettled { 
                game_id, 
                winner, 
                payout, 
                player_hand, 
                banker_hand, 
                player_score, 
                banker_score,
                bet_amount,
                bet_type
            } => {
                self.player_handle_baccarat_settled(game_id, winner, payout, player_hand, banker_hand, player_score, banker_score, bet_amount, bet_type).await;
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
            .send_to(bank_chain_id);
    }

    /// Player starts a Roulette game - deducts total bet and sends to Bank
    async fn handle_play_roulette(&mut self, signer: linera_base::identifiers::AccountOwner, bets: Vec<RouletteBet>) {
        let total_bet: u64 = bets.iter().map(|b| b.amount).sum();
        
        let balance = *self.state.player_balance.get();
        assert!(balance >= total_bet, "Insufficient balance");
        
        // Deduct bet (escrow)
        self.state.player_balance.set(balance - total_bet);
        
        // Send request to Bank
        let bank_chain_id = self.bank_chain_id();
        let player_chain = self.runtime.chain_id();
        
        self.runtime
            .prepare_message(Message::RequestRouletteGame {
                player: signer,
                player_chain,
                bets,
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
                    roulette_bets: None,
                    roulette_outcome: None,
                    baccarat_winner: None,
                    baccarat_bet: None,
                };
                self.state.game_history.push(record);
            }
        }
        
        // Clear current game
        self.state.current_game.set(None);
    }

    /// Player receives roulette seed from Bank - calculate outcome locally
    async fn player_handle_roulette_ready(&mut self, game_id: u64, seed: u64, bets: Vec<RouletteBet>) {
        // Calculate outcome locally using same RNG as bank
        let mut rng = SimpleRng::new(seed);
        let outcome = (rng.next() % 37) as u8;
        
        // Store pending roulette game for UI to query
        let pending = PendingRouletteGame {
            game_id,
            seed,
            bets: bets.clone(),
            outcome,
        };
        self.state.pending_roulette.set(Some(pending));
        
        // Send verification to bank (bank has player info stored from RequestRouletteGame)
        let bank_chain_id = self.bank_chain_id();
        
        self.runtime
            .prepare_message(Message::ReportRouletteResult {
                game_id,
                claimed_outcome: outcome,
            })
            .with_tracking()
            .send_to(bank_chain_id);
    }

    /// Player sends roulette result to bank for verification (called by operation if auto-send fails)
    async fn handle_report_roulette_result(&mut self, _signer: linera_base::identifiers::AccountOwner, game_id: u64, claimed_outcome: u8) {
        // Get pending roulette game
        let pending = self.state.pending_roulette.get().clone()
            .expect("No pending roulette game");
        assert!(pending.game_id == game_id, "Game ID mismatch");
        assert!(pending.outcome == claimed_outcome, "Outcome mismatch");
        
        // Send to bank
        let bank_chain_id = self.bank_chain_id();
        
        self.runtime
            .prepare_message(Message::ReportRouletteResult {
                game_id,
                claimed_outcome,
            })
            .with_tracking()
            .send_to(bank_chain_id);
    }

    /// Player receives roulette settlement from Bank
    async fn player_handle_roulette_settled(&mut self, game_id: u64, outcome: u8, payout: u64, bets: Vec<RouletteBet>) {
        // Credit payout to player
        let balance = *self.state.player_balance.get();
        self.state.player_balance.set(balance + payout);
        
        let total_bet: u64 = bets.iter().map(|b| b.amount).sum();
        let now = self.runtime.system_time().micros();
        
        // Record in history
        let record = GameRecord {
            game_id,
            game_type: GameType::Roulette,
            player_hand: vec![],
            dealer_hand: vec![],
            bet: total_bet,
            result: if payout > 0 { GameResult::PlayerWin } else { GameResult::DealerWin },
            payout,
            timestamp: now,
            roulette_bets: Some(bets),
            roulette_outcome: Some(outcome),
            baccarat_winner: None,
            baccarat_bet: None,
        };
        self.state.game_history.push(record);
        
        // Clear pending roulette
        self.state.pending_roulette.set(None);
    }

    /// Player starts a Baccarat game - deducts bet and sends to Bank
    async fn handle_play_baccarat(&mut self, signer: linera_base::identifiers::AccountOwner, amount: u64, bet_type: BaccaratBetType) {
        let balance = *self.state.player_balance.get();
        assert!(balance >= amount, "Insufficient balance");
        
        // Deduct bet (escrow)
        self.state.player_balance.set(balance - amount);
        
        let bank_chain_id = self.bank_chain_id();
        let player_chain = self.runtime.chain_id();
        
        self.runtime
            .prepare_message(Message::RequestBaccaratGame {
                player: signer,
                player_chain,
                amount,
                bet_type,
            })
            .with_tracking()
            .send_to(bank_chain_id);
    }
    
    /// Player receives Baccarat seed from Bank
    /// Player receives Baccarat seed from Bank (Legacy/Unused - Baccarat is now Bank-Authoritative)
    /// This is removed as part of the refactor.

    
    /// Player receives Baccarat settlement from Bank
    async fn player_handle_baccarat_settled(
        &mut self,
        game_id: u64,
        winner: BaccaratBetType,
        payout: u64,
        player_hand: Vec<Card>,
        banker_hand: Vec<Card>,
        _player_score: u8,
        _banker_score: u8,
        bet_amount: u64,
        bet_type: BaccaratBetType,
    ) {
        // Credit payout
        let balance = *self.state.player_balance.get();
        self.state.player_balance.set(balance + payout);
        
        let result = match winner {
            BaccaratBetType::Player => GameResult::PlayerWin, // Approximate mapping
            BaccaratBetType::Banker => GameResult::DealerWin, // Bank wins
            BaccaratBetType::Tie => GameResult::Push,
        };
        
        let now = self.runtime.system_time().micros();
        
        let record = GameRecord {
            game_id,
            game_type: GameType::Baccarat,
            player_hand, 
            dealer_hand: banker_hand, // Map banker hand to dealer hand field
            bet: bet_amount,
            result, // This is lossy, maybe we should update GameRecord too?
            payout,
            timestamp: now,
            roulette_bets: None,
            roulette_outcome: None,
        baccarat_winner: Some(winner),
            baccarat_bet: Some(bet_type),
        };
        self.state.game_history.push(record);
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
        
        // Generate deterministic seed using master seed + game_id + player + TIMESTAMP
        let master_seed = *self.state.master_seed.get();
        let now = self.runtime.system_time().micros();
        let seed = generate_game_seed(master_seed, game_id, &player, now);
        
        // Store pending game
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

    /// Bank receives roulette game request - generate seed and send back
    async fn bank_handle_request_roulette(
        &mut self,
        player: linera_base::identifiers::AccountOwner,
        player_chain: linera_base::identifiers::ChainId,
        bets: Vec<RouletteBet>,
    ) {
        // Generate unique game ID
        let game_id = *self.state.game_counter.get();
        self.state.game_counter.set(game_id + 1);
        
        // Generate seed for this game
        let master_seed = *self.state.master_seed.get();
        let now = self.runtime.system_time().micros();
        let seed = generate_game_seed(master_seed, game_id, &player, now);
        
        // Store pending game
        self.state.pending_games.insert(&game_id, PendingGame {
            player,
            player_chain,
            game_type: GameType::Roulette,
            bet: bets.iter().map(|b| b.amount).sum(),
            seed,
            created_at: now,
        }).expect("Failed to insert pending game");
        
        // Store bets separately for payout calculation
        self.state.pending_roulette_bets.insert(&game_id, bets.clone())
            .expect("Failed to insert pending bets");
        
        // Send seed to player (player will calculate outcome locally)
        self.runtime
            .prepare_message(Message::RouletteGameReady { 
                game_id, 
                seed, 
                bets 
            })
            .with_tracking()
            .send_to(player_chain);
    }

    /// Bank verifies and settles roulette game
    async fn bank_handle_report_roulette_result(
        &mut self,
        game_id: u64,
        claimed_outcome: u8,
    ) {
        // Get pending game
        let pending = self.state.pending_games.get(&game_id).await
            .expect("Failed to get pending game")
            .expect("Game not found");
        
        // Game_id is unique and already tied to the player from RequestRouletteGame
        
        // Verify outcome
        let mut rng = SimpleRng::new(pending.seed);
        let expected_outcome = (rng.next() % 37) as u8;
        assert!(claimed_outcome == expected_outcome, "Outcome verification failed");
        
        // Get stored bets
        let bets = self.state.pending_roulette_bets.get(&game_id).await
            .expect("Failed to get bets")
            .expect("Bets not found");
        
        // Calculate payout using actual bets
        let payout = calculate_roulette_payout(&bets, expected_outcome);
        let total_bet: u64 = bets.iter().map(|b| b.amount).sum();
        
        // Update house balance
        let house = *self.state.house_balance.get();
        if payout > total_bet {
            self.state.house_balance.set(house.saturating_sub(payout - total_bet));
        } else {
            self.state.house_balance.set(house + (total_bet - payout));
        }
        
        // Remove pending game and bets
        self.state.pending_games.remove(&game_id).expect("Failed to remove pending game");
        self.state.pending_roulette_bets.remove(&game_id).expect("Failed to remove pending bets");
        
        // Send settlement to player
        self.runtime
            .prepare_message(Message::RouletteSettled { 
                game_id, 
                outcome: expected_outcome, 
                payout,
                bets,
            })
            .with_tracking()
            .with_tracking()
            .send_to(pending.player_chain);
    }

    /// Bank receives Baccarat game request - Runs game and settles immediately
    async fn bank_handle_request_baccarat(
        &mut self,
        player: linera_base::identifiers::AccountOwner,
        player_chain: linera_base::identifiers::ChainId,
        amount: u64,
        bet_type: BaccaratBetType,
    ) {
        // Generate unique game ID
        let game_id = *self.state.game_counter.get();
        self.state.game_counter.set(game_id + 1);
        
        // Generate seed
        let master_seed = *self.state.master_seed.get();
        let now = self.runtime.system_time().micros();
        let seed = generate_game_seed(master_seed, game_id, &player, now);
        
        // Run logic immediately
        let (actual_winner, player_hand, banker_hand, player_score, banker_score) = run_baccarat_game(seed);
        
        // Calculate payout
        let mut payout = 0;
        if actual_winner == bet_type {
            if bet_type == BaccaratBetType::Tie {
                payout = amount * 9; // 8:1 payout = 9x total return
            } else if bet_type == BaccaratBetType::Player {
                payout = amount * 2; // 1:1 payout
            } else if bet_type == BaccaratBetType::Banker {
                // 0.95:1 payout (5% commission)
                payout = amount + (amount * 95 / 100);
            }
        } else if actual_winner == BaccaratBetType::Tie && bet_type != BaccaratBetType::Tie {
            // Push on Tie
            payout = amount;
        }

        // Update house balance
        let house = *self.state.house_balance.get();
        if payout > amount {
            self.state.house_balance.set(house.saturating_sub(payout - amount));
        } else {
            self.state.house_balance.set(house + (amount - payout));
        }
        
        // Send settlement directly to player
        self.runtime
            .prepare_message(Message::BaccaratSettled {
                game_id,
                winner: actual_winner,
                payout,
                player_hand,
                banker_hand,
                player_score,
                banker_score,
                bet_amount: amount,
                bet_type,
            })
            .with_tracking()
            .send_to(player_chain);
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

fn generate_game_seed(master_seed: u64, game_id: u64, player: &linera_base::identifiers::AccountOwner, timestamp: u64) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    master_seed.hash(&mut hasher);
    game_id.hash(&mut hasher);
    player.hash(&mut hasher);
    timestamp.hash(&mut hasher); // Mix in the timestamp
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

fn calculate_roulette_payout(bets: &[RouletteBet], outcome: u8) -> u64 {
    let mut payout = 0;
    for bet in bets {
        let win = match bet.bet_type {
            RouletteBetType::Number => bet.number == Some(outcome),
            RouletteBetType::Split => {
                // Check if outcome is in the numbers array
                bet.numbers.as_ref().map_or(false, |nums| nums.contains(&outcome))
            },
            RouletteBetType::Street => {
                bet.numbers.as_ref().map_or(false, |nums| nums.contains(&outcome))
            },
            RouletteBetType::Corner => {
                bet.numbers.as_ref().map_or(false, |nums| nums.contains(&outcome))
            },
            RouletteBetType::Line => {
                // Line bet: 6 numbers (2 adjacent streets)
                bet.numbers.as_ref().map_or(false, |nums| nums.contains(&outcome))
            },
            RouletteBetType::Basket => {
                // First Four: 0, 1, 2, 3
                outcome == 0 || outcome == 1 || outcome == 2 || outcome == 3
            },
            RouletteBetType::Red => {
                let red_numbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
                red_numbers.contains(&outcome)
            },
            RouletteBetType::Black => {
                let black_numbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
                black_numbers.contains(&outcome)
            },
            RouletteBetType::Even => outcome != 0 && outcome % 2 == 0,
            RouletteBetType::Odd => outcome != 0 && outcome % 2 != 0,
            RouletteBetType::Low => outcome >= 1 && outcome <= 18,
            RouletteBetType::High => outcome >= 19 && outcome <= 36,
            RouletteBetType::Dozen1 => outcome >= 1 && outcome <= 12,
            RouletteBetType::Dozen2 => outcome >= 13 && outcome <= 24,
            RouletteBetType::Dozen3 => outcome >= 25 && outcome <= 36,
            RouletteBetType::Column1 => outcome != 0 && outcome % 3 == 0,  // 3,6,9,12,15,18,21,24,27,30,33,36
            RouletteBetType::Column2 => outcome != 0 && outcome % 3 == 2,  // 2,5,8,11,14,17,20,23,26,29,32,35
            RouletteBetType::Column3 => outcome != 0 && outcome % 3 == 1,  // 1,4,7,10,13,16,19,22,25,28,31,34
        };
        
        if win {
            let multiplier = match bet.bet_type {
                RouletteBetType::Number => 36,   // 35:1
                RouletteBetType::Split => 18,    // 17:1
                RouletteBetType::Street => 12,   // 11:1
                RouletteBetType::Corner => 9,    // 8:1
                RouletteBetType::Line => 6,      // 5:1
                RouletteBetType::Basket => 7,    // 6:1
                RouletteBetType::Dozen1 | RouletteBetType::Dozen2 | RouletteBetType::Dozen3 => 3, // 2:1
                RouletteBetType::Column1 | RouletteBetType::Column2 | RouletteBetType::Column3 => 3, // 2:1
                RouletteBetType::Red | RouletteBetType::Black | 
                RouletteBetType::Even | RouletteBetType::Odd | 
                RouletteBetType::Low | RouletteBetType::High => 2, // 1:1
            };
            payout += bet.amount * multiplier;
        }
    }
    payout
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

fn calculate_baccarat_score(cards: &[Card]) -> u8 {
    let mut score = 0;
    for c in cards {
        let val = match c.value.as_str() {
            "ace" => 1,
            "2" => 2,
            "3" => 3,
            "4" => 4,
            "5" => 5,
            "6" => 6,
            "7" => 7,
            "8" => 8,
            "9" => 9,
            _ => 0, // 10, J, Q, K are 0
        };
        score = (score + val) % 10;
    }
    score
}

fn run_baccarat_game(seed: u64) -> (BaccaratBetType, Vec<Card>, Vec<Card>, u8, u8) {
    let mut deck = create_deck();
    shuffle(&mut deck, seed);
    
    // Draw initial cards
    let p1 = deck.pop().unwrap();
    let b1 = deck.pop().unwrap();
    let p2 = deck.pop().unwrap();
    let b2 = deck.pop().unwrap();
    
    let mut player_hand = vec![p1, p2];
    let mut banker_hand = vec![b1, b2];
    
    let mut p_score = calculate_baccarat_score(&player_hand);
    let mut b_score = calculate_baccarat_score(&banker_hand);
    
    // Natural win check (8 or 9)
    if p_score >= 8 || b_score >= 8 {
        let winner = if p_score > b_score {
            BaccaratBetType::Player
        } else if b_score > p_score {
            BaccaratBetType::Banker
        } else {
            BaccaratBetType::Tie
        };
        return (winner, player_hand, banker_hand, p_score, b_score);
    }
    
    // Player draw rules
    let mut p_third = None;
    if p_score <= 5 {
        let c = deck.pop().unwrap();
        
        // Calculate third card value for Banker rule
        let val = match c.value.as_str() {
            "ace" => 1,
            "2" => 2,
            "3" => 3,
            "4" => 4,
            "5" => 5,
            "6" => 6,
            "7" => 7,
            "8" => 8,
            "9" => 9,
            _ => 0,
        };
        p_third = Some(val);
        
        player_hand.push(c);
        p_score = calculate_baccarat_score(&player_hand);
    }
    
    // Banker draw rules
    let banker_draws = if p_third.is_none() {
        // Player stood (6 or 7) -> Banker draws on 0-5, stands on 6-7
        b_score <= 5
    } else {
        // Player drew a third card
        let p_val = p_third.unwrap();
        match b_score {
            0..=2 => true, // Always draw
            3 => p_val != 8,
            4 => (2..=7).contains(&p_val),
            5 => (4..=7).contains(&p_val),
            6 => (6..=7).contains(&p_val),
            _ => false, // 7 stands
        }
    };
    
    if banker_draws {
        let c = deck.pop().unwrap();
        banker_hand.push(c);
        b_score = calculate_baccarat_score(&banker_hand);
    }
    
    let winner = if p_score > b_score {
        BaccaratBetType::Player
    } else if b_score > p_score {
        BaccaratBetType::Banker
    } else {
        BaccaratBetType::Tie
    };
    
    (winner, player_hand, banker_hand, p_score, b_score)
}
