// RouletteBetRegistry.ts
// Complete mapping of hitbox IDs to bet payloads

export interface BetPayload {
    type: 'straight' | 'split' | 'street' | 'corner' | 'sixline' | 'dozen' | 'column' | 'even_money';
    numbers: number[];
    label: string;
    payout: number; // e.g., 35 means 35:1
}

// Helper to generate numbers
const range = (start: number, end: number): number[] =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

// Bet Registry - Maps hitbox IDs to bet definitions
export const BET_REGISTRY: Record<string, BetPayload> = {
    // ==================== STRAIGHT-UP BETS (35:1) ====================
    num_0: { type: 'straight', numbers: [0], label: '0', payout: 35 },
    ...Object.fromEntries(
        range(1, 36).map(n => [`num_${n}`, { type: 'straight', numbers: [n], label: `${n}`, payout: 35 }])
    ),

    // ==================== SPLIT BETS (17:1) ====================
    // Vertical splits (between rows): e.g., 1-2, 2-3, 4-5, 5-6, etc.
    // Row pattern: [1,4,7...], [2,5,8...], [3,6,9...]
    ...Object.fromEntries(
        range(1, 33).filter(n => n % 3 !== 0).map(n => [
            `split_${n}_${n + 1}`,
            { type: 'split', numbers: [n, n + 1], label: `${n}/${n + 1}`, payout: 17 }
        ])
    ),

    // Horizontal splits (between columns): e.g., 1-4, 2-5, 3-6, etc.
    ...Object.fromEntries(
        range(1, 33).map(n => [
            `split_${n}_${n + 3}`,
            { type: 'split', numbers: [n, n + 3], label: `${n}/${n + 3}`, payout: 17 }
        ])
    ),

    // Zero splits
    split_0_1: { type: 'split', numbers: [0, 1], label: '0/1', payout: 17 },
    split_0_2: { type: 'split', numbers: [0, 2], label: '0/2', payout: 17 },
    split_0_3: { type: 'split', numbers: [0, 3], label: '0/3', payout: 17 },

    // ==================== STREET BETS (11:1) ====================
    // 12 streets: 1-2-3, 4-5-6, ..., 34-35-36
    ...Object.fromEntries(
        range(0, 11).map(i => {
            const start = i * 3 + 1;
            return [
                `street_${start}_${start + 1}_${start + 2}`,
                { type: 'street', numbers: [start, start + 1, start + 2], label: `${start}-${start + 2}`, payout: 11 }
            ];
        })
    ),

    // ==================== CORNER BETS (8:1) ====================
    // Corners at intersections of 4 numbers
    ...Object.fromEntries(
        range(1, 32).filter(n => n % 3 !== 0).map(n => [
            `corner_${n}_${n + 1}_${n + 3}_${n + 4}`,
            { type: 'corner', numbers: [n, n + 1, n + 3, n + 4], label: `${n}/${n + 1}/${n + 3}/${n + 4}`, payout: 8 }
        ])
    ),

    // ==================== SIX-LINE / DOUBLE STREET (5:1) ====================
    // 6 numbers spanning 2 adjacent streets
    ...Object.fromEntries(
        range(0, 10).map(i => {
            const start = i * 3 + 1;
            return [
                `sixline_${start}_${start + 5}`,
                { type: 'sixline', numbers: range(start, start + 5), label: `${start}-${start + 5}`, payout: 5 }
            ];
        })
    ),

    // ==================== DOZEN BETS (2:1) ====================
    dozen_1: { type: 'dozen', numbers: range(1, 12), label: '1st 12', payout: 2 },
    dozen_2: { type: 'dozen', numbers: range(13, 24), label: '2nd 12', payout: 2 },
    dozen_3: { type: 'dozen', numbers: range(25, 36), label: '3rd 12', payout: 2 },

    // ==================== COLUMN BETS (2:1) ====================
    // Column 1: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
    column_1: { type: 'column', numbers: range(0, 11).map(i => 1 + i * 3), label: 'Column 1 (2:1)', payout: 2 },
    // Column 2: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
    column_2: { type: 'column', numbers: range(0, 11).map(i => 2 + i * 3), label: 'Column 2 (2:1)', payout: 2 },
    // Column 3: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
    column_3: { type: 'column', numbers: range(0, 11).map(i => 3 + i * 3), label: 'Column 3 (2:1)', payout: 2 },

    // ==================== EVEN-MONEY BETS (1:1) ====================
    low_1_18: { type: 'even_money', numbers: range(1, 18), label: '1-18', payout: 1 },
    high_19_36: { type: 'even_money', numbers: range(19, 36), label: '19-36', payout: 1 },
    even: { type: 'even_money', numbers: range(1, 36).filter(n => n % 2 === 0), label: 'EVEN', payout: 1 },
    odd: { type: 'even_money', numbers: range(1, 36).filter(n => n % 2 === 1), label: 'ODD', payout: 1 },
    red: {
        type: 'even_money',
        numbers: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
        label: 'RED',
        payout: 1
    },
    black: {
        type: 'even_money',
        numbers: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
        label: 'BLACK',
        payout: 1
    },
};

// Get bet config by ID
export const getBetById = (id: string): BetPayload | undefined => BET_REGISTRY[id];

// Check if number wins for a given bet
export const isBetWinner = (betId: string, winningNumber: number): boolean => {
    const bet = BET_REGISTRY[betId];
    return bet ? bet.numbers.includes(winningNumber) : false;
};

// Calculate payout for a bet
export const calculatePayout = (betId: string, amount: number, winningNumber: number): number => {
    const bet = BET_REGISTRY[betId];
    if (!bet || !bet.numbers.includes(winningNumber)) return 0;
    return amount * (bet.payout + 1); // Return stake + winnings
};
