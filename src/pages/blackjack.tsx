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
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);

  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [waitingForSeed, setWaitingForSeed] = useState(false);
  const [waitingForResult, setWaitingForResult] = useState(false);
  const [lastShownGameId, setLastShownGameId] = useState<number | null>(null); // Track which result we've shown

  // Derived
  const canPlay = phase === "PlayerTurn";

  const playerValue = useMemo(() => calculateHandValue(playerHand), [playerHand]);
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
    return lastPayout - lastBet; // positive = win, negative = loss, 0 = push
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

      const newHistory = data.gameHistory || [];
      setGameHistory(newHistory);

      if (data.currentGame) {
        const game = data.currentGame;
        setCurrentGameId(game.gameId);
        const gamePhase = normalizePhase(game.phase);
        setPhase(gamePhase);
        setPlayerHand(normalizeCards(game.playerHand));
        setDealerHand(normalizeCards(game.dealerHand));
        setWaitingForSeed(false);

        // Check if game auto-completed (Blackjack on deal)
        if (gamePhase === "RoundComplete" && !waitingForResult) {
          // Game ended immediately (Blackjack) - start waiting for result
          setWaitingForResult(true);
        }
      } else {
        // No active game - check if we just finished one
        const latestGame = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
        const isNewResult = latestGame && latestGame.gameId !== lastShownGameId;

        if ((waitingForResult || waitingForSeed) && latestGame && isNewResult) {
          // Game ended! Get result from latest history
          setLastResult(latestGame.result);
          setLastPayout(latestGame.payout);
          setLastBet(latestGame.bet);
          setPlayerHand(normalizeCards(latestGame.playerHand));
          setDealerHand(normalizeCards(latestGame.dealerHand));
          setPhase("RoundComplete");
          setWaitingForResult(false);
          setWaitingForSeed(false);
          setLastShownGameId(latestGame.gameId); // Mark as shown
        } else if (!waitingForSeed && !waitingForResult && phase !== "RoundComplete") {
          // Only reset to WaitingForGame if not on RoundComplete
          // User must click "Play Again" to leave RoundComplete
          setPhase("WaitingForGame");
          setPlayerHand([]);
          setDealerHand([]);
          setCurrentGameId(null);
        }
      }

      // Check if seed arrived
      if (waitingForSeed && data.currentGame) {
        setWaitingForSeed(false);
      }

    } catch (err) {
      console.error("Failed to refresh game state:", err);
    }
  }, [waitingForSeed, waitingForResult]);

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

  // Poll for updates - faster when waiting for Bank responses
  useEffect(() => {
    if (!isConnected) return;

    // Poll faster when waiting for cross-chain response
    const pollInterval = (waitingForSeed || waitingForResult) ? 800 : 3000;

    const syncInterval = setInterval(() => {
      if (!busy) {
        refresh().catch(console.error);
      }
    }, pollInterval);
    return () => clearInterval(syncInterval);
  }, [busy, isConnected, refresh, waitingForSeed, waitingForResult]);



  const handleAction = async (action: string, args: object = {}) => {
    setBusy(true);
    try {
      let mutation: string;
      let actionDescription: string;

      if (action === "requestChips") {
        mutation = `mutation { requestChips }`;
        actionDescription = "🎁 Requesting chips from Bank (sends cross-chain message)";
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📝 ACTION: Request Chips");
        console.log("📍 You are signing to: Send RequestChips message to Bank chain");
        console.log("💰 This transaction: Sends a cross-chain message asking for free chips");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      } else if (action === "playBlackjack") {
        const betAmount = (args as any).bet;
        mutation = `mutation { playBlackjack(bet: ${betAmount}) }`;
        actionDescription = `🎲 Starting game - Bet ${betAmount} chips (escrow to Bank)`;
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📝 ACTION: Play Blackjack");
        console.log(`📍 You are signing to: Deduct ${betAmount} chips and start a game`);
        console.log("💰 This transaction:");
        console.log(`   1. Deducts ${betAmount} chips from your balance`);
        console.log("   2. Sends RequestGame message to Bank chain with escrowed bet");
        console.log("   3. Waits for Bank to send back game seed");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        setWaitingForSeed(true);
        setLastResult(null);
        setLastPayout(0);
      } else if (action === "hit") {
        mutation = `mutation { hit }`;
        actionDescription = "👆 Hit - Draw another card";
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📝 ACTION: Hit");
        console.log("📍 You are signing to: Draw another card from the deck");
        console.log("💰 This transaction:");
        console.log("   1. Draws a card locally using the deterministic seed");
        console.log("   2. If bust (>21), auto-sends ReportResult to Bank");
        console.log("   3. No additional signing needed for bust report");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      } else if (action === "stand") {
        mutation = `mutation { stand }`;
        actionDescription = "✋ Stand - Finish turn (Bank verifies result)";
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📝 ACTION: Stand");
        console.log("📍 You are signing to: End your turn and request result verification");
        console.log("💰 This transaction:");
        console.log("   1. Records your Stand action");
        console.log("   2. Sends ReportResult message to Bank");
        console.log("   3. Bank replays game with seed, verifies, sends payout");
        console.log("   4. NO additional signing needed for payout - it arrives automatically!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        setWaitingForResult(true);
      } else if (action === "doubleDown") {
        mutation = `mutation { doubleDown }`;
        actionDescription = "✌️ Double Down - Double bet, take one card, stand";
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📝 ACTION: Double Down");
        console.log("📍 You are signing to: Double your bet and take exactly one more card");
        console.log("💰 This transaction:");
        console.log("   1. Doubles your bet (deducts additional chips)");
        console.log("   2. Draws exactly one card");
        console.log("   3. Automatically stands and sends ReportResult to Bank");
        console.log("   4. Bank verifies and sends payout (2x doubled bet if you win!)");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        setWaitingForResult(true);
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      console.log("🔐 Waiting for wallet signature...");
      console.log(`🎯 Action: ${actionDescription}`);

      await lineraAdapter.mutate(mutation);

      console.log("✅ Signature confirmed! Transaction sent.");

      // Immediately refresh after mutation
      await refresh();

      // For playBlackjack, the polling will handle waiting for seed
      // No need for extra wait loop here

    } catch (err: any) {
      console.error(`Failed to execute ${action}:`, err);
      setWaitingForSeed(false);
      setWaitingForResult(false);
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
    // Check if bust happened (will be visible in next refresh)
    setTimeout(async () => {
      await refresh();
      // If player busted, they need to wait for Bank verification
      if (playerValue > 21) {
        setWaitingForResult(true);
      }
    }, 300);
  }

  async function onStand() {
    if (busy || phase !== "PlayerTurn") return;
    await handleAction("stand");
  }

  async function onDoubleDown() {
    if (busy || phase !== "PlayerTurn") return;
    if (playerHand.length !== 2) return; // Only on first 2 cards
    if (balance < lastBet) return; // Need enough to double
    await handleAction("doubleDown");
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
            </div>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className="absolute right-0 top-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2"
            >
              📜 History ({gameHistory.length})
            </button>
          </div>

          {/* Waiting for Seed Banner (after clicking Play) */}
          {waitingForSeed && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              <div className="w-full rounded-xl p-6 text-center bg-yellow-500/20 text-yellow-400 border border-yellow-500">
                <div className="text-3xl font-bold mb-2 animate-pulse">🎲 Starting Game...</div>
                <div className="text-lg">Getting your cards from the dealer</div>
              </div>
            </div>
          )}

          {/* Waiting for Result Banner */}
          {!waitingForSeed && (waitingForResult || (phase === "RoundComplete" && !lastResult)) && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              <div className="w-full rounded-xl p-6 text-center bg-yellow-500/20 text-yellow-400 border border-yellow-500">
                <div className="text-3xl font-bold mb-2 animate-pulse">⏳ Calculating Result...</div>
                <div className="text-lg">Please wait while we process your game</div>
              </div>
            </div>
          )}

          {/* Round Complete - Result and Action Buttons */}
          {phase === "RoundComplete" && lastResult && (
            <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
              {/* Result Banner */}
              <div className={`w-full rounded-xl p-6 text-center ${resultClass}`}>
                <div className="text-4xl font-bold mb-3">{renderResult(lastResult)}</div>
                <div className="flex justify-center gap-6 text-lg">
                  <div>Bet: <span className="font-bold text-yellow-300">{lastBet}</span></div>
                  <div>Payout: <span className={`font-bold ${lastPayout > 0 ? "text-green-300" : "text-gray-300"}`}>{lastPayout}</span></div>
                  <div className={`font-bold px-3 py-1 rounded ${netResult > 0 ? "bg-green-600/50" : netResult < 0 ? "bg-red-600/50" : "bg-yellow-600/50"}`}>
                    {netResult > 0 ? `+${netResult}` : netResult} chips
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setPhase("WaitingForGame");
                    setLastResult(null);
                    setPlayerHand([]);
                    setDealerHand([]);
                    setCurrentGameId(null);
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-xl text-xl transform hover:scale-105 transition-all"
                >
                  🎲 Play Again
                </button>
                <a
                  href="/"
                  className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold rounded-lg shadow-xl text-xl transform hover:scale-105 transition-all"
                >
                  🏠 Go Home
                </a>
              </div>
            </div>
          )}


          {/* Waiting for Game / Place Bet */}
          {phase === "WaitingForGame" && !waitingForSeed && !waitingForResult && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              <div className="flex flex-col items-center gap-4 bg-green-900/50 p-6 rounded-lg border-2 border-green-700/50 w-full">
                <h3 className="text-2xl font-semibold text-green-200">Place Your Bet</h3>
                <p className="text-green-300 text-sm">Select chips and start game</p>

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


          {/* Dealer area */}
          <div className="w-full max-w-4xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold">Dealer's Hand</h2>
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
            {canPlay && (
              <div className="flex flex-col gap-3 items-center">
                {busy && (
                  <div className="text-yellow-300 text-sm animate-pulse">
                    ⏳ Processing...
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
                  {playerHand.length === 2 && (
                    <button
                      onClick={onDoubleDown}
                      disabled={busy || balance < lastBet}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Double your bet, take one card, then stand"
                    >
                      {busy ? "⏳ Double" : `Double (${lastBet * 2})`}
                    </button>
                  )}
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
                      const gameNet = game.payout - game.bet;

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
                              <div className="text-sm text-gray-400">Bet: {game.bet} → Payout: {game.payout}</div>
                              <div className={`text-xl font-bold ${gameNet > 0 ? "text-green-400" : gameNet < 0 ? "text-red-400" : "text-yellow-400"}`}>
                                {gameNet > 0 ? `+${gameNet}` : gameNet} chips
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
      </div >
    </div >
  );
}
