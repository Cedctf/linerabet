import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter } from '../lib/linera-adapter';
import { CONTRACTS_APP_ID } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { useGame } from '../context/GameContext';

export default function ConnectWallet() {
    const { primaryWallet, setShowAuthFlow } = useDynamicContext();
    const { lineraData, isConnecting, refreshData, pendingBet, balanceLocked } = useGame();
    const [isBuying, setIsBuying] = useState(false);
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);

    const handleBuyChips = async () => {
        setIsBuying(true);
        try {
            // Ensure application is set
            if (!lineraAdapter.isApplicationSet()) {
                await lineraAdapter.setApplication(CONTRACTS_APP_ID);
            }

            // Request chips from contract
            const mutation = `mutation { requestChips }`;
            await lineraAdapter.mutate(mutation);

            // Refresh balance (via context)
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

    // Low Balance Modal - rendered via portal to ensure it's centered on screen
    const LowBalanceModal = showLowBalanceModal ? createPortal(
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-yellow-900/90 to-orange-900/90 rounded-2xl border-2 border-yellow-500/50 p-6 max-w-md w-full shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-yellow-400">Waiting for Funds</h3>
                </div>

                <p className="text-white/80 mb-4">
                    Your testnet balance is currently <span className="font-bold text-yellow-400">0</span>.
                </p>

                <p className="text-white/70 text-sm mb-6">
                    The faucet is sending you tokens. Please wait a few seconds and try refreshing your balance.
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            refreshData();
                            setShowLowBalanceModal(false);
                        }}
                        className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
                    >
                        Refresh Balance
                    </button>
                    <button
                        onClick={() => setShowLowBalanceModal(false)}
                        className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    if (primaryWallet && lineraData) {
        return (
            <>
                {LowBalanceModal}
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
                                    // Show low balance modal if testnet balance is 0
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
                                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                                        Connected to Conway Testnet
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 uppercase tracking-wider">
                                        Testnet Balance
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
            </>
        );
    }

    return (
        <>
            {LowBalanceModal}
            <button
                onClick={() => setShowAuthFlow(true)}
                disabled={isConnecting}
                className="px-6 py-2 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-xl font-black italic tracking-wider text-white transition-all transform hover:scale-105 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: 'system-ui, sans-serif' }}
            >
                {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
            </button>
        </>
    );
}
