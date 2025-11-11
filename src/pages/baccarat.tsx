import { useMemo, useState } from "react";
import CardComp from "../components/Card";
import Header from "../components/Header";
import {
  BANKER_COMMISSION,
  playBaccaratRound,
  type BaccaratBetOption,
  type BaccaratBetResult,
} from "../lib/baccarat";

const INITIAL_BALANCE = 1000;
const BET_AMOUNTS = [10, 25, 50, 100, 250, 500, 1000];
const BET_TARGETS: { value: BaccaratBetOption; label: string }[] = [
  { value: "PLAYER", label: "Player" },
  { value: "BANKER", label: `Banker (-${BANKER_COMMISSION * 100}% commission)` },
  { value: "TIE", label: "Tie (8:1 payout)" },
];

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function renderOutcome(result: BaccaratBetResult): string {
  if (result.pushed) return "Tie! Non-tie bets push.";
  if (result.winner === "PLAYER") return "Player wins 🎉";
  if (result.winner === "BANKER") return "Banker wins (5% commission taken)";
  return "Tie hits! Massive payout 🎉";
}

export default function BaccaratPage() {
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [bet, setBet] = useState(BET_AMOUNTS[0]);
  const [betType, setBetType] = useState<BaccaratBetOption>("PLAYER");
  const [round, setRound] = useState<BaccaratBetResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerHand = round?.playerHand ?? [];
  const bankerHand = round?.bankerHand ?? [];
  const playerValue = round ? round.playerValue : "-";
  const bankerValue = round ? round.bankerValue : "-";

  const outcome = round
    ? round.pushed
      ? "PUSH"
      : round.winner === round.betType
      ? "WIN"
      : "LOSE"
    : null;

  const resultClass =
    outcome === "WIN"
      ? "bg-green-500/20 text-green-400 border border-green-500"
      : outcome === "PUSH"
      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500"
      : "bg-red-500/20 text-red-400 border border-red-500";

  const profitDisplay = useMemo(() => {
    if (!round) return null;
    const formatted = formatNumber(Math.abs(round.netProfit));
    if (round.netProfit > 0) return `+${formatted}`;
    if (round.netProfit < 0) return `-${formatted}`;
    return "±0";
  }, [round]);

  const insufficientFunds = bet > balance;
  const invalidBet = bet <= 0;

  function handleDeal() {
    if (invalidBet) {
      setError("Enter a bet greater than zero.");
      return;
    }
    if (insufficientFunds) {
      setError("Insufficient balance for that bet.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = playBaccaratRound(bet, betType);
      setRound(result);
      setBalance((prev) => Number((prev + result.netProfit).toFixed(2)));
    } finally {
      setBusy(false);
    }
  }

  function resetTable() {
    setRound(null);
    setBalance(INITIAL_BALANCE);
    setBet(BET_AMOUNTS[0]);
    setBetType("PLAYER");
    setError(null);
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
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
          <div className="text-center mb-2">
            <p className="text-sm uppercase tracking-[0.4em] text-green-300 mb-1">Live Baccarat</p>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
              Place Your Bet
            </h1>
            <p className="text-green-200 text-sm">
              Balance: <span className="font-semibold text-green-400">${formatNumber(balance)}</span>{" "}
              • Current bet: <span className="font-semibold text-green-400">${formatNumber(bet)}</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-4xl bg-green-900/40 border border-green-700/40 rounded-lg p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <label className="text-sm text-green-200 flex items-center gap-2">
                Bet Amount
                <select
                  className="bg-green-950 border border-green-700 rounded-md px-3 py-2 text-green-100"
                  disabled={busy}
                  value={bet}
                  onChange={(e) => setBet(Number(e.target.value))}
                >
                  {BET_AMOUNTS.map((amount) => (
                    <option key={amount} value={amount}>
                      ${amount}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col flex-1 gap-1">
                <p className="text-sm text-green-200">Bet On</p>
                <div className="flex flex-wrap gap-2">
                  {BET_TARGETS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setBetType(option.value)}
                      disabled={busy}
                      className={`px-4 py-2 rounded-lg border transition ${
                        betType === option.value
                          ? "border-green-400 bg-green-500/20 text-green-100"
                          : "border-green-800 text-green-200 hover:border-green-500/70"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleDeal}
                  disabled={busy || insufficientFunds || invalidBet}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Place Bet & Deal
                </button>

                {round && (
                  <button
                    onClick={resetTable}
                    disabled={busy}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg border border-gray-600 disabled:opacity-60"
                  >
                    Reset Table
                  </button>
                )}
              </div>
            </div>
            {error && <p className="text-red-300 text-sm">{error}</p>}
          </div>

          <div className="w-full max-w-4xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold">Banker&apos;s Hand</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">{bankerValue}</div>
                  {round && round.winner === "BANKER" && (
                    <div className="text-yellow-400 text-sm font-semibold">Banker wins</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                {bankerHand.length > 0 ? (
                  bankerHand.map((card, idx) => (
                    <div key={`${card.id}-${idx}`} className="transform hover:scale-105 transition-transform">
                      <CardComp suit={card.suit} value={card.value} width={90} height={126} />
                    </div>
                  ))
                ) : (
                  <p className="text-green-300 text-sm">No cards dealt</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 my-2">
            {round && (
              <div className={`text-xl font-bold px-6 py-3 rounded-lg ${resultClass}`}>
                <p>{renderOutcome(round)}</p>
                <p className="text-sm mt-1">
                  Result: Player {playerValue} vs Banker {bankerValue} {round.isNatural && "• Natural"}
                </p>
                <p className="text-sm mt-1">Payout: {profitDisplay}</p>
              </div>
            )}
          </div>

          <div className="w-full max-w-4xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold">Player&apos;s Hand</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">{playerValue}</div>
                  {round && round.winner === "PLAYER" && (
                    <div className="text-yellow-400 text-sm font-semibold">Player wins</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                {playerHand.length > 0 ? (
                  playerHand.map((card, idx) => (
                    <div key={`${card.id}-${idx}`} className="transform hover:scale-105 transition-transform">
                      <CardComp suit={card.suit} value={card.value} width={90} height={126} />
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
