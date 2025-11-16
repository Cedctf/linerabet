import { useState, useEffect } from 'react';
import { RouletteWheel } from 'react-casino-roulette';
import 'react-casino-roulette/dist/index.css';

// Roulette wheel numbers in order (American roulette with 00)
const WHEEL_ORDER = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00',
  27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

// Formatted bet options for RouletteWheel component
const BET_OPTIONS = WHEEL_ORDER.map(num => num.toString());

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

// Check if bet wins
const checkWin = (bet: any, result: number | string) => {
  return bet.numbers.includes(result);
};

// Calculate payout multiplier based on how many numbers are covered
const getPayoutMultiplier = (numbersCount: number) => {
  if (numbersCount === 1) return 35; // Straight up
  if (numbersCount === 2) return 17; // Split
  if (numbersCount === 3) return 11; // Street
  if (numbersCount === 4) return 8; // Corner
  if (numbersCount === 6) return 5; // Line
  if (numbersCount === 12) return 2; // Dozen/Column
  if (numbersCount === 18) return 1; // Red/Black, Odd/Even, High/Low
  return 0;
};

export default function Roulette() {
  const [balance, setBalance] = useState(1000);
  const [selectedChip, setSelectedChip] = useState(5);
  const [bets, setBets] = useState<Record<string, any>>({});
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<number | string | null>(null);
  const [history, setHistory] = useState<(number | string)[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [startWheel, setStartWheel] = useState(false);
  const [winningBet, setWinningBet] = useState('0');

  const placeBet = (betKey: string, numbers: (number | string)[], label: string) => {
    if (balance < selectedChip) {
      alert('Insufficient balance!');
      return;
    }

    setBets(prevBets => {
      const newBets = { ...prevBets };
      if (newBets[betKey]) {
        newBets[betKey] = {
          ...newBets[betKey],
          amount: newBets[betKey].amount + selectedChip
        };
      } else {
        newBets[betKey] = {
          amount: selectedChip,
          numbers: numbers,
          label: label
        };
      }
      return newBets;
    });
    
    setBalance(balance - selectedChip);
  };

  const clearBets = () => {
    const totalBetAmount = Object.values(bets).reduce((sum, bet) => sum + bet.amount, 0);
    setBalance(balance + totalBetAmount);
    setBets({});
  };

  const spin = () => {
    if (Object.keys(bets).length === 0) {
      alert('Please place at least one bet!');
      return;
    }

    setIsSpinning(true);
    setShowResult(false);
    setResult(null);
    setStartWheel(false);

    // Small delay to reset wheel, then start spinning
    setTimeout(() => {
      // Determine winning number
      const spinResult = WHEEL_ORDER[Math.floor(Math.random() * WHEEL_ORDER.length)];
      
      // Set the winning bet for the RouletteWheel component
      setWinningBet(spinResult.toString());
      setResult(spinResult);
      
      // Start the wheel spinning
      setStartWheel(true);
    }, 100);
  };

  const handleSpinningEnd = () => {
    setIsSpinning(false);
    setShowResult(true);
    setHistory([result!, ...history.slice(0, 9)]); // Keep last 10 results

    // Calculate winnings
    let totalWinnings = 0;
    Object.values(bets).forEach(bet => {
      if (checkWin(bet, result)) {
        const payout = bet.amount * getPayoutMultiplier(bet.numbers.length);
        totalWinnings += bet.amount + payout; // Original bet + winnings
      }
    });

    if (totalWinnings > 0) {
      setBalance(balance => balance + totalWinnings);
    }

    // Clear bets after spin
    setTimeout(() => {
      setBets({});
      setStartWheel(false);
    }, 2000);
  };

  const totalBetAmount = Object.values(bets).reduce((sum, bet) => sum + bet.amount, 0);

  // Check if a number is included in any active bet
  const isNumberBetOn = (num: number | string) => {
    return Object.values(bets).some(bet => bet.numbers.includes(num));
  };

  // Generate number grid (3 rows x 12 columns) - matching real roulette layout
  const numberGrid = [];
  for (let row = 0; row < 3; row++) {
    const rowNumbers = [];
    for (let col = 0; col < 12; col++) {
      const num = (2 - row) + (col * 3) + 1; // Top row: 3,6,9... Middle: 2,5,8... Bottom: 1,4,7...
      rowNumbers.push(num);
    }
    numberGrid.push(rowNumbers);
  }

  return (
    <div className="min-h-screen overflow-auto bg-gradient-to-br from-green-800 to-green-950 font-sans">
      <main className="flex flex-col items-center justify-start gap-4 py-8 px-4">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Roulette</h1>
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
                  betOptions={BET_OPTIONS}
                />
                
                {/* Result display overlay */}
                {!isSpinning && result !== null && showResult && (
                  <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <div className="bg-black/90 backdrop-blur-sm rounded-2xl px-8 py-6 border-4 border-yellow-500 shadow-2xl">
                      <div className="flex flex-col items-center">
                        <div className={`text-6xl font-bold mb-2 ${
                          getNumberColor(result) === 'red' ? 'text-red-500' :
                          getNumberColor(result) === 'black' ? 'text-white' :
                          'text-green-400'
                        }`}>
                          {result}
                        </div>
                        <div className={`text-lg font-semibold ${
                          getNumberColor(result) === 'red' ? 'text-red-300' :
                          getNumberColor(result) === 'black' ? 'text-gray-300' :
                          'text-green-300'
                        }`}>
                          {getNumberColor(result).toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Result Message */}
              {showResult && result !== null && (
                <div className="text-center">
                  {Object.values(bets).some(bet => checkWin(bet, result)) ? (
                    <div className="text-xl font-bold text-green-400 animate-pulse">
                      🎉 YOU WIN! 🎉
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
                        {num}
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
                  return (
                    <button
                      key={num}
                      onClick={() => placeBet(`num-${num}`, [num], num.toString())}
                      disabled={isSpinning}
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
                      {bets[`num-${num}`] && (
                        <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets[`num-${num}`].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                          ${bets[`num-${num}`].amount}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Zero and Double Zero */}
              <div className="flex gap-1 mb-4 justify-center">
                <button
                  onClick={() => placeBet('num-0', [0], '0')}
                  disabled={isSpinning}
                  className={`relative w-12 h-12 bg-green-600 hover:bg-green-500 text-white font-bold text-xl border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isNumberBetOn(0) ? 'border-yellow-400 ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-white'
                  }`}
                >
                  0
                  {bets['num-0'] && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets['num-0'].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${bets['num-0'].amount}
                    </div>
                  )}
                </button>
                <button
                  onClick={() => placeBet('num-00', ['00'], '00')}
                  disabled={isSpinning}
                  className={`relative w-12 h-12 bg-green-600 hover:bg-green-500 text-white font-bold text-xl border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isNumberBetOn('00') ? 'border-yellow-400 ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-white'
                  }`}
                >
                  00
                  {bets['num-00'] && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets['num-00'].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${bets['num-00'].amount}
                    </div>
                  )}
                </button>
              </div>

              {/* Outside bets */}
              <div className="grid grid-cols-6 gap-1">
                <button
                  onClick={() => {
                    const lowNums = Array.from({ length: 18 }, (_, i) => i + 1);
                    placeBet('low', lowNums, '1-18');
                  }}
                  disabled={isSpinning}
                  className="relative py-3 bg-amber-200/40 hover:bg-amber-300/50 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  1-18
                  {bets['low'] && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets['low'].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${bets['low'].amount}
                    </div>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    const evenNums = Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0);
                    placeBet('even', evenNums, 'Even');
                  }}
                  disabled={isSpinning}
                  className="relative py-3 bg-amber-200/40 hover:bg-amber-300/50 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  EVEN
                  {bets['even'] && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets['even'].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${bets['even'].amount}
                    </div>
                  )}
                </button>
                
                <button
                  onClick={() => placeBet('red', RED_NUMBERS, 'Red')}
                  disabled={isSpinning}
                  className="relative py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  RED
                  {bets['red'] && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets['red'].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${bets['red'].amount}
                    </div>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    const blackNums = Array.from({ length: 36 }, (_, i) => i + 1).filter(n => !RED_NUMBERS.includes(n));
                    placeBet('black', blackNums, 'Black');
                  }}
                  disabled={isSpinning}
                  className="relative py-3 bg-black hover:bg-gray-900 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  BLACK
                  {bets['black'] && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets['black'].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${bets['black'].amount}
                    </div>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    const oddNums = Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 1);
                    placeBet('odd', oddNums, 'Odd');
                  }}
                  disabled={isSpinning}
                  className="relative py-3 bg-amber-200/40 hover:bg-amber-300/50 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  ODD
                  {bets['odd'] && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets['odd'].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${bets['odd'].amount}
                    </div>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    const highNums = Array.from({ length: 18 }, (_, i) => i + 19);
                    placeBet('high', highNums, '19-36');
                  }}
                  disabled={isSpinning}
                  className="relative py-3 bg-amber-200/40 hover:bg-amber-300/50 text-white font-bold text-sm border-2 border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  19-36
                  {bets['high'] && (
                    <div className={`absolute inset-0 w-8 h-8 m-auto rounded-full ${CHIP_VALUES.find(c => c.value <= bets['high'].amount)?.color || CHIP_VALUES[0].color} border-2 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg`}>
                      ${bets['high'].amount}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={spin}
                disabled={isSpinning || Object.keys(bets).length === 0}
                className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold text-xl rounded-lg shadow-lg transform hover:scale-105 transition-all"
              >
                {isSpinning ? 'SPINNING...' : 'SPIN'}
              </button>
              <button
                onClick={clearBets}
                disabled={isSpinning || Object.keys(bets).length === 0}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg shadow-lg transform hover:scale-105 transition-all"
              >
                Clear Bets
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
