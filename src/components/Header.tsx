import { Link } from "react-router-dom";
import ConnectWallet from "./ConnectWallet";

function Header() {
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
          <nav className="hidden md:flex space-x-8 justify-center">
            <Link to="/games" className="hover:text-green-400 text-white transition-colors">Games</Link>
            <a href="#" className="hover:text-green-400 text-white transition-colors">About</a>
            <a href="#" className="hover:text-green-400 text-white transition-colors">Rewards</a>
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
