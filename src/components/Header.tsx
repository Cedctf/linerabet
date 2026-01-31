import { Link } from "react-router-dom";
import ConnectWallet from "./ConnectWallet";
import { useGame } from "../context/GameContext";

function Header() {
  const { isDebugMode, setIsDebugMode } = useGame();

  return (
    <header className="absolute top-0 w-full z-50 border-b border-green-900/30 backdrop-blur-sm bg-black/30">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="grid grid-cols-3 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 w-fit">
            <div className="w-[240px] h-[45px] rounded-lg overflow-hidden">
              <img
                src="/logo.png"
                alt="LineraBet Logo"
                width={250}
                height={50}
                className="object-cover"
              />
            </div>
          </Link>

          {/* Navigation - Centered */}
          <nav className="hidden md:flex space-x-6 justify-center items-center">
            <Link to="/games" className="hover:text-green-400 text-white transition-colors">Games</Link>
            <a href="#" className="hover:text-green-400 text-white transition-colors">About</a>
            <a href="#" className="hover:text-green-400 text-white transition-colors">Rewards</a>

            {/* Debug Toggle */}
            <div className={`flex items-center space-x-2 border rounded-full px-3 py-1 transition-all ${isDebugMode ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'border-white/10 bg-white/5'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDebugMode ? 'text-yellow-500' : 'text-white/40'}`}>
                Debug Mode
              </span>
              <button
                onClick={() => setIsDebugMode(!isDebugMode)}
                className={`w-8 h-4 rounded-full transition-all relative ${isDebugMode ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-200 ${isDebugMode ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>
          </nav>

          {/* Connect Wallet Button */}
          <div className="dynamic-widget-wrapper flex justify-end">
            <ConnectWallet />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
