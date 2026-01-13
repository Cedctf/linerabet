import { useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter } from '../lib/linera-adapter';
import { CONTRACTS_APP_ID, NETWORK_NAME, isTestnet } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { useGame } from '../context/GameContext';

export default function ConnectWallet() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
    const { lineraData, isConnecting, refreshData, pendingBet, balanceLocked } = useGame();
    const [isBuying, setIsBuying] = useState(false);
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);

    // Note: Connection logic is now handled in GameContext

    const handleBuyChips = async () => {
        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            // Basic validation or alert if funds low? for now simply proceed
        }

        setIsBuying(true);
        try {

            // Ensure application is set
            if (!lineraAdapter.isApplicationSet()) {
                await lineraAdapter.setApplication(CONTRACTS_APP_ID);
            }

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
                            {lineraData.gameBalance !== undefined
                                ? (balanceLocked ? lineraData.gameBalance : (lineraData.gameBalance - pendingBet))
                                : "..."} Chips
                        </span>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                // Check if balance is 0, show low balance modal instead
                                if (lineraData && parseFloat(lineraData.balance) === 0) {
                                    setShowLowBalanceModal(true);
                                } else {
                                    setIsBuyModalOpen(true);
                                }
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
                    <div className="absolute top-full right-0 mt-2 w-72 bg-black/90 border border-green-500/30 rounded-xl shadow-xl backdrop-blur-xl overflow-hidden z-50">
                        <div className="p-4 space-y-3">
                            {/* Network Status */}
                            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                                <div className={`w-2 h-2 rounded-full ${isTestnet ? 'bg-purple-500' : 'bg-green-500'} animate-pulse`} />
                                <span className={`text-xs font-semibold uppercase tracking-wider ${isTestnet ? 'text-purple-400' : 'text-green-400'}`}>
                                    Connected to {NETWORK_NAME}
                                </span>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 uppercase tracking-wider">
                                    {isTestnet ? 'Testnet' : 'Devnet'} Balance
                                </label>
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

                {/* Buy Chips Modal */}
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

                {/* Low Balance Warning Modal */}
                <ConfirmationModal
                    isOpen={showLowBalanceModal}
                    title="⚠️ Waiting for Funds"
                    message={`Your ${isTestnet ? 'testnet' : 'devnet'} balance is currently 0.

Current Balance:
• ${lineraData.balance} Test Tokens
• ${lineraData.gameBalance} Chips

${isTestnet
                            ? "The faucet is sending you tokens. Please wait a few seconds and try again."
                            : "The local faucet is initializing. Please wait a few seconds for the network to be ready."}`}
                    onConfirm={() => {
                        refreshData();
                        setShowLowBalanceModal(false);
                    }}
                    onCancel={() => setShowLowBalanceModal(false)}
                    confirmText="Refresh Balance"
                    cancelText="Dismiss"
                />
            </div>
        );
    }

    return (
        <button
            onClick={() => setShowAuthFlow(true)}
            disabled={isConnecting}
            className="px-6 py-2 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-xl font-black italic tracking-wider text-white transition-all transform hover:scale-105 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'system-ui, sans-serif' }}
        >
            {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
        </button>
    );
}
