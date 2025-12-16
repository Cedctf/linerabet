
import { useState, useEffect, useCallback } from "react";
import Wheel from "../components/roulette/Wheel";
import Board from "../components/roulette/Board";
import { GameStages, ValueType } from "../components/roulette/Global";
import type { Item, PlacedChip } from "../components/roulette/Global";
import "../components/roulette/roulette.css";
import { lineraAdapter } from "@/lib/linera-adapter";
import { CONTRACTS_APP_ID } from "@/constants";
import { useGame } from "@/context/GameContext";
import { BLACK_NUMBERS, calculatePayout, getChipClasses, WHEEL_NUMBERS } from "@/lib/roulette-utils";



const RoulettePage = () => {
  const { lineraData, refreshData } = useGame();
  // derived balance from context
  const serverBalance = lineraData?.gameBalance || 0;
  const isConnected = !!lineraData;

  const [selectedChip, setSelectedChip] = useState<number | null>(1);
  const [placedChips, setPlacedChips] = useState<Map<Item, PlacedChip>>(new Map());
  const [stage, setStage] = useState<GameStages>(GameStages.PLACE_BET);
  const [winningNumber, setWinningNumber] = useState<any>({ next: null });
  const [history, setHistory] = useState<number[]>([]);
  const [lastWinAmount, setLastWinAmount] = useState(0);

  const [busy, setBusy] = useState(false);

  const rouletteData = { numbers: WHEEL_NUMBERS };

  // Calculate total currently placed bets
  const currentTotalBet = Array.from(placedChips.values()).reduce((acc, chip) => acc + chip.sum, 0);

  // Available balance for new bets
  const availableBalance = serverBalance - currentTotalBet;

  // Refresh history / sync
  const refresh = useCallback(async () => {
    if (!lineraAdapter.isChainConnected()) return;

    try {
      // Ensure app set
      if (!lineraAdapter.isApplicationSet()) {
        await lineraAdapter.setApplication(CONTRACTS_APP_ID);
      }

      const owner = lineraAdapter.identity();
      const query = `
                query GetRouletteState($owner: AccountOwner!) {
                    player(owner: $owner) {
                        lastRouletteOutcome
                        rouletteHistory {
                            winningNumber
                            totalBet
                            payout
                            timestamp
                        }
                    }
                }
            `;
      // NOTE: We rely on context for balance, but we fetch history here.

      const data = await lineraAdapter.queryApplication<any>(query, { owner });
      if (data.player) {
        // Update History
        const serverHistory = data.player.rouletteHistory.map((r: any) => r.winningNumber).reverse().slice(0, 10);
        if (history.length === 0 && serverHistory.length > 0) {
          setHistory(serverHistory);
        }
      }
    } catch (err) {
      console.error("Failed to refresh roulette state:", err);
    }
  }, [history.length]);

  // Initial load sync
  useEffect(() => {
    refresh();
    // also trigger global refresh
    refreshData();
  }, [refresh, refreshData]);


  const onCellClick = (item: Item) => {
    if (stage !== GameStages.PLACE_BET || busy) return;

    const currentChipValue = selectedChip;
    if (currentChipValue === null) return;

    // Check against dynamic available balance
    if (availableBalance < currentChipValue) {
      alert("Insufficient balance! Please buy more chips.");
      return;
    }

    const newPlacedChips = new Map(placedChips);
    const existingChip = newPlacedChips.get(item);

    if (existingChip) {
      newPlacedChips.set(item, { ...existingChip, sum: existingChip.sum + currentChipValue });
    } else {
      newPlacedChips.set(item, { item, sum: currentChipValue });
    }

    setPlacedChips(newPlacedChips);
    // Visual deduction is handled automatically by 'availableBalance' derived variable
  };

  const clearBet = () => {
    if (stage !== GameStages.PLACE_BET) return;
    setPlacedChips(new Map());
  };

  const spin = async () => {
    setBusy(true);
    setStage(GameStages.NO_MORE_BETS);

    try {
      // Construct bets for GraphQL
      // Contract Bet (Blackjack lib.rs): { betType: RouletteBetType, number: Option<u8>, amount: u64 }
      // RouletteBetType: Number, Red, Black, Even, Odd, Low, High
      const betsArg: { betType: string, number?: number, amount: number }[] = [];

      for (const chip of placedChips.values()) {
        const { item, sum } = chip;
        if (item.type === ValueType.NUMBER) {
          betsArg.push({ betType: "NUMBER", number: item.value, amount: sum });
        } else if (item.type === ValueType.RED) {
          betsArg.push({ betType: "RED", amount: sum });
        } else if (item.type === ValueType.BLACK) {
          betsArg.push({ betType: "BLACK", amount: sum });
        } else if (item.type === ValueType.EVEN) {
          betsArg.push({ betType: "EVEN", amount: sum });
        } else if (item.type === ValueType.ODD) {
          betsArg.push({ betType: "ODD", amount: sum });
        } else if (item.type === ValueType.NUMBERS_1_18) {
          betsArg.push({ betType: "LOW", amount: sum });
        } else if (item.type === ValueType.NUMBERS_19_36) {
          betsArg.push({ betType: "HIGH", amount: sum });
        } else {
          console.warn("Skipping unsupported bet type:", item.type);
        }
      }

      if (betsArg.length === 0) {
        alert("Only currently supported bet types (Number, Color, Even/Odd, Low/High) will be processed.");
        setBusy(false);
        setStage(GameStages.PLACE_BET);
        return;
      }

      // Construct query string manually to ensure enum formatting
      const betsString = betsArg.map(b => {
        // For Number, we include `number: X`. For others, number is omitted (null/None)
        return `{ betType: ${b.betType}, amount: ${b.amount}${b.number !== undefined ? `, number: ${b.number}` : ""} }`;
      }).join(", ");

      const mutation = `mutation { spinRoulette(bets: [${betsString}]) }`;
      await lineraAdapter.mutate(mutation);

      // Fetch result
      const owner = lineraAdapter.identity();
      const query = `query { player(owner: "${owner}") { lastRouletteOutcome playerBalance } }`;
      const data = await lineraAdapter.queryApplication<any>(query);
      const winningNum = data.player.lastRouletteOutcome;

      if (winningNum === null || winningNum === undefined) {
        throw new Error("No outcome returned");
      }

      // Refresh Global Balance
      await refreshData();

      // Start Animation targeting the winning number
      setWinningNumber({ next: winningNum.toString(), onStop: () => handleSpinEnd(winningNum) });

    } catch (err: any) {
      console.error("Spin failed:", err);
      alert("Spin failed: " + err.message);
      setBusy(false);
      setStage(GameStages.PLACE_BET);
      refreshData(); // Sync back to truth
    }
  };

  const handleSpinEnd = (number: number) => {
    // Calculate Winnings locally for display (or trust server balance)
    // We use the server balance passed in

    // Calculate diff for the "YOU WON" popup
    // We don't have the explicit payout amount from the query above (only balance),
    // but we can infer or fetch history. For responsiveness, we'll rely on balance update.
    // Or calculate locally just for show:
    let totalWin = 0;
    placedChips.forEach((chip) => {
      const payout = calculatePayout(chip, number);
      totalWin += payout;
    });

    if (totalWin > 0) {
      setLastWinAmount(totalWin);
    } else {
      setLastWinAmount(0);
    }

    setHistory(prev => [number, ...prev.slice(0, 9)]);
    // Balance is updated via context refreshData() called in spin()
    setStage(GameStages.WINNERS);
    setBusy(false);
  };

  const resetGame = () => {
    setPlacedChips(new Map());
    setStage(GameStages.PLACE_BET);
    setWinningNumber({ next: null });
    setLastWinAmount(0);
  };

  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans">
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

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen py-8 px-4 pt-28 overflow-y-auto">

        <div className="relative w-full max-w-6xl mb-8 flex justify-center items-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent drop-shadow-sm">
            Roulette
          </h1>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-4">

            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2"
            >
              📜 History ({history.length})
            </button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-8 items-start justify-center w-full max-w-7xl">

          <div className="flex flex-col items-center gap-6">
            <div className="bg-green-900/40 p-8 rounded-full border-4 border-green-700/30 shadow-2xl backdrop-blur-sm">
              <Wheel rouletteData={rouletteData} number={winningNumber} />
            </div>

            <div className="h-16 flex items-center justify-center">
              {/* Placeholder for spacing, modal is now global/overlay */}
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 flex-1">

            <div className="flex flex-col items-center gap-6 bg-black/40 p-6 rounded-xl border border-white/10 w-full max-w-3xl backdrop-blur-sm shadow-md">

              <div className="flex flex-col items-center gap-2">
                <h3 className="text-green-200 font-semibold uppercase tracking-wider text-sm">Select Chip Value</h3>
                <div className="flex gap-4 flex-wrap justify-center p-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <div
                      key={val}
                      className={getChipClasses(val, selectedChip)}
                      onClick={() => setSelectedChip(val)}
                    >
                      {val}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 w-full justify-center">
                <button
                  onClick={clearBet}
                  disabled={stage !== GameStages.PLACE_BET || placedChips.size === 0 || busy}
                  className="px-8 py-3 bg-red-600/90 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all border-b-4 border-red-800 active:border-b-0 active:translate-y-1"
                >
                  Clear Bets
                </button>
                <button
                  onClick={spin}
                  disabled={stage !== GameStages.PLACE_BET || placedChips.size === 0 || busy || !isConnected}
                  className="px-16 py-3 bg-gradient-to-r from-amber-400 to-yellow-600 hover:from-amber-300 hover:to-yellow-500 text-black font-extrabold text-2xl rounded-xl shadow-[0_0_20px_#ca8a04] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transform hover:scale-105 transition-all border-b-4 border-amber-700 active:border-b-0 active:translate-y-1"
                >
                  {stage === GameStages.PLACE_BET ? (busy ? "WAIT..." : "SPIN") : "SPINNING..."}
                </button>
              </div>
            </div>

            <div className="transform origin-top scale-[0.6] md:scale-[0.75] lg:scale-[0.85] p-4 bg-black/20 rounded-xl border border-white/5">
              <Board
                onCellClick={onCellClick}
                chipsData={{ selectedChip, placedChips }}
                rouletteData={rouletteData}
              />
            </div>
          </div>
        </div>

        {showHistory && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-green-900 to-green-950 rounded-2xl border-2 border-green-600 p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b border-green-700 pb-4">
                <h2 className="text-3xl font-bold text-green-400">Winning Numbers</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>

              {history.length === 0 ? (
                <p className="text-green-300/50 text-center py-12 text-xl">No spins yet.</p>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-4">
                  {history.map((num, i) => (
                    <div key={i} className={`w-12 h-12 flex items-center justify-center rounded-full font-bold text-lg shadow-md border-2 border-white/20 ${num === 0 ? 'bg-green-600' : BLACK_NUMBERS.includes(num) ? 'bg-gray-900' : 'bg-red-600'}`}>
                      {num}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result Modal */}
        {stage === GameStages.WINNERS && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-gradient-to-br from-green-900 to-green-950 rounded-2xl border-4 border-green-500 p-10 max-w-md w-full shadow-[0_0_50px_rgba(0,255,0,0.3)] transform animate-in fade-in zoom-in duration-300 flex flex-col items-center gap-8">

              <div className="flex flex-col items-center gap-2">
                <h2 className="text-gray-300 uppercase tracking-widest font-semibold">Winning Number</h2>
                <div className={`w-24 h-24 flex items-center justify-center rounded-full font-bold text-4xl shadow-2xl border-4 border-white ${history[0] === 0 ? 'bg-green-600' : BLACK_NUMBERS.includes(history[0]) ? 'bg-gray-900' : 'bg-red-600'}`}>
                  {history[0]}
                </div>
              </div>

              <div className="text-center space-y-2">
                {lastWinAmount > 0 ? (
                  <>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-sm">
                      YOU WON
                    </div>
                    <div className="text-4xl font-bold text-yellow-400">
                      ${lastWinAmount}
                    </div>
                  </>
                ) : (
                  <div className="text-5xl font-black text-gray-400 drop-shadow-sm">
                    YOU LOST
                  </div>
                )}
              </div>

              <button
                onClick={resetGame}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold text-xl rounded-xl shadow-lg transform hover:scale-105 transition-all border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoulettePage;
