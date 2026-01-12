
import { useEffect, useState, useCallback } from "react";
import { lineraAdapter } from "@/lib/linera-adapter";
import { CONTRACTS_APP_ID } from "@/constants";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";

// Types
type BaccaratBetType = "PLAYER" | "BANKER" | "TIE";

type Phase = "WaitingForGame" | "Playing" | "RoundComplete";

interface Card {
    suit: string;
    value: string;
}

interface BaccaratRecord {
    gameId?: number;
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

// Helper to calculate Baccarat score
const calculateBaccaratScore = (hand: any[]) => {
    if (!hand || hand.length === 0) return 0;
    let score = 0;
    for (const card of hand) {
        const val = card.value.toLowerCase();
        let point = 0;
        if (val === 'ace') point = 1;
        else if (['10', 'jack', 'queen', 'king'].includes(val)) point = 0;
        else point = parseInt(val) || 0;
        score += point;
    }
    return score % 10;
};

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

    const [phase, setPhase] = useState<Phase>("WaitingForGame");

    // Track last seen game ID to detect new games
    const [lastSeenGameId, setLastSeenGameId] = useState<number>(-1);

    // Refresh Game State
    const refresh = useCallback(async () => {
        if (!lineraAdapter.isChainConnected()) return;
        try {
            if (!lineraAdapter.isApplicationSet()) {
                await lineraAdapter.setApplication(CONTRACTS_APP_ID);
            }
            const query = `
            query GetBaccaratState {
                gameHistory {
                    gameId
                    gameType
                    baccaratWinner
                    bet
                    payout
                    timestamp
                    playerHand { suit value }
                    dealerHand { suit value }
                }
            }
        `;
            const data = await lineraAdapter.queryApplication<any>(query, {});

            if (data.gameHistory) {
                const baccHistory = data.gameHistory
                    .filter((g: any) => g.gameType === "BACCARAT")
                    .reverse(); // Newest first

                // Map to local format
                const mappedHistory = baccHistory.map((g: any) => ({
                    gameId: g.gameId,
                    playerHand: g.playerHand,
                    bankerHand: g.dealerHand,
                    bet: g.bet,
                    betType: "PLAYER" as BaccaratBetType,
                    winner: g.baccaratWinner,
                    payout: g.payout,
                    timestamp: g.timestamp,
                    playerScore: calculateBaccaratScore(g.playerHand),
                    bankerScore: calculateBaccaratScore(g.dealerHand),
                    isNatural: false
                }));

                setHistory(mappedHistory);

                // If we are playing and see a new game
                if (phase === "Playing" && mappedHistory.length > 0) {
                    const latestGame = mappedHistory[0];
                    if (latestGame.gameId > lastSeenGameId) {
                        // found our new game!
                        setLastOutcome(latestGame);
                        setPhase("RoundComplete");
                        setLastSeenGameId(latestGame.gameId);
                        setBusy(false);
                        void refreshData();
                    }
                } else if (mappedHistory.length > 0 && lastSeenGameId === -1) {
                    // Initialize last seen on first load
                    setLastSeenGameId(mappedHistory[0].gameId);
                }
            }
        } catch (e) {
            console.error("Failed to refresh Baccarat state:", e);
        }
    }, [phase, lastSeenGameId, refreshData]);

    useEffect(() => {
        if (isConnected) {
            refresh();
        }

        // Polling when playing
        let interval: NodeJS.Timeout;
        if (phase === "Playing" || busy) {
            interval = setInterval(refresh, 1000);
        }
        return () => clearInterval(interval);
    }, [isConnected, refresh, phase, busy]);

    const placeBet = async () => {
        if (busy) return;
        if (balance < betAmount) {
            alert("Insufficient balance");
            return;
        }

        // Capture current latest game ID before betting
        const currentLatestId = history.length > 0 ? (history[0] as any).gameId : -1;
        setLastSeenGameId(currentLatestId);

        setBusy(true);
        setPhase("Playing");
        setLastOutcome(null);

        try {
            const mutation = `mutation { playBaccarat(amount: ${betAmount}, betType: ${betType}) }`;
            await lineraAdapter.mutate(mutation);
            // Polling in useEffect will pick up the result
        } catch (e: any) {
            console.error("Bet failed:", e);
            alert("Bet failed: " + e.message);
            setBusy(false);
            setPhase("WaitingForGame");
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
                            {busy ? "DEALING..." : phase === "RoundComplete" ? "Result Above" : "DEAL"}
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
                            onClick={() => { setLastOutcome(null); setPhase("WaitingForGame"); }}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg shadow-lg text-xl transform hover:scale-105 transition-all w-full"
                        >
                            Play Again
                        </button>
                    </div>
                ) : (
                    <div className="h-24"></div>
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
