// BoardVisualLayer.tsx
// SVG-based visual representation of the roulette board (replaceable with image later)

import React from 'react';

// Board dimensions and layout constants
export const BOARD_CONFIG = {
    // Aspect ratio of a European roulette table
    aspectRatio: 13 / 5, // ~2.6:1

    // Grid layout
    numColumns: 12, // 12 columns of 3 numbers each (36 total)
    numRows: 3,     // Top row (3,6,9...), Middle (2,5,8...), Bottom (1,4,7...)

    // Percentage-based dimensions (relative to container)
    zeroWidth: 7,     // Width of zero cell (%)
    cellWidth: 6.25,     // Width of each number cell (%)
    cellHeight: 18.9,   // Height of each number cell (%)
    outsideHeight: 16.2, // Height of outside bet rows (%)
    columnWidth: 5,   // Width of 2:1 column boxes (%)

    // Margins
    gridLeft: 13,      // Left offset where number grid starts (after zero)
    gridTop: 6,      // Top offset for number grid
};

// Color scheme
const COLORS = {
    green: '#0A5C36',
    red: '#C41E3A',
    black: '#1a1a1a',
    gold: '#D4AF37',
    white: '#FFFFFF',
    gridLine: '#2a7d4d',
};

// Red numbers on European wheel
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Get number's column (1-12) and row (1-3) position
const getNumberPosition = (num: number): { col: number; row: number } => {
    if (num === 0) return { col: 0, row: 0 };
    const col = Math.ceil(num / 3); // 1-3 → col 1, 4-6 → col 2, etc.
    const row = num % 3 === 0 ? 3 : num % 3; // 1,4,7... → row 1, 2,5,8... → row 2, 3,6,9... → row 3
    return { col, row };
};

// Get cell coordinates as percentages
const getCellCoords = (col: number, row: number) => {
    const { zeroWidth, cellWidth, cellHeight, gridLeft, gridTop } = BOARD_CONFIG;

    if (col === 0) {
        // Zero cell - spans all 3 rows on the left
        return {
            x: 6,
            y: gridTop,
            width: zeroWidth,
            height: cellHeight * 3,
        };
    }

    // Number cells
    return {
        x: gridLeft + (col - 1) * cellWidth,
        y: gridTop + (3 - row) * cellHeight, // Row 3 at top, row 1 at bottom
        width: cellWidth,
        height: cellHeight,
    };
};

interface BoardVisualLayerProps {
    debug?: boolean;
    transparent?: boolean;
}

export const BoardVisualLayer: React.FC<BoardVisualLayerProps> = ({ debug = false, transparent = false }) => {
    const { gridTop, cellHeight, gridLeft, cellWidth, outsideHeight, columnWidth } = BOARD_CONFIG;
    const strokeColor = transparent ? 'transparent' : COLORS.gridLine;
    const textColor = transparent ? 'transparent' : COLORS.white;

    // Generate number cells
    const numberCells = [];

    // Zero cell
    // Zero cell
    const zeroCoords = getCellCoords(0, 0);
    numberCells.push(
        <rect
            key="zero"
            x={`${zeroCoords.x}%`}
            y={`${zeroCoords.y}%`}
            width={`${zeroCoords.width}%`}
            height={`${zeroCoords.height}%`}
            fill={transparent ? 'transparent' : COLORS.green}
            stroke={strokeColor}
            strokeWidth="1"
        />
    );
    numberCells.push(
        <text
            key="zero-text"
            x={`${zeroCoords.x + zeroCoords.width / 2}%`}
            y={`${zeroCoords.y + zeroCoords.height / 2}%`}
            fill={textColor}
            fontSize="5%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight="bold"
        >
            0
        </text>
    );

    // Number cells 1-36
    for (let num = 1; num <= 36; num++) {
        const { col, row } = getNumberPosition(num);
        const { x, y, width, height } = getCellCoords(col, row);
        const isRed = RED_NUMBERS.includes(num);

        numberCells.push(
            <rect
                key={`cell-${num}`}
                x={`${x}%`}
                y={`${y}%`}
                width={`${width}%`}
                height={`${height}%`}
                fill={transparent ? 'transparent' : (isRed ? COLORS.red : COLORS.black)}
                stroke={strokeColor}
                strokeWidth="1"
            />
        );
        numberCells.push(
            <text
                key={`text-${num}`}
                x={`${x + width / 2}%`}
                y={`${y + height / 2}%`}
                fill={textColor}
                fontSize="4%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="bold"
            >
                {num}
            </text>
        );
    }

    // 2:1 Column boxes (right side)
    const columnBoxes = [1, 2, 3].map(colNum => {
        const y = gridTop + (3 - colNum) * cellHeight;
        return (
            <g key={`col-${colNum}`}>
                <rect
                    x={`${gridLeft + 12 * cellWidth}%`}
                    y={`${y}%`}
                    width={`${columnWidth}%`}
                    height={`${cellHeight}%`}
                    fill={transparent ? 'transparent' : COLORS.green}
                    stroke={strokeColor}
                    strokeWidth="1"
                />
                <text
                    x={`${gridLeft + 12 * cellWidth + columnWidth / 2}%`}
                    y={`${y + cellHeight / 2}%`}
                    fill={textColor}
                    fontSize="3%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                >
                    2:1
                </text>
            </g>
        );
    });

    // Dozen boxes
    const dozenWidth = cellWidth * 4;
    const dozenY = gridTop + cellHeight * 3;
    const dozenBoxes = [
        { label: '1st 12', x: gridLeft },
        { label: '2nd 12', x: gridLeft + dozenWidth },
        { label: '3rd 12', x: gridLeft + dozenWidth * 2 },
    ].map((dozen, i) => (
        <g key={`dozen-${i}`}>
            <rect
                x={`${dozen.x}%`}
                y={`${dozenY}%`}
                width={`${dozenWidth}%`}
                height={`${outsideHeight}%`}
                fill={transparent ? 'transparent' : COLORS.green}
                stroke={strokeColor}
                strokeWidth="1"
            />
            <text
                x={`${dozen.x + dozenWidth / 2}%`}
                y={`${dozenY + outsideHeight / 2}%`}
                fill={textColor}
                fontSize="3%"
                textAnchor="middle"
                dominantBaseline="middle"
            >
                {dozen.label}
            </text>
        </g>
    ));

    // Even-money boxes
    const evenMoneyWidth = cellWidth * 2;
    const evenMoneyY = dozenY + outsideHeight;
    const evenMoneyBets = [
        { label: '1-18', fill: COLORS.green },
        { label: 'EVEN', fill: COLORS.green },
        { label: '◆', fill: COLORS.red }, // Red diamond
        { label: '◆', fill: COLORS.black }, // Black diamond
        { label: 'ODD', fill: COLORS.green },
        { label: '19-36', fill: COLORS.green },
    ];
    const evenMoneyBoxes = evenMoneyBets.map((bet, i) => (
        <g key={`even-${i}`}>
            <rect
                x={`${gridLeft + i * evenMoneyWidth}%`}
                y={`${evenMoneyY}%`}
                width={`${evenMoneyWidth}%`}
                height={`${outsideHeight}%`}
                fill={transparent ? 'transparent' : bet.fill}
                stroke={strokeColor}
                strokeWidth="1"
            />
            <text
                x={`${gridLeft + i * evenMoneyWidth + evenMoneyWidth / 2}%`}
                y={`${evenMoneyY + outsideHeight / 2}%`}
                fill={textColor}
                fontSize={bet.label === '◆' ? '6%' : '3%'}
                textAnchor="middle"
                dominantBaseline="middle"
            >
                {bet.label}
            </text>
        </g>
    ));

    return (
        <g className="board-visual-layer">
            {/* Background */}
            <rect x="0" y="0" width="100%" height="100%" fill={transparent ? 'transparent' : COLORS.green} rx="1%" />

            {/* Number grid */}
            {numberCells}

            {/* Column boxes */}
            {columnBoxes}

            {/* Dozen boxes */}
            {dozenBoxes}

            {/* Even-money boxes */}
            {evenMoneyBoxes}

            {/* Debug grid overlay */}
            {debug && (
                <rect
                    x="0" y="0"
                    width="100%" height="100%"
                    fill="none"
                    stroke="lime"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                />
            )}
        </g>
    );
};

export { getCellCoords, getNumberPosition };
