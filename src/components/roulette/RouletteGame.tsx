import React, { useState, useRef, useEffect } from "react";
import Wheel from "./Wheel";
import Board from "./Board";
import { GameStages, ValueType } from "./Global";
import type { Item, PlacedChip } from "./Global";
import classNames from "classnames";
import "./roulette.css";

// Standard American Roulette sequence for the wheel
const WHEEL_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25,
    17, 34, 6, 27, 13, 36, 11,
    30, 8, 23, 10, 5, 24, 16, 33,
    1, 20, 14, 31, 9, 22, 18, 29,
    7, 28, 12, 35, 3, 26
];

const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 29, 28, 31, 33, 35];

const RouletteGame = () => {
    const [balance, setBalance] = useState(1000);
    const [selectedChip, setSelectedChip] = useState<number | null>(10);
    const [placedChips, setPlacedChips] = useState<Map<Item, PlacedChip>>(new Map());
    const [stage, setStage] = useState<GameStages>(GameStages.PLACE_BET);
    const [winningNumber, setWinningNumber] = useState<any>({ next: null });
    const [history, setHistory] = useState<number[]>([]);
    const [lastWinAmount, setLastWinAmount] = useState(0);

    const rouletteData = { numbers: WHEEL_NUMBERS };

    const onCellClick = (item: Item) => {
        if (stage !== GameStages.PLACE_BET) return;

        const currentChipValue = selectedChip;
        if (currentChipValue === null) return;
        if (balance < currentChipValue) {
            alert("Insufficient balance!");
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
        setBalance(prev => prev - currentChipValue);
    };

    const clearBet = () => {
        if (stage !== GameStages.PLACE_BET) return;
        // Refund bets
        let totalBet = 0;
        placedChips.forEach(chip => totalBet += chip.sum);
        setBalance(prev => prev + totalBet);
        setPlacedChips(new Map());
    };

    const spin = () => {
        if (placedChips.size === 0) {
            alert("Place a bet first!");
            return;
        }
        setStage(GameStages.NO_MORE_BETS);
        const nextNum = WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)];
        // Trigger wheel animation
        setWinningNumber({ next: nextNum.toString(), onStop: () => handleSpinEnd(nextNum) });
    };

    const handleSpinEnd = (number: number) => {
        // Calculate Winnings
        let totalWin = 0;
        placedChips.forEach((chip) => {
            const payout = calculatePayout(chip, number);
            totalWin += payout;
        });

        if (totalWin > 0) {
            setBalance(prev => prev + totalWin);
            setLastWinAmount(totalWin);
        } else {
            setLastWinAmount(0);
        }

        setHistory(prev => [number, ...prev.slice(0, 9)]);
        setStage(GameStages.WINNERS);

        // Reset after delay
        setTimeout(() => {
            setPlacedChips(new Map());
            setStage(GameStages.PLACE_BET);
            setWinningNumber({ next: null });
            setLastWinAmount(0);
        }, 3000);
    };

    const calculatePayout = (chip: PlacedChip, winningNum: number): number => {
        // Basic approximate payouts for simplified logic
        const { item, sum } = chip;
        switch (item.type) {
            case ValueType.NUMBER:
                return item.value === winningNum ? sum * 36 : 0;
            case ValueType.RED:
                return !BLACK_NUMBERS.includes(winningNum) && winningNum !== 0 ? sum * 2 : 0;
            case ValueType.BLACK:
                return BLACK_NUMBERS.includes(winningNum) ? sum * 2 : 0;
            case ValueType.EVEN:
                return (winningNum !== 0 && winningNum % 2 === 0) ? sum * 2 : 0;
            case ValueType.ODD:
                return (winningNum !== 0 && winningNum % 2 !== 0) ? sum * 2 : 0;
            // Add other logic (splits, corners) if needed, simplified for now
            // Splits/Corners need checking if winningNum is in valueSplit array
            case ValueType.DOUBLE_SPLIT:
            case ValueType.QUAD_SPLIT:
            case ValueType.TRIPLE_SPLIT:
                return item.valueSplit.includes(winningNum) ? sum * (36 / item.valueSplit.length) : 0;

            case ValueType.NUMBERS_1_12:
                return (winningNum >= 1 && winningNum <= 12) ? sum * 3 : 0;
            case ValueType.NUMBERS_2_12:
                return (winningNum >= 13 && winningNum <= 24) ? sum * 3 : 0;
            case ValueType.NUMBERS_3_12:
                return (winningNum >= 25 && winningNum <= 36) ? sum * 3 : 0;
            case ValueType.NUMBERS_1_18:
                return (winningNum >= 1 && winningNum <= 18) ? sum * 2 : 0;
            case ValueType.NUMBERS_19_36:
                return (winningNum >= 19 && winningNum <= 36) ? sum * 2 : 0;
            default:
                return 0;
        }
    };

    const getChipClasses = (val: number) => classNames("w-16 h-16 rounded-full flex items-center justify-center font-bold text-white cursor-pointer transition-transform hover:scale-110 border-2", {
        "bg-red-500 border-red-300": val === 5,
        "bg-blue-500 border-blue-300": val === 10,
        "bg-green-500 border-green-300": val === 20,
        "bg-black border-gray-500": val === 100,
        "ring-4 ring-yellow-400": selectedChip === val
    });

    return (
        <div className="bg-green-900 min-h-screen text-white font-sans p-8 flex flex-col items-center">
            <h1 className="text-4xl font-bold mb-4 drop-shadow-md text-amber-400">Roulette</h1>

            <div className="flex gap-8 mb-8">
                {/* Left Panel: Winners & Wheel */}
                <div className="flex flex-col gap-4">
                    {/* History Panel */}
                    <div className="bg-black/50 p-4 rounded-lg w-full max-w-sm">
                        <h3 className="text-amber-200 font-bold mb-2 text-center">History</h3>
                        <div className="flex gap-2 flex-wrap justify-center">
                            {history.map((num, i) => (
                                <div key={i} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${num === 0 ? 'bg-green-600' : BLACK_NUMBERS.includes(num) ? 'bg-gray-800' : 'bg-red-600'}`}>
                                    {num}
                                </div>
                            ))}
                        </div>
                    </div>

                    <Wheel rouletteData={rouletteData} number={winningNumber} />

                    {lastWinAmount > 0 && (
                        <div className="bg-yellow-500/80 p-4 rounded-lg text-black text-center font-bold text-2xl animate-bounce">
                            YOU WON ${lastWinAmount}!
                        </div>
                    )}
                </div>

                {/* Right Panel: Board */}
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-black/30 p-2 rounded-full px-8 text-2xl font-bold border border-white/20">
                        Balance: <span className="text-green-400">${balance}</span>
                    </div>

                    <div className="transform scale-90 origin-top">
                        <Board
                            onCellClick={onCellClick}
                            chipsData={{ selectedChip, placedChips }}
                            rouletteData={rouletteData}
                        />
                    </div>

                    {/* Controls */}
                    <div className="bg-black/40 p-6 rounded-xl border border-white/10 w-full flex flex-col items-center gap-6">
                        <div className="flex gap-4">
                            {[5, 10, 20, 100].map(val => (
                                <div
                                    key={val}
                                    className={`${getChipClasses(val)} text-xl`}
                                    onClick={() => setSelectedChip(val)}
                                >
                                    {val}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={clearBet}
                                disabled={stage !== GameStages.PLACE_BET}
                                className="px-8 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold text-lg shadow-lg"
                            >
                                Clear Bets
                            </button>
                            <button
                                onClick={spin}
                                disabled={stage !== GameStages.PLACE_BET}
                                className="px-12 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold text-xl text-black shadow-lg transform active:scale-95 transition-all"
                            >
                                SPIN
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouletteGame;
