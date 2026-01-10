import { useEffect, useMemo, useState, useCallback } from "react";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";
import {
  calculateHandValue,
  type BlackjackCard,
} from "../lib/blackjack-utils";
import { lineraAdapter } from "@/lib/linera-adapter";

import { CONTRACTS_APP_ID } from "../constants";

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

  // State from chain
  const [balance, setBalance] = useState<number>(0);
  const [allowedBets, setAllowedBets] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bet, setBet] = useState<number>(1);
  const [lastBet, setLastBet] = useState<number>(1);
  const [phase, setPhase] = useState<Phase>("WaitingForGame");
  const [lastResult, setLastResult] = useState<Result>(null);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);

  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

  // UI state
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [waitingForSeed, setWaitingForSeed] = useState(false);

  // Derived
  const canPlay = phase === "PlayerTurn";
  const roundOver = phase === "RoundComplete";

  const playerValue = useMemo(() => calculateHandValue(playerHand), [playerHand]);
  const dealerValue = useMemo(() => {
    if (phase === "PlayerTurn" && dealerHand.length > 0) {
      return calculateHandValue([dealerHand[0]]);
    }
    return calculateHandValue(dealerHand);
  }, [dealerHand, phase]);
  const playerBust = playerValue > 21;
  const dealerBust = dealerValue > 21;

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
      setGameHistory(data.gameHistory || []);

      if (data.currentGame) {
        const game = data.currentGame;
        setCurrentGameId(game.gameId);
        setPhase(normalizePhase(game.phase));
        setPlayerHand(normalizeCards(game.playerHand));
        setDealerHand(normalizeCards(game.dealerHand));
        setWaitingForSeed(false);
      } else {
        // No active game
        if (!waitingForSeed) {
          setPhase("WaitingForGame");
          setPlayerHand([]);
          setDealerHand([]);
          setCurrentGameId(null);
        }
      }

      // Check if waiting for seed (game requested but not yet received)
      if (waitingForSeed && data.currentGame) {
        setWaitingForSeed(false);
      }

    } catch (err) {
      console.error("Failed to refresh game state:", err);
    }
  }, [waitingForSeed]);

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

  // Poll for updates (cross-chain messages may take time)
  useEffect(() => {
    if (!isConnected) return;
    const syncInterval = setInterval(() => {
      if (!busy) {
        refresh().catch(console.error);
      }
    }, 3000); // Poll every 3 seconds for cross-chain updates
    return () => clearInterval(syncInterval);
  }, [busy, isConnected, refresh]);

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
      } else if (action === "hit") {
        mutation = `mutation { hit }`;
      } else if (action === "stand") {
        mutation = `mutation { stand }`;
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      await lineraAdapter.mutate(mutation);

      // Wait a bit for cross-chain message processing
      if (action === "playBlackjack") {
        // Poll more frequently while waiting for seed
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 1000));
          await refresh();
          if (phase === "PlayerTurn") break;
        }
      } else {
        await refresh();
      }
    } catch (err: any) {
      console.error(`Failed to execute ${action}:`, err);
      setWaitingForSeed(false);
      alert(`Action failed: ${err.message || JSON.stringify(err)}`);
    } finally {
      setBusy(false);
    }
  };

  async function onRequestChips() {
    if (busy) return;
    await handleAction("requestChips");
  }

  async function onStartGame() {
    if (busy) return;
    setLastBet(bet);
    await handleAction("playBlackjack", { bet });
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
    normalizeResult(lastResult) === "DEALER_BUST";
  const isPush = normalizeResult(lastResult) === "PUSH";
  const resultClass = isWin
    ? "bg-green-500/20 text-green-400 border border-green-500"
    : isPush
      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500"
      : "bg-red-500/20 text-red-400 border border-red-500";

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background */}
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
          {/* Header */}
          <div className="relative w-full max-w-4xl mb-2">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
                Blackjack
              </h1>
              <div className="text-green-300 text-sm">
                Balance: {balance} chips
                {waitingForSeed && <span className="ml-2 animate-pulse">⏳ Waiting for game seed...</span>}
              </div>
            </div>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className="absolute right-0 top-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2"
            >
              📜 History ({gameHistory.length})
            </button>
          </div>

          {/* Waiting for Game / Place Bet */}
          {phase === "WaitingForGame" && !waitingForSeed && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              <div className="flex flex-col items-center gap-4 bg-green-900/50 p-6 rounded-lg border-2 border-green-700/50 w-full">
                <h3 className="text-2xl font-semibold text-green-200">Place Your Bet</h3>
                <p className="text-green-300 text-sm">Select chips and start game (cross-chain)</p>



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

                {/* Play Button */}
                <button
                  onClick={onStartGame}
                  disabled={busy || balance < bet}
                  className="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-xl text-xl disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all"
                >
                  {busy ? "⏳ Starting..." : `🎲 Play (Bet: ${bet})`}
                </button>
              </div>
            </div>
          )}

          {/* Waiting for seed */}
          {waitingForSeed && (
            <div className="flex flex-col items-center gap-4 bg-green-900/50 p-10 rounded-lg border-2 border-green-700/50 w-full max-w-2xl">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400 animate-pulse">
                  ⏳ Waiting for Bank...
                </div>
                <div className="text-green-300 text-sm mt-2">
                  Cross-chain message sent. Waiting for game seed from Bank chain.
                </div>
              </div>
            </div>
          )}

          {/* Round Complete */}
          {phase === "RoundComplete" && lastResult && (
            <div className="flex flex-col items-center gap-6 bg-green-900/50 p-10 rounded-lg border-2 border-green-700/50 w-full max-w-2xl">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Round Result:</div>
                <div className={`text-4xl font-bold mb-4 ${isWin ? "text-green-400" : isPush ? "text-yellow-400" : "text-red-400"}`}>
                  {renderResult(lastResult)}
                </div>
              </div>
              <button
                onClick={() => {
                  setPhase("WaitingForGame");
                  setPlayerHand([]);
                  setDealerHand([]);
                  setLastResult(null);
                }}
                disabled={busy}
                className="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-xl text-xl disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all"
              >
                {busy ? "⏳ Loading..." : "Play Next Round"}
              </button>
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
                    {phase === "PlayerTurn" && dealerHand.length === 1 && (
                      <div className="transform hover:scale-105 transition-transform">
                        <div
                          className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 border-2 border-blue-700 rounded-lg shadow-xl flex items-center justify-center"
                          style={{ width: 90, height: 126 }}
                        >
                          <div className="text-blue-400 text-4xl font-bold opacity-50">?</div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-green-300 text-sm">No cards dealt</p>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
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
                      const date = new Date(game.timestamp / 1000);
                      const normalizedResult = normalizeResult(game.result);
                      const gameIsWin = normalizedResult === "PLAYER_BLACKJACK" || normalizedResult === "PLAYER_WIN" || normalizedResult === "DEALER_BUST";
                      const gameIsPush = normalizedResult === "PUSH";

                      return (
                        <div
                          key={game.gameId || actualIdx}
                          className={`border-2 rounded-lg p-4 ${gameIsWin
                            ? "border-green-500 bg-green-900/20"
                            : gameIsPush
                              ? "border-yellow-500 bg-yellow-900/20"
                              : "border-red-500 bg-red-900/20"
                            }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="text-sm text-gray-400">
                                Game #{game.gameId} • {date.toLocaleString()}
                              </div>
                              <div className={`text-xl font-bold ${gameIsWin ? "text-green-400" : gameIsPush ? "text-yellow-400" : "text-red-400"}`}>
                                {normalizedResult && renderResult(normalizedResult as any)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-400">Bet: {game.bet}</div>
                              <div className={`text-lg font-bold ${game.payout > game.bet ? "text-green-400" : game.payout === game.bet ? "text-yellow-400" : "text-red-400"}`}>
                                Payout: {game.payout}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
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
