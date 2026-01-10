import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";
import {
  calculateHandValue,
  type BlackjackCard, // typings only
} from "../lib/blackjack-utils";
import { lineraAdapter } from "@/lib/linera-adapter";

// New Multi-User Blackjack Application ID
import { CONTRACTS_APP_ID } from "../constants";


// GraphQL returns UPPER_SNAKE_CASE enums on your network.
type Phase = "WaitingForBet" | "BettingPhase" | "PlayerTurn" | "DealerTurn" | "RoundComplete";
type Result =
  | null
  | "PlayerBlackjack"
  | "PlayerWin"
  | "DealerWin"
  | "PlayerBust"
  | "DealerBust"
  | "Push";

// Cards as they arrive from the chain service
type ChainCard = { suit: string; value: string; id: string };

interface GameRecord {
  playerHand: ChainCard[];
  dealerHand: ChainCard[];
  bet: number;
  result: Result;
  payout: number;
  timestamp: number;
}

interface PlayerState {
  playerBalance: number;
  // Flattened Blackjack fields
  currentBet: number;
  phase: Phase;
  lastResult: Result | null;
  playerHand: ChainCard[];
  dealerHand: ChainCard[];
  gameHistory: GameRecord[];
}

interface QueryResponse {
  player: PlayerState | null;
  defaultBuyIn: number;
  deployer: string | null;
}

/** Convert chain cards ("2","3",...,"10","jack","queen","king","ace") to BlackjackCard (2..10 | faces) */
function normalizeCards(cards: ChainCard[]): BlackjackCard[] {
  return cards.map((c) => {
    const v = c.value.toLowerCase();
    if (v === "jack" || v === "queen" || v === "king" || v === "ace") {
      // keep faces as strings (matches blackjack-utils expectation)
      return { suit: c.suit as any, value: v as any, id: c.id };
    }
    // numeric strings -> numbers (e.g., "10" -> 10)
    const n = Number(v);
    return { suit: c.suit as any, value: (Number.isFinite(n) ? n : 0) as any, id: c.id };
  });
}

/** Convert PascalCase enum result to UPPER_SNAKE_CASE for display */
function normalizeResult(result: string | null): string | null {
  if (!result) return null;
  const map: Record<string, string> = {
    PlayerBlackjack: "PLAYER_BLACKJACK",
    PlayerWin: "PLAYER_WIN",
    DealerWin: "DEALER_WIN",
    PlayerBust: "PLAYER_BUST",
    DealerBust: "DEALER_BUST",
    Push: "PUSH",
  };
  return map[result] || result;
}

/** Convert chain phase (UPPER_SNAKE_CASE) to frontend Phase (PascalCase) */
function normalizePhase(phase: string): Phase {
  const map: Record<string, Phase> = {
    WAITING_FOR_BET: "WaitingForBet",
    BETTING_PHASE: "BettingPhase",
    PLAYER_TURN: "PlayerTurn",
    DEALER_TURN: "DealerTurn",
    ROUND_COMPLETE: "RoundComplete",
  };
  // Handle both UPPER_SNAKE_CASE (GraphQL default) and PascalCase (possible overrides)
  return map[phase.toUpperCase()] || (phase as Phase);
}

export default function Blackjack() {
  // On-chain mirrors
  const { lineraData } = useGame();
  const balance = lineraData?.gameBalance || 0;
  const [, setCurrentBet] = useState<number>(0);
  const [allowedBets, setAllowedBets] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bet, setBet] = useState<number>(1);
  const [lastBet, setLastBet] = useState<number>(1);
  const [phase, setPhase] = useState<Phase>("WaitingForBet");
  const phaseRef = useRef<Phase>("WaitingForBet");
  const [lastResult, setLastResult] = useState<Result>(null);

  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

  // UI
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Derived flags
  const canPlay = phase === "PlayerTurn";
  const roundOver = phase === "RoundComplete";

  // Hand values
  const playerValue = useMemo(() => calculateHandValue(playerHand), [playerHand]);
  // During player turn, only show dealer's first card value
  const dealerValue = useMemo(() => {
    if (phase === "PlayerTurn" && dealerHand.length > 0) {
      return calculateHandValue([dealerHand[0]]);
    }
    return calculateHandValue(dealerHand);
  }, [dealerHand, phase]);
  const playerBust = playerValue > 21;
  const dealerBust = dealerValue > 21;

  // ...

  const refresh = useCallback(async () => {
    if (!lineraAdapter.isChainConnected()) return;

    try {
      // Ensure application is set
      if (!lineraAdapter.isApplicationSet()) {
        await lineraAdapter.setApplication(CONTRACTS_APP_ID);
      }

      const owner = lineraAdapter.identity();
      const query = `
        query GetPlayerState($owner: AccountOwner!) {
          player(owner: $owner) {
            playerBalance
            currentBet
            phase
            lastResult
            playerHand {
              suit
              value
              id
            }
            dealerHand {
              suit
              value
              id
            }
            gameHistory {
              playerHand { suit value }
              dealerHand { suit value }
              bet
              result
              payout
              timestamp
            }
          }

          defaultBuyIn
          deployer
        }
      `;

      const data = await lineraAdapter.queryApplication<QueryResponse>(query, { owner });
      console.log("State refreshed:", data);

      if (data.player) {
        // Flattened response directly on data.player
        const player = data.player; // It is 'PlayerStateObject' which has the fields directly

        /* 
           Note: The typescript interface QueryResponse also needs to be updated to match this flat structure
           but since we cast 'data' to any or just read fields, we must update the usage below.
        */

        // Balance is now handled by GameContext
        // const effectiveBalance = isNewPlayer ? data.defaultBuyIn : data.player.playerBalance;
        // setBalance(effectiveBalance);
        setCurrentBet(player.currentBet);
        // allowedBets is typically static or matched to contract constants [1,2,3,4,5]
        setAllowedBets([1, 2, 3, 4, 5]);

        const chainPhase = normalizePhase(player.phase);
        let effectivePhase = chainPhase;

        if (chainPhase === "RoundComplete" && (phaseRef.current === "WaitingForBet" || phaseRef.current === "BettingPhase")) {
          effectivePhase = phaseRef.current;
        } else {
          effectivePhase = chainPhase;
          phaseRef.current = chainPhase;
        }

        setPhase(effectivePhase);
        setLastResult(player.lastResult);

        if (effectivePhase === "WaitingForBet") {
          setPlayerHand([]);
          setDealerHand([]);
        } else {
          setPlayerHand(normalizeCards(player.playerHand));
          setDealerHand(normalizeCards(player.dealerHand));
        }

        setGameHistory(player.gameHistory);
      } else {
        // Fallback
        // setBalance(data.defaultBuyIn);
        setPhase("WaitingForBet");
        phaseRef.current = "WaitingForBet";
        setAllowedBets([1, 2, 3, 4, 5]);
        setPlayerHand([]);
        setDealerHand([]);
        setGameHistory([]);
      }
    } catch (err) {
      console.error("Failed to refresh game state:", err);
    }
  }, [bet]);

  // Initial setup and subscription to connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      const connected = lineraAdapter.isChainConnected();
      setIsConnected(connected);
      if (connected) {
        refresh();
      }
    };

    // Initial check
    handleConnectionChange();

    // Subscribe to updates
    const unsubscribe = lineraAdapter.subscribe(handleConnectionChange);
    return () => unsubscribe();
  }, [refresh]);

  // Periodic state sync to recover from errors/lag
  useEffect(() => {
    if (!isConnected) return;
    const syncInterval = setInterval(() => {
      // Only sync if not busy to avoid interrupting operations
      if (!busy) {
        refresh().catch(console.error);
      }
    }, 5000); // Sync every 5 seconds
    return () => clearInterval(syncInterval);
  }, [busy, isConnected, refresh]);







  const handleAction = async (action: string, args: object = {}) => {
    setBusy(true);
    try {
      let mutation: string;

      // Construct GraphQL mutation matching contracts/src/lib.rs Operation enum
      // async-graphql defaults to camelCase for variant names.
      if (action === "requestChips") {
        mutation = `mutation { requestChips }`;
      } else if (action === "startGame") {
        const bet = (args as any).bet;
        mutation = `mutation { startGame(bet: ${bet}) }`;
      } else if (action === "hit") {
        mutation = `mutation { hit }`;
      } else if (action === "stand") {
        mutation = `mutation { stand }`;
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      await lineraAdapter.mutate(mutation);
      await refresh();
    } catch (err: any) {
      console.error(`Failed to execute ${action}:`, err);
      // Alert the user so they know why it failed (e.g. "Game already in progress")
      alert(`Action failed: ${err.message || JSON.stringify(err)}`);
    } finally {
      setBusy(false);
    }
  };

  async function onEnterBetting() {
    if (busy) return;
    // Local reset only - no transaction needed
    setPhase("WaitingForBet");
    phaseRef.current = "WaitingForBet";
    setPlayerHand([]);
    setDealerHand([]);
    setLastResult(null);
  }

  async function onStartGame() {
    if (busy) return;
    setLastBet(bet);
    await handleAction("startGame", { bet });
  }

  async function onHit() {
    if (busy || phase !== "PlayerTurn") return;
    await handleAction("hit");
  }

  async function onStand() {
    if (busy || phase !== "PlayerTurn") return;
    await handleAction("stand");
  }



  function onRepeatBet() {
    setBet(lastBet);
  }

  function onDoubleBet() {
    const doubled = lastBet * 2;
    if (allowedBets.includes(doubled)) {
      setBet(doubled);
    }
  }

  // Result text
  function renderResult(r: Exclude<Result, null>) {
    const normalized = normalizeResult(r);
    switch (normalized) {
      case "PLAYER_BLACKJACK":
        return "Blackjack! You Win 🎉";
      case "PLAYER_WIN":
        return "You Win! 🎉";
      case "DEALER_WIN":
        return "Dealer Wins 😢";
      case "PLAYER_BUST":
        return "You Bust 😵";
      case "DEALER_BUST":
        return "Dealer Busts! You Win 🎉";
      case "PUSH":
        return "Push (Tie)";
    }
    return normalized;
  }

  // Banner classes
  const isWin =
    normalizeResult(lastResult) === "PLAYER_BLACKJACK" ||
    normalizeResult(lastResult) === "PLAYER_WIN" ||
    normalizeResult(lastResult) === "DEALER_BUST";
  const isPush = normalizeResult(lastResult) === "PUSH";
  const resultClass = isWin
    ? "bg-green-500/20 text-green-400 border border-green-500"
    : isPush
      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500"
      : "bg-red-500/20 text-red-400 border border-red-500";

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background / styling */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-900 to-green-950 opacity-90" />
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />
      <div className="absolute top-20 left-20 w-96 h-96 bg-green-500 rounded-full opacity-10 blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-green-600 rounded-full opacity-10 blur-3xl" />

      <div className="relative z-10">


        <main className="flex flex-col items-center justify-center gap-3 py-4 px-4 min-h-[calc(100vh-80px)] pt-24">
          {/* Title / wallet-ish header */}
          <div className="relative w-full max-w-4xl mb-2">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
                Blackjack
              </h1>
            </div>

            {/* History Button */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="absolute right-0 top-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2"
            >
              📜 History ({gameHistory.length})
            </button>
          </div>

          {/* First game / Idle State - Direct bet, no confirmation */}
          {phase === "WaitingForBet" && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              {/* Betting Controls */}
              <div className="flex flex-col items-center gap-4 bg-green-900/50 p-6 rounded-lg border-2 border-green-700/50 w-full">
                <h3 className="text-2xl font-semibold text-green-200">Place Your Bet</h3>
                <p className="text-green-300 text-sm">Select chips and start game when ready</p>

                {/* Chip selector */}
                <div className="flex items-center gap-4 flex-wrap justify-center">
                  {allowedBets.map((chipValue) => (
                    <button
                      key={chipValue}
                      onClick={() => setBet(chipValue)}
                      disabled={busy || balance < chipValue}
                      className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all shadow-lg ${bet === chipValue
                        ? "border-yellow-400 bg-gradient-to-br from-yellow-500 to-yellow-600 scale-110"
                        : "border-white bg-gradient-to-br from-red-500 to-red-700 hover:scale-105"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {chipValue}
                    </button>
                  ))}
                </div>

                {/* Quick bet buttons */}
                <div className="flex gap-3 flex-wrap justify-center">
                  <button
                    onClick={onRepeatBet}
                    disabled={busy}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-60"
                  >
                    Repeat ({lastBet})
                  </button>
                  <button
                    onClick={onDoubleBet}
                    disabled={busy || !allowedBets.includes(lastBet * 2)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-60"
                  >
                    Double ({lastBet * 2})
                  </button>
                </div>

                {/* Play Button - Directly starts game */}
                <button
                  onClick={onStartGame}
                  disabled={busy || balance < bet}
                  className="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-xl text-xl disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all"
                >
                  {busy ? "⏳ Dealing..." : `🎲 Play (Bet: ${bet})`}
                </button>
              </div>
            </div>
          )}

          {/* Round Complete - Show result */}
          {phase === "RoundComplete" && lastResult && (
            <div className="flex flex-col items-center gap-6 bg-green-900/50 p-10 rounded-lg border-2 border-green-700/50 w-full max-w-2xl">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Round Result:</div>
                <div className={`text-4xl font-bold mb-4 ${isWin ? "text-green-400" : isPush ? "text-yellow-400" : "text-red-400"
                  }`}>
                  {renderResult(lastResult)}
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={onEnterBetting}
                  disabled={busy}
                  className="px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-xl text-xl disabled:opacity-50 transition-all"
                >
                  Stop Play
                </button>
                <button
                  onClick={onEnterBetting}
                  disabled={busy}
                  className="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-xl text-xl disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all"
                >
                  {busy ? "⏳ Starting..." : "Play Next Round"}
                </button>
              </div>
            </div>
          )}

          {/* Betting Phase - select chips (no timer) */}
          {phase === "BettingPhase" && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              {/* Betting Controls */}
              <div className="flex flex-col items-center gap-4 bg-green-900/50 p-6 rounded-lg border-2 border-green-700/50 w-full">
                <h3 className="text-xl font-semibold text-green-200">Confirm Your Bet</h3>

                {/* Chip selector */}
                <div className="flex items-center gap-4 flex-wrap justify-center">
                  {allowedBets.map((chipValue) => (
                    <button
                      key={chipValue}
                      onClick={() => setBet(chipValue)}
                      disabled={busy || balance < chipValue}
                      className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all shadow-lg ${bet === chipValue
                        ? "border-yellow-400 bg-gradient-to-br from-yellow-500 to-yellow-600 scale-110"
                        : "border-white bg-gradient-to-br from-red-500 to-red-700 hover:scale-105"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {chipValue}
                    </button>
                  ))}
                </div>

                {/* Quick bet buttons */}
                <div className="flex gap-3 flex-wrap justify-center">
                  <button
                    onClick={onRepeatBet}
                    disabled={busy}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-60"
                  >
                    Repeat ({lastBet})
                  </button>
                  <button
                    onClick={onDoubleBet}
                    disabled={busy || !allowedBets.includes(lastBet * 2)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-60"
                  >
                    Double ({lastBet * 2})
                  </button>
                </div>

                {/* Confirm Bet Button */}
                <button
                  onClick={onStartGame}
                  disabled={busy || balance < bet}
                  className="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-xl text-xl disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-105 transition-all"
                >
                  {busy ? "⏳ Starting..." : `✓ Confirm Bet (${bet})`}
                </button>
              </div>
            </div>
          )}


          {/* Dealer area */}
          <div className="w-full max-w-4xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold">Dealer&apos;s Hand</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    {dealerHand.length > 0 ? dealerValue : "-"}
                  </div>
                  {dealerBust && <div className="text-red-400 text-sm font-semibold">BUST!</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                {dealerHand.length > 0 ? (
                  <>
                    {dealerHand.map((card, idx) => (
                      <div key={`${card.id}-${idx}`} className="transform hover:scale-105 transition-transform">
                        <CardComp suit={card.suit as any} value={card.value as any} width={90} height={126} />
                      </div>
                    ))}
                    {/* Show hidden card during player turn */}
                    {phase === "PlayerTurn" && dealerHand.length === 1 && (
                      <div className="transform hover:scale-105 transition-transform">
                        <CardComp
                          hidden
                          width={90}
                          height={126}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-green-300 text-sm">No cards dealt</p>
                )}
              </div>
              {phase === "DealerTurn" && (
                <div className="text-yellow-400 text-sm font-semibold animate-pulse">
                  Dealer is playing...
                </div>
              )}
            </div>
          </div>

          {/* Result + action buttons */}
          <div className="flex flex-col items-center gap-3 my-2">
            {roundOver && lastResult && (
              <div className={`text-2xl font-bold px-6 py-3 rounded-lg ${resultClass}`}>
                {renderResult(lastResult)}
              </div>
            )}

            {canPlay && (
              <div className="flex flex-col gap-3 items-center">


                {busy && (
                  <div className="text-yellow-300 text-sm animate-pulse">
                    ⏳ Processing on blockchain...
                  </div>
                )}
                <div className="flex gap-4">
                  <button
                    onClick={onHit}
                    disabled={busy}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? "⏳ Hit" : "Hit"}
                  </button>
                  <button
                    onClick={onStand}
                    disabled={busy}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? "⏳ Stand" : "Stand"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Player area */}
          <div className="w-full max-w-4xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold">Your Hand</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    {playerHand.length > 0 ? playerValue : "-"}
                  </div>
                  {playerBust && <div className="text-red-400 text-sm font-semibold">BUST!</div>}
                  {playerValue === 21 && !playerBust && (
                    <div className="text-yellow-400 text-sm font-semibold">BLACKJACK!</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                {playerHand.length > 0 ? (
                  playerHand.map((card, idx) => (
                    <div key={`${card.id}-${idx}`} className="transform hover:scale-105 transition-transform">
                      <CardComp suit={card.suit as any} value={card.value as any} width={90} height={126} />
                    </div>
                  ))
                ) : (
                  <p className="text-green-300 text-sm">No cards dealt</p>
                )}
              </div>
            </div>
          </div>

          {/* Game History Modal */}
          {showHistory && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-gradient-to-br from-green-900 to-green-950 rounded-lg border-2 border-green-600 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-3xl font-bold text-green-400">Game History</h2>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-white text-3xl hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {gameHistory.length === 0 ? (
                  <p className="text-green-300 text-center py-8">No games played yet</p>
                ) : (
                  <div className="space-y-4">
                    {gameHistory.slice().reverse().map((game, idx) => {
                      const actualIdx = gameHistory.length - 1 - idx;
                      const date = new Date(game.timestamp / 1000); // Convert micros to millis
                      const normalizedResult = normalizeResult(game.result);
                      const isWin = normalizedResult === "PLAYER_BLACKJACK" || normalizedResult === "PLAYER_WIN" || normalizedResult === "DEALER_BUST";
                      const isPush = normalizedResult === "PUSH";

                      return (
                        <div
                          key={actualIdx}
                          className={`border-2 rounded-lg p-4 ${isWin
                            ? "border-green-500 bg-green-900/20"
                            : isPush
                              ? "border-yellow-500 bg-yellow-900/20"
                              : "border-red-500 bg-red-900/20"
                            }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="text-sm text-gray-400">
                                Game #{actualIdx + 1} • {date.toLocaleString()}
                              </div>
                              <div className={`text-xl font-bold ${isWin ? "text-green-400" : isPush ? "text-yellow-400" : "text-red-400"
                                }`}>
                                {normalizedResult && renderResult(normalizedResult as any)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-400">Bet: {game.bet}</div>
                              <div className={`text-lg font-bold ${game.payout > game.bet ? "text-green-400" : game.payout === game.bet ? "text-yellow-400" : "text-red-400"
                                }`}>
                                Payout: {game.payout}
                                {game.payout > game.bet && ` (+${game.payout - game.bet})`}
                                {game.payout < game.bet && ` (-${game.bet})`}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Player Hand */}
                            <div>
                              <div className="text-sm text-green-300 mb-2">Your Hand ({calculateHandValue(normalizeCards(game.playerHand))})</div>
                              <div className="flex gap-1 flex-wrap">
                                {normalizeCards(game.playerHand).map((card, cardIdx) => (
                                  <CardComp
                                    key={`${card.id}-${cardIdx}`}
                                    suit={card.suit as any}
                                    value={card.value as any}
                                    width={50}
                                    height={70}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Dealer Hand */}
                            <div>
                              <div className="text-sm text-red-300 mb-2">Dealer Hand ({calculateHandValue(normalizeCards(game.dealerHand))})</div>
                              <div className="flex gap-1 flex-wrap">
                                {normalizeCards(game.dealerHand).map((card, cardIdx) => (
                                  <CardComp
                                    key={`${card.id}-${cardIdx}`}
                                    suit={card.suit as any}
                                    value={card.value as any}
                                    width={50}
                                    height={70}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
