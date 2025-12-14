import { useEffect, useMemo, useRef, useState } from "react";
import CardComp from "../components/Card";
import { BANKER_COMMISSION, type BaccaratBetOption, type BaccaratBetResult } from "../lib/baccarat";
import {
  fetchBaccaratState,
  placeBetAndDeal,
  resetBaccaratRound,
} from "../lib/baccarat-chain";
import { lineraAdapter } from "../lib/linera-adapter";
import { CONTRACTS_APP_ID } from "../constants";

type ChainCard = { id: string; suit: string; value: string };
function normalizeBaccaratCards(cards: ChainCard[]) {
  return cards.map((c) => {
    const v = c.value.toLowerCase();
    const pointValue =
      v === "ace" ? 1 :
        v === "jack" || v === "queen" || v === "king" ? 0 :
          v === "10" ? 0 :
            Number.isFinite(Number(v)) ? Number(v) : 0;
    return { ...c, pointValue };
  });
}

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
  const winnerLabel =
    result.winner === "PLAYER" ? "Player" : result.winner === "BANKER" ? "Banker" : "Tie";
  if (result.pushed) return `Winner: Tie — Your non‑tie bet pushes.`;
  const youWin = result.winner === result.betType;
  return youWin ? `Winner: ${winnerLabel} — You win 🎉` : `Winner: ${winnerLabel} — You lose`;
}

export default function BaccaratPage() {
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [bet, setBet] = useState(BET_AMOUNTS[0]);
  const [betType, setBetType] = useState<BaccaratBetOption>("PLAYER");
  const [round, setRound] = useState<BaccaratBetResult | null>(null);
  const [isDealing, setIsDealing] = useState(false);
  const [dealOrder, setDealOrder] = useState<("PLAYER" | "BANKER")[]>([]);
  const [revealStep, setRevealStep] = useState(0);
  const dealTimerRef = useRef<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerHand = round?.playerHand ?? [];
  const bankerHand = round?.bankerHand ?? [];
  const totalCardsToReveal = dealOrder.length;
  const revealedCounts = useMemo(() => {
    if (!totalCardsToReveal) return { player: playerHand.length, banker: bankerHand.length };
    const upto = Math.min(revealStep, totalCardsToReveal);
    let player = 0;
    let banker = 0;
    for (let i = 0; i < upto; i++) {
      if (dealOrder[i] === "PLAYER") player++;
      else banker++;
    }
    return {
      player: Math.min(player, playerHand.length),
      banker: Math.min(banker, bankerHand.length),
    };
  }, [revealStep, totalCardsToReveal, dealOrder, playerHand.length, bankerHand.length]);
  function computeValue(cards: { pointValue: number }[]): number {
    const sum = cards.reduce((acc, c) => acc + c.pointValue, 0);
    return sum % 10;
  }
  const playerValue = round
    ? computeValue(playerHand.slice(0, (showResults ? playerHand.length : revealedCounts.player)))
    : "-";
  const bankerValue = round
    ? computeValue(bankerHand.slice(0, (showResults ? bankerHand.length : revealedCounts.banker)))
    : "-";

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

  // Sync initial on-chain state on mount and subscribe to connection changes
  useEffect(() => {
    const handleConnectionChange = async () => {
      try {
        if (!lineraAdapter.isApplicationSet()) {
          await lineraAdapter.setApplication(CONTRACTS_APP_ID);
        }
        if (lineraAdapter.isChainConnected()) {
          const owner = lineraAdapter.identity();
          const s = await fetchBaccaratState(owner);
          if (s?.player) {
            setBalance(s.player.playerBalance);
            // potentially restore state from s.player.baccarat if we wanted to
          }
          setError(null);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load on-chain state");
      }
    };

    handleConnectionChange();
    const unsubscribe = lineraAdapter.subscribe(handleConnectionChange);
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDeal() {
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
      // call chain mutation
      await placeBetAndDeal(bet, betType === "PLAYER" ? "Player" : betType === "BANKER" ? "Banker" : "Tie");

      // fetch new state
      const owner = lineraAdapter.identity();
      const s = await fetchBaccaratState(owner);

      if (!s?.player) {
        throw new Error("Failed to fetch player state");
      }

      setBalance(s.player.playerBalance);

      // build a local round-like object for UI rendering from chain state
      const baccaratState = s.player.baccarat;
      const last = baccaratState.lastResult;
      const winnerUpper = last ? String(last.winner).toUpperCase() : "TIE";
      const result: BaccaratBetResult = {
        playerHand: normalizeBaccaratCards(baccaratState.playerHand as any) as any,
        bankerHand: normalizeBaccaratCards(baccaratState.bankerHand as any) as any,
        playerValue: last ? last.playerValue : 0,
        bankerValue: last ? last.bankerValue : 0,
        winner: winnerUpper === "PLAYER" ? "PLAYER" : winnerUpper === "BANKER" ? "BANKER" : "TIE",
        isNatural: !!last?.isNatural,
        playerThirdCardValue: (last?.playerThirdCardValue ?? null) as any,
        bankerDrewThirdCard: !!last?.bankerDrewThirdCard,
        betType,
        betAmount: bet,
        netProfit: last?.netProfit ?? 0,
        commissionPaid: betType === "BANKER" && last && winnerUpper === "BANKER"
          ? +(bet * BANKER_COMMISSION).toFixed(2)
          : 0,
        payoutMultiplier:
          last && winnerUpper === "TIE" && betType === "TIE"
            ? 8
            : last && winnerUpper === "BANKER" && betType === "BANKER"
              ? +(1 - BANKER_COMMISSION)
              : last && winnerUpper === "PLAYER" && betType === "PLAYER"
                ? 1
                : last &&
                  winnerUpper !== (betType === "PLAYER" ? "PLAYER" : betType === "BANKER" ? "BANKER" : "TIE")
                  ? -1
                  : 0,
        pushed: !!last?.pushed,
      };
      // Establish the reveal order using returned hands
      const order: ("PLAYER" | "BANKER")[] = ["PLAYER", "BANKER", "PLAYER", "BANKER"];
      if (result.playerHand.length === 3) order.push("PLAYER");
      if (result.bankerHand.length === 3) order.push("BANKER");

      setRound(result);
      setDealOrder(order);
      setRevealStep(0);
      setIsDealing(true);
      setShowResults(false);

      if (dealTimerRef.current) {
        window.clearInterval(dealTimerRef.current);
        dealTimerRef.current = null;
      }
      dealTimerRef.current = window.setInterval(() => {
        setRevealStep((prev) => {
          const next = prev + 1;
          if (next >= order.length) {
            if (dealTimerRef.current) {
              window.clearInterval(dealTimerRef.current);
              dealTimerRef.current = null;
            }
            setIsDealing(false);
            setShowResults(true);
            // Chain already applied balance; just sync to chain in case of float rounding
            setBalance(s.player!.playerBalance);
          }
          return next;
        });
      }, 500);
    } catch (e: any) {
      setError(e?.message ?? "Deal failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetTable() {
    if (dealTimerRef.current) {
      window.clearInterval(dealTimerRef.current);
      dealTimerRef.current = null;
    }
    try {
      setBusy(true);
      await resetBaccaratRound();
      const owner = lineraAdapter.identity();
      const s = await fetchBaccaratState(owner);
      if (s?.player) {
        setBalance(s.player.playerBalance);
      }
    } finally {
      setBusy(false);
    }
    setRound(null);
    setIsDealing(false);
    setDealOrder([]);
    setRevealStep(0);
    setShowResults(false);
    setBet(BET_AMOUNTS[0]);
    setBetType("PLAYER");
    setError(null);
  }

  useEffect(() => {
    return () => {
      if (dealTimerRef.current) {
        window.clearInterval(dealTimerRef.current);
        dealTimerRef.current = null;
      }
    };
  }, []);

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


        <main className="flex flex-col items-center justify-center gap-3 py-4 px-4 min-h-[calc(100vh-80px)] pt-24">
          <div className="text-center mb-2">
            <p className="text-sm uppercase tracking-[0.4em] text-green-300 mb-1">Live Baccarat</p>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
              Place Your Bet
            </h1>
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
                <div className="flex flex-wrap gap-2">
                  {BET_TARGETS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setBetType(option.value)}
                      disabled={busy}
                      className={`px-4 py-2 rounded-lg border transition ${betType === option.value
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
                  disabled={busy || isDealing || insufficientFunds || invalidBet}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isDealing ? "Dealing..." : "Place Bet & Deal"}
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
                  {round && showResults && round.winner === "BANKER" && (
                    <div className="text-yellow-400 text-sm font-semibold">Banker wins</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                {bankerHand.length > 0 ? (
                  bankerHand.slice(0, revealedCounts.banker).map((card, idx) => (
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
            {round && showResults && (
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
                  {round && showResults && round.winner === "PLAYER" && (
                    <div className="text-yellow-400 text-sm font-semibold">Player wins</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                {playerHand.length > 0 ? (
                  playerHand.slice(0, revealedCounts.player).map((card, idx) => (
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
