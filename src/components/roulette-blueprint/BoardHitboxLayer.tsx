// BoardHitboxLayer.tsx
// SVG-based clickable hitboxes for all betting areas

import React, { useState } from 'react';
import { BOARD_CONFIG, getCellCoords, getNumberPosition } from './BoardVisualLayer';
import { BET_REGISTRY } from './RouletteBetRegistry';
import type { BetPayload } from './RouletteBetRegistry';

interface BoardHitboxLayerProps {
    debug?: boolean;
    onBetSelected?: (betId: string, payload: BetPayload) => void;
}

interface HitboxProps {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    debug?: boolean;
    onBetSelected?: (betId: string, payload: BetPayload) => void;
}

// Reusable Hitbox component with hover effects
const Hitbox: React.FC<HitboxProps> = ({ id, x, y, width, height, debug, onBetSelected }) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleClick = () => {
        const payload = BET_REGISTRY[id];
        if (payload) {
            console.log(`Bet selected: ${id}`, payload);
            onBetSelected?.(id, payload);
        }
    };

    return (
        <g
            className="hitbox"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
        >
            <rect
                x={`${x}%`}
                y={`${y}%`}
                width={`${width}%`}
                height={`${height}%`}
                fill={debug
                    ? (isHovered ? 'rgba(0,255,255,0.5)' : 'rgba(0,255,0,0.2)')
                    : (isHovered ? 'rgba(255,255,255,0.3)' : 'transparent')
                }
                stroke={debug ? 'lime' : (isHovered ? 'white' : 'transparent')}
                strokeWidth={isHovered ? '1' : '1'}
                filter={isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' : undefined}
                rx="1"
            />
            {debug && isHovered && (
                <text
                    x={`${x + width / 2}%`}
                    y={`${y + height / 2}%`}
                    fill="yellow"
                    fontSize="1.5%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="bold"
                    pointerEvents="none"
                >
                    {id}
                </text>
            )}
        </g>
    );
};

export const BoardHitboxLayer: React.FC<BoardHitboxLayerProps> = ({ debug = false, onBetSelected }) => {
    const { gridTop, cellHeight, gridLeft, cellWidth, outsideHeight } = BOARD_CONFIG;

    const hitboxes: JSX.Element[] = [];

    // ==================== STRAIGHT-UP BETS ====================
    // Zero
    // Zero
    const zeroCoords = getCellCoords(0, 0);
    hitboxes.push(
        <Hitbox
            key="num_0"
            id="num_0"
            x={zeroCoords.x + zeroCoords.width * 0.15}
            y={zeroCoords.y + zeroCoords.height * 0.1}
            width={zeroCoords.width * 0.7}
            height={zeroCoords.height * 0.8}
            debug={debug}
            onBetSelected={onBetSelected}
        />
    );

    // Numbers 1-36
    for (let num = 1; num <= 36; num++) {
        const { col, row } = getNumberPosition(num);
        const { x, y, width, height } = getCellCoords(col, row);

        // Inset the hitbox slightly from cell edges
        const inset = 0.5;
        hitboxes.push(
            <Hitbox
                key={`num_${num}`}
                id={`num_${num}`}
                x={x + inset}
                y={y + inset}
                width={width - inset * 2}
                height={height - inset * 2}
                debug={debug}
                onBetSelected={onBetSelected}
            />
        );
    }

    // ==================== SPLIT BETS (Vertical - between rows) ====================
    // Between row 1 and 2, and between row 2 and 3
    for (let col = 1; col <= 12; col++) {
        const baseNum = (col - 1) * 3 + 1; // 1, 4, 7, ...

        // Split between row 1 and row 2 (num and num+1)
        const pos1 = getCellCoords(col, 1);
        hitboxes.push(
            <Hitbox
                key={`split_${baseNum}_${baseNum + 1}`}
                id={`split_${baseNum}_${baseNum + 1}`}
                x={pos1.x + 0.5}
                y={pos1.y - 1.5}
                width={pos1.width - 1}
                height={3}
                debug={debug}
                onBetSelected={onBetSelected}
            />
        );

        // Split between row 2 and row 3 (num+1 and num+2)
        const pos2 = getCellCoords(col, 2);
        hitboxes.push(
            <Hitbox
                key={`split_${baseNum + 1}_${baseNum + 2}`}
                id={`split_${baseNum + 1}_${baseNum + 2}`}
                x={pos2.x + 0.5}
                y={pos2.y - 1.5}
                width={pos2.width - 1}
                height={3}
                debug={debug}
                onBetSelected={onBetSelected}
            />
        );
    }

    // ==================== SPLIT BETS (Horizontal - between columns) ====================
    for (let col = 1; col <= 11; col++) {
        for (let row = 1; row <= 3; row++) {
            const num = (col - 1) * 3 + row;
            const pos = getCellCoords(col, row);

            hitboxes.push(
                <Hitbox
                    key={`split_${num}_${num + 3}`}
                    id={`split_${num}_${num + 3}`}
                    x={pos.x + pos.width - 1.5}
                    y={pos.y + 0.5}
                    width={3}
                    height={pos.height - 1}
                    debug={debug}
                    onBetSelected={onBetSelected}
                />
            );
        }
    }

    // ==================== STREET BETS (Top edge of each column) ====================
    for (let col = 1; col <= 12; col++) {
        const startNum = (col - 1) * 3 + 1;
        const pos = getCellCoords(col, 3); // Top row

        hitboxes.push(
            <Hitbox
                key={`street_${startNum}_${startNum + 1}_${startNum + 2}`}
                id={`street_${startNum}_${startNum + 1}_${startNum + 2}`}
                x={pos.x}
                y={pos.y - 2}
                width={pos.width}
                height={3}
                debug={debug}
                onBetSelected={onBetSelected}
            />
        );
    }

    // ==================== CORNER BETS (Intersections) ====================
    for (let col = 1; col <= 11; col++) {
        for (let row = 1; row <= 2; row++) {
            const num = (col - 1) * 3 + row;
            const pos = getCellCoords(col, row);

            hitboxes.push(
                <Hitbox
                    key={`corner_${num}_${num + 1}_${num + 3}_${num + 4}`}
                    id={`corner_${num}_${num + 1}_${num + 3}_${num + 4}`}
                    x={pos.x + pos.width - 1.5}
                    y={pos.y - 1.5}
                    width={3}
                    height={3}
                    debug={debug}
                    onBetSelected={onBetSelected}
                />
            );
        }
    }

    // ==================== SIX-LINE BETS (Between street pairs at top) ====================
    for (let col = 1; col <= 11; col++) {
        const startNum = (col - 1) * 3 + 1;
        const pos = getCellCoords(col, 3);

        hitboxes.push(
            <Hitbox
                key={`sixline_${startNum}_${startNum + 5}`}
                id={`sixline_${startNum}_${startNum + 5}`}
                x={pos.x + pos.width - 1.5}
                y={pos.y - 2}
                width={3}
                height={3}
                debug={debug}
                onBetSelected={onBetSelected}
            />
        );
    }

    // ==================== DOZEN BETS ====================
    const dozenWidth = cellWidth * 4;
    const dozenY = gridTop + cellHeight * 3;

    ['dozen_1', 'dozen_2', 'dozen_3'].forEach((id, i) => {
        hitboxes.push(
            <Hitbox
                key={id}
                id={id}
                x={gridLeft + i * dozenWidth}
                y={dozenY}
                width={dozenWidth}
                height={outsideHeight}
                debug={debug}
                onBetSelected={onBetSelected}
            />
        );
    });

    // ==================== COLUMN BETS (2:1 boxes on right) ====================
    const columnWidth = 5;
    ['column_1', 'column_2', 'column_3'].forEach((id, i) => {
        const row = 3 - i; // column_1 = row 1, column_2 = row 2, column_3 = row 3
        hitboxes.push(
            <Hitbox
                key={id}
                id={id}
                x={gridLeft + 12 * cellWidth}
                y={gridTop + (3 - row) * cellHeight}
                width={columnWidth}
                height={cellHeight}
                debug={debug}
                onBetSelected={onBetSelected}
            />
        );
    });

    // ==================== EVEN-MONEY BETS ====================
    const evenMoneyWidth = cellWidth * 2;
    const evenMoneyY = dozenY + outsideHeight;
    const evenMoneyIds = ['low_1_18', 'even', 'red', 'black', 'odd', 'high_19_36'];

    evenMoneyIds.forEach((id, i) => {
        hitboxes.push(
            <Hitbox
                key={id}
                id={id}
                x={gridLeft + i * evenMoneyWidth}
                y={evenMoneyY}
                width={evenMoneyWidth}
                height={outsideHeight}
                debug={debug}
                onBetSelected={onBetSelected}
            />
        );
    });

    // ==================== ZERO SPLITS ====================
    // ==================== ZERO SPLITS ====================
    // Split 0-1
    hitboxes.push(
        <Hitbox
            key="split_0_1"
            id="split_0_1"
            x={zeroCoords.x + zeroCoords.width - 1.5}
            y={gridTop + cellHeight * 2 - 1.5}
            width={3}
            height={3}
            debug={debug}
            onBetSelected={onBetSelected}
        />
    );

    // Split 0-2
    hitboxes.push(
        <Hitbox
            key="split_0_2"
            id="split_0_2"
            x={zeroCoords.x + zeroCoords.width - 1.5}
            y={gridTop + cellHeight - 1.5}
            width={3}
            height={3}
            debug={debug}
            onBetSelected={onBetSelected}
        />
    );

    // Split 0-3
    hitboxes.push(
        <Hitbox
            key="split_0_3"
            id="split_0_3"
            x={zeroCoords.x + zeroCoords.width - 1.5}
            y={gridTop - 1.5}
            width={3}
            height={3}
            debug={debug}
            onBetSelected={onBetSelected}
        />
    );

    return (
        <g className="board-hitbox-layer">
            {hitboxes}
        </g>
    );
};
