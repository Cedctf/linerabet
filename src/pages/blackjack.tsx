import { useEffect, useMemo, useState, useCallback } from "react";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";
import {
  calculateHandValue,
  renderHandValue,
  type BlackjackCard,
} from "../lib/blackjack-utils";
import { lineraAdapter } from "@/lib/linera-adapter";
import Header from "../components/Header";

import { CONTRACTS_APP_ID } from "../constants";

// ============================================================================
// DEBUG MODE - Set to true to test UI without blockchain
// ============================================================================
const DEBUG_MODE_DEFAULT = false;

// Mock deck for debug mode
const MOCK_SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
const MOCK_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, "jack", "queen", "king", "ace"] as const;

function createMockDeck(): BlackjackCard[] {
  const deck: BlackjackCard[] = [];
  for (const suit of MOCK_SUITS) {
    for (const value of MOCK_VALUES) {
      deck.push({ suit, value: value as any, id: `${value}_of_${suit}` });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// New cross-chain phases
type Phase = "WaitingForGame" | "PlayerTurn" | "DealerTurn" | "RoundComplete";
type Result =
  | null
  | "PlayerBlackjack"
  | "PlayerWin"
  | "DealerWin"
  | "PlayerBust"
  | "DealerBust"
  | "Push";

type ChainCard = { suit: string; value: string; id: string };

interface CurrentGame {
  gameId: number;
  seed: number;
  bet: number;
  phase: string;
  playerHand: ChainCard[];
  dealerHand: ChainCard[];
  playerValue: number;
  dealerValue: number;
}

interface GameRecord {
  gameId: number;
  gameType: string;
  playerHand: ChainCard[];
  dealerHand: ChainCard[];
  bet: number;
  result: Result;
  payout: number;
  timestamp: number;
}

interface QueryResponse {
  playerBalance: number;
  currentGame: CurrentGame | null;
  gameHistory: GameRecord[];
  allowedBets: number[];
  isBank: boolean;
  bankChainId: string | null;
}

function normalizeCards(cards: ChainCard[]): BlackjackCard[] {
  return cards.map((c) => {
    const v = c.value.toLowerCase();
    if (v === "jack" || v === "queen" || v === "king" || v === "ace") {
      return { suit: c.suit as any, value: v as any, id: c.id };
    }
    const n = Number(v);
    return { suit: c.suit as any, value: (Number.isFinite(n) ? n : 0) as any, id: c.id };
  });
}

function normalizeResult(result: string | null): string | null {
  if (!result) return null;
  const map: Record<string, string> = {
    PlayerBlackjack: "PLAYER_BLACKJACK",
    PLAYER_BLACKJACK: "PLAYER_BLACKJACK",
    PlayerWin: "PLAYER_WIN",
    PLAYER_WIN: "PLAYER_WIN",
    DealerWin: "DEALER_WIN",
    DEALER_WIN: "DEALER_WIN",
    PlayerBust: "PLAYER_BUST",
    PLAYER_BUST: "PLAYER_BUST",
    DealerBust: "DEALER_BUST",
    DEALER_BUST: "DEALER_BUST",
    Push: "PUSH",
    PUSH: "PUSH",
  };
  return map[result] || result;
}

function normalizePhase(phase: string): Phase {
  const map: Record<string, Phase> = {
    WAITING_FOR_GAME: "WaitingForGame",
    WaitingForGame: "WaitingForGame",
    PLAYER_TURN: "PlayerTurn",
    PlayerTurn: "PlayerTurn",
    DEALER_TURN: "DealerTurn",
    DealerTurn: "DealerTurn",
    ROUND_COMPLETE: "RoundComplete",
    RoundComplete: "RoundComplete",
  };
  return map[phase] || "WaitingForGame";
}

export default function Blackjack() {
  const { lineraData } = useGame();

  // ============================================================================
  // DEBUG MODE STATE
  // ============================================================================
  const [debugMode, setDebugMode] = useState(DEBUG_MODE_DEFAULT);
  const [mockDeck, setMockDeck] = useState<BlackjackCard[]>([]);
  const [mockDealerHoleCard, setMockDealerHoleCard] = useState<BlackjackCard | null>(null);

  // State from chain (or mock in debug mode)
  const [balance, setBalance] = useState<number>(debugMode ? 100 : 0);
  const [allowedBets, setAllowedBets] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bet, setBet] = useState<number>(1);
  const [lastBet, setLastBet] = useState<number>(1);
  const [phase, setPhase] = useState<Phase>("WaitingForGame");
  const [lastResult, setLastResult] = useState<Result>(null);
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);

  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

  // Multi-hand split state
  // allHands[0] is the rightmost hand (played first), higher indices are further left
  const [allHands, setAllHands] = useState<BlackjackCard[][]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState<number>(0);
  const [handResults, setHandResults] = useState<('playing' | 'stand' | 'bust' | 'blackjack')[]>([]);

  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [waitingForSeed, setWaitingForSeed] = useState(false);
  const [waitingForResult, setWaitingForResult] = useState(false);
  const [lastShownGameId, setLastShownGameId] = useState<number | null>(null);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [gameStartedThisSession, setGameStartedThisSession] = useState(false);
  const [showControlsSidebar, setShowControlsSidebar] = useState(true);

  // Derived
  const canPlay = phase === "PlayerTurn";
  const isSplitMode = allHands.length > 1;
  const currentHand = allHands[activeHandIndex] || playerHand;

  const playerValue = useMemo(() => calculateHandValue(playerHand), [playerHand]);
  // Calculate values for all hands
  const allHandValues = useMemo(() => allHands.map(hand => calculateHandValue(hand)), [allHands]);
  const dealerValue = useMemo(() => {
    if (phase === "PlayerTurn" && dealerHand.length > 0) {
      return calculateHandValue([dealerHand[0]]);
    }
    return calculateHandValue(dealerHand);
  }, [dealerHand, phase]);
  const playerBust = playerValue > 21;
  const dealerBust = dealerValue > 21;

  // Calculate net win/loss
  const netResult = useMemo(() => {
    if (lastResult === null) return 0;
    return lastPayout - lastBet;
  }, [lastPayout, lastBet]);

  const refresh = useCallback(async () => {
    if (!lineraAdapter.isChainConnected()) return;

    try {
      if (!lineraAdapter.isApplicationSet()) {
        await lineraAdapter.setApplication(CONTRACTS_APP_ID);
      }

      const query = `
                query {
                    playerBalance
                    currentGame {
                        gameId
                        seed
                        bet
                        phase
                        playerHand { suit value id }
                        dealerHand { suit value id }
                        playerValue
                        dealerValue
                    }
                    gameHistory {
                        gameId
                        gameType
                        playerHand { suit value id }
                        dealerHand { suit value id }
                        bet
                        result
                        payout
                        timestamp
                    }
                    allowedBets
                    isBank
                    bankChainId
                }
            `;

      const data = await lineraAdapter.queryApplication<QueryResponse>(query, {});
      console.log("State refreshed:", data);

      setBalance(data.playerBalance || 0);
      setAllowedBets(data.allowedBets || [1, 2, 3, 4, 5]);

      const allHistory = data.gameHistory || [];
      console.log("All game history:", allHistory.map((g: any) => ({ gameId: g.gameId, gameType: g.gameType })));
      const newHistory = allHistory.filter(
        (g: GameRecord) => g.gameType?.toUpperCase() === "BLACKJACK"
      );
      setGameHistory(newHistory);

      // On first load (lastShownGameId is null), initialize it from history
      // to prevent showing old results when starting a new game
      if (lastShownGameId === null && newHistory.length > 0) {
        setLastShownGameId(newHistory[newHistory.length - 1].gameId);
      }

      if (data.currentGame) {
        const game = data.currentGame;
        setCurrentGameId(game.gameId);
        const gamePhase = normalizePhase(game.phase);
        setPhase(gamePhase);
        setPlayerHand(normalizeCards(game.playerHand));
        setDealerHand(normalizeCards(game.dealerHand));
        setWaitingForSeed(false);

        if (gamePhase === "RoundComplete" && !waitingForResult) {
          setWaitingForResult(true);
        }
      } else {
        const latestGame = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
        const isNewResult = latestGame && latestGame.gameId !== lastShownGameId;

        // Only show history results when waitingForResult (after stand/double/bust)
        // AND only if the game was started in this session (not old games after refresh)
        if (gameStartedThisSession && waitingForResult && latestGame && isNewResult) {
          setLastResult(latestGame.result);
          setLastPayout(latestGame.payout);
          setLastBet(latestGame.bet);
          setPlayerHand(normalizeCards(latestGame.playerHand));
          setDealerHand(normalizeCards(latestGame.dealerHand));
          setPhase("RoundComplete");
          setWaitingForResult(false);
          setLastShownGameId(latestGame.gameId);
          // Show popup after 1 second delay so player can see the cards
          setTimeout(() => {
            setShowResultPopup(true);
          }, 1000);
        } else if (!waitingForSeed && !waitingForResult && phase !== "RoundComplete") {
          setPhase("WaitingForGame");
          setPlayerHand([]);
          setDealerHand([]);
          setCurrentGameId(null);
        }
      }

      if (waitingForSeed && data.currentGame) {
        setWaitingForSeed(false);
      }

    } catch (err) {
      console.error("Failed to refresh game state:", err);
    }
  }, [waitingForSeed, waitingForResult, lastShownGameId, phase, gameStartedThisSession]);

  useEffect(() => {
    const handleConnectionChange = () => {
      const connected = lineraAdapter.isChainConnected();
      setIsConnected(connected);
      if (connected) {
        refresh();
      }
    };

    handleConnectionChange();
    const unsubscribe = lineraAdapter.subscribe(handleConnectionChange);
    return () => unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!isConnected) return;

    const pollInterval = (waitingForSeed || waitingForResult) ? 800 : 3000;

    const syncInterval = setInterval(() => {
      if (!busy) {
        refresh().catch(console.error);
      }
    }, pollInterval);
    return () => clearInterval(syncInterval);
  }, [busy, isConnected, refresh, waitingForSeed, waitingForResult, debugMode]);

  // ============================================================================
  // DEBUG MODE GAME LOGIC
  // ============================================================================

  function debugDealerPlay(currentDealerHand: BlackjackCard[], deck: BlackjackCard[], playerValue: number): { finalDealerHand: BlackjackCard[], result: Result, payout: number } {
    const newDealerHand = [...currentDealerHand];
    const newDeck = [...deck];

    // Dealer hits until 17
    while (calculateHandValue(newDealerHand) < 17 && newDeck.length > 0) {
      newDealerHand.push(newDeck.pop()!);
    }

    const dealerFinalValue = calculateHandValue(newDealerHand);
    let result: Result;
    let payout = 0;

    if (playerValue > 21) {
      result = "PlayerBust";
      payout = 0;
    } else if (dealerFinalValue > 21) {
      result = "DealerBust";
      payout = lastBet * 2;
    } else if (playerValue > dealerFinalValue) {
      result = "PlayerWin";
      payout = lastBet * 2;
    } else if (dealerFinalValue > playerValue) {
      result = "DealerWin";
      payout = 0;
    } else {
      result = "Push";
      payout = lastBet;
    }

    return { finalDealerHand: newDealerHand, result, payout };
  }

  function debugStartGame() {
    const deck = createMockDeck();
    const playerCard1 = deck.pop()!;
    const playerCard2 = deck.pop()!;
    const dealerUp = deck.pop()!;
    const dealerHole = deck.pop()!;

    setMockDeck(deck);
    setMockDealerHoleCard(dealerHole);
    setPlayerHand([playerCard1, playerCard2]);
    setDealerHand([dealerUp]);
    setPhase("PlayerTurn");
    setBalance(prev => prev - bet);
    setLastBet(bet);
    setLastResult(null);
    setShowResultPopup(false);
    setCurrentGameId(Date.now());
    // Reset multi-hand split state
    setAllHands([]);
    setActiveHandIndex(0);
    setHandResults([]);

    // Check for blackjack
    const handValue = calculateHandValue([playerCard1, playerCard2]);
    if (handValue === 21) {
      const fullDealerHand = [dealerUp, dealerHole];
      const dealerValue = calculateHandValue(fullDealerHand);
      setDealerHand(fullDealerHand);
      setPhase("RoundComplete");
      if (dealerValue === 21) {
        setLastResult("Push");
        setLastPayout(bet);
        setBalance(prev => prev + bet);
      } else {
        setLastResult("PlayerBlackjack");
        const payout = Math.floor(bet * 2.5);
        setLastPayout(payout);
        setBalance(prev => prev + payout);
      }
      setTimeout(() => setShowResultPopup(true), 1000);
    }
  }

  // Debug function to start game with a splittable hand (two cards of same value)
  function debugStartGameWithSplit() {
    const deck = createMockDeck();

    // Find two cards with the same value for a splittable hand
    let playerCard1: BlackjackCard | null = null;
    let playerCard2: BlackjackCard | null = null;

    // Pick a random value to split on
    const splitValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'jack', 'queen', 'king', 'ace'];
    const targetValue = splitValues[Math.floor(Math.random() * splitValues.length)];

    // Find two cards with the target value
    const matchingCards = deck.filter(c => c.value === targetValue);
    if (matchingCards.length >= 2) {
      playerCard1 = matchingCards[0];
      playerCard2 = matchingCards[1];
      // Remove them from deck
      const idx1 = deck.indexOf(playerCard1);
      deck.splice(idx1, 1);
      const idx2 = deck.indexOf(playerCard2);
      deck.splice(idx2, 1);
    } else {
      // Fallback: just use first two cards
      playerCard1 = deck.pop()!;
      playerCard2 = deck.pop()!;
    }

    const dealerUp = deck.pop()!;
    const dealerHole = deck.pop()!;

    setMockDeck(deck);
    setMockDealerHoleCard(dealerHole);
    setPlayerHand([playerCard1!, playerCard2!]);
    setDealerHand([dealerUp]);
    setPhase("PlayerTurn");
    setBalance(prev => prev - bet);
    setLastBet(bet);
    setLastResult(null);
    setShowResultPopup(false);
    setCurrentGameId(Date.now());
    // Reset multi-hand split state
    setAllHands([]);
    setActiveHandIndex(0);
    setHandResults([]);
  }

  // Debug function to start game that allows TRIPLE+ splits
  // This arranges deck so split hands will also get pairs
  function debugStartGameWithTripleSplit() {
    const deck = createMockDeck();

    // Pick a value that has 4 cards (for triple split potential)
    const splitValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'jack', 'queen', 'king', 'ace'];
    const targetValue = splitValues[Math.floor(Math.random() * splitValues.length)];

    // Find ALL 4 cards with the target value
    const matchingCards = deck.filter(c => c.value === targetValue);

    // Remove all matching cards from deck
    matchingCards.forEach(card => {
      const idx = deck.indexOf(card);
      if (idx !== -1) deck.splice(idx, 1);
    });

    // Stack the deck: put 2 matching cards on top (for the split draws)
    // Then the player's 2 starting cards
    const dealerUp = deck.pop()!;
    const dealerHole = deck.pop()!;

    // Place the matching cards at top of deck so splits will get pairs
    // When you split: first hand gets matchingCards[2], second gets matchingCards[3]
    if (matchingCards.length >= 4) {
      deck.push(matchingCards[3]); // Will be drawn for second split hand
      deck.push(matchingCards[2]); // Will be drawn for first split hand
    }

    setMockDeck(deck);
    setMockDealerHoleCard(dealerHole);
    setPlayerHand([matchingCards[0], matchingCards[1]]); // Starting pair
    setDealerHand([dealerUp]);
    setPhase("PlayerTurn");
    setBalance(prev => prev - bet);
    setLastBet(bet);
    setLastResult(null);
    setShowResultPopup(false);
    setCurrentGameId(Date.now());
    // Reset multi-hand split state
    setAllHands([]);
    setActiveHandIndex(0);
    setHandResults([]);
  }

  // Debug function to start game that ends in a PUSH (Tie)
  function debugStartGameWithPush() {
    const deck = createMockDeck();

    // Give player two 10s (20)
    const playerCard1 = deck.find(c => (c.value === 10 || c.value === 'jack' || c.value === 'queen' || c.value === 'king'))!;
    deck.splice(deck.indexOf(playerCard1), 1);
    const playerCard2 = deck.find(c => (c.value === 10 || c.value === 'jack' || c.value === 'queen' || c.value === 'king'))!;
    deck.splice(deck.indexOf(playerCard2), 1);

    // Give dealer two 10s (20)
    const dealerUp = deck.find(c => (c.value === 10 || c.value === 'jack' || c.value === 'queen' || c.value === 'king'))!;
    deck.splice(deck.indexOf(dealerUp), 1);
    const dealerHole = deck.find(c => (c.value === 10 || c.value === 'jack' || c.value === 'queen' || c.value === 'king'))!;
    deck.splice(deck.indexOf(dealerHole), 1);

    setMockDeck(deck);
    setMockDealerHoleCard(dealerHole);
    setPlayerHand([playerCard1, playerCard2]);
    setDealerHand([dealerUp]);
    setPhase("PlayerTurn");
    setBalance(prev => prev - bet);
    setLastBet(bet);
    setLastResult(null);
    setShowResultPopup(false);
    setCurrentGameId(Date.now());
    setAllHands([]);
    setActiveHandIndex(0);
    setHandResults([]);
  }

  // Helper function to move to next hand or finish the round
  function moveToNextHandOrFinish(currentHandIdx: number, newHandResults: ('playing' | 'stand' | 'bust' | 'blackjack')[]) {
    // Find next hand that is still 'playing' (move to higher index = further left)
    let nextHandIdx = -1;
    for (let i = currentHandIdx + 1; i < newHandResults.length; i++) {
      if (newHandResults[i] === 'playing') {
        nextHandIdx = i;
        break;
      }
    }

    if (nextHandIdx !== -1) {
      // Move to next hand
      setActiveHandIndex(nextHandIdx);
    } else {
      // All hands done - dealer plays
      finishRoundWithDealer(newHandResults);
    }
  }

  // Calculate final results for all hands against dealer
  function finishRoundWithDealer(finalHandResults: ('playing' | 'stand' | 'bust' | 'blackjack')[]) {
    const fullDealerHand = mockDealerHoleCard ? [...dealerHand, mockDealerHoleCard] : dealerHand;

    // Dealer plays (hits until 17)
    let currentDealerHand = [...fullDealerHand];
    let currentDeck = [...mockDeck];
    while (calculateHandValue(currentDealerHand) < 17 && currentDeck.length > 0) {
      currentDealerHand.push(currentDeck.pop()!);
    }

    setDealerHand(currentDealerHand);
    setMockDeck(currentDeck);

    const dealerFinalValue = calculateHandValue(currentDealerHand);

    // Calculate total payout for all hands
    let totalPayout = 0;

    allHands.forEach((hand, idx) => {
      const handValue = calculateHandValue(hand);
      const handResult = finalHandResults[idx];

      if (handResult === 'bust') {
        // Already lost this bet
      } else if (handResult === 'blackjack') {
        totalPayout += Math.floor(lastBet * 2.5);
      } else if (dealerFinalValue > 21) {
        totalPayout += lastBet * 2;
      } else if (handValue > dealerFinalValue) {
        totalPayout += lastBet * 2;
      } else if (handValue === dealerFinalValue) {
        totalPayout += lastBet; // Push - return bet
      } else {
        // Dealer wins this hand
      }
    });

    // Summary Result based on Net Profit
    const totalInitialBet = lastBet * allHands.length;
    let overallResult: Result = "Push";
    if (totalPayout > totalInitialBet) {
      overallResult = "PlayerWin";
    } else if (totalPayout < totalInitialBet) {
      overallResult = "DealerWin";
    } else {
      overallResult = "Push";
    }

    setPhase("RoundComplete");
    setLastResult(overallResult);
    setLastPayout(totalPayout);
    setBalance(prev => prev + totalPayout);
    setTimeout(() => setShowResultPopup(true), 500);
  }

  function debugHit() {
    if (mockDeck.length === 0) return;

    const newDeck = [...mockDeck];
    const card = newDeck.pop()!;

    if (!isSplitMode) {
      // Normal single hand
      const newHand = [...playerHand, card];
      setMockDeck(newDeck);
      setPlayerHand(newHand);

      const handValue = calculateHandValue(newHand);
      if (handValue > 21) {
        // Bust - reveal dealer card and end
        const fullDealerHand = mockDealerHoleCard ? [...dealerHand, mockDealerHoleCard] : dealerHand;
        setDealerHand(fullDealerHand);
        setPhase("RoundComplete");
        setLastResult("PlayerBust");
        setLastPayout(0);
        setTimeout(() => setShowResultPopup(true), 500);
      }
    } else {
      // Split mode - hit the active hand
      const newHands = [...allHands];
      newHands[activeHandIndex] = [...newHands[activeHandIndex], card];
      setMockDeck(newDeck);
      setAllHands(newHands);

      const handValue = calculateHandValue(newHands[activeHandIndex]);
      if (handValue > 21) {
        // This hand busts - mark it and move to next
        const newResults = [...handResults];
        newResults[activeHandIndex] = 'bust';
        setHandResults(newResults);
        moveToNextHandOrFinish(activeHandIndex, newResults);
      }
    }
  }

  function debugStand() {
    if (!isSplitMode) {
      // Normal single hand - dealer plays immediately
      const fullDealerHand = mockDealerHoleCard ? [...dealerHand, mockDealerHoleCard] : dealerHand;
      const { finalDealerHand, result, payout } = debugDealerPlay(fullDealerHand, mockDeck, playerValue);

      setDealerHand(finalDealerHand);
      setPhase("RoundComplete");
      setLastResult(result);
      setLastPayout(payout);
      setBalance(prev => prev + payout);
      setTimeout(() => setShowResultPopup(true), 500);
    } else {
      // Split mode - mark this hand as done and move to next
      const newResults = [...handResults];
      newResults[activeHandIndex] = 'stand';
      setHandResults(newResults);
      moveToNextHandOrFinish(activeHandIndex, newResults);
    }
  }

  function debugDoubleDown() {
    if (mockDeck.length === 0) return;
    if (balance < lastBet) return;

    // Double the bet
    setBalance(prev => prev - lastBet);

    // Draw one card
    const newDeck = [...mockDeck];
    const card = newDeck.pop()!;

    if (!isSplitMode) {
      // Normal single hand
      const newBet = lastBet * 2;
      setLastBet(newBet);
      const newHand = [...playerHand, card];
      setMockDeck(newDeck);
      setPlayerHand(newHand);

      // Then stand automatically
      setTimeout(() => {
        const handValue = calculateHandValue(newHand);
        const fullDealerHand = mockDealerHoleCard ? [...dealerHand, mockDealerHoleCard] : dealerHand;

        if (handValue > 21) {
          setDealerHand(fullDealerHand);
          setPhase("RoundComplete");
          setLastResult("PlayerBust");
          setLastPayout(0);
          setTimeout(() => setShowResultPopup(true), 1000);
        } else {
          const { finalDealerHand, result, payout } = debugDealerPlay(fullDealerHand, newDeck, handValue);
          setDealerHand(finalDealerHand);
          setPhase("RoundComplete");
          setLastResult(result);
          setLastPayout(payout);
          setBalance(prev => prev + payout);
          setTimeout(() => setShowResultPopup(true), 1000);
        }
      }, 300);
    } else {
      // Split mode - double on current hand then move to next
      const newHands = [...allHands];
      newHands[activeHandIndex] = [...newHands[activeHandIndex], card];
      setMockDeck(newDeck);
      setAllHands(newHands);

      const handValue = calculateHandValue(newHands[activeHandIndex]);
      const newResults = [...handResults];
      newResults[activeHandIndex] = handValue > 21 ? 'bust' : 'stand';
      setHandResults(newResults);

      // Move to next hand
      setTimeout(() => {
        moveToNextHandOrFinish(activeHandIndex, newResults);
      }, 300);
    }
  }

  function debugSplit() {
    // Determine which hand we're splitting
    const handToSplit = isSplitMode ? allHands[activeHandIndex] : playerHand;

    if (handToSplit.length !== 2) return;
    if (handToSplit[0].value !== handToSplit[1].value) return;
    if (balance < lastBet) return;
    if (mockDeck.length < 2) return;

    // Deduct additional bet for split
    setBalance(prev => prev - lastBet);

    const newDeck = [...mockDeck];

    // Split the hand: first card goes to new hand (will be further left), second stays in current
    const leftCard = handToSplit[0];
    const rightCard = handToSplit[1];

    // Deal one card to each hand
    const newLeftCard = newDeck.pop()!;
    const newRightCard = newDeck.pop()!;

    setMockDeck(newDeck);

    if (!isSplitMode) {
      // First split: initialize allHands with two hands
      // Index 0 = rightmost (current), higher indices = further left
      setAllHands([
        [rightCard, newRightCard],  // Index 0: rightmost hand (played first)
        [leftCard, newLeftCard]     // Index 1: left hand (played second)
      ]);
      setActiveHandIndex(0);
      setHandResults(['playing', 'playing']);
      setPlayerHand([]); // Clear playerHand since we're using allHands now
    } else {
      // Re-split: insert a new hand after current position
      const newHands = [...allHands];
      const newResults = [...handResults];

      // Update current hand with rightCard
      newHands[activeHandIndex] = [rightCard, newRightCard];

      // Insert new hand after current (higher index = further left)
      newHands.splice(activeHandIndex + 1, 0, [leftCard, newLeftCard]);
      newResults.splice(activeHandIndex + 1, 0, 'playing');

      setAllHands(newHands);
      setHandResults(newResults);
    }
  }

  // ============================================================================
  // NORMAL ACTION HANDLERS (uses blockchain or debug mode)
  // ============================================================================

  const handleAction = async (action: string, args: object = {}) => {
    if (debugMode) return; // Debug mode uses separate handlers

    setBusy(true);
    try {
      let mutation: string;

      if (action === "requestChips") {
        mutation = `mutation { requestChips }`;
      } else if (action === "playBlackjack") {
        const betAmount = (args as any).bet;
        mutation = `mutation { playBlackjack(bet: ${betAmount}) }`;
        setWaitingForSeed(true);
        setGameStartedThisSession(true);
        setLastResult(null);
        setLastPayout(0);
        setShowResultPopup(false);
      } else if (action === "hit") {
        mutation = `mutation { hit }`;
      } else if (action === "stand") {
        mutation = `mutation { stand }`;
        setWaitingForResult(true);
      } else if (action === "doubleDown") {
        mutation = `mutation { doubleDown }`;
        setWaitingForResult(true);
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      await lineraAdapter.mutate(mutation);
      await refresh();

    } catch (err: any) {
      console.error(`Failed to execute ${action}:`, err);
      setWaitingForSeed(false);
      setWaitingForResult(false);
      alert(`Action failed: ${err.message || JSON.stringify(err)}`);
    } finally {
      setBusy(false);
    }
  };

  async function onStartGame() {
    if (busy) return;
    if (debugMode) {
      debugStartGame();
      return;
    }
    setLastBet(bet);
    await handleAction("playBlackjack", { bet });
  }

  async function onHit() {
    if (busy || phase !== "PlayerTurn") return;
    if (debugMode) {
      debugHit();
      return;
    }
    await handleAction("hit");
    setTimeout(async () => {
      await refresh();
      if (playerValue > 21) {
        setWaitingForResult(true);
      }
    }, 300);
  }

  async function onStand() {
    if (busy || phase !== "PlayerTurn") return;
    if (debugMode) {
      debugStand();
      return;
    }
    await handleAction("stand");
  }

  async function onDoubleDown() {
    if (busy || phase !== "PlayerTurn") return;
    // Check the correct hand based on split mode
    const handToCheck = isSplitMode ? allHands[activeHandIndex] : playerHand;
    if (!handToCheck || handToCheck.length !== 2) return;
    if (balance < lastBet) return;
    if (debugMode) {
      debugDoubleDown();
      return;
    }
    await handleAction("doubleDown");
  }

  function renderResult(r: Exclude<Result, null>) {
    const normalized = normalizeResult(r);
    switch (normalized) {
      case "PLAYER_BLACKJACK": return "Blackjack! You Win 🎉";
      case "PLAYER_WIN": return "You Win! 🎉";
      case "DEALER_WIN": return "Dealer Wins 😢";
      case "PLAYER_BUST": return "You Bust 😵";
      case "DEALER_BUST": return "Dealer Busts! You Win 🎉";
      case "PUSH": return "Push (Tie)";
    }
    return normalized;
  }

  const isWin =
    normalizeResult(lastResult) === "PLAYER_BLACKJACK" ||
    normalizeResult(lastResult) === "PLAYER_WIN" ||
    normalizeResult(lastResult) === "PLAYER_WIN_MULTI" ||
    normalizeResult(lastResult) === "DEALER_BUST";

  const isPush = normalizeResult(lastResult) === "PUSH";

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/blackjack-desk.png')" }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <Header />

        {/* Debug Mode Toggle - Top Left (below header) */}
        <div className="fixed top-20 left-4 z-50 flex flex-col gap-2">
          <button
            onClick={() => {
              const newDebugMode = !debugMode;
              setDebugMode(newDebugMode);
              if (newDebugMode) {
                setBalance(100);
                setPhase("WaitingForGame");
                setPlayerHand([]);
                setDealerHand([]);
                setIsConnected(true);
              }
            }}
            className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${debugMode
              ? "bg-red-600 text-white border-2 border-red-400 shadow-lg shadow-red-500/50"
              : "bg-gray-800/80 text-gray-400 border border-gray-600 hover:bg-gray-700"
              }`}
          >
            🛠️ {debugMode ? "DEBUG ON" : "Debug Off"}
          </button>

          {/* Balance Display */}
          <div className={`px-3 py-2 rounded-lg text-center font-bold ${debugMode ? "bg-red-900/80 border border-red-500" : "bg-black/60 border border-white/20"
            }`}>
            <div className="text-xs text-white/60">Balance</div>
            <div className="text-xl text-yellow-400">{balance} 🪙</div>
          </div>
        </div>

        {/* History Button - Bottom Left Corner (always visible) */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="group fixed bottom-4 left-4 z-30 hover:scale-110 transition-transform"
          style={{ width: '8vw', height: '18vh' }}
        >
          <img
            src="/buttons/history.png"
            alt="History"
            className="w-full h-full object-contain group-hover:hidden"
          />
          <img
            src="/animations/history.gif"
            alt="History"
            className="w-full h-full object-contain hidden group-hover:block"
          />
        </button>

        {/* Main Game Area */}
        <div className="flex-1 flex flex-col justify-between px-4 pb-4">

          {/* Betting Phase - Bottom Right Corner */}
          {phase === "WaitingForGame" && !waitingForSeed && !waitingForResult && (
            <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-20">
              <div className="bg-black/60 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-2xl">
                <div className="text-sm font-semibold text-white/80 mb-2 text-center">Place Bet</div>
                <div className="flex items-center gap-2 mb-3">
                  {allowedBets.map((val) => (
                    <button
                      key={val}
                      onClick={() => setBet(val)}
                      className={`relative transition-all hover:scale-110 ${bet === val ? "scale-125 drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" : "opacity-90 hover:opacity-100"}`}
                    >
                      <img
                        src={`/Chips/chip${val}.png`}
                        alt={`$${val} Chip`}
                        className="w-16 h-16 object-contain"
                      />
                    </button>
                  ))}
                </div>
                <button
                  onClick={onStartGame}
                  disabled={busy || balance < bet}
                  className="w-full mt-2 hover:scale-105 transition-all flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <img
                    src="/deal.png"
                    alt="Deal"
                    className="h-16 object-contain drop-shadow-lg"
                  />
                </button>

                {/* Debug Split Deal Button - only visible in debug mode */}
                {debugMode && (
                  <button
                    onClick={debugStartGameWithSplit}
                    disabled={busy || balance < bet}
                    className="w-full mt-2 px-4 py-2 bg-gradient-to-b from-red-500 to-red-700 border-2 border-red-400 rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-white font-bold">✂️ Deal Split</span>
                    </div>
                    <div className="text-xs text-red-200">Debug: Forces splittable hand</div>
                  </button>
                )}

                {/* Debug Triple Split Button - only visible in debug mode */}
                {debugMode && (
                  <button
                    onClick={debugStartGameWithTripleSplit}
                    disabled={busy || balance < bet * 4} // Need money for up to 4 hands
                    className="w-full mt-2 px-4 py-2 bg-gradient-to-b from-orange-500 to-orange-700 border-2 border-orange-400 rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-white font-bold">✂️✂️✂️ Triple Split</span>
                    </div>
                    <div className="text-xs text-orange-200">Debug: 4 same cards for multi-split</div>
                  </button>
                )}

                {/* Debug Push Deal Button - only visible in debug mode */}
                {debugMode && (
                  <button
                    onClick={debugStartGameWithPush}
                    disabled={busy || balance < bet}
                    className="w-full mt-2 px-4 py-2 bg-gradient-to-b from-gray-500 to-gray-700 border-2 border-gray-400 rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-white font-bold">🤝 Deal Push</span>
                    </div>
                    <div className="text-xs text-gray-200">Debug: Ties with dealer</div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Waiting for Seed Banner */}
          {waitingForSeed && (
            <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
              <div className="text-3xl font-bold text-yellow-400 animate-pulse">
                🎲 Starting Game...
              </div>
            </div>
          )}

          {/* Waiting for Result Banner */}
          {!waitingForSeed && waitingForResult && (
            <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
              <div className="text-3xl font-bold text-yellow-400 animate-pulse">
                ⏳ Calculating Result...
              </div>
            </div>
          )}

          {/* Game Board */}
          {(phase === "PlayerTurn" || phase === "DealerTurn" || phase === "RoundComplete") && (
            <div className="flex-1 flex flex-col justify-between items-center py-4 relative">
              {/* Dealer Hand - Top Area */}
              <div className="w-full max-w-lg flex flex-col items-center mt-[145px]">
                <div className="text-lg font-semibold text-white/80 mb-2 drop-shadow-lg">
                  Dealer ({renderHandValue(dealerHand)})
                </div>
                <div className="flex justify-center min-h-[140px] items-center px-4">
                  {dealerHand.map((card, idx) => (
                    <div key={idx} className="transform hover:scale-105 transition-transform" style={{ marginLeft: idx > 0 ? '-20px' : '0' }}>
                      <CardComp
                        suit={card.suit as any}
                        value={card.value as any}
                        hidden={phase === "PlayerTurn" && idx === 1}
                        width={90}
                        height={126}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Result Popup with Try Again - Center */}
              {showResultPopup && phase === "RoundComplete" && lastResult && (
                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                  <div className="relative">
                    {/* Win/Lose/Push Image */}
                    <img
                      src={isWin ? "/animations/win.png" : isPush ? "/animations/push.png" : "/animations/lose.png"}
                      alt={isWin ? "You Win!" : isPush ? "Push!" : "You Lose"}
                      className="max-w-[50vw] max-h-[60vh] object-contain"
                    />
                    {/* Try Again Button - Overlaid at bottom of image */}
                    <button
                      onClick={() => {
                        setShowResultPopup(false);
                        setPhase("WaitingForGame");
                        setLastResult(null);
                        setPlayerHand([]);
                        setDealerHand([]);
                        setCurrentGameId(null);
                        // Reset multi-hand split state
                        setAllHands([]);
                        setActiveHandIndex(0);
                        setHandResults([]);
                      }}
                      className="absolute bottom-[5%] left-1/2 -translate-x-1/2 hover:scale-110 transition-transform"
                      style={{ width: '15vw', height: '12vh' }}
                    >
                      <img
                        src="/buttons/try-again.png"
                        alt="Play Again"
                        className="w-full h-full object-contain"
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Player Hand - Bottom Area */}
              {!isSplitMode ? (
                /* Normal single hand display */
                <div className="w-full max-w-lg flex flex-col items-center mb-[-15px]">
                  <div className="text-lg font-semibold text-white/80 mb-2 drop-shadow-lg">
                    You ({renderHandValue(playerHand)})
                  </div>
                  <div className="flex justify-center min-h-[140px] items-center px-4">
                    {playerHand.map((card, idx) => (
                      <div key={idx} className="transform hover:scale-105 transition-transform" style={{ marginLeft: idx > 0 ? '-20px' : '0' }}>
                        <CardComp suit={card.suit as any} value={card.value as any} width={90} height={126} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Split mode: multiple hands displayed right to left */
                <div className="w-full max-w-6xl flex justify-center gap-8 mb-[-15px] flex-wrap">
                  {/* Display hands in reverse order so rightmost (index 0) appears on right side */}
                  {[...allHands].reverse().map((hand, reversedIdx) => {
                    const handIndex = allHands.length - 1 - reversedIdx; // Convert back to actual index
                    const isActive = handIndex === activeHandIndex;
                    const handValue = allHandValues[handIndex] || 0;
                    const result = handResults[handIndex];
                    const isBust = handValue > 21;
                    const isDone = result === 'stand' || result === 'bust' || result === 'blackjack';

                    return (
                      <div
                        key={handIndex}
                        className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-105' : isDone ? 'scale-90 opacity-50' : 'scale-95 opacity-70'
                          }`}
                      >
                        <div className={`text-lg font-semibold mb-2 drop-shadow-lg px-3 py-1 rounded-lg ${isActive
                          ? 'text-yellow-400 bg-yellow-500/20 border border-yellow-400'
                          : isBust
                            ? 'text-red-400 bg-red-500/20 border border-red-400'
                            : isDone
                              ? 'text-green-400 bg-green-500/20 border border-green-400'
                              : 'text-white/80'
                          }`}>
                          Hand {allHands.length - handIndex} ({renderHandValue(hand)})
                          {isBust && ' 💥'}
                          {result === 'stand' && ' ✓'}
                        </div>
                        <div className={`flex justify-center min-h-[140px] items-center px-4 rounded-xl transition-all ${isActive ? 'ring-4 ring-yellow-400/50 bg-yellow-500/10' : ''
                          }`}>
                          {hand.map((card: BlackjackCard, cardIdx: number) => (
                            <div key={cardIdx} className="transform hover:scale-105 transition-transform" style={{ marginLeft: cardIdx > 0 ? '-20px' : '0' }}>
                              <CardComp suit={card.suit as any} value={card.value as any} width={90} height={126} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Collapsible Controls Sidebar - Right Side */}
              {phase === "PlayerTurn" && (
                <div
                  className={`fixed bottom-4 right-0 z-30 flex items-center transition-all duration-300 ${showControlsSidebar ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                  {/* Toggle Button - Protrudes to the left of the sliding container */}
                  <button
                    onClick={() => setShowControlsSidebar(!showControlsSidebar)}
                    className="absolute left-0 -translate-x-full bg-gray-800/90 hover:bg-gray-700 border-2 border-gray-600 rounded-l-lg h-20 w-8 flex items-center justify-center shrink-0"
                  >
                    <span className="text-white text-2xl font-bold">
                      {showControlsSidebar ? '›' : '‹'}
                    </span>
                  </button>

                  {/* Sidebar Panel */}
                  <div className="bg-gray-900/95 border-l-2 border-t-2 border-b-2 border-gray-600 rounded-l-xl p-4 shadow-2xl">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Top Row: Split, Double */}
                      <button
                        onClick={() => { if (debugMode) debugSplit(); }}
                        disabled={busy || balance < lastBet || (() => {
                          // Check if current hand can be split
                          const handToCheck = isSplitMode ? allHands[activeHandIndex] : playerHand;
                          if (!handToCheck || handToCheck.length !== 2) return true;
                          return handToCheck[0]?.value !== handToCheck[1]?.value;
                        })()}
                        className="relative hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-b from-blue-500 to-blue-700 border-4 border-blue-300 rounded-xl shadow-lg flex items-center justify-center"
                        style={{ width: '8vw', height: '18vh', minWidth: '80px' }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-white font-bold text-lg drop-shadow-lg">SPLIT</span>
                          <span className="text-yellow-300 font-semibold text-sm">✂️</span>
                        </div>
                      </button>

                      <button
                        onClick={onDoubleDown}
                        disabled={busy || balance < lastBet || (() => {
                          const handToCheck = isSplitMode ? allHands[activeHandIndex] : playerHand;
                          return !handToCheck || handToCheck.length !== 2;
                        })()}
                        className="relative hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-b from-purple-500 to-purple-700 border-4 border-purple-300 rounded-xl shadow-lg flex items-center justify-center"
                        style={{ width: '8vw', height: '18vh', minWidth: '80px' }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-white font-bold text-lg drop-shadow-lg">DOUBLE</span>
                          <span className="text-yellow-300 font-semibold text-sm">x2</span>
                        </div>
                      </button>

                      {/* Bottom Row: Hit, Stand */}
                      <button
                        onClick={onHit}
                        disabled={busy}
                        className="group relative hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ width: '8vw', height: '18vh' }}
                      >
                        <img
                          src="/buttons/hit.png"
                          alt="Hit"
                          className="w-full h-full object-contain group-hover:hidden"
                        />
                        <img
                          src="/animations/hit.gif"
                          alt="Hit"
                          className="w-full h-full object-contain hidden group-hover:block"
                        />
                      </button>

                      <button
                        onClick={onStand}
                        disabled={busy}
                        className="group relative hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ width: '8vw', height: '18vh' }}
                      >
                        <img
                          src="/buttons/stand.png"
                          alt="Stand"
                          className="w-full h-full object-contain group-hover:hidden"
                        />
                        <img
                          src="/animations/stand.gif"
                          alt="Stand"
                          className="w-full h-full object-contain hidden group-hover:block"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Modal */}
          {showHistory && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-gradient-to-br from-green-900 to-green-950 rounded-lg border-2 border-green-600 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-3xl font-bold text-green-400">Game History</h2>
                  <button onClick={() => setShowHistory(false)} className="text-white text-3xl">✕</button>
                </div>
                {gameHistory.slice().reverse().map((game, i) => {
                  const normalizedResult = normalizeResult(game.result);
                  const gameIsWin = normalizedResult === "PLAYER_BLACKJACK" || normalizedResult === "PLAYER_WIN" || normalizedResult === "DEALER_BUST";
                  const gameNet = game.payout - game.bet;
                  return (
                    <div key={i} className="border-b border-green-700 py-2">
                      <div className="flex justify-between">
                        <span>{new Date(game.timestamp / 1000).toLocaleTimeString()}</span>
                        <span className={gameIsWin ? "text-green-400" : "text-red-400"}>
                          {normalizedResult && renderResult(normalizedResult as any)} ({gameNet > 0 ? `+${gameNet}` : gameNet})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
