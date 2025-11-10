#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::collections::BTreeMap;

use linera_base::{data_types::BlockHeight, identifiers::AccountOwner};
use linera_sdk::{
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};
use rand::{seq::SliceRandom, SeedableRng};
use rand_chacha::ChaCha20Rng;
use sha2::{Digest, Sha256};
use smartcontract::{
    Card, ContractResponse, GameConfig, GameId, GamePhase, Operation, PlayerActionKind,
    PlayerStatus, RoundOutcome, VrfRecord,
};

use self::state::{GameData, PlayerData, SmartcontractState};

const BLACKJACK_TOTAL: u8 = 21;
const DEALER_STAND_THRESHOLD: u8 = 17;

pub struct SmartcontractContract {
    state: SmartcontractState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(SmartcontractContract);

impl WithContractAbi for SmartcontractContract {
    type Abi = smartcontract::SmartcontractAbi;
}

impl Contract for SmartcontractContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = SmartcontractState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        SmartcontractContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        self.runtime.application_parameters();
        self.state.next_game_id.set(0);
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        match operation {
            Operation::CreateGame {
                max_players,
                min_bet,
                allow_mid_join,
                vrf_public_key,
                round_timeout,
            } => {
                let dealer = self.require_signer();
                assert_state(max_players > 0, "max_players must be positive");
                let game_id = self.allocate_game_id();
                let block = self.current_block();
                let config = GameConfig {
                    dealer,
                    max_players,
                    min_bet,
                    vrf_public_key,
                    allow_mid_join,
                    round_timeout,
                };
                let game = GameData {
                    config,
                    phase: GamePhase::Lobby,
                    players: BTreeMap::new(),
                    join_sequence: Vec::new(),
                    turn_order: Vec::new(),
                    dealer_hand: Vec::new(),
                    deck: Vec::new(),
                    combined_entropy: None,
                    vrf: None,
                    last_updated_at: block,
                };
                self.state
                    .games
                    .insert(&game_id, game)
                    .expect("Failed to insert game");
                ContractResponse::GameCreated { game_id }
            }
            Operation::JoinGame {
                game_id,
                bet,
                commitment,
            } => {
                let commitment = into_fixed::<32>(commitment, "commitment");
                let player = self.require_signer();
                let block = self.current_block();
                let game = self
                    .state
                    .games
                    .get_mut(&game_id)
                    .await
                    .expect("Storage error")
                    .expect("Game not found");
                assert_state(
                    game.phase == GamePhase::Lobby
                        || (game.config.allow_mid_join && game.phase == GamePhase::Reveal),
                    "Game not accepting new players",
                );
                assert_state(
                    (game.players.len() as u8) < game.config.max_players,
                    "Game is already full",
                );
                assert_state(bet >= game.config.min_bet, "Bet below table minimum");
                assert_state(
                    !game.players.contains_key(&player),
                    "Player already joined",
                );
                let player_data = PlayerData {
                    bet,
                    commitment,
                    revealed_entropy: None,
                    hand: Vec::new(),
                    status: PlayerStatus::Pending,
                    last_action: None,
                    result: None,
                };
                game.players.insert(player, player_data);
                game.join_sequence.push(player);
                if game.players.len() as u8 == game.config.max_players {
                    game.phase = GamePhase::Reveal;
                }
                game.last_updated_at = block;
                ContractResponse::Acknowledged
            }
            Operation::RevealCommitment { game_id, secret } => {
                let player = self.require_signer();
                let block = self.current_block();
                let game = self
                    .state
                    .games
                    .get_mut(&game_id)
                    .await
                    .expect("Storage error")
                    .expect("Game not found");
                assert_state(game.phase == GamePhase::Reveal, "Reveal phase not active");
                let player_entry = game
                    .players
                    .get_mut(&player)
                    .expect("Player not part of game");
                let hashed = hash_bytes(&secret);
                assert_state(
                    hashed == player_entry.commitment,
                    "Reveal does not match commitment",
                );
                let mut salted = secret.clone();
                salted.extend_from_slice(b":entropy");
                player_entry.revealed_entropy = Some(hash_bytes(&salted));
                if game
                    .players
                    .values()
                    .all(|p| p.revealed_entropy.is_some())
                {
                    game.phase = GamePhase::AwaitingVrf;
                }
                game.last_updated_at = block;
                ContractResponse::Acknowledged
            }
            Operation::SubmitVrf {
                game_id,
                output,
                proof,
                message,
            } => {
                let output = into_fixed::<32>(output, "output");
                let signer = self.require_signer();
                let block = self.current_block();
                let game = self
                    .state
                    .games
                    .get_mut(&game_id)
                    .await
                    .expect("Storage error")
                    .expect("Game not found");
                assert_state(
                    game.phase == GamePhase::AwaitingVrf,
                    "VRF not expected yet",
                );
                assert_state(
                    signer == game.config.dealer,
                    "Only the dealer may submit VRF output",
                );
                assert_state(
                    verify_vrf(&game.config.vrf_public_key, &proof, &message, &output),
                    "Invalid VRF proof",
                );
                game.vrf = Some(VrfRecord {
                    provider: signer,
                    public_key: game.config.vrf_public_key.clone(),
                    output,
                    proof,
                    message,
                });
                game.combined_entropy = compute_entropy(game_id, &game.players, output);
                assert_state(game.combined_entropy.is_some(), "Missing player revelations");
                game.phase = GamePhase::ReadyToDeal;
                game.last_updated_at = block;
                ContractResponse::Acknowledged
            }
            Operation::DealInitialHands { game_id } => {
                let signer = self.require_signer();
                let block = self.current_block();
                let game = self
                    .state
                    .games
                    .get_mut(&game_id)
                    .await
                    .expect("Storage error")
                    .expect("Game not found");
                assert_state(
                    signer == game.config.dealer,
                    "Only the dealer can deal cards",
                );
                assert_state(
                    game.phase == GamePhase::ReadyToDeal,
                    "Game not ready to deal",
                );
                let seed = game
                    .combined_entropy
                    .expect("Entropy missing despite ready state");
                let mut deck = shuffled_deck(seed);
                for player_id in &game.join_sequence {
                    if let Some(player) = game.players.get_mut(player_id) {
                        player.hand.clear();
                        player.hand.push(draw(&mut deck));
                        player.hand.push(draw(&mut deck));
                        let value = hand_value(&player.hand);
                        player.status = if value == BLACKJACK_TOTAL {
                            PlayerStatus::Blackjack
                        } else {
                            PlayerStatus::Active
                        };
                    }
                }
                game.dealer_hand.clear();
                game.dealer_hand.push(draw(&mut deck));
                game.dealer_hand.push(draw(&mut deck));
                game.deck = deck;
                game.turn_order = game
                    .join_sequence
                    .iter()
                    .copied()
                    .filter(|player_id| {
                        game.players
                            .get(player_id)
                            .map(|p| matches!(p.status, PlayerStatus::Active))
                            .unwrap_or(false)
                    })
                    .collect();
                game.phase = if game.turn_order.is_empty() {
                    GamePhase::DealerTurn
                } else {
                    GamePhase::PlayerTurns
                };
                game.last_updated_at = block;
                ContractResponse::Acknowledged
            }
            Operation::PlayerAction { game_id, action } => {
                let player = self.require_signer();
                let block = self.current_block();
                let game = self
                    .state
                    .games
                    .get_mut(&game_id)
                    .await
                    .expect("Storage error")
                    .expect("Game not found");
                assert_state(
                    game.phase == GamePhase::PlayerTurns,
                    "Not in player action phase",
                );
                let Some(current) = game.turn_order.first().copied() else {
                    panic!("No active player despite action phase");
                };
                assert_state(current == player, "It is not your turn");
                let mut advance = false;
                let new_status;
                {
                    let player_state = game.players.get_mut(&player).expect("Player not found");
                    match action {
                        PlayerActionKind::Hit => {
                            player_state.hand.push(draw(&mut game.deck));
                            let value = hand_value(&player_state.hand);
                            if value > BLACKJACK_TOTAL {
                                player_state.status = PlayerStatus::Busted;
                                advance = true;
                            }
                        }
                        PlayerActionKind::Stand => {
                            player_state.status = PlayerStatus::Stood;
                            advance = true;
                        }
                        PlayerActionKind::DoubleDown => {
                            assert_state(
                                player_state.hand.len() == 2,
                                "Double down allowed only on initial hand",
                            );
                            player_state.bet *= 2;
                            player_state.hand.push(draw(&mut game.deck));
                            let value = hand_value(&player_state.hand);
                            if value > BLACKJACK_TOTAL {
                                player_state.status = PlayerStatus::Busted;
                            } else {
                                player_state.status = PlayerStatus::Stood;
                            }
                            advance = true;
                        }
                    }
                    player_state.last_action = Some(action);
                    new_status = player_state.status;
                }
                if advance {
                    advance_turn(game);
                }
                if game.turn_order.is_empty() && game.phase == GamePhase::PlayerTurns {
                    game.phase = GamePhase::DealerTurn;
                }
                game.last_updated_at = block;
                ContractResponse::PlayerState {
                    status: new_status,
                }
            }
            Operation::ResolveDealer { game_id } => {
                let signer = self.require_signer();
                let block = self.current_block();
                let game = self
                    .state
                    .games
                    .get_mut(&game_id)
                    .await
                    .expect("Storage error")
                    .expect("Game not found");
                assert_state(
                    signer == game.config.dealer,
                    "Only the dealer resolves the round",
                );
                assert_state(
                    matches!(game.phase, GamePhase::DealerTurn | GamePhase::PlayerTurns),
                    "Cannot resolve dealer yet",
                );
                if !game.turn_order.is_empty() {
                    panic!("Players still have actions to take");
                }
                let mut dealer_value = hand_value(&game.dealer_hand);
                while dealer_value < DEALER_STAND_THRESHOLD {
                    game.dealer_hand.push(draw(&mut game.deck));
                    dealer_value = hand_value(&game.dealer_hand);
                }
                let dealer_busted = dealer_value > BLACKJACK_TOTAL;
                for player in game.players.values_mut() {
                    if matches!(player.status, PlayerStatus::Busted) {
                        player.result = Some(RoundOutcome {
                            final_value: hand_value(&player.hand).min(99),
                            dealer_value,
                            win_multiplier: -100,
                        });
                    } else if matches!(player.status, PlayerStatus::Blackjack) {
                        player.result = Some(RoundOutcome {
                            final_value: BLACKJACK_TOTAL,
                            dealer_value,
                            win_multiplier: 150,
                        });
                    } else {
                        let player_value = hand_value(&player.hand);
                        let win_multiplier = if dealer_busted || player_value > dealer_value {
                            100
                        } else if player_value == dealer_value {
                            0
                        } else {
                            -100
                        };
                        player.result = Some(RoundOutcome {
                            final_value: player_value,
                            dealer_value,
                            win_multiplier,
                        });
                    }
                    player.status = PlayerStatus::Settled;
                }
                game.phase = GamePhase::Settled;
                game.last_updated_at = block;
                ContractResponse::GameSettled { game_id }
            }
            Operation::CancelGame { game_id } => {
                let signer = self.require_signer();
                let block = self.current_block();
                let game = self
                    .state
                    .games
                    .get_mut(&game_id)
                    .await
                    .expect("Storage error")
                    .expect("Game not found");
                assert_state(signer == game.config.dealer, "Only the dealer can cancel");
                game.phase = GamePhase::Cancelled;
                game.last_updated_at = block;
                ContractResponse::Acknowledged
            }
        }
    }

    async fn execute_message(&mut self, _message: Self::Message) {}

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl SmartcontractContract {
    fn require_signer(&mut self) -> AccountOwner {
        self.runtime
            .authenticated_signer()
            .expect("Operation requires an authenticated signer")
    }

    fn current_block(&mut self) -> u64 {
        let BlockHeight(value) = self.runtime.block_height();
        value
    }

    fn allocate_game_id(&mut self) -> GameId {
        let current = *self.state.next_game_id.get();
        self.state.next_game_id.set(current.wrapping_add(1));
        current
    }
}

fn advance_turn(game: &mut GameData) {
    if !game.turn_order.is_empty() {
        game.turn_order.remove(0);
    }
}

fn draw(deck: &mut Vec<Card>) -> Card {
    deck.pop().expect("Deck exhausted")
}

fn shuffled_deck(seed: [u8; 32]) -> Vec<Card> {
    let mut cards: Vec<Card> = (0..52).map(Card::from_index).collect();
    let mut rng = ChaCha20Rng::from_seed(seed);
    cards.shuffle(&mut rng);
    cards
}

fn hand_value(cards: &[Card]) -> u8 {
    let mut total = 0u8;
    let mut aces = 0;
    for card in cards {
        let value = card.blackjack_value();
        total = total.saturating_add(value);
        if card.rank == 0 {
            aces += 1;
        }
    }
    while total > BLACKJACK_TOTAL && aces > 0 {
        total = total.saturating_sub(10);
        aces -= 1;
    }
    total
}

fn compute_entropy(
    game_id: GameId,
    players: &BTreeMap<AccountOwner, PlayerData>,
    vrf_output: [u8; 32],
) -> Option<[u8; 32]> {
    let mut hasher = Sha256::new();
    hasher.update(game_id.to_le_bytes());
    hasher.update(vrf_output);
    for player in players.values() {
        let Some(entropy) = player.revealed_entropy else {
            return None;
        };
        hasher.update(entropy);
    }
    Some(hasher.finalize().into())
}

fn hash_bytes(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().into()
}

fn verify_vrf(public_key: &[u8], proof: &[u8], message: &[u8], output: &[u8; 32]) -> bool {
    // Deterministic pseudo-VRF validation.
    let mut hasher = Sha256::new();
    hasher.update(public_key);
    hasher.update(proof);
    hasher.update(message);
    let digest: [u8; 32] = hasher.finalize().into();
    &digest == output
}

fn assert_state(condition: bool, message: &str) {
    if !condition {
        panic!("{message}");
    }
}

fn into_fixed<const N: usize>(bytes: Vec<u8>, field: &str) -> [u8; N] {
    assert_state(
        bytes.len() == N,
        &format!("{field} must be exactly {N} bytes long"),
    );
    let mut array = [0u8; N];
    array.copy_from_slice(&bytes);
    array
}

#[cfg(test)]
mod tests {
    use futures::FutureExt as _;
    use linera_base::identifiers::AccountOwner;
    use linera_sdk::{util::BlockingWait, views::View, Contract, ContractRuntime};
    use smartcontract::{ContractResponse, Operation};

    use super::{SmartcontractContract, SmartcontractState};

    #[test]
    fn create_game_flow() {
        let mut app = create_app();
        let dealer = sample_owner(1);
        app.runtime.set_authenticated_signer(Some(dealer));
        let response = app
            .execute_operation(Operation::CreateGame {
                max_players: 2,
                min_bet: 10,
                allow_mid_join: false,
                vrf_public_key: vec![1u8; 32],
                round_timeout: None,
            })
            .now_or_never()
            .unwrap();
        match response {
            ContractResponse::GameCreated { game_id } => {
                assert_eq!(game_id, 0);
            }
            _ => panic!("Unexpected response"),
        }
    }

    fn create_app() -> SmartcontractContract {
        let runtime = ContractRuntime::new().with_application_parameters(());
        let mut contract = SmartcontractContract {
            state: SmartcontractState::load(runtime.root_view_storage_context())
                .blocking_wait()
                .unwrap(),
            runtime,
        };
        contract.instantiate(()).blocking_wait();
        contract
    }

    fn sample_owner(index: u8) -> AccountOwner {
        AccountOwner::Address20([index; 20])
    }
}
