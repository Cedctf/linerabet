
import { useEffect, useState, useCallback } from "react";
import { lineraAdapter } from "@/lib/linera-adapter";
import { CONTRACTS_APP_ID } from "@/constants";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";
import ConnectWallet from "../components/ConnectWallet";

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

export default function Baccarat2Page() {
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

    // Simulation Logic
    const getRandomCard = (): Card => {
        const suits = ["hearts", "diamonds", "clubs", "spades"];
        const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
        return {
            suit: suits[Math.floor(Math.random() * suits.length)],
            value: values[Math.floor(Math.random() * values.length)]
        };
    };

    const calculateScore = (hand: Card[]): number => {
        let score = 0;
        hand.forEach(card => {
            let val = 0;
            if (["10", "J", "Q", "K"].includes(card.value)) val = 0;
            else if (card.value === "A") val = 1;
            else val = parseInt(card.value);
            score += val;
        });
        return score % 10;
    };

    const simulateGame = () => {
        // Initial Deal
        const playerHand = [getRandomCard(), getRandomCard()];
        const bankerHand = [getRandomCard(), getRandomCard()];

        let playerScore = calculateScore(playerHand);
        let bankerScore = calculateScore(bankerHand);
        let isNatural = playerScore >= 8 || bankerScore >= 8;

        if (!isNatural) {
            // Player Draw Rule
            if (playerScore <= 5) {
                const thirdCard = getRandomCard();
                playerHand.push(thirdCard);
                playerScore = calculateScore(playerHand);

                // Banker Draw Rule
                let bankerDraws = false;
                const thirdVal = calculateScore([thirdCard]); // Value of 3rd card

                if (bankerScore <= 2) bankerDraws = true;
                else if (bankerScore === 3 && thirdVal !== 8) bankerDraws = true;
                else if (bankerScore === 4 && thirdVal >= 2 && thirdVal <= 7) bankerDraws = true;
                else if (bankerScore === 5 && thirdVal >= 4 && thirdVal <= 7) bankerDraws = true;
                else if (bankerScore === 6 && thirdVal >= 6 && thirdVal <= 7) bankerDraws = true;

                if (bankerDraws) {
                    bankerHand.push(getRandomCard());
                    bankerScore = calculateScore(bankerHand);
                }
            } else if (bankerScore <= 5) {
                // Player stood (6 or 7), Banker draws on 0-5
                bankerHand.push(getRandomCard());
                bankerScore = calculateScore(bankerHand);
            }
        }

        // Determine Winner
        let winner: BaccaratBetType = "TIE";
        if (playerScore > bankerScore) winner = "PLAYER";
        else if (bankerScore > playerScore) winner = "BANKER";

        // Calculate Payout
        let payout = 0;
        if (winner === betType) {
            if (betType === "PLAYER") payout = betAmount * 2;
            else if (betType === "BANKER") payout = betAmount * 1.95;
            else if (betType === "TIE") payout = betAmount * 9;
        }

        const outcome: BaccaratRecord = {
            player_hand: playerHand,
            banker_hand: bankerHand,
            playerHand,
            bankerHand,
            bet: betAmount,
            betType,
            winner,
            payout,
            timestamp: Date.now(),
            playerScore,
            bankerScore,
            isNatural
        };

        setLastOutcome(outcome);
        setHistory(prev => [outcome, ...prev]);
    };

    const placeBet = async () => {
        if (busy) return;
        // if (balance < betAmount) {
        //     alert("Insufficient balance");
        //     return;
        // }
        setBusy(true);
        try {
            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            simulateGame();

            // Mutation
            // Operation: PlayBaccarat { amount: u64, bet_type: BaccaratBetType }
            // const mutation = `mutation { playBaccarat(amount: ${betAmount}, betType: ${betType}) }`;
            // await lineraAdapter.mutate(mutation);

            // await refreshData(); // Refresh balance
            // await refresh(); // Refresh game state
        } catch (e: any) {
            console.error("Bet failed:", e);
            alert("Bet failed: " + e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="h-screen bg-black text-white overflow-hidden relative font-sans">
            {/* Background */}
            <div className="absolute inset-0 bg-[url('/baccarat.jpg')] bg-cover bg-center" />

            <div className="relative z-10 flex flex-col items-center justify-center h-full py-4 px-4">
                {/* Top Right Controls */}
                <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
                    <ConnectWallet />
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
                    >
                        📜 History ({history.length})
                    </button>
                </div>

                {/* Header Removed */}

                {/* Chip Selection - Bottom Center */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 p-4 rounded-xl border border-white/10 w-full max-w-xl backdrop-blur-sm shadow-md flex flex-col items-center z-50">
                    <h3 className="text-red-200 font-semibold uppercase tracking-wider text-xs mb-2">Select Chip Value</h3>
                    <div className="flex items-center gap-3 flex-wrap justify-center">
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
                                    className="w-16 h-16 object-contain"
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bottom Right Controls - Vertical Stack */}
                <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-50">
                    <div className="text-xl font-mono text-yellow-400 font-bold bg-black/40 px-4 py-2 rounded-lg backdrop-blur-sm border border-yellow-500/30 mb-2">
                        Bet: {betAmount} Chips
                    </div>

                    <button
                        onClick={() => setBetType("PLAYER")}
                        className={`w-48 py-3 rounded-xl border-2 font-bold text-lg transition-all ${betType === "PLAYER" ? "bg-blue-600 border-blue-400 scale-105 shadow-[0_0_20px_rgba(37,99,235,0.5)]" : "bg-blue-900/40 border-blue-800 hover:bg-blue-900/60 backdrop-blur-md"}`}
                    >
                        BET PLAYER
                    </button>
                    <button
                        onClick={() => setBetType("TIE")}
                        className={`w-48 py-3 rounded-xl border-2 font-bold text-lg transition-all ${betType === "TIE" ? "bg-green-600 border-green-400 scale-105 shadow-[0_0_20px_rgba(22,163,74,0.5)]" : "bg-green-900/40 border-green-800 hover:bg-green-900/60 backdrop-blur-md"}`}
                    >
                        BET TIE
                    </button>
                    <button
                        onClick={() => setBetType("BANKER")}
                        className={`w-48 py-3 rounded-xl border-2 font-bold text-lg transition-all ${betType === "BANKER" ? "bg-red-600 border-red-400 scale-105 shadow-[0_0_20px_rgba(220,38,38,0.5)]" : "bg-red-900/40 border-red-800 hover:bg-red-900/60 backdrop-blur-md"}`}
                    >
                        BET BANKER
                    </button>

                    <button
                        onClick={placeBet}
                        disabled={busy || !!lastOutcome}
                        className="w-48 py-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-extrabold text-2xl rounded-xl shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {busy ? "..." : "DEAL"}
                    </button>
                </div>

                {/* Game Area - Absolute Positioning for Manual Placement */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Player Hand */}
                    {/* Mobile: Top 15%, Centered. Desktop: Top 20%, Left 25% */}
                    <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[90%] md:w-[350px] md:left-[25%] md:translate-x-0 md:top-[20%] pointer-events-auto bg-blue-900/20 p-4 md:p-6 rounded-2xl border-2 border-blue-500/30 flex flex-col items-center backdrop-blur-sm transition-all duration-300 hover:border-blue-400/50">
                        <h2 className="text-xl md:text-2xl font-bold text-blue-400 mb-2 md:mb-4 tracking-widest">PLAYER</h2>
                        <div className="flex gap-2 md:gap-4 min-h-[100px] md:min-h-[120px] items-center justify-center flex-wrap">
                            {lastOutcome ? (
                                lastOutcome.playerHand.map((c, i) => (
                                    <div key={i} className="transform hover:scale-105 transition-transform shadow-xl">
                                        <CardComp suit={normalizeCard(c).suit as any} value={normalizeCard(c).value as any} width={window.innerWidth < 768 ? 60 : 80} height={window.innerWidth < 768 ? 84 : 112} />
                                    </div>
                                ))
                            ) : (
                                <div className="text-blue-300/30 font-bold text-xl tracking-widest border-2 border-dashed border-blue-500/30 rounded-lg w-16 h-24 md:w-20 md:h-28 flex items-center justify-center">?</div>
                            )}
                        </div>
                        {lastOutcome && <div className="text-4xl md:text-5xl font-black mt-2 md:mt-4 text-white drop-shadow-lg">{lastOutcome.playerScore}</div>}
                    </div>

                    {/* Banker Hand */}
                    {/* Mobile: Top 45%, Centered. Desktop: Top 20%, Right 25% */}
                    <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[90%] md:w-[350px] md:left-auto md:right-[25%] md:translate-x-0 md:top-[20%] pointer-events-auto bg-red-900/20 p-4 md:p-6 rounded-2xl border-2 border-red-500/30 flex flex-col items-center backdrop-blur-sm transition-all duration-300 hover:border-red-400/50">
                        <h2 className="text-xl md:text-2xl font-bold text-red-400 mb-2 md:mb-4 tracking-widest">BANKER</h2>
                        <div className="flex gap-2 md:gap-4 min-h-[100px] md:min-h-[120px] items-center justify-center flex-wrap">
                            {lastOutcome ? (
                                lastOutcome.bankerHand.map((c, i) => (
                                    <div key={i} className="transform hover:scale-105 transition-transform shadow-xl">
                                        <CardComp suit={normalizeCard(c).suit as any} value={normalizeCard(c).value as any} width={window.innerWidth < 768 ? 60 : 80} height={window.innerWidth < 768 ? 84 : 112} />
                                    </div>
                                ))
                            ) : (
                                <div className="text-red-300/30 font-bold text-xl tracking-widest border-2 border-dashed border-red-500/30 rounded-lg w-16 h-24 md:w-20 md:h-28 flex items-center justify-center">?</div>
                            )}
                        </div>
                        {lastOutcome && <div className="text-4xl md:text-5xl font-black mt-2 md:mt-4 text-white drop-shadow-lg">{lastOutcome.bankerScore}</div>}
                    </div>
                </div>

                {/* Outcome Message & Controls - Absolute Positioned above Chip Selection */}
                {lastOutcome && (
                    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 mb-4 w-full max-w-lg mx-auto bg-green-900/90 p-4 rounded-xl border border-green-500/30 backdrop-blur-md z-[60] shadow-2xl">
                        <div className="text-center animate-bounce">
                            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 drop-shadow-sm uppercase">
                                {lastOutcome.winner} WINS
                            </div>
                            {lastOutcome.payout > 0 ? (
                                <div className="text-xl text-green-400 font-bold mt-1">
                                    You Won {lastOutcome.payout} Chips!
                                </div>
                            ) : (
                                <div className="text-xl text-red-400 font-bold mt-1">
                                    You Lost {lastOutcome.bet} Chips
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setLastOutcome(null)}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg shadow-lg text-lg transform hover:scale-105 transition-all w-full"
                        >
                            Play Again
                        </button>
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
