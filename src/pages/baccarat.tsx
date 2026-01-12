
import { useEffect, useState, useCallback } from "react";
import { lineraAdapter } from "@/lib/linera-adapter";
import { CONTRACTS_APP_ID } from "@/constants";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";
import Header from "../components/Header";

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
    const [showPopup, setShowPopup] = useState(false);

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
                        // Show popup after 1 second delay so player can see the cards
                        setTimeout(() => {
                            setShowPopup(true);
                        }, 1000);
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
        setShowPopup(false);

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
        <div className="h-screen bg-black text-white overflow-hidden relative font-sans">
            {/* Background */}
            <div className="absolute inset-0 bg-[url('/baccarat-desk.png')] bg-cover bg-center" />

            <div className="relative z-10 flex flex-col items-center justify-center h-full py-4 px-4">
                <Header />

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

                {/* Bottom Right Controls - Combined */}
                <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-50">
                    {/* Main Control Panel */}
                    <div className="bg-black/60 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-2xl flex flex-col gap-4 items-center">

                        {/* Chip Selection */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="text-sm font-semibold text-white/80 text-center">Select Chip Value</div>
                            <div className="flex items-center gap-2">
                                {allowedBets.map((chipValue) => (
                                    <button
                                        key={chipValue}
                                        onClick={() => setBetAmount(chipValue)}
                                        disabled={busy || balance < chipValue}
                                        className={`relative transition-all hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed ${betAmount === chipValue ? "scale-125 drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" : "opacity-90 hover:opacity-100"}`}
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

                        {/* Betting Buttons - Images */}
                        <div className="flex flex-row gap-3 w-full justify-center items-center">
                            <button
                                onClick={() => setBetType("PLAYER")}
                                className={`transition-all hover:scale-105 ${betType === "PLAYER" ? "scale-110 drop-shadow-[0_0_15px_rgba(37,99,235,0.8)]" : "opacity-80 hover:opacity-100"}`}
                            >
                                <img src="/buttons/player.png" alt="Bet Player" className="w-32 object-contain" />
                            </button>
                            <button
                                onClick={() => setBetType("TIE")}
                                className={`transition-all hover:scale-105 ${betType === "TIE" ? "scale-110 drop-shadow-[0_0_15px_rgba(22,163,74,0.8)]" : "opacity-80 hover:opacity-100"}`}
                            >
                                <img src="/buttons/tie.png" alt="Bet Tie" className="w-32 object-contain" />
                            </button>
                            <button
                                onClick={() => setBetType("BANKER")}
                                className={`transition-all hover:scale-105 ${betType === "BANKER" ? "scale-110 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]" : "opacity-80 hover:opacity-100"}`}
                            >
                                <img src="/buttons/banker.png" alt="Bet Banker" className="w-32 object-contain" />
                            </button>
                        </div>

                        {/* Deal Button */}
                        <button
                            onClick={placeBet}
                            disabled={busy || !!lastOutcome}
                            className="w-full mt-2 hover:scale-105 transition-all flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <img
                                src="/deal.png"
                                alt="Deal"
                                className="h-16 object-contain drop-shadow-lg"
                            />
                        </button>
                    </div>
                </div>

                {/* Game Area - Absolute Positioning for Manual Placement */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Player Hand */}
                    <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[90%] md:w-[350px] md:left-[25%] md:translate-x-0 md:top-[35%] pointer-events-auto flex flex-col items-center transition-all duration-300">
                        <div className="flex gap-2 md:gap-4 min-h-[100px] md:min-h-[120px] items-center justify-center flex-wrap">
                            {lastOutcome && (
                                lastOutcome.playerHand.map((c, i) => (
                                    <div key={i} className="transform hover:scale-105 transition-transform shadow-xl">
                                        <CardComp suit={normalizeCard(c).suit as any} value={normalizeCard(c).value as any} width={typeof window !== 'undefined' && window.innerWidth < 768 ? 60 : 80} height={typeof window !== 'undefined' && window.innerWidth < 768 ? 84 : 112} />
                                    </div>
                                ))
                            )}
                        </div>
                        {lastOutcome && <div className="text-4xl md:text-5xl font-black mt-2 md:mt-4 text-white drop-shadow-lg">{lastOutcome.playerScore}</div>}
                    </div>

                    {/* Banker Hand */}
                    <div className="absolute top-[55%] left-1/2 -translate-x-1/2 w-[90%] md:w-[350px] md:left-auto md:right-[25%] md:translate-x-0 md:top-[35%] pointer-events-auto flex flex-col items-center transition-all duration-300">
                        <div className="flex gap-2 md:gap-4 min-h-[100px] md:min-h-[120px] items-center justify-center flex-wrap">
                            {lastOutcome && (
                                lastOutcome.bankerHand.map((c, i) => (
                                    <div key={i} className="transform hover:scale-105 transition-transform shadow-xl">
                                        <CardComp suit={normalizeCard(c).suit as any} value={normalizeCard(c).value as any} width={typeof window !== 'undefined' && window.innerWidth < 768 ? 60 : 80} height={typeof window !== 'undefined' && window.innerWidth < 768 ? 84 : 112} />
                                    </div>
                                ))
                            )}
                        </div>
                        {lastOutcome && <div className="text-4xl md:text-5xl font-black mt-2 md:mt-4 text-white drop-shadow-lg">{lastOutcome.bankerScore}</div>}
                    </div>
                </div>

                {/* Result Popup with Try Again - Center */}
                {showPopup && lastOutcome && (
                    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center">
                        <div className="relative">
                            {/* Win/Lose Image */}
                            <img
                                src={
                                    lastOutcome.payout > 0
                                        ? "/animations/win.png"
                                        : "/animations/lose.png"
                                }
                                alt={lastOutcome.payout > 0 ? "You Win!" : "You Lose"}
                                className="max-w-[50vw] max-h-[60vh] object-contain"
                            />
                            {/* Try Again Button - Overlaid at bottom of image */}
                            <button
                                onClick={() => {
                                    setShowPopup(false);
                                    setLastOutcome(null);
                                    setPhase("WaitingForGame");
                                }}
                                className="absolute bottom-[5%] left-1/2 -translate-x-1/2 hover:scale-110 transition-transform"
                                style={{ width: '15vw', height: '12vh' }}
                            >
                                <img
                                    src="/buttons/try-again.png"
                                    alt="Play Again"
                                    className="w-full h-full object-contain"
                                />
                            </button>
                        </div>
                    </div>
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
