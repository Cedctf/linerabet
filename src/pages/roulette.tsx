
import { useState, useEffect, useCallback } from "react";
import Wheel from "../components/roulette/Wheel";
import { GameStages } from "../components/roulette/Global";
import "../components/roulette/roulette.css";
import { lineraAdapter } from "@/lib/linera-adapter";
import { CONTRACTS_APP_ID } from "@/constants";
import { useGame } from "@/context/GameContext";
import { BLACK_NUMBERS, WHEEL_NUMBERS } from "@/lib/roulette-utils";
import { RouletteBoardBlueprint, BET_REGISTRY, calculatePayout } from "../components/roulette-blueprint";
import type { BetPayload } from "../components/roulette-blueprint";



const RoulettePage = () => {
  const { lineraData, refreshData, setPendingBet } = useGame();
  // derived balance from context
  const serverBalance = lineraData?.gameBalance || 0;
  const isConnected = !!lineraData;

  const [selectedChip, setSelectedChip] = useState<number>(1);
  // NEW: Map of hotspot ID -> bet amount (replaces old placedChips)
  const [placedBets, setPlacedBets] = useState<Map<string, number>>(new Map());
  const [stage, setStage] = useState<GameStages>(GameStages.PLACE_BET);
  const [winningNumber, setWinningNumber] = useState<any>({ next: null });
  const [history, setHistory] = useState<number[]>([]);
  const [lastWinAmount, setLastWinAmount] = useState(0);

  const [busy, setBusy] = useState(false);

  const rouletteData = { numbers: WHEEL_NUMBERS };

  // Calculate total currently placed bets (from new placedBets map)
  const currentTotalBet = Array.from(placedBets.values()).reduce((acc, amount) => acc + amount, 0);

  // Available balance for new bets
  const availableBalance = serverBalance - currentTotalBet;

  // Sync pendingBet with context for header display - only during betting phase
  useEffect(() => {
    // Only sync pending bet when user is placing bets (before spin)
    // pendingBet is cleared explicitly after mutation completes in spin()
    if (stage === GameStages.PLACE_BET) {
      setPendingBet(currentTotalBet);
    }
    // NO cleanup here - pendingBet is cleared explicitly in spin() after mutation
  }, [currentTotalBet, stage, setPendingBet]);

  // Clear pendingBet on unmount only
  useEffect(() => {
    return () => setPendingBet(0);
  }, [setPendingBet]);

  // Refresh history / sync
  const refresh = useCallback(async () => {
    if (!lineraAdapter.isChainConnected()) return;

    try {
      // Ensure app set
      if (!lineraAdapter.isApplicationSet()) {
        await lineraAdapter.setApplication(CONTRACTS_APP_ID);
      }


      const query = `
                query GetRouletteState {
                    gameHistory {
                        gameType
                        result
                        payout
                        timestamp
                        rouletteOutcome
                        rouletteBets {
                            amount
                            betType
                            number
                        }
                    }
                }
            `;
      // NOTE: We rely on context for balance, but we fetch history here.

      const data = await lineraAdapter.queryApplication<any>(query);
      if (data.gameHistory) {
        // Update History
        const serverHistory = data.gameHistory
          .filter((g: any) => g.gameType === "ROULETTE" && g.rouletteOutcome !== null)
          .map((r: any) => r.rouletteOutcome)
          .reverse()
          .slice(0, 10);

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


  // NEW: Handle clicks from the roulette board blueprint
  const handleBetSelected = (betId: string, payload: BetPayload) => {
    if (stage !== GameStages.PLACE_BET || busy) return;

    // Check against available balance (skip if no wallet connected for testing)
    if (isConnected && availableBalance < selectedChip) {
      alert("Insufficient balance! Please buy more chips.");
      return;
    }

    // Add bet to placedBets map
    const newPlacedBets = new Map(placedBets);
    const existingAmount = newPlacedBets.get(betId) || 0;
    newPlacedBets.set(betId, existingAmount + selectedChip);
    setPlacedBets(newPlacedBets);

    console.log(`Bet placed: ${payload.label} ($${selectedChip}) - Payout: ${payload.payout}:1`);
  };

  const clearBet = () => {
    if (stage !== GameStages.PLACE_BET) return;
    setPlacedBets(new Map());
  };

  const spin = async () => {
    setBusy(true);
    setStage(GameStages.NO_MORE_BETS);
    // Keep pendingBet during spin - will be cleared after mutation confirms

    try {
      // Construct bets from placedBets map using BET_REGISTRY
      const betsArg: { betType: string, number?: number, numbers?: number[], amount: number }[] = [];

      for (const [betId, amount] of placedBets.entries()) {
        const config = BET_REGISTRY[betId];
        if (!config) continue;

        // Determine the correct contract bet type based on betId and config.type
        let contractBetType: string;

        switch (config.type) {
          case 'straight':
            contractBetType = 'NUMBER';
            break;
          case 'split':
            contractBetType = 'SPLIT';
            break;
          case 'street':
            contractBetType = 'STREET';
            break;
          case 'corner':
            contractBetType = 'CORNER';
            break;
          case 'sixline':
            contractBetType = 'LINE';
            break;
          case 'dozen':
            // Map dozen_1, dozen_2, dozen_3 to DOZEN1, DOZEN2, DOZEN3
            if (betId === 'dozen_1') contractBetType = 'DOZEN1';
            else if (betId === 'dozen_2') contractBetType = 'DOZEN2';
            else contractBetType = 'DOZEN3';
            break;
          case 'column':
            // Map column_1, column_2, column_3 to COLUMN1, COLUMN2, COLUMN3
            if (betId === 'column_1') contractBetType = 'COLUMN1';
            else if (betId === 'column_2') contractBetType = 'COLUMN2';
            else contractBetType = 'COLUMN3';
            break;
          case 'even_money':
            // Map specific even money bets to contract types
            if (betId === 'red') contractBetType = 'RED';
            else if (betId === 'black') contractBetType = 'BLACK';
            else if (betId === 'even') contractBetType = 'EVEN';
            else if (betId === 'odd') contractBetType = 'ODD';
            else if (betId === 'low_1_18') contractBetType = 'LOW';
            else if (betId === 'high_19_36') contractBetType = 'HIGH';
            else contractBetType = betId.toUpperCase();
            break;
          default:
            contractBetType = (config.type as string).toUpperCase();
        }

        const bet: { betType: string, number?: number, numbers?: number[], amount: number } = {
          betType: contractBetType,
          amount: amount
        };

        // Add number/numbers based on bet type
        if (config.type === 'straight' && config.numbers.length === 1) {
          bet.number = config.numbers[0];
        } else if (['split', 'street', 'corner', 'sixline'].includes(config.type)) {
          bet.numbers = config.numbers;
        }
        // Note: dozen, column, and even_money bets don't need numbers - the type itself defines the numbers

        betsArg.push(bet);
      }

      if (betsArg.length === 0) {
        alert("No bets placed. Please place at least one bet.");
        setBusy(false);
        setStage(GameStages.PLACE_BET);
        return;
      }

      // Construct query string manually to ensure enum formatting
      const betsString = betsArg.map(b => {
        let parts = [`betType: ${b.betType}`, `amount: ${b.amount}`];
        if (b.number !== undefined) {
          parts.push(`number: ${b.number}`);
        }
        if (b.numbers !== undefined) {
          parts.push(`numbers: [${b.numbers.join(", ")}]`);
        }
        return `{ ${parts.join(", ")} }`;
      }).join(", ");

      // Fetch initial history count
      const initialQuery = `query { gameHistory { gameType } }`;
      const initialData = await lineraAdapter.queryApplication<any>(initialQuery);
      const initialCount = initialData.gameHistory
        ? initialData.gameHistory.filter((g: any) => g.gameType === "ROULETTE").length
        : 0;

      const mutation = `mutation { playRoulette(bets: [${betsString}]) }`;
      await lineraAdapter.mutate(mutation);

      // Clear pendingBet now - contract has deducted the bet
      // This prevents double-counting when refreshData updates the balance
      setPendingBet(0);

      // Poll for result
      let winningNum: number | null = null;
      let retries = 0;

      while (retries < 40) { // Poll for ~20 seconds (500ms * 40)
        const query = `query { gameHistory { gameType rouletteOutcome } }`;
        const data = await lineraAdapter.queryApplication<any>(query);
        const history = data.gameHistory.filter((g: any) => g.gameType === "ROULETTE");

        if (history.length > initialCount) {
          const lastGame = history[history.length - 1];
          if (lastGame.rouletteOutcome !== null && lastGame.rouletteOutcome !== undefined) {
            winningNum = lastGame.rouletteOutcome;
            break;
          }
        }

        await new Promise(r => setTimeout(r, 500));
        retries++;
      }

      if (winningNum === null || winningNum === undefined) {
        throw new Error("Game timed out waiting for Bank result. Please check history later.");
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
    // Calculate Winnings locally for display using new BET_REGISTRY
    let totalWin = 0;
    placedBets.forEach((amount, betId) => {
      const payout = calculatePayout(betId, amount, number);
      totalWin += payout;
    });

    if (totalWin > 0) {
      setLastWinAmount(totalWin);
    } else {
      setLastWinAmount(0);
    }

    setHistory(prev => [number, ...prev.slice(0, 9)]);

    // Refresh balance after animation - settlement should be complete by now
    setTimeout(async () => {
      await refreshData();
    }, 500);

    setStage(GameStages.WINNERS);
    setBusy(false);
  };

  const resetGame = () => {
    setPlacedBets(new Map());
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

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen py-8 px-4 pt-28 overflow-y-auto">
        {/* Header - Top bar */}
        <div className="absolute top-0 left-0 w-full flex justify-between items-center p-4 z-50">
          <div className="text-2xl font-bold text-yellow-400 drop-shadow-lg">
            Balance: ${serverBalance}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full max-w-[1800px]">

          {/* Left Column: Wheel */}
          <div className="flex flex-col items-center gap-6 lg:w-1/3 lg:sticky lg:top-24">
            <div className="transform scale-75 lg:scale-100 transition-transform">
              <Wheel rouletteData={rouletteData} number={winningNumber} />
            </div>
          </div>

          {/* Right Column: Board & Controls */}
          <div className="flex flex-col items-center gap-6 flex-1 w-full lg:w-2/3">

            {/* Board at the TOP of right column */}
            <div className="w-full px-2">
              <RouletteBoardBlueprint
                debug={false}
                onBetSelected={handleBetSelected}
                placedBets={placedBets}
              />
            </div>

            {/* Fixed Bottom Right Controls - Matching blackjack2/baccarat2 style */}
            <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-20">
              <div className="bg-black/60 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-2xl flex flex-col gap-4 items-center">
                {/* Chip Selection */}
                <div className="flex flex-col items-center gap-2">
                  <div className="text-sm font-semibold text-white/80 text-center">Select Chip Value</div>
                  <div className="flex items-center gap-2">
                    {[1, 5, 10, 25, 100].map((chipValue) => (
                      <button
                        key={chipValue}
                        onClick={() => setSelectedChip(chipValue)}
                        disabled={busy || (isConnected && availableBalance < chipValue)}
                        className={`relative transition-all hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed ${selectedChip === chipValue ? "scale-125 drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" : "opacity-90 hover:opacity-100"}`}
                      >
                        <img
                          src={`/Chips/chip${chipValue}.png`}
                          alt={`$${chipValue} Chip`}
                          className="w-12 h-12 object-contain"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-green-300 font-semibold">
                  Total Bet: <span className="text-yellow-400">${currentTotalBet}</span>
                </div>

                {/* Action Buttons - Image based */}
                <div className="flex gap-3 items-center">
                  <button
                    onClick={clearBet}
                    disabled={stage !== GameStages.PLACE_BET || currentTotalBet === 0}
                    className="hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ width: '8vw', height: '10vh' }}
                  >
                    <img
                      src="/buttons/clear-bets.png"
                      alt="Clear Bets"
                      className="w-full h-full object-contain"
                    />
                  </button>
                  <button
                    onClick={spin}
                    disabled={stage !== GameStages.PLACE_BET || currentTotalBet === 0 || busy}
                    className="hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ width: '8vw', height: '10vh' }}
                  >
                    <img
                      src="/buttons/spin.png"
                      alt="Spin Wheel"
                      className="w-full h-full object-contain"
                    />
                  </button>
                </div>
              </div>
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
        )
        }

        {/* Result Modal */}
        {
          stage === GameStages.WINNERS && (
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
          )
        }
      </div>
    </div>
  );
};

export default RoulettePage;
