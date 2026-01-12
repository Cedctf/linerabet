
import { useEffect, useState, useCallback } from "react";
import { lineraAdapter } from "@/lib/linera-adapter";
import { CONTRACTS_APP_ID } from "@/constants";
import { useGame } from "@/context/GameContext";
import CardComp from "../components/Card";
import ConnectWallet from "../components/ConnectWallet";
import Header from "../components/Header";

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
    const [showPopup, setShowPopup] = useState(false);

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

        // Delay popup to let user see result
        setTimeout(() => {
            setShowPopup(true);
        }, 2000);
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

                {/* Header Removed */}

                {/* Chip Selection - Bottom Center */}


                {/* Bottom Right Controls - Combined */}
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
                    {/* Mobile: Top 25%, Centered. Desktop: Top 35%, Left 25% */}
                    <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[90%] md:w-[350px] md:left-[25%] md:translate-x-0 md:top-[35%] pointer-events-auto flex flex-col items-center transition-all duration-300">
                        <div className="flex gap-2 md:gap-4 min-h-[100px] md:min-h-[120px] items-center justify-center flex-wrap">
                            {lastOutcome && (
                                lastOutcome.playerHand.map((c, i) => (
                                    <div key={i} className="transform hover:scale-105 transition-transform shadow-xl">
                                        <CardComp suit={normalizeCard(c).suit as any} value={normalizeCard(c).value as any} width={window.innerWidth < 768 ? 60 : 80} height={window.innerWidth < 768 ? 84 : 112} />
                                    </div>
                                ))
                            )}
                        </div>
                        {lastOutcome && <div className="text-4xl md:text-5xl font-black mt-2 md:mt-4 text-white drop-shadow-lg">{lastOutcome.playerScore}</div>}
                    </div>

                    {/* Banker Hand */}
                    {/* Mobile: Top 55%, Centered. Desktop: Top 35%, Right 25% */}
                    <div className="absolute top-[55%] left-1/2 -translate-x-1/2 w-[90%] md:w-[350px] md:left-auto md:right-[25%] md:translate-x-0 md:top-[35%] pointer-events-auto flex flex-col items-center transition-all duration-300">
                        <div className="flex gap-2 md:gap-4 min-h-[100px] md:min-h-[120px] items-center justify-center flex-wrap">
                            {lastOutcome && (
                                lastOutcome.bankerHand.map((c, i) => (
                                    <div key={i} className="transform hover:scale-105 transition-transform shadow-xl">
                                        <CardComp suit={normalizeCard(c).suit as any} value={normalizeCard(c).value as any} width={window.innerWidth < 768 ? 60 : 80} height={window.innerWidth < 768 ? 84 : 112} />
                                    </div>
                                ))
                            )}
                        </div>
                        {lastOutcome && <div className="text-4xl md:text-5xl font-black mt-2 md:mt-4 text-white drop-shadow-lg">{lastOutcome.bankerScore}</div>}
                    </div>
                </div>

                {/* Outcome Message & Controls - Absolute Positioned above Chip Selection */}
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
