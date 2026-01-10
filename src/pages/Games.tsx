import { Link } from 'react-router-dom';

const games = [
    {
        name: 'ROULETTE',
        path: '/roulette',
        image: '/roulette.jpg',
        gradient: 'from-orange-400 via-yellow-500 to-orange-600',
        borderColor: 'border-yellow-300'
    },
    {
        name: 'BLACKJACK',
        path: '/blackjack',
        image: '/blackjack.png',
        gradient: 'from-blue-400 via-blue-500 to-blue-700',
        borderColor: 'border-blue-300'
    },
    {
        name: 'BACCARAT',
        path: '/baccarat',
        image: '/baccarat.png',
        gradient: 'from-purple-400 via-pink-500 to-purple-700',
        borderColor: 'border-pink-300'
    }
];

export default function Games() {
    return (
        <div className="min-h-screen bg-[#0F172A] relative overflow-hidden font-sans selection:bg-green-500 selection:text-white">
            {/* Background - Blue sky/game world feel */}
            <div className="absolute inset-0 bg-[url('/Landing.png')] bg-cover bg-center opacity-30"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-[#0284c7]/40 to-[#0f172a]/90"></div>

            {/* Header */}
            <div className="relative z-20 flex justify-between items-center px-8 py-6">
                <h1 className="text-5xl md:text-6xl font-black italic tracking-wider text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    SELECT GAME
                </h1>
            </div>

            {/* Cards Container */}
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-center min-h-[80vh] gap-6 px-4 pb-10">
                {games.map((game) => (
                    <Link
                        to={game.path}
                        key={game.name}
                        className={`
                            group relative w-full md:w-[30%] max-w-md h-[65vh] 
                            transform md:-skew-x-6
                            transition-all duration-300 hover:scale-105 hover:z-20 hover:shadow-[0_0_50px_rgba(255,255,255,0.2)]
                            border-[6px] ${game.borderColor} rounded-xl overflow-hidden
                            bg-gradient-to-br ${game.gradient}
                            shadow-2xl
                        `}
                    >
                        {/* Image Container */}
                        <div className="absolute inset-0 m-1 bg-black/20 rounded-lg overflow-hidden">
                            <img
                                src={game.image}
                                alt={game.name}
                                className="w-full h-full object-cover transform md:skew-x-6 scale-125 group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100 mix-blend-overlay"
                            />
                            {/* Character/Game Image Overlay - using same image for now but fully visible */}
                            <img
                                src={game.image}
                                alt={game.name}
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-auto object-contain transform md:skew-x-6 translate-y-10 group-hover:translate-y-0 transition-transform duration-500 drop-shadow-2xl"
                            />
                        </div>

                        {/* Text Overlay */}
                        <div className="absolute top-6 left-0 w-full text-center z-30 transform md:skew-x-6">
                            <h2 className="text-4xl font-black text-white italic uppercase drop-shadow-[0_3px_0_rgba(0,0,0,0.5)] tracking-wide">
                                {game.name}
                            </h2>
                        </div>

                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
