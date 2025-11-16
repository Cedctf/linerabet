import { useEffect, useMemo, useState } from "react";
import CardComp from "../components/Card";
import Header from "../components/Header";
import {
  calculateHandValue,
  type BlackjackCard, // typings only
} from "../lib/blackjack-utils";
import {
  fetchState,
  enterBettingPhase as enterBettingPhaseMutation,
  startGame as startGameMutation,
  hit as hitMutation,
  stand as standMutation,
  type GameRecord,
} from "../lib/linera";

// GraphQL returns UPPER_SNAKE_CASE enums on your network.
type Phase = "WAITING_FOR_BET" | "BETTING_PHASE" | "PLAYER_TURN" | "DEALER_TURN" | "ROUND_COMPLETE";
type Result =
  | null
  | "PLAYER_BLACKJACK"
  | "PLAYER_WIN"
  | "DEALER_WIN"
  | "PLAYER_BUST"
  | "DEALER_BUST"
  | "PUSH";

// Cards as they arrive from the chain service
type ChainCard = { suit: string; value: string; id: string };

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
function normalizeResult(result: string): Result {
  const map: Record<string, Result> = {
    PlayerBlackjack: "PLAYER_BLACKJACK",
    PlayerWin: "PLAYER_WIN",
    DealerWin: "DEALER_WIN",
    PlayerBust: "PLAYER_BUST",
    DealerBust: "DEALER_BUST",
    Push: "PUSH",
  };
  return map[result] as Result || null;
}

export default function Blackjack() {
  // On-chain mirrors
  const [balance, setBalance] = useState<number>(0);
  const [currentBet, setCurrentBet] = useState<number>(0);
  const [allowedBets, setAllowedBets] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bet, setBet] = useState<number>(1);
  const [lastBet, setLastBet] = useState<number>(1);

  const [phase, setPhase] = useState<Phase>("WAITING_FOR_BET");
  const [lastResult, setLastResult] = useState<Result>(null);

  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [splitHand, setSplitHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

  // UI
  const [busy, setBusy] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(20);
  const [showHistory, setShowHistory] = useState(false);

  // Derived flags
  const canPlay = phase === "PLAYER_TURN";
  const roundOver = phase === "ROUND_COMPLETE";

  // Hand values
  const playerValue = useMemo(() => calculateHandValue(playerHand), [playerHand]);
  // During player turn, only show dealer's first card value
  const dealerValue = useMemo(() => {
    if (phase === "PLAYER_TURN" && dealerHand.length > 0) {
      return calculateHandValue([dealerHand[0]]);
    }
    return calculateHandValue(dealerHand);
  }, [dealerHand, phase]);
  const playerBust = playerValue > 21;
  const dealerBust = dealerValue > 21;

  // Fetch latest on-chain state
  async function refresh() {
    const s = await fetchState();
    setBalance(s.balance);
    setCurrentBet(s.currentBet);
    setAllowedBets(s.allowedBets);
    if (!s.allowedBets.includes(bet)) setBet(s.allowedBets[0] ?? 1);
    setPhase(s.phase as Phase);
    setLastResult(s.lastResult as Result);
    setPlayerHand(normalizeCards(s.playerHand as any));
    setDealerHand(normalizeCards(s.dealerHand as any));
    setRoundStartTime(s.roundStartTime);
    setGameHistory(s.gameHistory);
  }

  useEffect(() => {
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic state sync to recover from errors/lag
  useEffect(() => {
    const syncInterval = setInterval(() => {
      // Only sync if not busy to avoid interrupting operations
      if (!busy) {
        refresh().catch(console.error);
      }
    }, 5000); // Sync every 5 seconds
    return () => clearInterval(syncInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);


  // Player turn timer countdown effect
  useEffect(() => {
    if (phase === "PLAYER_TURN" && roundStartTime > 0) {
      const timer = setInterval(() => {
        const now = Date.now() * 1000; // convert to micros
        const elapsed = (now - roundStartTime) / 1_000_000; // convert to seconds
        const remaining = Math.max(0, 20 - Math.floor(elapsed));
        setTimeRemaining(remaining);

        // If timer expires, auto-stand
        if (remaining === 0 && !busy) {
          clearInterval(timer);
          if (phase === "PLAYER_TURN") {
            onStand().catch(console.error);
          }
        }
      }, 100);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundStartTime, busy]);

  // Actions
  async function onEnterBetting() {
    setBusy(true);
    try {
      await enterBettingPhaseMutation();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onStartGame() {
    // Prevent multiple simultaneous game starts
    if (busy) return;

    setBusy(true);
    try {
      await startGameMutation(bet);
      setLastBet(bet);
      await refresh();
    } catch (err) {
      console.error("Failed to start game:", err);
      await refresh(); // Refresh to get correct state on error
    } finally {
      setBusy(false);
    }
  }

  async function onHit() {
    if (busy || phase !== "PLAYER_TURN") return;

    setBusy(true);
    try {
      await hitMutation();
      await refresh();
    } catch (err) {
      console.error("Failed to hit:", err);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onStand() {
    if (busy || phase !== "PLAYER_TURN") return;

    setBusy(true);
    try {
      await standMutation();
      await refresh();
    } catch (err) {
      console.error("Failed to stand:", err);
      await refresh();
    } finally {
      setBusy(false);
    }
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
    switch (r) {
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
  }

  // Banner classes
  const isWin =
    lastResult === "PLAYER_BLACKJACK" ||
    lastResult === "PLAYER_WIN" ||
    lastResult === "DEALER_BUST";
  const isPush = lastResult === "PUSH";
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
        <Header />

        <main className="flex flex-col items-center justify-center gap-3 py-4 px-4 min-h-[calc(100vh-80px)]">
          {/* Title / wallet-ish header */}
          <div className="relative w-full max-w-4xl mb-2">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
                Blackjack (On-Chain)
              </h1>
              <p className="text-green-200 text-sm">
                Balance: <span className="font-semibold text-green-400">{balance}</span>{" "}
                • Current bet: <span className="font-semibold text-green-400">{currentBet}</span>
              </p>
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
          {phase === "WAITING_FOR_BET" && (
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
                      className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all shadow-lg ${
                        bet === chipValue
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
          {phase === "ROUND_COMPLETE" && lastResult && (
            <div className="flex flex-col items-center gap-6 bg-green-900/50 p-10 rounded-lg border-2 border-green-700/50 w-full max-w-2xl">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Round Result:</div>
                <div className={`text-4xl font-bold mb-4 ${
                  isWin ? "text-green-400" : isPush ? "text-yellow-400" : "text-red-400"
                }`}>
                  {renderResult(lastResult)}
                </div>
              </div>
              <button
                onClick={onEnterBetting}
                disabled={busy}
                className="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-xl text-xl disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all"
              >
                {busy ? "⏳ Starting..." : "Play Next Round"}
              </button>
            </div>
          )}

          {/* Betting Phase - select chips (no timer) */}
          {phase === "BETTING_PHASE" && (
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
                      className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all shadow-lg ${
                        bet === chipValue
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
                    {phase === "PLAYER_TURN" && dealerHand.length === 1 && (
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
              {phase === "DEALER_TURN" && (
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
                {/* Player Turn Timer */}
                {roundStartTime > 0 && (
                  <div className="w-full max-w-md bg-yellow-900/30 p-4 rounded-lg border-2 border-yellow-600/50 shadow-xl">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`text-2xl font-bold ${
                        timeRemaining > 10 ? "text-yellow-300" : "text-red-400 animate-pulse"
                      }`}>
                        ⏱️ Time to act: {timeRemaining}s
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden border-2 border-yellow-600">
                        <div
                          className={`h-full transition-all duration-300 ${
                            timeRemaining > 10
                              ? "bg-gradient-to-r from-green-500 to-green-600"
                              : timeRemaining > 5
                              ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                              : "bg-gradient-to-r from-red-500 to-red-700 animate-pulse"
                          }`}
                          style={{ width: `${(timeRemaining / 20) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-yellow-200">
                        Auto-stand at 0 seconds
                      </div>
                    </div>
                  </div>
                )}

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
                      const normalizedResult = normalizeResult(game.result as string);
                      const isWin = normalizedResult === "PLAYER_BLACKJACK" || normalizedResult === "PLAYER_WIN" || normalizedResult === "DEALER_BUST";
                      const isPush = normalizedResult === "PUSH";

                      return (
                        <div
                          key={actualIdx}
                          className={`border-2 rounded-lg p-4 ${
                            isWin
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
                              <div className={`text-xl font-bold ${
                                isWin ? "text-green-400" : isPush ? "text-yellow-400" : "text-red-400"
                              }`}>
                                {normalizedResult && renderResult(normalizedResult)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-400">Bet: {game.bet}</div>
                              <div className={`text-lg font-bold ${
                                game.payout > game.bet ? "text-green-400" : game.payout === game.bet ? "text-yellow-400" : "text-red-400"
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
                              <div className="text-sm text-green-300 mb-2">Your Hand ({calculateHandValue(normalizeCards(game.playerHand as any))})</div>
                              <div className="flex gap-1 flex-wrap">
                                {normalizeCards(game.playerHand as any).map((card, cardIdx) => (
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
                              <div className="text-sm text-red-300 mb-2">Dealer Hand ({calculateHandValue(normalizeCards(game.dealerHand as any))})</div>
                              <div className="flex gap-1 flex-wrap">
                                {normalizeCards(game.dealerHand as any).map((card, cardIdx) => (
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
