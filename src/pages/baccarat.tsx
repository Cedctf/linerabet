
import React, { useEffect, useState, useCallback } from "react";
import { lineraAdapter } from "@/lib/linera-adapter";
import { CONTRACTS_APP_ID } from "@/constants";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";

// Types
type BaccaratBetType = "PLAYER" | "BANKER" | "TIE";

interface Card {
    suit: string;
    value: string;
}

interface BaccaratRecord {
    player_hand: Card[];
    banker_hand: Card[]; // Note: contract uses snake_case in Struct, but GraphQL might return camelCase or snake_case depending on configuration. async-graphql usually defaults to camelCase for fields unless renamed. Let's assume camelCase for now based on previous files, but check service.rs.
    // service.rs uses SimpleObject which defaults to camelCase.
    // wait, in service.rs:
    // last_baccarat_outcome: Option<BaccaratRecord>,
    // And BaccaratRecord in state.rs uses snake_case fields. 
    // async-graphql SimpleObject creates identifiers in camelCase by default.
    // SO: playerHand, bankerHand.
    playerHand: Card[];
    bankerHand: Card[];
    bet: number;
    betType: BaccaratBetType;
    winner: BaccaratBetType;
    payout: number;
    timestamp: number;
    playerScore: number;
    bankerScore: number;
    isNatural: boolean;
}

// Helper to normalize card values for display
const normalizeCard = (c: any) => {
    return {
        suit: c.suit.toLowerCase(),
        value: c.value.toLowerCase()
    }
}

export default function BaccaratPage() {
    const { lineraData, refreshData } = useGame();
    const balance = lineraData?.gameBalance || 0;
    const isConnected = !!lineraData;

    const [betAmount, setBetAmount] = useState<number>(1);
    const [betType, setBetType] = useState<BaccaratBetType>("PLAYER");
    const [busy, setBusy] = useState(false);
    const [lastOutcome, setLastOutcome] = useState<BaccaratRecord | null>(null);
    const [history, setHistory] = useState<BaccaratRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const allowedBets = [1, 2, 3, 4, 5];

    // Refresh Game State
    const refresh = useCallback(async () => {
        if (!lineraAdapter.isChainConnected()) return;
        try {
            if (!lineraAdapter.isApplicationSet()) {
                await lineraAdapter.setApplication(CONTRACTS_APP_ID);
            }
            const owner = lineraAdapter.identity();
            const query = `
            query GetBaccaratState($owner: AccountOwner!) {
                player(owner: $owner) {
                    lastBaccaratOutcome {
                        playerHand { suit value }
                        bankerHand { suit value }
                        bet
                        betType
                        winner
                        payout
                        timestamp
                        playerScore
                        bankerScore
                        isNatural
                    }
                    baccaratHistory {
                        playerHand { suit value }
                        bankerHand { suit value }
                        bet
                        betType
                        winner
                        payout
                        timestamp
                    }
                }
            }
        `;
            const data = await lineraAdapter.queryApplication<any>(query, { owner });
            if (data.player) {
                setLastOutcome(data.player.lastBaccaratOutcome);
                setHistory(data.player.baccaratHistory || []);
            }
        } catch (e) {
            console.error("Failed to refresh Baccarat state:", e);
        }
    }, []);

    useEffect(() => {
        if (isConnected) {
            refresh();
        }
    }, [isConnected, refresh]);

    const placeBet = async () => {
        if (busy) return;
        if (balance < betAmount) {
            alert("Insufficient balance");
            return;
        }
        setBusy(true);
        try {
            // Mutation
            // Operation: PlayBaccarat { amount: u64, bet_type: BaccaratBetType }
            const mutation = `mutation { playBaccarat(amount: ${betAmount}, betType: ${betType}) }`;
            await lineraAdapter.mutate(mutation);

            await refreshData(); // Refresh balance
            await refresh(); // Refresh game state
        } catch (e: any) {
            console.error("Bet failed:", e);
            alert("Bet failed: " + e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans">
            {/* Background */}
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

            <div className="relative z-10 flex flex-col items-center justify-start min-h-screen py-8 px-4 pt-28">
                {/* Header */}
                <div className="relative w-full max-w-4xl mb-8 flex justify-center items-center">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent drop-shadow-sm">
                        Baccarat
                    </h1>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2"
                    >
                        📜 History ({history.length})
                    </button>
                </div>

                {/* Chip Selection - Top */}
                <div className="bg-black/40 p-6 rounded-xl border border-white/10 w-full max-w-3xl backdrop-blur-sm shadow-md mb-8 flex flex-col items-center">
                    <h3 className="text-red-200 font-semibold uppercase tracking-wider text-sm mb-4">Select Chip Value</h3>
                    <div className="flex items-center gap-4 flex-wrap justify-center">
                        {allowedBets.map((chipValue) => (
                            <button
                                key={chipValue}
                                onClick={() => setBetAmount(chipValue)}
                                disabled={busy || balance < chipValue}
                                className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all shadow-lg ${betAmount === chipValue
                                    ? "border-yellow-400 bg-gradient-to-br from-yellow-500 to-yellow-600 scale-110"
                                    : "border-white bg-gradient-to-br from-red-500 to-red-700 hover:scale-105"
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                {chipValue}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Game Area */}
                <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Player Hand */}
                    <div className="col-span-1 bg-blue-900/30 p-6 rounded-xl border-2 border-blue-500/30 flex flex-col items-center">
                        <h2 className="text-2xl font-bold text-blue-400 mb-4">PLAYER</h2>
                        <div className="flex gap-2 min-h-[140px] items-center justify-center flex-wrap">
                            {lastOutcome ? (
                                lastOutcome.playerHand.map((c, i) => (
                                    <div key={i} className="transform hover:scale-105 transition-transform">
                                        <CardComp suit={normalizeCard(c).suit as any} value={normalizeCard(c).value as any} width={80} height={112} />
                                    </div>
                                ))
                            ) : (
                                <div className="text-blue-300/50">Waiting...</div>
                            )}
                        </div>
                        {lastOutcome && <div className="text-4xl font-bold mt-4 text-white">{lastOutcome.playerScore}</div>}
                    </div>

                    {/* Betting Controls (Center) */}
                    <div className="col-span-1 flex flex-col items-center justify-center gap-6">
                        <div className="flex flex-col w-full gap-4">
                            <button
                                onClick={() => setBetType("PLAYER")}
                                className={`p-4 rounded-xl border-2 font-bold text-xl transition-all ${betType === "PLAYER" ? "bg-blue-600 border-blue-400 scale-105 shadow-[0_0_20px_rgba(37,99,235,0.5)]" : "bg-blue-900/20 border-blue-800 hover:bg-blue-900/40"}`}
                            >
                                BET PLAYER (1:1)
                            </button>
                            <button
                                onClick={() => setBetType("TIE")}
                                className={`p-4 rounded-xl border-2 font-bold text-xl transition-all ${betType === "TIE" ? "bg-green-600 border-green-400 scale-105 shadow-[0_0_20px_rgba(22,163,74,0.5)]" : "bg-green-900/20 border-green-800 hover:bg-green-900/40"}`}
                            >
                                BET TIE (8:1)
                            </button>
                            <button
                                onClick={() => setBetType("BANKER")}
                                className={`p-4 rounded-xl border-2 font-bold text-xl transition-all ${betType === "BANKER" ? "bg-red-600 border-red-400 scale-105 shadow-[0_0_20px_rgba(220,38,38,0.5)]" : "bg-red-900/20 border-red-800 hover:bg-red-900/40"}`}
                            >
                                BET BANKER (0.95:1)
                            </button>
                        </div>

                        <div className="text-xl font-mono text-yellow-400 mt-4">
                            Bet: {betAmount} Chips
                        </div>

                        <button
                            onClick={placeBet}
                            disabled={busy || !!lastOutcome}
                            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-extrabold text-2xl rounded-xl shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {busy ? "DEALING..." : lastOutcome ? "Result Above" : "DEAL"}
                        </button>
                    </div>

                    {/* Banker Hand */}
                    <div className="col-span-1 bg-red-900/30 p-6 rounded-xl border-2 border-red-500/30 flex flex-col items-center">
                        <h2 className="text-2xl font-bold text-red-400 mb-4">BANKER</h2>
                        <div className="flex gap-2 min-h-[140px] items-center justify-center flex-wrap">
                            {lastOutcome ? (
                                lastOutcome.bankerHand.map((c, i) => (
                                    <div key={i} className="transform hover:scale-105 transition-transform">
                                        <CardComp suit={normalizeCard(c).suit as any} value={normalizeCard(c).value as any} width={80} height={112} />
                                    </div>
                                ))
                            ) : (
                                <div className="text-red-300/50">Waiting...</div>
                            )}
                        </div>
                        {lastOutcome && <div className="text-4xl font-bold mt-4 text-white">{lastOutcome.bankerScore}</div>}
                    </div>
                </div>

                {/* Outcome Message & Controls */}
                {lastOutcome ? (
                    <div className="flex flex-col items-center gap-6 mb-8 w-full max-w-lg mx-auto bg-green-900/50 p-6 rounded-xl border border-green-500/30 backdrop-blur-sm">
                        <div className="text-center animate-bounce">
                            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 drop-shadow-sm uppercase">
                                {lastOutcome.winner} WINS
                            </div>
                            {lastOutcome.payout > 0 ? (
                                <div className="text-2xl text-green-400 font-bold mt-2">
                                    You Won {lastOutcome.payout} Chips!
                                </div>
                            ) : (
                                <div className="text-2xl text-red-400 font-bold mt-2">
                                    You Lost {lastOutcome.bet} Chips
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setLastOutcome(null)}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg shadow-lg text-xl transform hover:scale-105 transition-all w-full"
                        >
                            Play Again
                        </button>
                    </div>
                ) : (
                    <div className="h-24"></div> // Spacer to keep layout stable
                )}
            </div>

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-gray-900 to-black rounded-lg border-2 border-gray-600 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-3xl font-bold text-white">Game History</h2>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="text-white text-3xl hover:text-red-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-2">
                            {history.map((game, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                                    <div className="flex items-center gap-4">
                                        <span className="text-gray-400 text-sm">#{history.length - i}</span>
                                        <span className={`font-bold ${game.winner === "PLAYER" ? "text-blue-400" : game.winner === "BANKER" ? "text-red-400" : "text-green-400"}`}>
                                            {game.winner}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-sm">Bet: {game.bet} on {game.betType}</span>
                                        <span className={game.payout > 0 ? "text-green-400" : "text-red-400"}>
                                            {game.payout > 0 ? `+${game.payout}` : `-${game.bet}`}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
