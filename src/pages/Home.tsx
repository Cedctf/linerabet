import { Link } from 'react-router-dom';
import CardSwap, { Card } from '../components/CardSwap';
import CountUp from '../components/CountUp';
import Header from '../components/Header';

export default function Home() {
  const games = [
    { 
      name: 'Blackjack', 
      image: '/games/blackjack.jpg', 
      description: 'Beat the dealer with classic 21'
    },
    { 
      name: 'Poker', 
      image: '/games/poker.jpg', 
      description: 'Texas Hold\'em tournaments'
    },
    { 
      name: 'Baccarat', 
      image: '/games/baccarat.jpg', 
      description: 'High stakes elegance'
    },
    { 
      name: 'Roulette', 
      image: '/games/roulette.jpg', 
      description: 'Spin the wheel of fortune'
    }
  ];

  return (
    <div className="h-screen bg-black text-white overflow-hidden relative flex flex-col">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-green-950 opacity-80"></div>
      
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

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 flex-1 flex items-center">
          <div className="grid md:grid-cols-2 gap-8 items-center w-full">
            {/* Left Side - Hero Content */}
            <div className="space-y-8 max-md:text-center">
              <div className="inline-block px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
                <span className="text-green-400 text-sm font-semibold tracking-wide">Web3 Gaming Platform</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
                Play, Win,{' '}
                <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
                  Earn
                </span>
              </h1>
              
              <p className="text-xl text-gray-400 max-w-lg max-md:mx-auto leading-relaxed">
                Experience the future of online gaming with provably fair games, instant payouts, 
                and complete transparency on the blockchain.
              </p>

              {/* Buttons and Stats Section */}
              <div className="space-y-10 mt-6">
                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 max-md:justify-center mt-2">
                  <Link to="/blackjack">
                    <button className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-green-500/30">
                      Start Playing
                    </button>
                  </Link>
                  <button className="px-8 py-4 border-2 border-green-500 hover:bg-green-500/10 rounded-lg font-bold text-lg transition-all">
                    Learn More
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-6 max-md:max-w-md max-md:mx-auto">
                  <div className="text-left">
                    <div className="text-3xl font-bold text-green-400">
                      $<CountUp to={2.5} duration={2} className="text-3xl font-bold text-green-400" />M+
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Total Payouts</div>
                  </div>
                  <div className="text-left">
                    <div className="text-3xl font-bold text-green-400">
                      <CountUp to={15} duration={2} className="text-3xl font-bold text-green-400" />K+
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Active Players</div>
                  </div>
                  <div className="text-left">
                    <div className="text-3xl font-bold text-green-400">
                      <CountUp to={99.7} duration={2} className="text-3xl font-bold text-green-400" />%
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Uptime</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - CardSwap Component */}
            <div className="relative h-[600px] w-full flex items-center justify-center">
              <CardSwap
                width={480}
                height={420}
                cardDistance={50}
                verticalDistance={60}
                delay={3000}
                pauseOnHover={true}
                skewAmount={5}
                easing="elastic"
              >
                {games.map((game, index) => (
                  <Card key={index} customClass="overflow-hidden shadow-2xl shadow-green-500/20 border border-green-500/20 cursor-pointer">
                    <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black flex flex-col relative group">
                      {/* Game Image */}
                      <div className="relative w-full h-full">
                        <img
                          src={game.image}
                          alt={game.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Gradient Overlay on Image */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                      </div>
                      
                      {/* Game Info */}
                      <div className="absolute bottom-0 w-full p-8 z-10">
                        <h3 className="text-4xl font-bold mb-2 text-white">{game.name}</h3>
                        <p className="text-gray-300 text-lg">{game.description}</p>
                      </div>

                      {/* Hover Glow Effect */}
                      <div className="absolute inset-0 bg-gradient-to-t from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </div>
                  </Card>
                ))}
              </CardSwap>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

