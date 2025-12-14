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

    const [showHistory, setShowHistory] = useState(false);

    const getChipClasses = (val: number) => {
        const selected = selectedChip === val;
        // Base classes for 3D/Gradient chip look
        const base = "relative w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all shadow-lg cursor-pointer";

        // Color variants with gradients
        let colorClass = "";
        switch (val) {
            case 5: colorClass = "border-white bg-gradient-to-br from-red-500 to-red-700"; break;
            case 10: colorClass = "border-white bg-gradient-to-br from-blue-500 to-blue-700"; break;
            case 20: colorClass = "border-white bg-gradient-to-br from-green-500 to-green-700"; break;
            case 100: colorClass = "border-white bg-gradient-to-br from-gray-800 to-black"; break;
            default: colorClass = "border-white bg-gray-500";
        }

        if (selected) {
            // Selected state overrides border and scale
            return classNames(base, "scale-110 border-yellow-400 bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-[0_0_15px_#facc15]");
        }

        return classNames(base, colorClass, "hover:scale-105");
    };

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans">
            {/* Background / styling matching Blackjack */}
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

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center justify-start min-h-screen py-8 px-4 pt-28 overflow-y-auto">

                {/* Header */}
                <div className="relative w-full max-w-6xl mb-8 flex justify-center items-center">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent drop-shadow-sm">
                        Roulette
                    </h1>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2"
                    >
                        📜 History
                    </button>
                </div>

                <div className="flex flex-col xl:flex-row gap-8 items-start justify-center w-full max-w-7xl">

                    {/* Left Column: Wheel & Info */}
                    <div className="flex flex-col items-center gap-6">
                        <div className="bg-green-900/40 p-8 rounded-full border-4 border-green-700/30 shadow-2xl backdrop-blur-sm">
                            <Wheel rouletteData={rouletteData} number={winningNumber} />
                        </div>

                        {/* Status/Win Message */}
                        <div className="h-16 flex items-center justify-center">
                            {lastWinAmount > 0 && (
                                <div className="px-8 py-3 bg-yellow-500/90 rounded-xl text-black font-extrabold text-2xl animate-bounce shadow-[0_0_20px_#eab308]">
                                    YOU WON ${lastWinAmount}!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Board & Controls */}
                    <div className="flex flex-col items-center gap-6 flex-1">

                        {/* Top Control Panel: Chips & Actions */}
                        <div className="flex flex-col items-center gap-6 bg-black/40 p-6 rounded-xl border border-white/10 w-full max-w-3xl backdrop-blur-sm shadow-md">

                            <div className="flex flex-col items-center gap-2">
                                <h3 className="text-green-200 font-semibold uppercase tracking-wider text-sm">Select Chip Value</h3>
                                <div className="flex gap-4 flex-wrap justify-center p-2">
                                    {[5, 10, 20, 100].map(val => (
                                        <div
                                            key={val}
                                            className={getChipClasses(val)}
                                            onClick={() => setSelectedChip(val)}
                                        >
                                            {val}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4 w-full justify-center">
                                <button
                                    onClick={clearBet}
                                    disabled={stage !== GameStages.PLACE_BET || placedChips.size === 0}
                                    className="px-8 py-3 bg-red-600/90 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all border-b-4 border-red-800 active:border-b-0 active:translate-y-1"
                                >
                                    Clear Bets
                                </button>
                                <button
                                    onClick={spin}
                                    disabled={stage !== GameStages.PLACE_BET}
                                    className="px-16 py-3 bg-gradient-to-r from-amber-400 to-yellow-600 hover:from-amber-300 hover:to-yellow-500 text-black font-extrabold text-2xl rounded-xl shadow-[0_0_20px_#ca8a04] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transform hover:scale-105 transition-all border-b-4 border-amber-700 active:border-b-0 active:translate-y-1"
                                >
                                    {stage === GameStages.PLACE_BET ? "SPIN" : "SPINNING..."}
                                </button>
                            </div>
                        </div>

                        {/* Game Board (Now at bottom) */}
                        <div className="transform origin-top scale-[0.6] md:scale-[0.75] lg:scale-[0.85] p-4 bg-black/20 rounded-xl border border-white/5">
                            <Board
                                onCellClick={onCellClick}
                                chipsData={{ selectedChip, placedChips }}
                                rouletteData={rouletteData}
                            />
                        </div>
                    </div>
                </div>

                {/* History Modal */}
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
            </div>
        </div>
    );
};

export default RouletteGame;
