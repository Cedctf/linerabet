// RouletteBoardBlueprint.tsx
// Main container component that combines visual and hitbox layers

import React from 'react';
import { BoardVisualLayer, BOARD_CONFIG, getCellCoords, getNumberPosition } from './BoardVisualLayer';
import { BoardHitboxLayer } from './BoardHitboxLayer';
import type { BetPayload } from './RouletteBetRegistry';

interface RouletteBoardBlueprintProps {
    /** Enable debug mode to show hitbox outlines and IDs */
    debug?: boolean;
    /** Callback when a bet area is clicked */
    onBetSelected?: (betId: string, payload: BetPayload) => void;
    /** Optional: Use custom visual layer (e.g., image) instead of SVG grid */
    customVisualLayer?: React.ReactNode;
    /** Map of bet ID to amount placed */
    placedBets?: Map<string, number>;
}

// Helper to get center position for a bet
const getBetCenterPosition = (betId: string): { x: number; y: number } | null => {
    const { gridTop, cellHeight, gridLeft, cellWidth, zeroWidth, outsideHeight } = BOARD_CONFIG;

    // Straight-up bets (num_0, num_1, etc.)
    if (betId.startsWith('num_')) {
        const num = parseInt(betId.replace('num_', ''));
        if (num === 0) {
            return { x: zeroWidth / 2, y: gridTop + cellHeight * 1.5 };
        }
        const { col, row } = getNumberPosition(num);
        const { x, y, width, height } = getCellCoords(col, row);
        return { x: x + width / 2, y: y + height / 2 };
    }

    // Dozen bets
    if (betId.startsWith('dozen_')) {
        const dozenNum = parseInt(betId.replace('dozen_', ''));
        const dozenWidth = cellWidth * 4;
        const dozenY = gridTop + cellHeight * 3;
        return { x: gridLeft + (dozenNum - 1) * dozenWidth + dozenWidth / 2, y: dozenY + outsideHeight / 2 };
    }

    // Column bets
    if (betId.startsWith('column_')) {
        const colNum = parseInt(betId.replace('column_', ''));
        const row = 4 - colNum; // column_1 = row 3, column_2 = row 2, column_3 = row 1
        return { x: gridLeft + 12 * cellWidth + 2.5, y: gridTop + (3 - row) * cellHeight + cellHeight / 2 };
    }

    // Even money bets
    const evenMoneyIds = ['low_1_18', 'even', 'red', 'black', 'odd', 'high_19_36'];
    const evenMoneyIdx = evenMoneyIds.indexOf(betId);
    if (evenMoneyIdx !== -1) {
        const evenMoneyWidth = cellWidth * 2;
        const evenMoneyY = gridTop + cellHeight * 3 + outsideHeight;
        return { x: gridLeft + evenMoneyIdx * evenMoneyWidth + evenMoneyWidth / 2, y: evenMoneyY + outsideHeight / 2 };
    }

    // Split bets - position at the edge between numbers
    if (betId.startsWith('split_')) {
        const nums = betId.replace('split_', '').split('_').map(Number);
        if (nums[0] === 0) {
            // Zero splits
            if (nums[1] === 1) return { x: zeroWidth, y: gridTop + cellHeight * 2.5 };
            if (nums[1] === 2) return { x: zeroWidth, y: gridTop + cellHeight * 1.5 };
            if (nums[1] === 3) return { x: zeroWidth, y: gridTop + cellHeight * 0.5 };
        }
        // Regular splits - average the positions
        const pos1 = getNumberPosition(nums[0]);
        const pos2 = getNumberPosition(nums[1]);
        const c1 = getCellCoords(pos1.col, pos1.row);
        const c2 = getCellCoords(pos2.col, pos2.row);
        return { x: (c1.x + c1.width / 2 + c2.x + c2.width / 2) / 2, y: (c1.y + c1.height / 2 + c2.y + c2.height / 2) / 2 };
    }

    // Street bets
    if (betId.startsWith('street_')) {
        const nums = betId.replace('street_', '').split('_').map(Number);
        const col = Math.ceil(nums[0] / 3);
        const pos = getCellCoords(col, 2); // Middle of the street
        return { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 };
    }

    // Corner bets
    if (betId.startsWith('corner_')) {
        const nums = betId.replace('corner_', '').split('_').map(Number);
        const pos1 = getNumberPosition(nums[0]);
        const c1 = getCellCoords(pos1.col, pos1.row);
        return { x: c1.x + c1.width, y: c1.y };
    }

    // Sixline bets
    if (betId.startsWith('sixline_')) {
        const nums = betId.replace('sixline_', '').split('_').map(Number);
        const col = Math.ceil(nums[0] / 3);
        const pos = getCellCoords(col, 3);
        return { x: pos.x + pos.width, y: pos.y - 1 };
    }

    return null;
};

// Chip value to image mapping
const getChipImage = (amount: number): string => {
    if (amount >= 100) return '/Chips/chip100.png';
    if (amount >= 25) return '/Chips/chip25.png';
    if (amount >= 10) return '/Chips/chip10.png';
    if (amount >= 5) return '/Chips/chip5.png';
    return '/Chips/chip1.png';
};

// Chips Overlay Layer
const ChipsOverlayLayer: React.FC<{ placedBets: Map<string, number> }> = ({ placedBets }) => {
    const chips: JSX.Element[] = [];

    placedBets.forEach((amount, betId) => {
        const pos = getBetCenterPosition(betId);
        if (!pos) return;

        const chipImage = getChipImage(amount);
        const chipSize = 9; // Size in %

        chips.push(
            <g key={`chip_${betId}`}>
                <image
                    href={chipImage}
                    x={`${pos.x - chipSize / 2}%`}
                    y={`${pos.y - chipSize / 2}%`}
                    width={`${chipSize}%`}
                    height={`${chipSize}%`}
                    style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}
                />
            </g>
        );
    });

    return (
        <g className="chips-overlay-layer">
            {chips}
        </g>
    );
};

// Import the background image
import BoardImage from '../roulette/assets/Board.png';

export const RouletteBoardBlueprint: React.FC<RouletteBoardBlueprintProps> = ({
    debug = false,
    onBetSelected,
    customVisualLayer,
    placedBets,
}) => {
    const handleBetSelected = (betId: string, payload: BetPayload) => {
        console.log('Bet selected:', betId, payload);
        onBetSelected?.(betId, payload);
    };

    return (
        <div
            style={{
                width: '100%',
                margin: '0 auto',
                position: 'relative',
                backgroundImage: `url(${BoardImage})`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
        >
            {/* SVG Container with proper aspect ratio - larger for better visibility */}
            <svg
                viewBox="0 0 100 38.5"
                preserveAspectRatio="xMidYMid meet"
                style={{
                    width: '100%',
                    aspectRatio: '100 / 38.5',
                    display: 'block',
                    borderRadius: '8px',
                }}
            >
                {/* Visual Layer (grid, numbers, labels) - replaceable with image */}
                {customVisualLayer || <BoardVisualLayer debug={debug} transparent={true} />}

                {/* Hitbox Layer (clickable areas) */}
                <BoardHitboxLayer debug={debug} onBetSelected={handleBetSelected} />

                {/* Chips Overlay Layer - renders placed bet chips */}
                {placedBets && placedBets.size > 0 && <ChipsOverlayLayer placedBets={placedBets} />}
            </svg>

            {/* Debug Info Panel */}
            {debug && (
                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    color: '#00ff00',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                }}>
                    <div><strong>Debug Mode Active</strong></div>
                    <div>• Green/Cyan rectangles = Hitbox areas</div>
                    <div>• Hover over any area to see its ID</div>
                    <div>• Click any area to log bet payload to console</div>
                    <div>• Board uses normalized coordinates (0-100%)</div>
                </div>
            )}
        </div>
    );
};

// Export all components and utilities
export { BoardVisualLayer, BOARD_CONFIG } from './BoardVisualLayer';
export { BoardHitboxLayer } from './BoardHitboxLayer';
export { BET_REGISTRY, getBetById, isBetWinner, calculatePayout } from './RouletteBetRegistry';
export type { BetPayload } from './RouletteBetRegistry';
