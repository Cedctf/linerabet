import ConnectWallet from "./ConnectWallet";

function Header() {
  return (
    <header className="border-b border-green-900/30 backdrop-blur-sm bg-black/30">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="grid grid-cols-3 items-center">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-lg overflow-hidden">
              <img
                src="/LineraBet.png"
                alt="LineraBet Logo"
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
              LineraBet
            </span>
          </div>

          {/* Navigation - Centered */}
          <nav className="hidden md:flex space-x-8 justify-center">
            <a href="#" className="hover:text-green-400 transition-colors">Games</a>
            <a href="#" className="hover:text-green-400 transition-colors">About</a>
            <a href="#" className="hover:text-green-400 transition-colors">Rewards</a>
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
