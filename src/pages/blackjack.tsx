import { useState, useEffect } from 'react';
import Card from '../components/Card';
import Header from '../components/Header';
import {
  createDeck,
  shuffleArray,
  calculateHandValue,
  determineWinner,
  canSplit,
  canDoubleDown,
  type BlackjackCard
} from '../lib/blackjack-utils';

export default function Blackjack() {
  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [splitHand, setSplitHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [deck, setDeck] = useState<BlackjackCard[]>(createDeck());
  const [gameStarted, setGameStarted] = useState(false);
  const [playerStood, setPlayerStood] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [activeHand, setActiveHand] = useState<'main' | 'split'>('main');
  const [bet, setBet] = useState(10);
  const [balance, setBalance] = useState(1000);
  const [hasDoubled, setHasDoubled] = useState(false);
  const [showDealerHoleCard, setShowDealerHoleCard] = useState(false);

  const dealInitialCards = () => {
    if (balance < bet) {
      alert('Insufficient balance!');
      return;
    }

    // Create and shuffle a fresh deck
    const newDeck = shuffleArray(createDeck());
    
    // Deal 2 cards to player and 2 to dealer
    const playerCards = [newDeck[0], newDeck[1]];
    const dealerCards = [newDeck[2], newDeck[3]];
    
    // Update state
    setPlayerHand(playerCards);
    setDealerHand(dealerCards);
    setDeck(newDeck.slice(4)); // Remove dealt cards from deck
    setGameStarted(true);
    setPlayerStood(false);
    setGameOver(false);
    setIsSplit(false);
    setSplitHand([]);
    setActiveHand('main');
    setHasDoubled(false);
    setShowDealerHoleCard(false); // Hide dealer's second card
    setBalance(balance - bet);
    
    // Check for player blackjack
    const playerValue = calculateHandValue(playerCards);
    const dealerValue = calculateHandValue(dealerCards);
    
    if (playerValue === 21) {
      // Player has blackjack!
      setShowDealerHoleCard(true);
      setGameOver(true);
      
      // Check if dealer also has blackjack (push) or player wins
      setTimeout(() => {
        if (dealerValue === 21) {
          // Push - return bet
          setBalance(prev => prev + bet);
        } else {
          // Blackjack pays 3:2
          setBalance(prev => prev + bet + Math.floor(bet * 1.5));
        }
      }, 500);
    }
  };

  const hitPlayer = () => {
    if (deck.length > 0 && !gameOver && !hasDoubled) {
      const newCard = deck[0];
      const currentHand = activeHand === 'main' ? playerHand : splitHand;
      const newHand = [...currentHand, newCard];
      
      if (activeHand === 'main') {
        setPlayerHand(newHand);
      } else {
        setSplitHand(newHand);
      }
      setDeck(deck.slice(1));
      
      // Check if current hand busts
      if (calculateHandValue(newHand) > 21) {
        if (isSplit && activeHand === 'main') {
          // Switch to split hand
          setActiveHand('split');
        } else {
          // Reveal dealer's hole card and end game
          setShowDealerHoleCard(true);
          setGameOver(true);
        }
      }
    }
  };

  const stand = () => {
    if (isSplit && activeHand === 'main') {
      // Switch to split hand
      setActiveHand('split');
    } else {
      // Reveal dealer's hole card
      setShowDealerHoleCard(true);
      setPlayerStood(true);
    }
  };

  const handleSplit = () => {
    if (!canSplit(playerHand) || balance < bet) return;
    
    // Take one card from player hand to create split hand
    const card1 = playerHand[0];
    const card2 = playerHand[1];
    
    // Deal one new card to each hand
    const newCard1 = deck[0];
    const newCard2 = deck[1];
    
    setPlayerHand([card1, newCard1]);
    setSplitHand([card2, newCard2]);
    setDeck(deck.slice(2));
    setIsSplit(true);
    setActiveHand('main');
    setBalance(balance - bet); // Double the bet for split
  };

  const handleDoubleDown = () => {
    if (!canDoubleDown(activeHand === 'main' ? playerHand : splitHand) || balance < bet) return;
    
    setBalance(balance - bet); // Double the bet
    setHasDoubled(true);
    
    // Hit once
    if (deck.length > 0) {
      const newCard = deck[0];
      const currentHand = activeHand === 'main' ? playerHand : splitHand;
      const newHand = [...currentHand, newCard];
      
      if (activeHand === 'main') {
        setPlayerHand(newHand);
      } else {
        setSplitHand(newHand);
      }
      setDeck(deck.slice(1));
      
      // Automatically stand after double down
      setTimeout(() => {
        if (calculateHandValue(newHand) <= 21) {
          if (isSplit && activeHand === 'main') {
            setActiveHand('split');
            setHasDoubled(false);
          } else {
            setShowDealerHoleCard(true);
            setPlayerStood(true);
          }
        } else {
          if (isSplit && activeHand === 'main') {
            setActiveHand('split');
            setHasDoubled(false);
          } else {
            setShowDealerHoleCard(true);
            setGameOver(true);
          }
        }
      }, 300);
    }
  };

  const resetGame = () => {
    setPlayerHand([]);
    setSplitHand([]);
    setDealerHand([]);
    setDeck(createDeck());
    setGameStarted(false);
    setPlayerStood(false);
    setGameOver(false);
    setIsSplit(false);
    setActiveHand('main');
    setHasDoubled(false);
    setShowDealerHoleCard(false);
  };

  // Automatic dealer play when player stands
  useEffect(() => {
    if (playerStood && !gameOver && gameStarted) {
      const dealerValue = calculateHandValue(dealerHand);
      
      // Dealer must hit on less than 17, stay on all 17s
      if (dealerValue < 17 && deck.length > 0) {
        const timer = setTimeout(() => {
          const newCard = deck[0];
          const newDealerHand = [...dealerHand, newCard];
          setDealerHand(newDealerHand);
          setDeck(deck.slice(1));
          
          // Check if dealer busts
          if (calculateHandValue(newDealerHand) > 21) {
            setGameOver(true);
          }
        }, 1000); // 1 second delay between dealer hits for visual effect
        
        return () => clearTimeout(timer);
      } else if (dealerValue >= 17) {
        setGameOver(true);
      }
    }
  }, [playerStood, dealerHand, gameOver, gameStarted, deck]);

  // Calculate winnings when game is over
  useEffect(() => {
    if (gameOver && gameStarted) {
      const dealerValue = calculateHandValue(dealerHand);
      const playerValue = calculateHandValue(playerHand);
      const playerBust = playerValue > 21;
      const dealerBust = dealerValue > 21;
      
      let winnings = 0;
      
      // Main hand
      const mainResult = determineWinner(playerValue, dealerValue, playerBust, dealerBust);
      if (mainResult.includes('You Win')) {
        winnings += bet * 2 * (hasDoubled ? 2 : 1);
      } else if (mainResult.includes('Push')) {
        winnings += bet * (hasDoubled ? 2 : 1);
      }
      
      // Split hand
      if (isSplit) {
        const splitValue = calculateHandValue(splitHand);
        const splitBust = splitValue > 21;
        const splitResult = determineWinner(splitValue, dealerValue, splitBust, dealerBust);
        if (splitResult.includes('You Win')) {
          winnings += bet * 2;
        } else if (splitResult.includes('Push')) {
          winnings += bet;
        }
      }
      
      if (winnings > 0) {
        setBalance(prev => prev + winnings);
      }
    }
  }, [gameOver]);

  const playerValue = calculateHandValue(playerHand);
  const splitValue = calculateHandValue(splitHand);
  const dealerValue = calculateHandValue(dealerHand);
  // Only show first card value if hole card is hidden
  const dealerVisibleValue = showDealerHoleCard ? dealerValue : (dealerHand.length > 0 ? calculateHandValue([dealerHand[0]]) : 0);
  const playerBust = playerValue > 21;
  const splitBust = splitValue > 21;
  const dealerBust = dealerValue > 21;

  // Determine winner for each hand
  let mainResult = '';
  let splitResult = '';
  if (gameOver) {
    // Check for blackjack on initial deal
    if (playerHand.length === 2 && playerValue === 21 && dealerValue === 21) {
      mainResult = 'Push (Both Blackjack)';
    } else if (playerHand.length === 2 && playerValue === 21) {
      mainResult = 'BLACKJACK! You Win! (3:2)';
    } else {
      mainResult = determineWinner(playerValue, dealerValue, playerBust, dealerBust);
    }
    
    if (isSplit) {
      splitResult = determineWinner(splitValue, dealerValue, splitBust, dealerBust);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-900 to-green-950 opacity-90"></div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }}></div>

      {/* Green Glow Effects */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-green-500 rounded-full opacity-10 blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-green-600 rounded-full opacity-10 blur-3xl"></div>

      <div className="relative z-10">
        {/* Header */}
        <Header />

        <main className="flex flex-col items-center justify-center gap-3 py-4 px-4 min-h-[calc(100vh-80px)]">
          {/* Title & Balance */}
          <div className="text-center mb-2">
            <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
              Blackjack
            </h1>
            <p className="text-green-200 text-sm">Try to get as close to 21 as possible!</p>
            <div className="mt-3 flex gap-4 justify-center items-center">
              <div className="text-lg">
                <span className="text-gray-400">Balance:</span>{' '}
                <span className="text-green-400 font-bold">${balance}</span>
              </div>
              <div className="text-lg">
                <span className="text-gray-400">Bet:</span>{' '}
                <span className="text-yellow-400 font-bold">${bet}</span>
              </div>
            </div>
            {!gameStarted && (
              <div className="mt-2 flex gap-2 justify-center">
                <button onClick={() => setBet(Math.max(5, bet - 5))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">-$5</button>
                <button onClick={() => setBet(bet + 5)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">+$5</button>
              </div>
            )}
          </div>

          {/* Dealer's Hand */}
          <div className="w-full max-w-4xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold text-white">Dealer's Hand</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    {dealerHand.length > 0 ? (showDealerHoleCard ? dealerValue : `${dealerVisibleValue} + ?`) : '-'}
                  </div>
                  {dealerBust && showDealerHoleCard && (
                    <div className="text-red-400 text-sm font-semibold">BUST!</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                {dealerHand.length > 0 ? (
                  dealerHand.map((card, index) => (
                    <div key={`${card.id}-${index}`} className="transform hover:scale-105 transition-transform">
                      {index === 1 && !showDealerHoleCard ? (
                        // Show card back for hole card
                        <div className="w-[90px] h-[126px] bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-white flex items-center justify-center">
                          <div className="text-white text-4xl">🂠</div>
                        </div>
                      ) : (
                        <Card suit={card.suit} value={card.value} width={90} height={126} />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-green-300 text-sm">No cards dealt</p>
                )}
              </div>
              {playerStood && !gameOver && dealerValue < 17 && (
                <div className="text-yellow-400 text-sm font-semibold animate-pulse">
                  Dealer is playing...
                </div>
              )}
            </div>
          </div>

          {/* Game Result & Action Buttons */}
          <div className="flex flex-col items-center gap-3 my-2">
            {gameOver && mainResult && (
              <div className="flex flex-col gap-2">
                <div className={`text-2xl font-bold px-6 py-3 rounded-lg ${
                  mainResult.includes('You Win') ? 'bg-green-500/20 text-green-400 border border-green-500' : 
                  mainResult.includes('Push') ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500' : 
                  'bg-red-500/20 text-red-400 border border-red-500'
                }`}>
                  {isSplit ? 'Main Hand: ' : ''}{mainResult}
                </div>
                {isSplit && splitResult && (
                  <div className={`text-2xl font-bold px-6 py-3 rounded-lg ${
                    splitResult.includes('You Win') ? 'bg-green-500/20 text-green-400 border border-green-500' : 
                    splitResult.includes('Push') ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500' : 
                    'bg-red-500/20 text-red-400 border border-red-500'
                  }`}>
                    Split Hand: {splitResult}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-4">
              {!gameStarted ? (
                <button
                  onClick={dealInitialCards}
                  disabled={balance < bet}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg shadow-lg transform hover:scale-105 disabled:transform-none transition-all"
                >
                  Deal Cards
                </button>
              ) : gameOver ? (
                <button
                  onClick={resetGame}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-lg rounded-lg shadow-lg transform hover:scale-105 transition-all"
                >
                  New Game
                </button>
              ) : (
                <button
                  onClick={resetGame}
                  className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all border border-gray-600"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Player's Hands */}
          <div className="w-full max-w-4xl flex gap-4">
            {/* Main Hand */}
            <div className={`flex-1 bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border ${
              activeHand === 'main' && !gameOver && !playerStood ? 'border-yellow-400 shadow-yellow-400/50 shadow-lg' : 'border-green-700/50'
            } shadow-xl`}>
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-xl font-semibold text-white">{isSplit ? 'Main Hand' : 'Your Hand'}</h2>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      {playerHand.length > 0 ? playerValue : '-'}
                    </div>
                    {playerBust && (
                      <div className="text-red-400 text-sm font-semibold">BUST!</div>
                    )}
                    {playerValue === 21 && !playerBust && (
                      <div className="text-yellow-400 text-sm font-semibold">BLACKJACK!</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                  {playerHand.length > 0 ? (
                    playerHand.map((card, index) => (
                      <div key={`${card.id}-${index}`} className="transform hover:scale-105 transition-transform">
                        <Card suit={card.suit} value={card.value} width={90} height={126} />
                      </div>
                    ))
                  ) : (
                    <p className="text-green-300 text-sm">No cards dealt</p>
                  )}
                </div>
              </div>
            </div>

            {/* Split Hand */}
            {isSplit && (
              <div className={`flex-1 bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border ${
                activeHand === 'split' && !gameOver && !playerStood ? 'border-yellow-400 shadow-yellow-400/50 shadow-lg' : 'border-green-700/50'
              } shadow-xl`}>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center justify-between w-full">
                    <h2 className="text-xl font-semibold text-white">Split Hand</h2>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-400">
                        {splitHand.length > 0 ? splitValue : '-'}
                      </div>
                      {splitBust && (
                        <div className="text-red-400 text-sm font-semibold">BUST!</div>
                      )}
                      {splitValue === 21 && !splitBust && (
                        <div className="text-yellow-400 text-sm font-semibold">BLACKJACK!</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                    {splitHand.map((card, index) => (
                      <div key={`${card.id}-${index}`} className="transform hover:scale-105 transition-transform">
                        <Card suit={card.suit} value={card.value} width={90} height={126} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {gameStarted && !gameOver && !playerStood && (
            <div className="flex gap-4 flex-wrap justify-center">
              <button
                onClick={hitPlayer}
                disabled={hasDoubled}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg transform hover:scale-105 disabled:transform-none"
              >
                Hit
              </button>
              <button
                onClick={stand}
                disabled={hasDoubled}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg transform hover:scale-105 disabled:transform-none"
              >
                Stand
              </button>
              {canDoubleDown(activeHand === 'main' ? playerHand : splitHand) && balance >= bet && (
                <button
                  onClick={handleDoubleDown}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all shadow-lg transform hover:scale-105"
                >
                  Double Down
                </button>
              )}
              {canSplit(playerHand) && !isSplit && balance >= bet && (
                <button
                  onClick={handleSplit}
                  className="px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg transition-all shadow-lg transform hover:scale-105"
                >
                  Split
                </button>
              )}
            </div>
          )}

          {/* Game Info */}
          {gameStarted && (
            <div className="text-center text-green-200 mt-2">
              <p className="text-sm">Cards remaining in deck: <span className="font-semibold text-green-400">{deck.length}</span></p>
              {activeHand === 'split' && !gameOver && !playerStood && (
                <p className="text-yellow-400 text-sm font-semibold mt-1">Playing Split Hand</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
