import { useState, useEffect } from 'react';
import { RouletteWheel } from 'react-casino-roulette';
import 'react-casino-roulette/dist/index.css';
import Header from '../components/Header';
import {
  fetchRouletteState,
  placeBetsAndSpin,
  resetRouletteRound,
  type Bet,
  type BetType,
  type SpinResult,
} from '../lib/roulette-chain';


// Red numbers in roulette (American roulette standard)
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 28, 30, 32, 34, 36];

// Chip values and colors
const CHIP_VALUES = [
  { value: 1, color: 'bg-white text-black border-gray-400' },
  { value: 5, color: 'bg-red-600 text-white border-red-400' },
  { value: 10, color: 'bg-blue-600 text-white border-blue-400' },
  { value: 25, color: 'bg-green-600 text-white border-green-400' },
  { value: 50, color: 'bg-orange-600 text-white border-orange-400' },
  { value: 100, color: 'bg-black text-white border-gray-600' },
];

// Determine if number is red or black
const getNumberColor = (num: number | string) => {
  if (num === 0 || num === '00') return 'green';
  return RED_NUMBERS.includes(Number(num)) ? 'red' : 'black';
};

export default function Roulette() {
  const [balance, setBalance] = useState(1000);
  const [selectedChip, setSelectedChip] = useState(5);
  const [bets, setBets] = useState<Bet[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [startWheel, setStartWheel] = useState(false);
  const [winningBet, setWinningBet] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial on-chain state on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await fetchRouletteState();
        setBalance(s.playerBalance);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load on-chain state");
      }
    })();
  }, []);

  const placeBet = (betType: BetType, selection: number) => {
    if (balance < selectedChip) {
      setError('Insufficient balance!');
      return;
    }

    const newBet: Bet = {
      betType,
      amount: selectedChip,
      selection,
    };

    setBets(prevBets => [...prevBets, newBet]);
    setBalance(balance - selectedChip);
  };

  const clearBets = () => {
    const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
    setBalance(balance + totalBetAmount);
    setBets([]);
  };

  const spin = async () => {
    if (bets.length === 0) {
      setError('Please place at least one bet!');
      return;
    }

    setError(null);
    setBusy(true);
    setIsSpinning(true);
    setShowResult(false);
    setResult(null);
    setStartWheel(false);

    try {
      // Call chain mutation
      await placeBetsAndSpin(bets);
      // Fetch new state
      const state = await fetchRouletteState();
      setBalance(state.playerBalance);
      
      if (state.lastResult) {
        const spinResult = state.lastResult;
        setResult(spinResult);
        
        // Convert winning number for wheel display
        const winningNumber = spinResult.winningNumber === 37 ? '00' : spinResult.winningNumber.toString();
        setWinningBet(winningNumber);
        
        // Add to history
        setHistory(prev => [spinResult.winningNumber, ...prev.slice(0, 9)]);
        
        // Start the wheel spinning
        setStartWheel(true);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Spin failed');
      setIsSpinning(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSpinningEnd = () => {
    setIsSpinning(false);
    setShowResult(true);

    // Clear bets after spin
    setTimeout(() => {
      setBets([]);
      setStartWheel(false);
    }, 2000);
  };

  async function resetTable() {
    try {
      setBusy(true);
      await resetRouletteRound();
      const s = await fetchRouletteState();
      setBalance(s.playerBalance);
    } finally {
      setBusy(false);
    }
    setBets([]);
    setResult(null);
    setIsSpinning(false);
    setShowResult(false);
    setStartWheel(false);
    setError(null);
  }

  const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

  // Check if a number is included in any active bet
  const isNumberBetOn = (num: number | string) => {
    const numValue = num === '00' ? 37 : Number(num);
    return bets.some(bet => 
      (bet.betType === 'StraightUp' && bet.selection === numValue)
    );
  };

  const getBetAmount = (num: number | string) => {
    const numValue = num === '00' ? 37 : Number(num);
    const bet = bets.find(bet => 
      bet.betType === 'StraightUp' && bet.selection === numValue
    );
    return bet ? bet.amount : 0;
  };

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
        <main className="flex flex-col items-center justify-start gap-4 py-8 px-4 overflow-auto">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Roulette (On-Chain)</h1>
          <p className="text-green-200 text-sm">Select chips and place your bets on the table!</p>
        </div>

        {/* Balance */}
        <div className="w-full max-w-6xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">Balance:</span>
              <span className="text-2xl font-bold text-yellow-400">${balance}</span>
            </div>
            {totalBetAmount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">Total Bet:</span>
                <span className="text-xl font-bold text-orange-400">${totalBetAmount}</span>
              </div>
            )}
          </div>
          {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
        </div>

        {/* Wheel and Table Side by Side */}
        <div className="w-full max-w-[1800px] flex gap-6 items-start">
          {/* Left Side - Roulette Wheel */}
          <div className="flex-shrink-0 bg-green-900/50 rounded-lg p-6 backdrop-blur-sm border border-green-700/50">
            <div className="flex flex-col items-center gap-4">
              {/* Professional RouletteWheel Component */}
              <div className="relative" style={{ width: '400px', height: '400px' }}>
                <RouletteWheel 
                  start={startWheel}
                  winningBet={winningBet}
                  onSpinningEnd={handleSpinningEnd}
                />
                
                {/* Result display overlay */}
                {!isSpinning && result !== null && showResult && (
                  <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <div className="bg-black/90 backdrop-blur-sm rounded-2xl px-8 py-6 border-4 border-yellow-500 shadow-2xl">
                      <div className="flex flex-col items-center">
                        <div className={`text-6xl font-bold mb-2 ${
                          getNumberColor(result.winningNumber) === 'red' ? 'text-red-500' :
                          getNumberColor(result.winningNumber) === 'black' ? 'text-white' :
                          'text-green-400'
                        }`}>
                          {result.winningNumber === 37 ? '00' : result.winningNumber}
                        </div>
                        <div className={`text-lg font-semibold ${
                          getNumberColor(result.winningNumber) === 'red' ? 'text-red-300' :
                          getNumberColor(result.winningNumber) === 'black' ? 'text-gray-300' :
                          'text-green-300'
                        }`}>
                          {getNumberColor(result.winningNumber).toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Result Message */}
              {showResult && result && (
                <div className="text-center">
                  {result.totalPayout > 0 ? (
                    <div className="text-xl font-bold text-green-400 animate-pulse">
                      🎉 YOU WIN! 🎉
                      <div className="text-sm mt-1">Payout: ${result.totalPayout}</div>
                    </div>
                  ) : (
                    <div className="text-lg font-bold text-red-400">
                      Better luck next time!
                    </div>
                  )}
                </div>
              )}

              {/* History */}
              {history.length > 0 && (
                <div className="flex flex-col items-center gap-2 w-full">
                  <span className="text-white text-sm font-semibold">Recent Results:</span>
                  <div className="flex gap-2 flex-wrap justify-center max-w-[380px]">
                    {history.map((num, idx) => (
                      <div
                        key={idx}
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm border-2 ${
                          getNumberColor(num) === 'red' ? 'bg-red-600 border-red-400' :
                          getNumberColor(num) === 'black' ? 'bg-black border-gray-400' :
                          'bg-green-600 border-green-400'
                        }`}
                      >
                        {num === 37 ? '00' : num}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Betting Table and Controls */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Chip Selection */}
            <div className="bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50">
              <h3 className="text-white font-semibold mb-3 text-center">Select Your Chip</h3>
              <div className="flex gap-3 justify-center flex-wrap">
                {CHIP_VALUES.map(chip => (
                  <button
                    key={chip.value}
                    onClick={() => setSelectedChip(chip.value)}
                    disabled={isSpinning || balance < chip.value}
                    className={`w-14 h-14 rounded-full border-4 font-bold text-base shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      chip.color
                    } ${
                      selectedChip === chip.value ? 'ring-4 ring-yellow-400 scale-110' : 'hover:scale-105'
                    }`}
                  >
                    ${chip.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Simplified Betting Table */}
            <div className="bg-gradient-to-br from-amber-600 via-yellow-700 to-amber-700 rounded-lg p-6 shadow-2xl border-4 border-amber-900">
              <h3 className="text-white font-bold text-xl mb-4 text-center drop-shadow-lg">Betting Table</h3>
              
              {/* Number Grid */}
              <div className="grid grid-cols-12 gap-1 mb-4">
                {Array.from({ length: 36 }, (_, i) => i + 1).map(num => {
                  const isRed = RED_NUMBERS.includes(num);
                  const isBetOn = isNumberBetOn(num);
                  const betAmount = getBetAmount(num);
                  return (
                    <button
                      key={num}
                      onClick={() => placeBet('StraightUp', num)}
                      disabled={isSpinning || busy}
                      className={`relative w-12 h-12 font-bold text-white text-base border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        isRed 
                          ? 'bg-red-600 hover:bg-red-500' 
                          : 'bg-black hover:bg-gray-800'
                      } ${
                        isBetOn 
                          ? 'border-yellow-400 ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50' 
                          : 'border-white'
                      }`}
                    >
                      {num}
                      {betAmount > 0 && (
                        <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= betAmount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                          ${betAmount}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Zero and Double Zero */}
              <div className="flex gap-1 mb-4 justify-center">
                <button
                  onClick={() => placeBet('StraightUp', 0)}
                  disabled={isSpinning || busy}
                  className={`relative w-12 h-12 bg-green-600 hover:bg-green-500 text-white font-bold text-xl border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isNumberBetOn(0) ? 'border-yellow-400 ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-white'
                  }`}
                >
                  0
                  {getBetAmount(0) > 0 && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= getBetAmount(0))?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${getBetAmount(0)}
                    </div>
                  )}
                </button>
                <button
                  onClick={() => placeBet('StraightUp', 37)}
                  disabled={isSpinning || busy}
                  className={`relative w-12 h-12 bg-green-600 hover:bg-green-500 text-white font-bold text-xl border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isNumberBetOn('00') ? 'border-yellow-400 ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-white'
                  }`}
                >
                  00
                  {getBetAmount('00') > 0 && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= getBetAmount('00'))?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${getBetAmount('00')}
                    </div>
                  )}
                </button>
              </div>

              {/* Outside bets */}
              <div className="grid grid-cols-6 gap-1">
                <button
                  onClick={() => placeBet('Range', 0)}
                  disabled={isSpinning || busy}
                  className="py-3 bg-amber-200/40 hover:bg-amber-300/50 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  1-18
                </button>
                
                <button
                  onClick={() => placeBet('Parity', 0)}
                  disabled={isSpinning || busy}
                  className="py-3 bg-amber-200/40 hover:bg-amber-300/50 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  EVEN
                </button>
                
                <button
                  onClick={() => placeBet('Color', 0)}
                  disabled={isSpinning || busy}
                  className="py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  RED
                </button>
                
                <button
                  onClick={() => placeBet('Color', 1)}
                  disabled={isSpinning || busy}
                  className="py-3 bg-black hover:bg-gray-900 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  BLACK
                </button>
                
                <button
                  onClick={() => placeBet('Parity', 1)}
                  disabled={isSpinning || busy}
                  className="py-3 bg-amber-200/40 hover:bg-amber-300/50 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  ODD
                </button>
                
                <button
                  onClick={() => placeBet('Range', 1)}
                  disabled={isSpinning || busy}
                  className="py-3 bg-amber-200/40 hover:bg-amber-300/50 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  19-36
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={spin}
                disabled={isSpinning || busy || bets.length === 0}
                className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold text-xl rounded-lg shadow-lg transform hover:scale-105 transition-all"
              >
                {isSpinning ? 'SPINNING...' : busy ? 'PROCESSING...' : 'SPIN'}
              </button>
              <button
                onClick={clearBets}
                disabled={isSpinning || busy || bets.length === 0}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg shadow-lg transform hover:scale-105 transition-all"
              >
                Clear Bets
              </button>
              {result && (
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
        </div>
        </main>
      </div>
    </div>
  );
}
