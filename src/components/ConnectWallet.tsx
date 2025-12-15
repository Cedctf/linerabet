import { useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter } from '../lib/linera-adapter';
import { DEPLOYER_ADDRESS, CONTRACTS_APP_ID } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { useGame } from '../context/GameContext';

export default function ConnectWallet() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
    const { lineraData, isConnecting, refreshData } = useGame();
    const [isBuying, setIsBuying] = useState(false);
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

    // Note: Connection logic is now handled in GameContext

    const handleBuyChips = async () => {
        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            // Basic validation or alert if funds low? for now simply proceed
        }

        setIsBuying(true);
        try {
            const chainId = lineraAdapter.getProvider().chainId;

            // Ensure application is set
            if (!lineraAdapter.isApplicationSet()) {
                await lineraAdapter.setApplication(CONTRACTS_APP_ID);
            }

            // 1. Transfer 1 token to deployer (API enforces whole tokens via u64)
            await lineraAdapter.client.transfer({
                recipient: {
                    chain_id: chainId,
                    owner: DEPLOYER_ADDRESS,
                },
                amount: 1,
            });

            // 2. Request chips from contract
            const mutation = `mutation { requestChips }`;
            await lineraAdapter.mutate(mutation);

            // 3. Refresh balance (via context)
            await refreshData();

            // Close modal on success
            setIsBuyModalOpen(false);
        } catch (err: any) {
            console.error("Failed to buy chips:", err);
            alert(`Failed to buy chips: ${err.message || err}`);
        } finally {
            setIsBuying(false);
        }
    };

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    if (primaryWallet && lineraData) {
        return (
            <div className="relative">
                <div
                    className="flex items-center gap-4 px-4 py-2 bg-black/40 border border-green-500/30 rounded-full hover:bg-black/60 transition-all backdrop-blur-md group cursor-pointer"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-white font-mono text-sm">
                            {primaryWallet.address.slice(0, 6)}...{primaryWallet.address.slice(-4)}
                        </span>
                    </div>

                    <div className="h-4 w-px bg-white/20" />

                    <div className="flex items-center gap-2">
                        <span className="text-yellow-400 font-bold text-sm">
                            {lineraData.gameBalance !== undefined ? lineraData.gameBalance : "..."} Chips
                        </span>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsBuyModalOpen(true);
                            }}
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-green-600 hover:bg-green-500 text-white shadow-sm hover:scale-110 transition-all"
                            title="Buy Chips"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>

                    <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {/* Dropdown */}
                {isDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-black/90 border border-green-500/30 rounded-xl shadow-xl backdrop-blur-xl overflow-hidden z-50">
                        <div className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 uppercase tracking-wider">Testnet Balance</label>
                                <div className="text-purple-400 font-mono text-sm font-semibold truncate">
                                    {lineraData.balance}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 uppercase tracking-wider">Linera Chain ID</label>
                                <div className="text-green-400 font-mono text-xs break-all leading-tight">
                                    {lineraData.chainId.slice(0, 16)}...
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ConfirmationModal
                    isOpen={isBuyModalOpen}
                    title="Confirm Chip Purchase"
                    message={`Do you want to use 1 Linera Test Token to purchase 100 Chips? (Minimum transfer: 1 Token)

Current Balance:
• ${lineraData.balance} Test Tokens
• ${lineraData.gameBalance} Chips

After Purchase:
• ${(parseFloat(lineraData.balance) - 1).toFixed(4)} Test Tokens
• ${(lineraData.gameBalance || 0) + 100} Chips`}
                    onConfirm={handleBuyChips}
                    onCancel={() => setIsBuyModalOpen(false)}
                    isLoading={isBuying}
                />
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
