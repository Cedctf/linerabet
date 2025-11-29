import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter } from '../lib/linera-adapter';

export default function ConnectWallet() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
    const [lineraData, setLineraData] = useState<{ chainId: string; address: string } | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Connect to Linera when Dynamic wallet is available
    useEffect(() => {
        const connectToLinera = async () => {
            if (primaryWallet) {
                if (!lineraAdapter.isChainConnected()) {
                    try {
                        setIsConnecting(true);
                        const faucetUrl = import.meta.env.VITE_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net/';
                        const provider = await lineraAdapter.connect(primaryWallet, faucetUrl);
                        setLineraData({
                            chainId: provider.chainId,
                            address: provider.address
                        });
                    } catch (error) {
                        console.error("Failed to connect to Linera:", error);
                    } finally {
                        setIsConnecting(false);
                    }
                } else {
                    // Already connected, just sync state
                    const provider = lineraAdapter.getProvider();
                    setLineraData({
                        chainId: provider.chainId,
                        address: provider.address
                    });
                }
            } else if (!primaryWallet) {
                setLineraData(null);
                lineraAdapter.reset();
            }
        };

        connectToLinera();
    }, [primaryWallet]);

    if (primaryWallet && lineraData) {
        return (
            <div className="flex flex-col items-end gap-2">
                <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 font-mono text-sm">
                    Dynamic: {primaryWallet.address.slice(0, 6)}...{primaryWallet.address.slice(-4)}
                </div>
                <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 font-mono text-sm">
                    Linera Chain: {lineraData.chainId.slice(0, 6)}...
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={() => setShowAuthFlow(true)}
            disabled={isConnecting}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-lg font-bold text-white transition-all transform hover:scale-105 shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isConnecting ? 'Connecting to Linera...' : 'Connect Wallet'}
        </button>
    );
}
