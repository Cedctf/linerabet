import { useEffect, useMemo, useState, useCallback } from "react";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";
import {
  calculateHandValue,
  renderHandValue,
  createDeck,
  shuffleArray,
  canSplit,
  canDoubleDown,
  type BlackjackCard,
} from "../lib/blackjack-utils";
import { lineraAdapter } from "@/lib/linera-adapter";
import Header from "../components/Header";

import { CONTRACTS_APP_ID } from "../constants";

// Cross-chain phases
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
  playerHands: ChainCard[][];  // Now a 2D array for split hands
  dealerHand: ChainCard[];
  playerValues: number[];  // Array of values for each hand
  dealerValue: number;
  activeHandIndex: number;
}

interface GameRecord {
  gameId: number;
  gameType: string;
  playerHands: ChainCard[][];  // Now a 2D array
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
  const { lineraData, isDebugMode, debugBalance, setDebugBalance } = useGame();

  // State for Debug Mode
  const [debugDeck, setDebugDeck] = useState<BlackjackCard[]>([]);
  const [debugGameHistory, setDebugGameHistory] = useState<GameRecord[]>([]);

  // State from chain
  const [balance, setBalance] = useState<number>(0);
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
  const effectiveBalance = isDebugMode ? debugBalance : balance;
  const effectiveHistory = isDebugMode ? debugGameHistory : gameHistory;

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
                        playerHands { suit value id }
                        dealerHand { suit value id }
                        playerValues
                        dealerValue
                        activeHandIndex
                    }
                    gameHistory {
                        gameId
                        gameType
                        playerHands { suit value id }
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
        // Handle multi-hand: playerHands is now Vec<Vec<Card>>
        const hands = game.playerHands || [];
        if (hands.length > 0) {
          // Set allHands for split mode, playerHand to first hand for compatibility
          const normalizedHands = hands.map((h: ChainCard[]) => normalizeCards(h));
          setAllHands(normalizedHands);
          setPlayerHand(normalizedHands[0] || []);
          setActiveHandIndex(game.activeHandIndex || 0);
          // Initialize handResults based on hand values and active index
          const newHandResults = normalizedHands.map((hand: BlackjackCard[], idx: number) => {
            const handValue = calculateHandValue(hand);
            if (handValue > 21) return 'bust' as const;
            if (idx < (game.activeHandIndex || 0)) return 'stand' as const;
            return 'playing' as const;
          });
          setHandResults(newHandResults);
        } else {
          setPlayerHand([]);
          setAllHands([]);
          setHandResults([]);
        }
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
          // Handle multi-hand in history
          const hands = latestGame.playerHands || [];
          if (hands.length > 0) {
            const normalizedHands = hands.map((h: ChainCard[]) => normalizeCards(h));
            setAllHands(normalizedHands);
            setPlayerHand(normalizedHands[0] || []);
          } else {
            setPlayerHand([]);
          }
          setDealerHand(normalizeCards(latestGame.dealerHand));
          setPhase("RoundComplete");
          setWaitingForResult(false);
          setLastShownGameId(latestGame.gameId);
          // Show popup after 3 second delay so player can see the cards
          setTimeout(() => {
            setShowResultPopup(true);
          }, 3000);
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
  }, [busy, isConnected, refresh, waitingForSeed, waitingForResult]);

  // ============================================================================
  // ACTION HANDLERS (blockchain only)
  // ============================================================================

  const handleAction = async (action: string, args: object = {}) => {
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
      } else if (action === "split") {
        mutation = `mutation { split }`;
      } else {
        mutation = `mutation { ${action} }`;
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

  // --- Debug Mode Helpers ---
  const drawCard = (deck: BlackjackCard[]) => {
    const newDeck = [...deck];
    const card = newDeck.pop();
    if (!card) return { card: null, deck: [] };
    return { card, deck: newDeck };
  };

  const resolveDebugGame = (finalHands: BlackjackCard[][], finalDealer: BlackjackCard[], currentBet: number) => {
    const dValue = calculateHandValue(finalDealer);
    const dBust = dValue > 21;
    const dBlackjack = dValue === 21 && finalDealer.length === 2;

    let totalPayout = 0;
    const lastResArr: Result[] = [];

    finalHands.forEach(hand => {
      const pValue = calculateHandValue(hand);
      const pBust = pValue > 21;
      const pBlackjack = pValue === 21 && hand.length === 2;

      let res: Result = null;
      let payout = 0;

      if (pBust) {
        res = "PlayerBust";
        payout = 0;
      } else if (pBlackjack && !dBlackjack) {
        res = "PlayerBlackjack";
        payout = currentBet * 2.5;
      } else if (dBust) {
        res = "DealerBust";
        payout = currentBet * 2;
      } else if (pValue > dValue) {
        res = "PlayerWin";
        payout = currentBet * 2;
      } else if (pValue < dValue) {
        res = "DealerWin";
        payout = 0;
      } else {
        res = "Push";
        payout = currentBet;
      }
      totalPayout += payout;
      lastResArr.push(res);
    });

    setLastResult(lastResArr[0]); // For popup compatibility
    setLastPayout(totalPayout);
    setDebugBalance(debugBalance - (allHands.length || 1) * currentBet + totalPayout);

    const record: GameRecord = {
      gameId: Date.now(),
      gameType: "BLACKJACK",
      playerHands: finalHands.map(h => h.map(c => ({ suit: c.suit, value: c.value.toString(), id: c.id }))),
      dealerHand: finalDealer.map(c => ({ suit: c.suit, value: c.value.toString(), id: c.id })),
      bet: currentBet,
      result: lastResArr[0],
      payout: totalPayout,
      timestamp: Date.now()
    };
    setDebugGameHistory(prev => [...prev, record]);

    setPhase("RoundComplete");
    setWaitingForResult(false);
    setTimeout(() => setShowResultPopup(true), 1500);
  };

  async function onStartGame() {
    if (busy) return;
    if (isDebugMode) {
      if (debugBalance < bet) {
        alert("Insufficient debug balance!");
        return;
      }
      setBusy(true);
      setWaitingForSeed(true);
      setGameStartedThisSession(true);

      setTimeout(() => {
        const deck = shuffleArray(createDeck());
        const p1 = deck.pop()!;
        const d1 = deck.pop()!;
        const p2 = deck.pop()!;
        const d2 = deck.pop()!;

        setPlayerHand([p1, p2]);
        setAllHands([[p1, p2]]);
        setDealerHand([d1, d2]);
        setDebugDeck(deck);
        setPhase("PlayerTurn");
        setWaitingForSeed(false);
        setBusy(false);
        setActiveHandIndex(0);
        setHandResults(['playing']);

        // Check for immediate blackjacks
        const pVal = calculateHandValue([p1, p2]);
        if (pVal === 21) {
          setPhase("DealerTurn");
          resolveDebugGame([[p1, p2]], [d1, d2], bet);
        }
      }, 800);
      return;
    }
    setLastBet(bet);
    await handleAction("playBlackjack", { bet });
  }

  async function onHit() {
    if (busy || phase !== "PlayerTurn") return;
    if (isDebugMode) {
      const { card, deck } = drawCard(debugDeck);
      if (!card) return;

      const newHand = [...currentHand, card];
      const newAllHands = [...allHands];
      newAllHands[activeHandIndex] = newHand;

      setAllHands(newAllHands);
      if (!isSplitMode) setPlayerHand(newHand);
      setDebugDeck(deck);

      const val = calculateHandValue(newHand);
      if (val >= 21) {
        if (isSplitMode && activeHandIndex < allHands.length - 1) {
          const newResults = [...handResults];
          newResults[activeHandIndex] = val > 21 ? 'bust' : 'stand';
          setHandResults(newResults);
          setActiveHandIndex(activeHandIndex + 1);
        } else {
          onStand();
        }
      }
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
    if (isDebugMode) {
      if (isSplitMode && activeHandIndex < allHands.length - 1) {
        const newResults = [...handResults];
        newResults[activeHandIndex] = 'stand';
        setHandResults(newResults);
        setActiveHandIndex(activeHandIndex + 1);
        return;
      }

      setPhase("DealerTurn");
      setWaitingForResult(true);

      setTimeout(() => {
        let currentDealer = [...dealerHand];
        let currentDeck = [...debugDeck];

        while (calculateHandValue(currentDealer) < 17) {
          const card = currentDeck.pop();
          if (!card) break;
          currentDealer.push(card);
        }

        setDealerHand(currentDealer);
        resolveDebugGame(allHands, currentDealer, bet);
      }, 1000);
      return;
    }
    await handleAction("stand");
  }

  async function onSplit() {
    if (busy || phase !== "PlayerTurn") return;
    if (isDebugMode) {
      const hand = allHands[activeHandIndex];
      if (!canSplit(hand)) return;
      if (debugBalance < (allHands.length + 1) * bet) {
        alert("Insufficient balance for split!");
        return;
      }

      let currentDeck = [...debugDeck];
      const card1 = currentDeck.pop()!;
      const card2 = currentDeck.pop()!;

      const newHand1 = [hand[0], card1];
      const newHand2 = [hand[1], card2];

      const newAllHands = [...allHands];
      newAllHands.splice(activeHandIndex, 1, newHand1, newHand2);

      setAllHands(newAllHands);
      setDebugDeck(currentDeck);
      setHandResults(newArray(newAllHands.length).fill('playing') as ('playing' | 'stand' | 'bust' | 'blackjack')[]);
      return;
    }
    await handleAction("split");
  }

  function newArray(len: number): any[] { return Array.from({ length: len }); }

  async function onDoubleDown() {
    if (busy || phase !== "PlayerTurn") return;
    if (isDebugMode) {
      const hand = allHands[activeHandIndex];
      if (!canDoubleDown(hand)) return;
      if (debugBalance < (allHands.length + 1) * bet) {
        alert("Insufficient balance for double!");
        return;
      }

      const { card, deck } = drawCard(debugDeck);
      if (!card) return;

      const newHand = [...hand, card];
      const newAllHands = [...allHands];
      newAllHands[activeHandIndex] = newHand;

      setAllHands(newAllHands);
      setDebugDeck(deck);

      // After double, we always stand
      if (isSplitMode && activeHandIndex < allHands.length - 1) {
        const newResults = [...handResults];
        newResults[activeHandIndex] = calculateHandValue(newHand) > 21 ? 'bust' : 'stand';
        setHandResults(newResults);
        setActiveHandIndex(activeHandIndex + 1);
      } else {
        onStand();
      }
      return;
    }
    // Check the correct hand based on split mode
    const handToCheck = isSplitMode ? allHands[activeHandIndex] : playerHand;
    if (!handToCheck || handToCheck.length !== 2) return;
    if (balance < lastBet) return;
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
                  disabled={busy || effectiveBalance < bet}
                  className="w-full mt-2 hover:scale-105 transition-all flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <img
                    src="/deal.png"
                    alt="Deal"
                    className="h-16 object-contain drop-shadow-lg"
                  />
                </button>

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
                  Dealer ({phase === "PlayerTurn" && dealerHand.length > 1
                    ? `${calculateHandValue([dealerHand[0]])} + ?`
                    : calculateHandValue(dealerHand)})
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
                        onClick={onSplit}
                        disabled={busy || effectiveBalance < bet || (() => {
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
                        disabled={busy || effectiveBalance < bet || (() => {
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
              <div className="bg-gradient-to-br from-green-900 to-green-950 rounded-lg border-2 border-green-600 p-6 max-w-5xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-3xl font-bold text-green-400">Game History</h2>
                  <button onClick={() => setShowHistory(false)} className="text-white text-3xl">✕</button>
                </div>
                {effectiveHistory.slice().reverse().map((game, i) => {
                  const normalizedResult = normalizeResult(game.result);
                  const gameIsWin = normalizedResult === "PLAYER_BLACKJACK" || normalizedResult === "PLAYER_WIN" || normalizedResult === "DEALER_BUST";
                  const gameNet = game.payout - game.bet;
                  // Get player hand (first hand from playerHands array)
                  const playerCards = game.playerHands && game.playerHands.length > 0 ? normalizeCards(game.playerHands[0]) : [];
                  const dealerCards = game.dealerHand ? normalizeCards(game.dealerHand) : [];
                  const playerTotal = calculateHandValue(playerCards);
                  const dealerTotal = calculateHandValue(dealerCards);

                  return (
                    <div key={i} className="border-b border-green-700 py-4">
                      {/* Result and Time Row */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-gray-400 text-sm">{new Date(game.timestamp / 1000).toLocaleTimeString()}</span>
                        <span className={gameIsWin ? "text-green-400 font-bold text-lg" : "text-red-400 font-bold text-lg"}>
                          {normalizedResult && renderResult(normalizedResult as any)} ({gameNet > 0 ? `+${gameNet}` : gameNet} chips)
                        </span>
                      </div>
                      {/* Cards Row */}
                      <div className="flex justify-between items-start gap-4">
                        {/* Player Cards */}
                        <div className="flex flex-col gap-1">
                          <span className="text-white/70 text-sm">You ({playerTotal}):</span>
                          <div className="flex gap-1">
                            {playerCards.map((card, idx) => (
                              <div key={idx} style={{ marginLeft: idx > 0 ? '-15px' : '0' }}>
                                <CardComp
                                  suit={card.suit as any}
                                  value={card.value as any}
                                  width={45}
                                  height={63}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Dealer Cards */}
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-white/70 text-sm">Dealer ({dealerTotal}):</span>
                          <div className="flex gap-1">
                            {dealerCards.map((card, idx) => (
                              <div key={idx} style={{ marginLeft: idx > 0 ? '-15px' : '0' }}>
                                <CardComp
                                  suit={card.suit as any}
                                  value={card.value as any}
                                  width={45}
                                  height={63}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
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
