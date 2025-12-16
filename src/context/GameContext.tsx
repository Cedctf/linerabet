import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter } from '../lib/linera-adapter';
import { CONTRACTS_APP_ID } from '../constants';

interface GameContextType {
    lineraData: { chainId: string; address: string; balance: string; gameBalance?: number } | null;
    isConnecting: boolean;
    refreshData: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
    const { primaryWallet } = useDynamicContext();
    const [lineraData, setLineraData] = useState<{ chainId: string; address: string; balance: string; gameBalance?: number } | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const refreshData = useCallback(async () => {
        if (!primaryWallet || !lineraAdapter.isChainConnected()) return;

        const provider = lineraAdapter.getProvider();
        let balance = "0";
        try {
            balance = await provider.client.balance();
        } catch (e) {
            console.warn("Failed to fetch balance in refresh:", e);
        }

        let gameBalance = 0;
        try {
            const owner = lineraAdapter.identity();
            const query = `query GetBalance($owner: AccountOwner!) { player(owner: $owner) { playerBalance } }`;
            const data = await lineraAdapter.queryApplication<{ player: { playerBalance: number } | null }>(query, { owner });
            if (data.player) {
                gameBalance = data.player.playerBalance;
            }
        } catch (e) {
            console.warn("Refreshed game balance failed:", e);
        }

        setLineraData(() => ({
            chainId: provider.chainId,
            address: provider.address,
            balance,
            gameBalance
        }));
    }, [primaryWallet]);

    useEffect(() => {
        const connectToLinera = async () => {
            if (primaryWallet) {
                if (!lineraAdapter.isChainConnected()) {
                    try {
                        setIsConnecting(true);
                        const faucetUrl = import.meta.env.VITE_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net/';
                        await lineraAdapter.connect(primaryWallet, faucetUrl);

                        // Set app ID once
                        try {
                            if (!lineraAdapter.isApplicationSet()) {
                                await lineraAdapter.setApplication(CONTRACTS_APP_ID);
                            }
                        } catch (e) {
                            console.warn("Failed to set application:", e);
                        }

                        // Initial fetch
                        await refreshData();
                    } catch (error) {
                        console.error("Failed to connect to Linera:", error);
                    } finally {
                        setIsConnecting(false);
                    }
                } else {
                    // Already connected, just refresh
                    refreshData();
                }
            } else if (!primaryWallet) {
                setLineraData(null);
                lineraAdapter.reset();
            }
        };

        connectToLinera();
    }, [primaryWallet, refreshData]);

    // Periodic poll (optional, or rely on manual refresh)
    useEffect(() => {
        if (!lineraData) return;
        const interval = setInterval(refreshData, 5000);
        return () => clearInterval(interval);
    }, [lineraData, refreshData]);

    return (
        <GameContext.Provider value={{ lineraData, isConnecting, refreshData }}>
            {children}
        </GameContext.Provider>
    );
}

export function useGame() {
    const context = useContext(GameContext);
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
}
