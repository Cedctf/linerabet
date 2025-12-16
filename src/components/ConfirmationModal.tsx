
import { createPortal } from 'react-dom';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export default function ConfirmationModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    isLoading = false
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={!isLoading ? onCancel : undefined}
            />

            {/* Modal Content */}
            <div className="relative bg-gradient-to-br from-gray-900 to-black border border-green-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-gray-400 hover:text-white font-semibold transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-lg shadow-lg hover:shadow-green-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Confirm'
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
