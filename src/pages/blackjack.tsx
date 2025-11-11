import { useEffect, useMemo, useState } from "react";
import CardComp from "../components/Card";
import Header from "../components/Header";
import {
  calculateHandValue,
  type BlackjackCard, // typings only
} from "../lib/blackjack-utils";
import {
  fetchState,
  startRound,
  hit as hitMutation,
  stand as standMutation,
  resetRound, // ensure lib/linera exports `resetRound`
} from "../lib/linera";

// GraphQL returns UPPER_SNAKE_CASE enums on your network.
type Phase = "WAITING_FOR_BET" | "PLAYER_TURN" | "DEALER_TURN" | "ROUND_COMPLETE";
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

export default function Blackjack() {
  // On-chain mirrors
  const [balance, setBalance] = useState<number>(0);
  const [currentBet, setCurrentBet] = useState<number>(0);
  const [allowedBets, setAllowedBets] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bet, setBet] = useState<number>(1);

  const [phase, setPhase] = useState<Phase>("WAITING_FOR_BET");
  const [lastResult, setLastResult] = useState<Result>(null);

  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [splitHand, setSplitHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);

  // UI
  const [busy, setBusy] = useState(false);

  // Derived flags
  const canPlay = phase === "PLAYER_TURN";
  const roundOver = phase === "ROUND_COMPLETE";

  // Hand values
  const playerValue = useMemo(() => calculateHandValue(playerHand), [playerHand]);
  const dealerValue = useMemo(() => calculateHandValue(dealerHand), [dealerHand]);
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
  }

  useEffect(() => {
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actions
  async function onDeal() {
    setBusy(true);
    try {
      await startRound(bet); // 1..5
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onHit() {
    setBusy(true);
    try {
      await hitMutation();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onStand() {
    setBusy(true);
    try {
      await standMutation();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    setBusy(true);
    try {
      await resetRound();
      await refresh();
    } finally {
      setBusy(false);
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
          <div className="text-center mb-2">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
              Blackjack (On-Chain)
            </h1>
            <p className="text-green-200 text-sm">
              Balance: <span className="font-semibold text-green-400">{balance}</span>{" "}
              • Current bet: <span className="font-semibold text-green-400">{currentBet}</span>
            </p>
          </div>

          {/* Bet picker + actions */}
          <div className="flex items-center gap-3 bg-green-900/50 p-3 rounded-lg border border-green-700/50">
            <label className="text-sm text-green-200">Bet</label>
            <select
              className="bg-green-950 border border-green-700 rounded-md px-3 py-2 text-green-100"
              disabled={busy || !(phase === "WAITING_FOR_BET" || phase === "ROUND_COMPLETE")}
              value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
            >
              {allowedBets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button
              onClick={onDeal}
              disabled={
                busy || balance <= 0 || !(phase === "WAITING_FOR_BET" || phase === "ROUND_COMPLETE")
              }
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Place Bet & Deal
            </button>

            {phase !== "WAITING_FOR_BET" && (
              <button
                onClick={onReset}
                disabled={busy || phase === "PLAYER_TURN"}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg border border-gray-600 disabled:opacity-60"
              >
                Reset Table
              </button>
            )}
          </div>

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
                  dealerHand.map((card, idx) => (
                    <div key={`${card.id}-${idx}`} className="transform hover:scale-105 transition-transform">
                      <CardComp suit={card.suit as any} value={card.value as any} width={90} height={126} />
                    </div>
                  ))
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
              <div className="flex gap-4">
                <button
                  onClick={onHit}
                  disabled={busy}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg"
                >
                  Hit
                </button>
                <button
                  onClick={onStand}
                  disabled={busy}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-all shadow-lg"
                >
                  Stand
                </button>
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
        </main>
      </div>
    </div>
  );
}
