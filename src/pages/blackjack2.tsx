
import { useEffect, useMemo, useState } from "react";
import CardComp from "../components/Card";
import { type BlackjackCard, calculateHandValue } from "../lib/blackjack-utils";

type Phase = "WaitingForBet" | "PlayerTurn" | "DealerTurn" | "RoundComplete";
type Result =
    | null
    | "PLAYER_BLACKJACK"
    | "PLAYER_WIN"
    | "DEALER_WIN"
    | "PLAYER_BUST"
    | "DEALER_BUST"
    | "PUSH";

interface GameRecord {
    playerHand: BlackjackCard[];
    dealerHand: BlackjackCard[];
    bet: number;
    result: Result;
    payout: number;
    timestamp: number;
}

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, "jack", "queen", "king", "ace"] as const;

function createDeck(): BlackjackCard[] {
    const deck: BlackjackCard[] = [];
    let id = 0;
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value, id: `card-${id++}` });
        }
    }
    return deck;
}

function shuffleDeck(deck: BlackjackCard[]): BlackjackCard[] {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}

export default function Blackjack2() {
    // Local State
    const [balance, setBalance] = useState(1000);
    const [bet, setBet] = useState(10);
    const [phase, setPhase] = useState<Phase>("WaitingForBet");

    const [deck, setDeck] = useState<BlackjackCard[]>([]);
    const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
    const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
    const [lastResult, setLastResult] = useState<Result>(null);
    const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

    // UI
    const [showHistory, setShowHistory] = useState(false);
    const allowedBets = [10, 25, 50, 100, 500];

    // Derived Values
    const playerValue = useMemo(() => calculateHandValue(playerHand), [playerHand]);
    const dealerValue = useMemo(() => {
        if (phase === "PlayerTurn" && dealerHand.length > 0) {
            // Hide hole card value
            return calculateHandValue([dealerHand[0]]);
        }
        return calculateHandValue(dealerHand);
    }, [dealerHand, phase]);



    // Helpers to draw cards
    // Note: changing state in a loop requires care with closures. 
    // We'll use a ref or just manipulate local array and set once.
    const drawCards = (currentDeck: BlackjackCard[], count: number) => {
        const drawn = [];
        const remaining = [...currentDeck];
        for (let i = 0; i < count; i++) {
            if (remaining.length === 0) {
                // Reshuffle if empty (simple implementation: new deck)
                const newDeck = shuffleDeck(createDeck());
                remaining.push(...newDeck);
            }
            drawn.push(remaining.pop()!);
        }
        return { drawn, remaining };
    };

    const startGame = () => {
        if (balance < bet) {
            alert("Insufficient balance!");
            return;
        }

        // Deduct bet immediately (or reserve it)
        setBalance(prev => prev - bet);

        // Init Deck if needed
        let currentDeck = deck.length < 10 ? shuffleDeck(createDeck()) : deck;

        // Deal 2 cards to player, 2 to dealer
        const { drawn: pCards, remaining: d1 } = drawCards(currentDeck, 2);
        const { drawn: dCards, remaining: d2 } = drawCards(d1, 2);

        setDeck(d2);
        setPlayerHand(pCards);
        setDealerHand(dCards); // Index 1 is hole card
        setPhase("PlayerTurn");
        setLastResult(null);

        // Initial Blackjack check
        const pVal = calculateHandValue(pCards);
        const dVal = calculateHandValue(dCards);

        if (pVal === 21) {
            if (dVal === 21) {
                endRound("PUSH", pCards, dCards, bet);
            } else {
                endRound("PLAYER_BLACKJACK", pCards, dCards, bet);
            }
        }
    };

    const endRound = (
        result: Result,
        finalPlayerHand: BlackjackCard[],
        finalDealerHand: BlackjackCard[],
        currentBet: number
    ) => {
        let payout = 0;
        if (result === "PLAYER_BLACKJACK") payout = currentBet * 2.5; // 3:2 payout usually
        else if (result === "PLAYER_WIN" || result === "DEALER_BUST") payout = currentBet * 2;
        else if (result === "PUSH") payout = currentBet;

        setBalance(prev => prev + payout);
        setLastResult(result);
        setPhase("RoundComplete");

        // Add to history
        setGameHistory(prev => [
            ...prev,
            {
                playerHand: finalPlayerHand,
                dealerHand: finalDealerHand,
                bet: currentBet,
                result,
                payout,
                timestamp: Date.now(),
            }
        ]);
    };

    const hit = () => {
        const { drawn, remaining } = drawCards(deck, 1);
        const newHand = [...playerHand, ...drawn];
        setPlayerHand(newHand);
        setDeck(remaining);

        if (calculateHandValue(newHand) > 21) {
            endRound("PLAYER_BUST", newHand, dealerHand, bet);
        }
    };

    const stand = () => {
        setPhase("DealerTurn");
    };

    // Dealer Logic Effect
    useEffect(() => {
        if (phase === "DealerTurn") {
            const runDealer = async () => {
                let currentDHand = [...dealerHand];
                let currentDeck = [...deck];

                // Simple delay for suspense
                await new Promise(r => setTimeout(r, 600));

                // Dealer hits on soft 17 or less, usually stand on 17. 
                // Let's say hit < 17.
                while (calculateHandValue(currentDHand) < 17) {
                    const { drawn, remaining } = drawCards(currentDeck, 1);
                    currentDHand.push(...drawn);
                    currentDeck = remaining;
                    setDealerHand([...currentDHand]);
                    setDeck(currentDeck);
                    await new Promise(r => setTimeout(r, 800));
                }

                // Determine winner
                const dVal = calculateHandValue(currentDHand);
                const pVal = calculateHandValue(playerHand);
                let res: Result = "PUSH";

                if (dVal > 21) res = "DEALER_BUST";
                else if (dVal > pVal) res = "DEALER_WIN";
                else if (dVal < pVal) res = "PLAYER_WIN";
                else res = "PUSH";

                endRound(res, playerHand, currentDHand, bet);
            };
            runDealer();
        }
    }, [phase]);


    // Formatting Helpers
    function renderResult(r: Result) {
        switch (r) {
            case "PLAYER_BLACKJACK": return "Blackjack! You Win 🎉";
            case "PLAYER_WIN": return "You Win! 🎉";
            case "DEALER_WIN": return "Dealer Wins 😢";
            case "PLAYER_BUST": return "You Bust 😵";
            case "DEALER_BUST": return "Dealer Busts! You Win 🎉";
            case "PUSH": return "Push (Tie)";
            default: return "";
        }
    }

    const resultClass =
        lastResult === "PLAYER_BLACKJACK" || lastResult === "PLAYER_WIN" || lastResult === "DEALER_BUST"
            ? "bg-green-500/20 text-green-400 border border-green-500"
            : lastResult === "PUSH"
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500"
                : "bg-red-500/20 text-red-400 border border-red-500";


    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative">
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/blackjack-desk.png')" }}
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/20" />

            <div className="relative z-10 min-h-screen flex flex-col">
                {/* Header - Top bar */}
                <div className="flex justify-between items-center p-4">
                    <div className="text-2xl font-bold text-yellow-400 drop-shadow-lg">
                        Balance: ${balance}
                    </div>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="px-4 py-2 bg-blue-600/80 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg backdrop-blur-sm"
                    >
                        📜 History
                    </button>
                </div>

                {/* Main Game Area */}
                <div className="flex-1 flex flex-col justify-between px-4 pb-4">


                    {/* Betting Phase - Bottom Right Corner */}
                    {phase === "WaitingForBet" && (
                        <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-20">
                            <div className="bg-black/60 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-2xl">
                                <div className="text-sm font-semibold text-white/80 mb-2 text-center">Place Bet</div>
                                <div className="flex items-center gap-2 mb-3">
                                    {allowedBets.map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => setBet(val)}
                                            className={`relative transition-all hover:scale-110 ${bet === val ? "scale-125 drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" : "opacity-90 hover:opacity-100"}`}
                                        >
                                            <img
                                                src={`/Chips/chip${val}.png`}
                                                alt={`$${val} Chip`}
                                                className="w-16 h-16 object-contain"
                                            />
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={startGame}
                                    className="w-full mt-2 hover:scale-105 transition-all flex justify-center"
                                >
                                    <img
                                        src="/deal.png"
                                        alt="Deal"
                                        className="h-16 object-contain drop-shadow-lg"
                                    />
                                </button>
                            </div>
                        </div>
                    )}


                    {/* Game Board */}
                    {(phase === "PlayerTurn" || phase === "DealerTurn" || phase === "RoundComplete") && (
                        <div className="flex-1 flex flex-col justify-between items-center py-4 relative">
                            {/* Dealer Hand - Top Area */}
                            <div className="w-full max-w-md flex flex-col items-center mt-[115px]">
                                <div className="text-lg font-semibold text-white/80 mb-2 drop-shadow-lg">
                                    Dealer ({phase === "PlayerTurn" ? "?" : dealerValue})
                                </div>
                                <div className="flex gap-2 justify-center min-h-[140px] items-center">
                                    {dealerHand.map((card, idx) => (
                                        <div key={idx} className="transform hover:scale-105 transition-transform -ml-6 first:ml-0">
                                            <CardComp
                                                suit={card.suit}
                                                value={card.value}
                                                hidden={phase === "PlayerTurn" && idx === 1}
                                                width={90}
                                                height={126}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Result Popup with Try Again - Center */}
                            {phase === "RoundComplete" && lastResult && (
                                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                                    <div className="relative">
                                        {/* Win/Lose Image */}
                                        <img
                                            src={
                                                lastResult === "PLAYER_BLACKJACK" || lastResult === "PLAYER_WIN" || lastResult === "DEALER_BUST"
                                                    ? "/animations/win.png"
                                                    : "/animations/lose.png"
                                            }
                                            alt={lastResult === "PLAYER_BLACKJACK" || lastResult === "PLAYER_WIN" || lastResult === "DEALER_BUST" ? "You Win!" : "You Lose"}
                                            className="max-w-[50vw] max-h-[60vh] object-contain"
                                        />
                                        {/* Try Again Button - Overlaid at bottom of image */}
                                        <button
                                            onClick={() => setPhase("WaitingForBet")}
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

                            {/* Player Hand - Bottom Area */}
                            <div className="w-full max-w-md flex flex-col items-center mb-[-15px]">
                                <div className="flex gap-2 justify-center min-h-[140px] items-center ">
                                    {playerHand.map((card, idx) => (
                                        <div key={idx} className="transform hover:scale-105 transition-transform -ml-6 first:ml-0">
                                            <CardComp suit={card.suit} value={card.value} width={90} height={126} />
                                        </div>
                                    ))}
                                </div>
                                <div className="text-lg font-semibold text-white/80 mt-2 drop-shadow-lg">
                                    You ({playerValue})
                                </div>
                            </div>

                            {/* Controls - Bottom Right Corner */}
                            {phase === "PlayerTurn" && (
                                <div className="fixed bottom-4 right-4 flex flex-row gap-4 z-30">
                                    <button
                                        onClick={hit}
                                        className="group relative hover:scale-110 transition-transform"
                                        style={{ width: '8vw', height: '18vh' }}
                                    >
                                        <img
                                            src="/buttons/hit.png"
                                            alt="Hit"
                                            className="w-full h-full object-contain group-hover:hidden"
                                        />
                                        <img
                                            src="/animations/hit.gif"
                                            alt="Hit"
                                            className="w-full h-full object-contain hidden group-hover:block"
                                        />
                                    </button>
                                    <button
                                        onClick={stand}
                                        className="group relative hover:scale-110 transition-transform"
                                        style={{ width: '8vw', height: '18vh' }}
                                    >
                                        <img
                                            src="/buttons/stand.png"
                                            alt="Stand"
                                            className="w-full h-full object-contain group-hover:hidden"
                                        />
                                        <img
                                            src="/animations/stand.gif"
                                            alt="Stand"
                                            className="w-full h-full object-contain hidden group-hover:block"
                                        />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* History Modal */}
                    {showHistory && (
                        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                            <div className="bg-gradient-to-br from-green-900 to-green-950 rounded-lg border-2 border-green-600 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-3xl font-bold text-green-400">Game History</h2>
                                    <button onClick={() => setShowHistory(false)} className="text-white text-3xl">✕</button>
                                </div>
                                {gameHistory.slice().reverse().map((game, i) => (
                                    <div key={i} className="border-b border-green-700 py-2">
                                        <div className="flex justify-between">
                                            <span>{new Date(game.timestamp).toLocaleTimeString()}</span>
                                            <span className={game.payout > 0 ? "text-green-400" : "text-red-400"}>
                                                {renderResult(game.result)} ({game.payout > 0 ? `+${game.payout}` : `-${game.bet}`})
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
