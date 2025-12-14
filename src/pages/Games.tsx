
import { Link } from 'react-router-dom';

const games = [
    {
        name: 'Roulette',
        path: '/roulette',
        description: 'Spin the wheel of fortune and test your luck.',
        image: '/games/roulette.jpg' // Assuming these images exist as per Home.tsx
    },
    {
        name: 'Blackjack',
        path: '/blackjack',
        description: 'Beat the dealer with classic 21.',
        image: '/games/blackjack.jpg'
    },
    {
        name: 'Baccarat',
        path: '/baccarat',
        description: 'High stakes elegance and simple rules.',
        image: '/games/baccarat.jpg'
    }
];

export default function Games() {
    return (
        <div className="min-h-screen bg-black text-white relative flex flex-col pt-20">
            {/* Animated Background - Reused from Home.tsx for consistency */}
            <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-green-950 opacity-80 pointer-events-none"></div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: `linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)`,
                backgroundSize: '50px 50px'
            }}></div>

            {/* Green Glow Effects */}
            <div className="absolute top-20 left-20 w-96 h-96 bg-green-500 rounded-full opacity-10 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-green-600 rounded-full opacity-10 blur-3xl pointer-events-none"></div>


            <main className="relative z-10 max-w-7xl mx-auto px-6 w-full flex-grow flex flex-col items-center justify-center">
                <h1 className="text-4xl md:text-5xl font-bold mb-12 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
                    Select Your Game
                </h1>

                <div className="grid md:grid-cols-3 gap-8 w-full">
                    {games.map((game) => (
                        <Link to={game.path} key={game.name} className="group relative block h-96 rounded-xl overflow-hidden border border-green-500/20 shadow-2xl shadow-green-500/10 hover:shadow-green-500/30 transition-all duration-300 transform hover:-translate-y-2">
                            {/* Background Image */}
                            <div className="absolute inset-0">
                                <img
                                    src={game.image}
                                    alt={game.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
                            </div>

                            {/* Content */}
                            <div className="absolute bottom-0 w-full p-6 z-10">
                                <h3 className="text-3xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">{game.name}</h3>
                                <p className="text-gray-300 text-sm mb-4">{game.description}</p>
                                <div className="inline-block px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors">
                                    Play Now
                                </div>
                            </div>

                            {/* Hover Border Glow */}
                            <div className="absolute inset-0 border-2 border-transparent group-hover:border-green-500/50 rounded-xl transition-colors pointer-events-none"></div>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
}
