import { useState, useEffect } from 'react';
import Card from '../components/Card';
import Header from '../components/Header';
import {
  createDeck,
  shuffleArray,
  calculateHandValue,
  determineWinner,
  type BlackjackCard
} from '../lib/blackjack-utils';

export default function Blackjack() {
  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [deck, setDeck] = useState<BlackjackCard[]>(createDeck());
  const [gameStarted, setGameStarted] = useState(false);
  const [playerStood, setPlayerStood] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const dealInitialCards = () => {
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
  };

  const hitPlayer = () => {
    if (deck.length > 0 && !gameOver) {
      const newCard = deck[0];
      const newPlayerHand = [...playerHand, newCard];
      setPlayerHand(newPlayerHand);
      setDeck(deck.slice(1));
      
      // Check if player busts
      if (calculateHandValue(newPlayerHand) > 21) {
        setGameOver(true);
      }
    }
  };

  const stand = () => {
    setPlayerStood(true);
  };

  const resetGame = () => {
    setPlayerHand([]);
    setDealerHand([]);
    setDeck(createDeck());
    setGameStarted(false);
    setPlayerStood(false);
    setGameOver(false);
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

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);
  const playerBust = playerValue > 21;
  const dealerBust = dealerValue > 21;

  // Determine winner
  let result = '';
  if (gameOver) {
    result = determineWinner(playerValue, dealerValue, playerBust, dealerBust);
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
          {/* Title */}
          <div className="text-center mb-2">
            <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
              Blackjack
            </h1>
            <p className="text-green-200 text-sm">Try to get as close to 21 as possible!</p>
          </div>

          {/* Dealer's Hand */}
          <div className="w-full max-w-4xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold text-white">Dealer's Hand</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    {dealerHand.length > 0 ? dealerValue : '-'}
                  </div>
                  {dealerBust && (
                    <div className="text-red-400 text-sm font-semibold">BUST!</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center min-h-[140px] items-center">
                {dealerHand.length > 0 ? (
                  dealerHand.map((card, index) => (
                    <div key={`${card.id}-${index}`} className="transform hover:scale-105 transition-transform">
                      <Card suit={card.suit} value={card.value} width={90} height={126} />
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
            {gameOver && result && (
              <div className={`text-2xl font-bold px-6 py-3 rounded-lg ${
                result.includes('You Win') ? 'bg-green-500/20 text-green-400 border border-green-500' : 
                result.includes('Push') ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500' : 
                'bg-red-500/20 text-red-400 border border-red-500'
              }`}>
                {result}
              </div>
            )}
            
            <div className="flex gap-4">
              {!gameStarted ? (
                <button
                  onClick={dealInitialCards}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-lg rounded-lg shadow-lg transform hover:scale-105 transition-all"
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

          {/* Player's Hand */}
          <div className="w-full max-w-4xl bg-green-900/50 rounded-lg p-4 backdrop-blur-sm border border-green-700/50 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold text-white">Your Hand</h2>
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
              {gameStarted && !gameOver && !playerStood && (
                <div className="flex gap-4">
                  <button
                    onClick={hitPlayer}
                    disabled={playerBust || deck.length === 0}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg transform hover:scale-105 disabled:transform-none"
                  >
                    Hit
                  </button>
                  <button
                    onClick={stand}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-all shadow-lg transform hover:scale-105"
                  >
                    Stand
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Game Info */}
          {gameStarted && (
            <div className="text-center text-green-200 mt-2">
              <p className="text-sm">Cards remaining in deck: <span className="font-semibold text-green-400">{deck.length}</span></p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

