import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter } from '../lib/linera-adapter';

export default function ConnectWallet() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
    const [lineraData, setLineraData] = useState<{ chainId: string; address: string; balance: string } | null>(null);
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

                        let balance = "0";
                        try {
                            balance = await provider.client.balance();
                        } catch (e) {
                            console.warn("Failed to fetch initial balance, retrying in 1s...", e);
                            await new Promise(r => setTimeout(r, 1000));
                            try {
                                balance = await provider.client.balance();
                            } catch (e2) {
                                console.error("Failed to fetch balance after retry:", e2);
                                // Continue with 0 balance rather than failing connection
                            }
                        }

                        setLineraData({
                            chainId: provider.chainId,
                            address: provider.address,
                            balance
                        });
                    } catch (error) {
                        console.error("Failed to connect to Linera:", error);
                    } finally {
                        setIsConnecting(false);
                    }
                } else {
                    // Already connected, just sync state
                    const provider = lineraAdapter.getProvider();
                    const balance = await provider.client.balance();
                    setLineraData({
                        chainId: provider.chainId,
                        address: provider.address,
                        balance
                    });
                }
            } else if (!primaryWallet) {
                setLineraData(null);
                lineraAdapter.reset();
            }
        };

        connectToLinera();
        connectToLinera();
    }, [primaryWallet]);

    // Poll for balance updates
    useEffect(() => {
        if (!lineraData) return;

        const interval = setInterval(async () => {
            try {
                const provider = lineraAdapter.getProvider();
                const balance = await provider.client.balance();
                setLineraData(prev => prev ? { ...prev, balance } : null);
            } catch (error) {
                console.error("Failed to poll balance:", error);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [lineraData]);

    if (primaryWallet && lineraData) {
        return (
            <div className="flex flex-col items-end gap-2">
                <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 font-mono text-sm">
                    Dynamic: {primaryWallet.address.slice(0, 6)}...{primaryWallet.address.slice(-4)}
                </div>
                <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 font-mono text-sm">
                    Linera Chain: {lineraData.chainId.slice(0, 6)}...
                </div>
                <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400 font-mono text-sm">
                    Balance: {lineraData.balance}
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
