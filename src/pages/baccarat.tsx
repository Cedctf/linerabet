
import { useEffect, useState, useCallback, useRef } from "react";
import { lineraAdapter } from "@/lib/linera-adapter";
import { CONTRACTS_APP_ID } from "@/constants";
import { useGame } from "@/context/GameContext";
import { playBaccaratRound } from "../lib/baccarat-utils";
import CardComp from "../components/Card";
import Header from "../components/Header";

// Types
type BaccaratBetType = "PLAYER" | "BANKER" | "TIE";

type Phase = "WaitingForGame" | "Playing" | "Revealing" | "RoundComplete";
type RevealMode = "auto" | "interactive";

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

// Calculate score from first N cards only
const calculatePartialScore = (hand: any[], numCards: number) => {
    if (!hand || hand.length === 0) return 0;
    let score = 0;
    for (let i = 0; i < Math.min(numCards, hand.length); i++) {
        const card = hand[i];
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
    const { lineraData, refreshData, isDebugMode, debugBalance, setDebugBalance } = useGame();
    const balance = isDebugMode ? debugBalance : (lineraData?.gameBalance || 0);
    const isConnected = !!lineraData;

    const [debugHistory, setDebugHistory] = useState<BaccaratRecord[]>([]);

    const [betAmount, setBetAmount] = useState<number>(1);
    const [betType, setBetType] = useState<BaccaratBetType>("PLAYER");
    const [busy, setBusy] = useState(false);
    const [lastOutcome, setLastOutcome] = useState<BaccaratRecord | null>(null);
    const [history, setHistory] = useState<BaccaratRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showPopup, setShowPopup] = useState(false);

    const allowedBets = [1, 2, 3, 4, 5];

    const [phase, setPhase] = useState<Phase>("WaitingForGame");

    // Reveal mode: "auto" = cards appear automatically, "interactive" = user clicks to flip cards
    const [revealMode, setRevealMode] = useState<RevealMode>("auto");

    // For auto mode: tracks how many cards have been revealed
    const [cardsRevealed, setCardsRevealed] = useState<number>(0);

    // For interactive mode: track which cards are flipped (face-up)
    const [flippedPlayerCards, setFlippedPlayerCards] = useState<boolean[]>([]);
    const [flippedBankerCards, setFlippedBankerCards] = useState<boolean[]>([]);

    // Track if third cards should be shown (only after initial 2 cards per side are flipped)
    const [showThirdCards, setShowThirdCards] = useState(false);

    // Retractable control panel
    const [showControlsPanel, setShowControlsPanel] = useState(true);

    // Track total cards for current round
    const totalCardsRef = useRef<number>(0);

    // Track last seen game ID to detect new games
    const [lastSeenGameId, setLastSeenGameId] = useState<number>(-1);

    // Check if all initial cards (first 2 per side) are flipped
    const areInitialCardsFlipped = () => {
        const playerFirst2 = flippedPlayerCards.slice(0, 2).every(f => f);
        const bankerFirst2 = flippedBankerCards.slice(0, 2).every(f => f);
        return playerFirst2 && bankerFirst2;
    };

    // Check if all cards (including third if exists) are flipped
    const areAllCardsFlipped = () => {
        if (!lastOutcome) return false;
        const allPlayerFlipped = lastOutcome.playerHand.every((_, i) => flippedPlayerCards[i]);
        const allBankerFlipped = lastOutcome.bankerHand.every((_, i) => flippedBankerCards[i]);
        return allPlayerFlipped && allBankerFlipped;
    };

    // Handle card flip in interactive mode
    const handleCardFlip = (side: "player" | "banker", index: number) => {
        if (phase !== "Revealing" || revealMode !== "interactive") return;

        const isThirdCard = index === 2;
        if (isThirdCard && !showThirdCards) return;

        if (side === "player") {
            setFlippedPlayerCards(prev => {
                const newState = [...prev];
                newState[index] = true;
                return newState;
            });
        } else {
            setFlippedBankerCards(prev => {
                const newState = [...prev];
                newState[index] = true;
                return newState;
            });
        }
    };

    // Check if we should show third cards after initial cards are flipped
    useEffect(() => {
        if (phase !== "Revealing" || revealMode !== "interactive" || !lastOutcome) return;

        if (areInitialCardsFlipped() && !showThirdCards) {
            const hasPlayerThird = lastOutcome.playerHand.length > 2;
            const hasBankerThird = lastOutcome.bankerHand.length > 2;

            if (hasPlayerThird || hasBankerThird) {
                setTimeout(() => {
                    setShowThirdCards(true);
                }, 500);
            } else {
                setTimeout(() => {
                    setPhase("RoundComplete");
                    setTimeout(() => setShowPopup(true), 800);
                }, 500);
            }
        }
    }, [flippedPlayerCards, flippedBankerCards, phase, revealMode, lastOutcome, showThirdCards]);

    // Check if all cards are flipped to complete the round
    useEffect(() => {
        if (phase !== "Revealing" || revealMode !== "interactive" || !lastOutcome || !showThirdCards) return;

        if (areAllCardsFlipped()) {
            setTimeout(() => {
                setPhase("RoundComplete");
                setTimeout(() => setShowPopup(true), 800);
            }, 300);
        }
    }, [flippedPlayerCards, flippedBankerCards, phase, revealMode, lastOutcome, showThirdCards]);

    // Start reveal animation when outcome is received
    const startRevealAnimation = useCallback((outcome: BaccaratRecord) => {
        setPhase("Revealing");
        setCardsRevealed(0);
        setShowThirdCards(false);
        totalCardsRef.current = outcome.playerHand.length + outcome.bankerHand.length;

        if (revealMode === "auto") {
            let revealed = 0;
            const dealInterval = setInterval(() => {
                revealed++;
                setCardsRevealed(revealed);
                if (revealed >= totalCardsRef.current) {
                    clearInterval(dealInterval);
                    setTimeout(() => {
                        setPhase("RoundComplete");
                        setTimeout(() => setShowPopup(true), 800);
                    }, 600);
                }
            }, 500);
        } else {
            setFlippedPlayerCards(new Array(outcome.playerHand.length).fill(false));
            setFlippedBankerCards(new Array(outcome.bankerHand.length).fill(false));
        }
    }, [revealMode]);

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
                    playerHands { suit value }
                    dealerHand { suit value }
                }
            }
        `;
            const data = await lineraAdapter.queryApplication<any>(query, {});

            if (data.gameHistory) {
                const baccHistory = data.gameHistory
                    .filter((g: any) => g.gameType === "BACCARAT")
                    .reverse();

                const mappedHistory = baccHistory.map((g: any) => {
                    const playerHand = g.playerHands && g.playerHands.length > 0 ? g.playerHands[0] : [];
                    return {
                        gameId: g.gameId,
                        playerHand: playerHand,
                        bankerHand: g.dealerHand,
                        bet: g.bet,
                        betType: "PLAYER" as BaccaratBetType,
                        winner: g.baccaratWinner,
                        payout: g.payout,
                        timestamp: g.timestamp,
                        playerScore: calculateBaccaratScore(playerHand),
                        bankerScore: calculateBaccaratScore(g.dealerHand),
                        isNatural: false
                    };
                });

                setHistory(mappedHistory);

                if (phase === "Playing" && mappedHistory.length > 0) {
                    const latestGame = mappedHistory[0];
                    if (latestGame.gameId > lastSeenGameId) {
                        setLastOutcome(latestGame);
                        setLastSeenGameId(latestGame.gameId);
                        setBusy(false);
                        void refreshData();
                        startRevealAnimation(latestGame);
                    }
                } else if (mappedHistory.length > 0 && lastSeenGameId === -1) {
                    setLastSeenGameId(mappedHistory[0].gameId);
                }
            }
        } catch (e) {
            console.error("Failed to refresh Baccarat state:", e);
        }
    }, [phase, lastSeenGameId, refreshData, startRevealAnimation]);

    const effectiveHistory = isDebugMode ? debugHistory : history;

    useEffect(() => {
        if (isConnected && !isDebugMode) {
            refresh();
        }

        let interval: NodeJS.Timeout;
        if ((phase === "Playing" || busy) && !isDebugMode) {
            interval = setInterval(refresh, 1000);
        }
        return () => clearInterval(interval);
    }, [isConnected, refresh, phase, busy, isDebugMode]);

    const placeBet = async () => {
        if (busy) return;
        if (balance < betAmount) {
            alert("Insufficient balance");
            return;
        }

        setBusy(true);
        setPhase("Playing");
        setLastOutcome(null);
        setShowPopup(false);
        setCardsRevealed(0);
        setFlippedPlayerCards([]);
        setFlippedBankerCards([]);
        setShowThirdCards(false);

        if (isDebugMode) {
            setTimeout(() => {
                const res = playBaccaratRound(betAmount, betType);
                const record: BaccaratRecord = {
                    gameId: Date.now(),
                    playerHand: res.playerHand.map(c => ({ suit: c.suit, value: c.value.toString() })),
                    bankerHand: res.bankerHand.map(c => ({ suit: c.suit, value: c.value.toString() })),
                    bet: betAmount,
                    betType: betType,
                    winner: res.winner,
                    payout: res.payoutMultiplier > 0 ? res.netProfit + betAmount : (res.pushed ? betAmount : 0),
                    timestamp: Date.now(),
                    playerScore: res.playerValue,
                    bankerScore: res.bankerValue,
                    isNatural: res.isNatural
                };

                setLastOutcome(record);
                setDebugHistory(prev => [record, ...prev]);
                setDebugBalance(debugBalance + res.netProfit);
                setBusy(false);
                startRevealAnimation(record);
            }, 800);
            return;
        }

        const currentLatestId = history.length > 0 ? (history[0] as any).gameId : -1;
        setLastSeenGameId(currentLatestId);

        try {
            const mutation = `mutation { playBaccarat(amount: ${betAmount}, betType: ${betType}) }`;
            await lineraAdapter.mutate(mutation);
        } catch (e: any) {
            console.error("Bet failed:", e);
            alert("Bet failed: " + e.message);
            setBusy(false);
            setPhase("WaitingForGame");
        }
    };

    // For AUTO mode: Check if a card should be visible based on reveal order
    const isCardVisibleAuto = (side: "player" | "banker", index: number) => {
        if (phase !== "Revealing") return true;
        const dealOrder = side === "player" ? index * 2 : index * 2 + 1;
        return cardsRevealed > dealOrder;
    };

    // For INTERACTIVE mode: Check if card should be shown (dealt face-down)
    const isCardDealtInteractive = (side: "player" | "banker", index: number) => {
        if (!lastOutcome) return false;
        const isThirdCard = index === 2;
        if (!isThirdCard) return true;
        return showThirdCards;
    };

    // For INTERACTIVE mode: Check if card is flipped (face-up)
    const isCardFlippedInteractive = (side: "player" | "banker", index: number) => {
        if (side === "player") {
            return flippedPlayerCards[index] || false;
        } else {
            return flippedBankerCards[index] || false;
        }
    };

    // Check if all cards on a side are revealed (for showing score)
    const shouldShowScore = (side: "player" | "banker") => {
        if (phase === "RoundComplete") return true;
        if (phase !== "Revealing" || !lastOutcome) return false;

        if (revealMode === "auto") {
            const cards = side === "player" ? lastOutcome.playerHand : lastOutcome.bankerHand;
            return cards.every((_, i) => isCardVisibleAuto(side, i));
        } else {
            const cards = side === "player" ? lastOutcome.playerHand : lastOutcome.bankerHand;
            const flippedCards = side === "player" ? flippedPlayerCards : flippedBankerCards;
            return cards.every((_, i) => {
                if (!isCardDealtInteractive(side, i)) return true;
                return flippedCards[i];
            });
        }
    };

    // Get current visible score
    const getVisibleScore = (side: "player" | "banker") => {
        if (!lastOutcome) return 0;

        if (revealMode === "auto" || phase === "RoundComplete") {
            return side === "player" ? lastOutcome.playerScore : lastOutcome.bankerScore;
        }

        const hand = side === "player" ? lastOutcome.playerHand : lastOutcome.bankerHand;
        const flipped = side === "player" ? flippedPlayerCards : flippedBankerCards;
        const numFlipped = flipped.filter(f => f).length;
        return calculatePartialScore(hand, numFlipped);
    };

    // Card dimensions
    const cardWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? 60 : 80;
    const cardHeight = typeof window !== 'undefined' && window.innerWidth < 768 ? 84 : 112;

    return (
        <div className="h-screen bg-black text-white overflow-hidden relative font-sans">
            {/* Background */}
            <div className="absolute inset-0 bg-[url('/baccarat-desk.png')] bg-cover bg-center" />

            <div className="relative z-10 flex flex-col items-center h-full">
                <Header />

                {/* History Button - Bottom Left Corner */}
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


                {/* Cards Area - Positioned lower */}
                <div className="flex-1 flex items-start justify-center pt-[180px] md:pt-[200px] w-full">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-24 w-full max-w-5xl px-4">

                        {/* Player Hand */}
                        <div className="flex flex-col items-center">
                            {/* Fixed width container for 3 cards */}
                            <div
                                className="flex gap-2 md:gap-3 items-center justify-center"
                                style={{ width: `${3 * (cardWidth + 8)}px`, minHeight: `${cardHeight + 20}px` }}
                            >
                                {(phase === "Revealing" || phase === "RoundComplete") && lastOutcome && (
                                    [0, 1, 2].map((i) => {
                                        const c = lastOutcome.playerHand[i];

                                        // Empty placeholder for missing card
                                        if (!c) {
                                            return (
                                                <div
                                                    key={i}
                                                    style={{ width: cardWidth, height: cardHeight }}
                                                />
                                            );
                                        }

                                        // Auto mode logic
                                        if (revealMode === "auto") {
                                            return (
                                                <div
                                                    key={i}
                                                    className="transform hover:scale-105 transition-all shadow-xl"
                                                    style={{
                                                        opacity: isCardVisibleAuto("player", i) ? 1 : 0,
                                                        transform: isCardVisibleAuto("player", i) ? 'translateY(0) scale(1)' : 'translateY(-30px) scale(0.8)',
                                                        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                                    }}
                                                >
                                                    <CardComp
                                                        suit={normalizeCard(c).suit as any}
                                                        value={normalizeCard(c).value as any}
                                                        width={cardWidth}
                                                        height={cardHeight}
                                                        isFlipped={true}
                                                    />
                                                </div>
                                            );
                                        }

                                        // Interactive mode logic
                                        const isDealt = isCardDealtInteractive("player", i);
                                        const isFlipped = isCardFlippedInteractive("player", i);
                                        const canFlip = isDealt && !isFlipped && phase === "Revealing";

                                        if (!isDealt) {
                                            return <div key={i} style={{ width: cardWidth, height: cardHeight }} />;
                                        }

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => canFlip && handleCardFlip("player", i)}
                                                className={`relative transform transition-all shadow-xl ${canFlip ? 'cursor-pointer hover:scale-110' : 'hover:scale-105'}`}
                                                style={{ animation: 'cardDealIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
                                            >
                                                {canFlip && (
                                                    <div
                                                        className="absolute inset-0 rounded-lg animate-pulse pointer-events-none"
                                                        style={{ boxShadow: '0 0 20px 5px rgba(255, 215, 0, 0.5)', zIndex: 10 }}
                                                    />
                                                )}
                                                <CardComp
                                                    suit={normalizeCard(c).suit as any}
                                                    value={normalizeCard(c).value as any}
                                                    width={cardWidth}
                                                    height={cardHeight}
                                                    isFlipped={isFlipped}
                                                />
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            {/* Score - Fixed height container to prevent jumping */}
                            <div className="h-12 md:h-14 flex items-center justify-center mt-3">
                                {shouldShowScore("player") && lastOutcome && (
                                    <div
                                        className="text-3xl md:text-4xl font-black text-white drop-shadow-lg"
                                        style={{ animation: 'scorePopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
                                    >
                                        {getVisibleScore("player")}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Banker Hand */}
                        <div className="flex flex-col items-center">
                            {/* Fixed width container for 3 cards */}
                            <div
                                className="flex gap-2 md:gap-3 items-center justify-center"
                                style={{ width: `${3 * (cardWidth + 8)}px`, minHeight: `${cardHeight + 20}px` }}
                            >
                                {(phase === "Revealing" || phase === "RoundComplete") && lastOutcome && (
                                    [0, 1, 2].map((i) => {
                                        const c = lastOutcome.bankerHand[i];

                                        // Empty placeholder for missing card
                                        if (!c) {
                                            return (
                                                <div
                                                    key={i}
                                                    style={{ width: cardWidth, height: cardHeight }}
                                                />
                                            );
                                        }

                                        // Auto mode logic
                                        if (revealMode === "auto") {
                                            return (
                                                <div
                                                    key={i}
                                                    className="transform hover:scale-105 transition-all shadow-xl"
                                                    style={{
                                                        opacity: isCardVisibleAuto("banker", i) ? 1 : 0,
                                                        transform: isCardVisibleAuto("banker", i) ? 'translateY(0) scale(1)' : 'translateY(-30px) scale(0.8)',
                                                        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                                    }}
                                                >
                                                    <CardComp
                                                        suit={normalizeCard(c).suit as any}
                                                        value={normalizeCard(c).value as any}
                                                        width={cardWidth}
                                                        height={cardHeight}
                                                        isFlipped={true}
                                                    />
                                                </div>
                                            );
                                        }

                                        // Interactive mode logic
                                        const isDealt = isCardDealtInteractive("banker", i);
                                        const isFlipped = isCardFlippedInteractive("banker", i);
                                        const canFlip = isDealt && !isFlipped && phase === "Revealing";

                                        if (!isDealt) {
                                            return <div key={i} style={{ width: cardWidth, height: cardHeight }} />;
                                        }

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => canFlip && handleCardFlip("banker", i)}
                                                className={`relative transform transition-all shadow-xl ${canFlip ? 'cursor-pointer hover:scale-110' : 'hover:scale-105'}`}
                                                style={{ animation: 'cardDealIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
                                            >
                                                {canFlip && (
                                                    <div
                                                        className="absolute inset-0 rounded-lg animate-pulse pointer-events-none"
                                                        style={{ boxShadow: '0 0 20px 5px rgba(255, 215, 0, 0.5)', zIndex: 10 }}
                                                    />
                                                )}
                                                <CardComp
                                                    suit={normalizeCard(c).suit as any}
                                                    value={normalizeCard(c).value as any}
                                                    width={cardWidth}
                                                    height={cardHeight}
                                                    isFlipped={isFlipped}
                                                />
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            {/* Score - Fixed height container to prevent jumping */}
                            <div className="h-12 md:h-14 flex items-center justify-center mt-3">
                                {shouldShowScore("banker") && lastOutcome && (
                                    <div
                                        className="text-3xl md:text-4xl font-black text-white drop-shadow-lg"
                                        style={{ animation: 'scorePopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
                                    >
                                        {getVisibleScore("banker")}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Interactive mode hint - Below cards, centered */}
                    {phase === "Revealing" && revealMode === "interactive" && (
                        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 bg-black/80 px-6 py-3 rounded-full border border-yellow-500/50">
                            <span className="text-yellow-400 font-semibold text-sm">
                                ↑ Click on cards to flip them!
                            </span>
                        </div>
                    )}
                </div>

                {/* Collapsible Controls Sidebar - Right Side (like blackjack) */}
                <div
                    className={`fixed bottom-4 right-0 z-30 flex items-center transition-all duration-300 ${showControlsPanel ? 'translate-x-0' : 'translate-x-full'
                        }`}
                >
                    {/* Toggle Button - Left side of panel */}
                    <button
                        onClick={() => setShowControlsPanel(!showControlsPanel)}
                        className="absolute left-0 -translate-x-full bg-gray-800/90 hover:bg-gray-700 border-2 border-gray-600 rounded-l-lg h-20 w-8 flex items-center justify-center shrink-0"
                    >
                        <span className="text-white text-2xl font-bold">
                            {showControlsPanel ? '›' : '‹'}
                        </span>
                    </button>

                    {/* Sidebar Panel */}
                    <div className="bg-gray-900/95 border-l-2 border-t-2 border-b-2 border-gray-600 rounded-l-xl p-4 shadow-2xl">
                        <div className="flex flex-col gap-4 items-center">

                            {/* Reveal Mode Toggle */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-sm font-semibold text-white/80">Reveal Mode</div>
                                <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1">
                                    <button
                                        onClick={() => setRevealMode("auto")}
                                        disabled={phase === "Revealing"}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${revealMode === "auto"
                                            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                                            : "text-white/60 hover:text-white hover:bg-white/10"
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        ⚡ Auto
                                    </button>
                                    <button
                                        onClick={() => setRevealMode("interactive")}
                                        disabled={phase === "Revealing"}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${revealMode === "interactive"
                                            ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg"
                                            : "text-white/60 hover:text-white hover:bg-white/10"
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        👆 Interactive
                                    </button>
                                </div>
                            </div>

                            {/* Chip Selection */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-sm font-semibold text-white/80">Select Chip</div>
                                <div className="flex items-center gap-1">
                                    {allowedBets.map((chipValue) => (
                                        <button
                                            key={chipValue}
                                            onClick={() => setBetAmount(chipValue)}
                                            disabled={busy || balance < chipValue}
                                            className={`relative transition-all hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed ${betAmount === chipValue ? "scale-125 drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" : "opacity-90 hover:opacity-100"
                                                }`}
                                        >
                                            <img
                                                src={`/Chips/chip${chipValue}.png`}
                                                alt={`$${chipValue} Chip`}
                                                className="w-10 h-10 object-contain"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Betting Buttons */}
                            <div className="flex flex-row gap-3 items-center">
                                <button
                                    onClick={() => setBetType("PLAYER")}
                                    className={`transition-all hover:scale-105 ${betType === "PLAYER" ? "scale-110 drop-shadow-[0_0_15px_rgba(37,99,235,0.8)]" : "opacity-80 hover:opacity-100"
                                        }`}
                                >
                                    <img src="/buttons/player.png" alt="Bet Player" className="w-28 object-contain" />
                                </button>
                                <button
                                    onClick={() => setBetType("TIE")}
                                    className={`transition-all hover:scale-105 ${betType === "TIE" ? "scale-110 drop-shadow-[0_0_15px_rgba(22,163,74,0.8)]" : "opacity-80 hover:opacity-100"
                                        }`}
                                >
                                    <img src="/buttons/tie.png" alt="Bet Tie" className="w-28 object-contain" />
                                </button>
                                <button
                                    onClick={() => setBetType("BANKER")}
                                    className={`transition-all hover:scale-105 ${betType === "BANKER" ? "scale-110 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]" : "opacity-80 hover:opacity-100"
                                        }`}
                                >
                                    <img src="/buttons/banker.png" alt="Bet Banker" className="w-28 object-contain" />
                                </button>
                            </div>

                            {/* Deal Button */}
                            <button
                                onClick={placeBet}
                                disabled={busy || phase === "Revealing" || phase === "RoundComplete"}
                                className="hover:scale-105 transition-all flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <img
                                    src="/deal.png"
                                    alt="Deal"
                                    className="h-12 object-contain drop-shadow-lg"
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Result Popup */}
                {showPopup && lastOutcome && (
                    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center">
                        <div className="relative">
                            {(() => {
                                const isTie = lastOutcome.winner === "TIE";
                                const isWin = lastOutcome.payout > 0;
                                const imageSrc = isTie
                                    ? "/animations/tie.png"
                                    : isWin
                                        ? "/animations/win.png"
                                        : "/animations/lose.png";
                                const altText = isTie ? "It's a Tie!" : isWin ? "You Win!" : "You Lose";
                                return (
                                    <img
                                        src={imageSrc}
                                        alt={altText}
                                        className="max-w-[50vw] max-h-[60vh] object-contain"
                                    />
                                );
                            })()}
                            <button
                                onClick={() => {
                                    setShowPopup(false);
                                    setLastOutcome(null);
                                    setPhase("WaitingForGame");
                                    setCardsRevealed(0);
                                    setFlippedPlayerCards([]);
                                    setFlippedBankerCards([]);
                                    setShowThirdCards(false);
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
                            {effectiveHistory.map((game, i) => (
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

            {/* CSS for animations */}
            <style>{`
                @keyframes scorePopIn {
                    from { 
                        opacity: 0; 
                        transform: scale(0.5); 
                    }
                    to { 
                        opacity: 1; 
                        transform: scale(1); 
                    }
                }
                @keyframes cardDealIn {
                    from {
                        opacity: 0;
                        transform: translateY(-50px) scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}
