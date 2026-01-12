/**
 * BetRegistry.ts
 * Maps hotspot component IDs to their bet configurations.
 * This is the single source of truth for what each hotspot represents.
 */

export interface BetConfig {
    /** Bet type for the GraphQL mutation (e.g., "NUMBER", "SPLIT", "STREET", etc.) */
    betType: string;
    /** Numbers covered by this bet */
    numbersCovered: number[];
    /** Payout multiplier (e.g., 35 for straight up, 17 for split, etc.) */
    payout: number;
    /** Human-readable display name */
    displayName: string;
}

// Red numbers on a standard roulette wheel
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export const BET_REGISTRY: Record<string, BetConfig> = {
    // ========== NUMBER BETS (Straight Up - 35:1) ==========
    "number0": { betType: "NUMBER", numbersCovered: [0], payout: 35, displayName: "0" },
    "number1": { betType: "NUMBER", numbersCovered: [1], payout: 35, displayName: "1" },
    "number2": { betType: "NUMBER", numbersCovered: [2], payout: 35, displayName: "2" },
    "number3": { betType: "NUMBER", numbersCovered: [3], payout: 35, displayName: "3" },
    "number4": { betType: "NUMBER", numbersCovered: [4], payout: 35, displayName: "4" },
    "number5": { betType: "NUMBER", numbersCovered: [5], payout: 35, displayName: "5" },
    "number6": { betType: "NUMBER", numbersCovered: [6], payout: 35, displayName: "6" },
    "number7": { betType: "NUMBER", numbersCovered: [7], payout: 35, displayName: "7" },
    "number8": { betType: "NUMBER", numbersCovered: [8], payout: 35, displayName: "8" },
    "number9": { betType: "NUMBER", numbersCovered: [9], payout: 35, displayName: "9" },
    "number10": { betType: "NUMBER", numbersCovered: [10], payout: 35, displayName: "10" },
    "number11": { betType: "NUMBER", numbersCovered: [11], payout: 35, displayName: "11" },
    "number12": { betType: "NUMBER", numbersCovered: [12], payout: 35, displayName: "12" },
    "number13": { betType: "NUMBER", numbersCovered: [13], payout: 35, displayName: "13" },
    "number14": { betType: "NUMBER", numbersCovered: [14], payout: 35, displayName: "14" },
    "number15": { betType: "NUMBER", numbersCovered: [15], payout: 35, displayName: "15" },
    "number16": { betType: "NUMBER", numbersCovered: [16], payout: 35, displayName: "16" },
    "number17": { betType: "NUMBER", numbersCovered: [17], payout: 35, displayName: "17" },
    "number18": { betType: "NUMBER", numbersCovered: [18], payout: 35, displayName: "18" },
    "number19": { betType: "NUMBER", numbersCovered: [19], payout: 35, displayName: "19" },
    "number20": { betType: "NUMBER", numbersCovered: [20], payout: 35, displayName: "20" },
    "number21": { betType: "NUMBER", numbersCovered: [21], payout: 35, displayName: "21" },
    "number22": { betType: "NUMBER", numbersCovered: [22], payout: 35, displayName: "22" },
    "number23": { betType: "NUMBER", numbersCovered: [23], payout: 35, displayName: "23" },
    "number24": { betType: "NUMBER", numbersCovered: [24], payout: 35, displayName: "24" },
    "number25": { betType: "NUMBER", numbersCovered: [25], payout: 35, displayName: "25" },
    "number26": { betType: "NUMBER", numbersCovered: [26], payout: 35, displayName: "26" },
    "number27": { betType: "NUMBER", numbersCovered: [27], payout: 35, displayName: "27" },
    "number28": { betType: "NUMBER", numbersCovered: [28], payout: 35, displayName: "28" },
    "number29": { betType: "NUMBER", numbersCovered: [29], payout: 35, displayName: "29" },
    "number30": { betType: "NUMBER", numbersCovered: [30], payout: 35, displayName: "30" },
    "number31": { betType: "NUMBER", numbersCovered: [31], payout: 35, displayName: "31" },
    "number32": { betType: "NUMBER", numbersCovered: [32], payout: 35, displayName: "32" },
    "number33": { betType: "NUMBER", numbersCovered: [33], payout: 35, displayName: "33" },
    "number34": { betType: "NUMBER", numbersCovered: [34], payout: 35, displayName: "34" },
    "number35": { betType: "NUMBER", numbersCovered: [35], payout: 35, displayName: "35" },
    "number36": { betType: "NUMBER", numbersCovered: [36], payout: 35, displayName: "36" },

    // ========== STREET BETS (Top Yellow - 11:1) ==========
    // Street bets cover 3 numbers in a row
    "streetTopYellow1": { betType: "STREET", numbersCovered: [1, 2, 3], payout: 11, displayName: "Street 1-3" },
    "streetTopYellow2": { betType: "STREET", numbersCovered: [4, 5, 6], payout: 11, displayName: "Street 4-6" },
    "streetTopYellow3": { betType: "STREET", numbersCovered: [7, 8, 9], payout: 11, displayName: "Street 7-9" },
    "streetTopYellow4": { betType: "STREET", numbersCovered: [10, 11, 12], payout: 11, displayName: "Street 10-12" },
    "streetTopYellow5": { betType: "STREET", numbersCovered: [13, 14, 15], payout: 11, displayName: "Street 13-15" },
    "streetTopYellow6": { betType: "STREET", numbersCovered: [16, 17, 18], payout: 11, displayName: "Street 16-18" },
    "streetTopYellow7": { betType: "STREET", numbersCovered: [19, 20, 21], payout: 11, displayName: "Street 19-21" },
    "streetTopYellow8": { betType: "STREET", numbersCovered: [22, 23, 24], payout: 11, displayName: "Street 22-24" },
    "streetTopYellow9": { betType: "STREET", numbersCovered: [25, 26, 27], payout: 11, displayName: "Street 25-27" },
    "streetTopYellow10": { betType: "STREET", numbersCovered: [28, 29, 30], payout: 11, displayName: "Street 28-30" },
    "streetTopYellow11": { betType: "STREET", numbersCovered: [31, 32, 33], payout: 11, displayName: "Street 31-33" },
    "streetTopYellow12": { betType: "STREET", numbersCovered: [34, 35, 36], payout: 11, displayName: "Street 34-36" },

    // ========== LINE BETS (Top Cyan - 5:1) ==========
    // Line bets cover 6 numbers (2 adjacent streets)
    "streetTopCyan1": { betType: "LINE", numbersCovered: [1, 2, 3, 4, 5, 6], payout: 5, displayName: "Line 1-6" },
    "streetTopCyan2": { betType: "LINE", numbersCovered: [4, 5, 6, 7, 8, 9], payout: 5, displayName: "Line 4-9" },
    "streetTopCyan3": { betType: "LINE", numbersCovered: [7, 8, 9, 10, 11, 12], payout: 5, displayName: "Line 7-12" },
    "streetTopCyan4": { betType: "LINE", numbersCovered: [10, 11, 12, 13, 14, 15], payout: 5, displayName: "Line 10-15" },
    "streetTopCyan5": { betType: "LINE", numbersCovered: [13, 14, 15, 16, 17, 18], payout: 5, displayName: "Line 13-18" },
    "streetTopCyan6": { betType: "LINE", numbersCovered: [16, 17, 18, 19, 20, 21], payout: 5, displayName: "Line 16-21" },
    "streetTopCyan7": { betType: "LINE", numbersCovered: [19, 20, 21, 22, 23, 24], payout: 5, displayName: "Line 19-24" },
    "streetTopCyan8": { betType: "LINE", numbersCovered: [22, 23, 24, 25, 26, 27], payout: 5, displayName: "Line 22-27" },
    "streetTopCyan9": { betType: "LINE", numbersCovered: [25, 26, 27, 28, 29, 30], payout: 5, displayName: "Line 25-30" },
    "streetTopCyan10": { betType: "LINE", numbersCovered: [28, 29, 30, 31, 32, 33], payout: 5, displayName: "Line 28-33" },
    "streetTopCyan11": { betType: "LINE", numbersCovered: [31, 32, 33, 34, 35, 36], payout: 5, displayName: "Line 31-36" },

    // ========== STREET BETS (Bottom Yellow - 11:1) ==========
    "streetBottomYellow1": { betType: "STREET", numbersCovered: [1, 2, 3], payout: 11, displayName: "Street 1-3" },
    "streetBottomYellow2": { betType: "STREET", numbersCovered: [4, 5, 6], payout: 11, displayName: "Street 4-6" },
    "streetBottomYellow3": { betType: "STREET", numbersCovered: [7, 8, 9], payout: 11, displayName: "Street 7-9" },
    "streetBottomYellow4": { betType: "STREET", numbersCovered: [10, 11, 12], payout: 11, displayName: "Street 10-12" },
    "streetBottomYellow5": { betType: "STREET", numbersCovered: [13, 14, 15], payout: 11, displayName: "Street 13-15" },
    "streetBottomYellow6": { betType: "STREET", numbersCovered: [16, 17, 18], payout: 11, displayName: "Street 16-18" },
    "streetBottomYellow7": { betType: "STREET", numbersCovered: [19, 20, 21], payout: 11, displayName: "Street 19-21" },
    "streetBottomYellow8": { betType: "STREET", numbersCovered: [22, 23, 24], payout: 11, displayName: "Street 22-24" },
    "streetBottomYellow9": { betType: "STREET", numbersCovered: [25, 26, 27], payout: 11, displayName: "Street 25-27" },
    "streetBottomYellow10": { betType: "STREET", numbersCovered: [28, 29, 30], payout: 11, displayName: "Street 28-30" },
    "streetBottomYellow11": { betType: "STREET", numbersCovered: [31, 32, 33], payout: 11, displayName: "Street 31-33" },
    "streetBottomYellow12": { betType: "STREET", numbersCovered: [34, 35, 36], payout: 11, displayName: "Street 34-36" },

    // ========== LINE BETS (Bottom Cyan - 5:1) ==========
    "streetBottomCyan1": { betType: "LINE", numbersCovered: [1, 2, 3, 4, 5, 6], payout: 5, displayName: "Line 1-6" },
    "streetBottomCyan2": { betType: "LINE", numbersCovered: [4, 5, 6, 7, 8, 9], payout: 5, displayName: "Line 4-9" },
    "streetBottomCyan3": { betType: "LINE", numbersCovered: [7, 8, 9, 10, 11, 12], payout: 5, displayName: "Line 7-12" },
    "streetBottomCyan4": { betType: "LINE", numbersCovered: [10, 11, 12, 13, 14, 15], payout: 5, displayName: "Line 10-15" },
    "streetBottomCyan5": { betType: "LINE", numbersCovered: [13, 14, 15, 16, 17, 18], payout: 5, displayName: "Line 13-18" },
    "streetBottomCyan6": { betType: "LINE", numbersCovered: [16, 17, 18, 19, 20, 21], payout: 5, displayName: "Line 16-21" },
    "streetBottomCyan7": { betType: "LINE", numbersCovered: [19, 20, 21, 22, 23, 24], payout: 5, displayName: "Line 19-24" },
    "streetBottomCyan8": { betType: "LINE", numbersCovered: [22, 23, 24, 25, 26, 27], payout: 5, displayName: "Line 22-27" },
    "streetBottomCyan9": { betType: "LINE", numbersCovered: [25, 26, 27, 28, 29, 30], payout: 5, displayName: "Line 25-30" },
    "streetBottomCyan10": { betType: "LINE", numbersCovered: [28, 29, 30, 31, 32, 33], payout: 5, displayName: "Line 28-33" },
    "streetBottomCyan11": { betType: "LINE", numbersCovered: [31, 32, 33, 34, 35, 36], payout: 5, displayName: "Line 31-36" },

    // ========== HORIZONTAL SPLIT BETS (17:1) ==========
    // Row 1 horizontal splits (between rows 1 and 2)
    "dashHorizR1C1": { betType: "SPLIT", numbersCovered: [3, 6], payout: 17, displayName: "Split 3/6" },
    "dashHorizR1C2": { betType: "SPLIT", numbersCovered: [6, 9], payout: 17, displayName: "Split 6/9" },
    "dashHorizR1C3": { betType: "SPLIT", numbersCovered: [9, 12], payout: 17, displayName: "Split 9/12" },
    "dashHorizR1C4": { betType: "SPLIT", numbersCovered: [12, 15], payout: 17, displayName: "Split 12/15" },
    "dashHorizR1C5": { betType: "SPLIT", numbersCovered: [15, 18], payout: 17, displayName: "Split 15/18" },
    "dashHorizR1C6": { betType: "SPLIT", numbersCovered: [18, 21], payout: 17, displayName: "Split 18/21" },
    "dashHorizR1C7": { betType: "SPLIT", numbersCovered: [21, 24], payout: 17, displayName: "Split 21/24" },
    "dashHorizR1C8": { betType: "SPLIT", numbersCovered: [24, 27], payout: 17, displayName: "Split 24/27" },
    "dashHorizR1C9": { betType: "SPLIT", numbersCovered: [27, 30], payout: 17, displayName: "Split 27/30" },
    "dashHorizR1C10": { betType: "SPLIT", numbersCovered: [30, 33], payout: 17, displayName: "Split 30/33" },
    "dashHorizR1C11": { betType: "SPLIT", numbersCovered: [33, 36], payout: 17, displayName: "Split 33/36" },
    "dashHorizR1C12": { betType: "SPLIT", numbersCovered: [36], payout: 17, displayName: "Split (edge)" },

    // Row 2 horizontal splits (between rows 2 and 3)
    "dashHorizR2C1": { betType: "SPLIT", numbersCovered: [2, 5], payout: 17, displayName: "Split 2/5" },
    "dashHorizR2C2": { betType: "SPLIT", numbersCovered: [5, 8], payout: 17, displayName: "Split 5/8" },
    "dashHorizR2C3": { betType: "SPLIT", numbersCovered: [8, 11], payout: 17, displayName: "Split 8/11" },
    "dashHorizR2C4": { betType: "SPLIT", numbersCovered: [11, 14], payout: 17, displayName: "Split 11/14" },
    "dashHorizR2C5": { betType: "SPLIT", numbersCovered: [14, 17], payout: 17, displayName: "Split 14/17" },
    "dashHorizR2C6": { betType: "SPLIT", numbersCovered: [17, 20], payout: 17, displayName: "Split 17/20" },
    "dashHorizR2C7": { betType: "SPLIT", numbersCovered: [20, 23], payout: 17, displayName: "Split 20/23" },
    "dashHorizR2C8": { betType: "SPLIT", numbersCovered: [23, 26], payout: 17, displayName: "Split 23/26" },
    "dashHorizR2C9": { betType: "SPLIT", numbersCovered: [26, 29], payout: 17, displayName: "Split 26/29" },
    "dashHorizR2C10": { betType: "SPLIT", numbersCovered: [29, 32], payout: 17, displayName: "Split 29/32" },
    "dashHorizR2C11": { betType: "SPLIT", numbersCovered: [32, 35], payout: 17, displayName: "Split 32/35" },
    "dashHorizR2C12": { betType: "SPLIT", numbersCovered: [35], payout: 17, displayName: "Split (edge)" },

    // ========== VERTICAL SPLIT BETS (17:1) ==========
    // Column 0 (next to zero)
    "dashVertR1C0": { betType: "SPLIT", numbersCovered: [0, 3], payout: 17, displayName: "Split 0/3" },
    "dashVertR2C0": { betType: "SPLIT", numbersCovered: [0, 2], payout: 17, displayName: "Split 0/2" },
    "dashVertR3C0": { betType: "SPLIT", numbersCovered: [0, 1], payout: 17, displayName: "Split 0/1" },

    // Row 1 vertical splits
    "dashVertR1C1": { betType: "SPLIT", numbersCovered: [3, 6], payout: 17, displayName: "Split 3/6" },
    "dashVertR1C2": { betType: "SPLIT", numbersCovered: [6, 9], payout: 17, displayName: "Split 6/9" },
    "dashVertR1C3": { betType: "SPLIT", numbersCovered: [9, 12], payout: 17, displayName: "Split 9/12" },
    "dashVertR1C4": { betType: "SPLIT", numbersCovered: [12, 15], payout: 17, displayName: "Split 12/15" },
    "dashVertR1C5": { betType: "SPLIT", numbersCovered: [15, 18], payout: 17, displayName: "Split 15/18" },
    "dashVertR1C6": { betType: "SPLIT", numbersCovered: [18, 21], payout: 17, displayName: "Split 18/21" },
    "dashVertR1C7": { betType: "SPLIT", numbersCovered: [21, 24], payout: 17, displayName: "Split 21/24" },
    "dashVertR1C8": { betType: "SPLIT", numbersCovered: [24, 27], payout: 17, displayName: "Split 24/27" },
    "dashVertR1C9": { betType: "SPLIT", numbersCovered: [27, 30], payout: 17, displayName: "Split 27/30" },
    "dashVertR1C10": { betType: "SPLIT", numbersCovered: [30, 33], payout: 17, displayName: "Split 30/33" },
    "dashVertR1C11": { betType: "SPLIT", numbersCovered: [33, 36], payout: 17, displayName: "Split 33/36" },
    "dashVertR1C12": { betType: "SPLIT", numbersCovered: [36], payout: 17, displayName: "Split (edge)" },

    // Row 2 vertical splits
    "dashVertR2C1": { betType: "SPLIT", numbersCovered: [2, 5], payout: 17, displayName: "Split 2/5" },
    "dashVertR2C2": { betType: "SPLIT", numbersCovered: [5, 8], payout: 17, displayName: "Split 5/8" },
    "dashVertR2C3": { betType: "SPLIT", numbersCovered: [8, 11], payout: 17, displayName: "Split 8/11" },
    "dashVertR2C4": { betType: "SPLIT", numbersCovered: [11, 14], payout: 17, displayName: "Split 11/14" },
    "dashVertR2C5": { betType: "SPLIT", numbersCovered: [14, 17], payout: 17, displayName: "Split 14/17" },
    "dashVertR2C6": { betType: "SPLIT", numbersCovered: [17, 20], payout: 17, displayName: "Split 17/20" },
    "dashVertR2C7": { betType: "SPLIT", numbersCovered: [20, 23], payout: 17, displayName: "Split 20/23" },
    "dashVertR2C8": { betType: "SPLIT", numbersCovered: [23, 26], payout: 17, displayName: "Split 23/26" },
    "dashVertR2C9": { betType: "SPLIT", numbersCovered: [26, 29], payout: 17, displayName: "Split 26/29" },
    "dashVertR2C10": { betType: "SPLIT", numbersCovered: [29, 32], payout: 17, displayName: "Split 29/32" },
    "dashVertR2C11": { betType: "SPLIT", numbersCovered: [32, 35], payout: 17, displayName: "Split 32/35" },
    "dashVertR2C12": { betType: "SPLIT", numbersCovered: [35], payout: 17, displayName: "Split (edge)" },

    // Row 3 vertical splits
    "dashVertR3C1": { betType: "SPLIT", numbersCovered: [1, 4], payout: 17, displayName: "Split 1/4" },
    "dashVertR3C2": { betType: "SPLIT", numbersCovered: [4, 7], payout: 17, displayName: "Split 4/7" },
    "dashVertR3C3": { betType: "SPLIT", numbersCovered: [7, 10], payout: 17, displayName: "Split 7/10" },
    "dashVertR3C4": { betType: "SPLIT", numbersCovered: [10, 13], payout: 17, displayName: "Split 10/13" },
    "dashVertR3C5": { betType: "SPLIT", numbersCovered: [13, 16], payout: 17, displayName: "Split 13/16" },
    "dashVertR3C6": { betType: "SPLIT", numbersCovered: [16, 19], payout: 17, displayName: "Split 16/19" },
    "dashVertR3C7": { betType: "SPLIT", numbersCovered: [19, 22], payout: 17, displayName: "Split 19/22" },
    "dashVertR3C8": { betType: "SPLIT", numbersCovered: [22, 25], payout: 17, displayName: "Split 22/25" },
    "dashVertR3C9": { betType: "SPLIT", numbersCovered: [25, 28], payout: 17, displayName: "Split 25/28" },
    "dashVertR3C10": { betType: "SPLIT", numbersCovered: [28, 31], payout: 17, displayName: "Split 28/31" },
    "dashVertR3C11": { betType: "SPLIT", numbersCovered: [31, 34], payout: 17, displayName: "Split 31/34" },
    "dashVertR3C12": { betType: "SPLIT", numbersCovered: [34], payout: 17, displayName: "Split (edge)" },

    // ========== CORNER BETS (Node intersections - 8:1) ==========
    // Row 1 corners (between rows 1-2)
    "nodeR1C1": { betType: "CORNER", numbersCovered: [2, 3, 5, 6], payout: 8, displayName: "Corner 2/3/5/6" },
    "nodeR1C2": { betType: "CORNER", numbersCovered: [5, 6, 8, 9], payout: 8, displayName: "Corner 5/6/8/9" },
    "nodeR1C3": { betType: "CORNER", numbersCovered: [8, 9, 11, 12], payout: 8, displayName: "Corner 8/9/11/12" },
    "nodeR1C4": { betType: "CORNER", numbersCovered: [11, 12, 14, 15], payout: 8, displayName: "Corner 11/12/14/15" },
    "nodeR1C5": { betType: "CORNER", numbersCovered: [14, 15, 17, 18], payout: 8, displayName: "Corner 14/15/17/18" },
    "nodeR1C6": { betType: "CORNER", numbersCovered: [17, 18, 20, 21], payout: 8, displayName: "Corner 17/18/20/21" },
    "nodeR1C7": { betType: "CORNER", numbersCovered: [20, 21, 23, 24], payout: 8, displayName: "Corner 20/21/23/24" },
    "nodeR1C8": { betType: "CORNER", numbersCovered: [23, 24, 26, 27], payout: 8, displayName: "Corner 23/24/26/27" },
    "nodeR1C9": { betType: "CORNER", numbersCovered: [26, 27, 29, 30], payout: 8, displayName: "Corner 26/27/29/30" },
    "nodeR1C10": { betType: "CORNER", numbersCovered: [29, 30, 32, 33], payout: 8, displayName: "Corner 29/30/32/33" },
    "nodeR1C11": { betType: "CORNER", numbersCovered: [32, 33, 35, 36], payout: 8, displayName: "Corner 32/33/35/36" },
    "nodeR1C12": { betType: "CORNER", numbersCovered: [35, 36], payout: 8, displayName: "Corner (edge)" },

    // Row 2 corners (between rows 2-3)
    "nodeR2C1": { betType: "CORNER", numbersCovered: [1, 2, 4, 5], payout: 8, displayName: "Corner 1/2/4/5" },
    "nodeR2C2": { betType: "CORNER", numbersCovered: [4, 5, 7, 8], payout: 8, displayName: "Corner 4/5/7/8" },
    "nodeR2C3": { betType: "CORNER", numbersCovered: [7, 8, 10, 11], payout: 8, displayName: "Corner 7/8/10/11" },
    "nodeR2C4": { betType: "CORNER", numbersCovered: [10, 11, 13, 14], payout: 8, displayName: "Corner 10/11/13/14" },
    "nodeR2C5": { betType: "CORNER", numbersCovered: [13, 14, 16, 17], payout: 8, displayName: "Corner 13/14/16/17" },
    "nodeR2C6": { betType: "CORNER", numbersCovered: [16, 17, 19, 20], payout: 8, displayName: "Corner 16/17/19/20" },
    "nodeR2C7": { betType: "CORNER", numbersCovered: [19, 20, 22, 23], payout: 8, displayName: "Corner 19/20/22/23" },
    "nodeR2C8": { betType: "CORNER", numbersCovered: [22, 23, 25, 26], payout: 8, displayName: "Corner 22/23/25/26" },
    "nodeR2C9": { betType: "CORNER", numbersCovered: [25, 26, 28, 29], payout: 8, displayName: "Corner 25/26/28/29" },
    "nodeR2C10": { betType: "CORNER", numbersCovered: [28, 29, 31, 32], payout: 8, displayName: "Corner 28/29/31/32" },
    "nodeR2C11": { betType: "CORNER", numbersCovered: [31, 32, 34, 35], payout: 8, displayName: "Corner 31/32/34/35" },
    "nodeR2C12": { betType: "CORNER", numbersCovered: [34, 35], payout: 8, displayName: "Corner (edge)" },

    // ========== COLUMN BETS (2:1) ==========
    "column2to1_row1": { betType: "COLUMN", numbersCovered: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], payout: 2, displayName: "Column 3" },
    "column2to1_row2": { betType: "COLUMN", numbersCovered: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], payout: 2, displayName: "Column 2" },
    "column2to1_row3": { betType: "COLUMN", numbersCovered: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34], payout: 2, displayName: "Column 1" },

    // ========== DOZEN BETS (2:1) ==========
    "dozen1to12": { betType: "DOZEN1", numbersCovered: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], payout: 2, displayName: "1st 12" },
    "dozen13to24": { betType: "DOZEN2", numbersCovered: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], payout: 2, displayName: "2nd 12" },
    "dozen25to36": { betType: "DOZEN3", numbersCovered: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36], payout: 2, displayName: "3rd 12" },

    // ========== EVEN MONEY BETS (1:1) ==========
    "outer1to18": { betType: "LOW", numbersCovered: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], payout: 1, displayName: "1-18" },
    "outer19to36": { betType: "HIGH", numbersCovered: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36], payout: 1, displayName: "19-36" },
    "outerEven": { betType: "EVEN", numbersCovered: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36], payout: 1, displayName: "Even" },
    "outerOdd": { betType: "ODD", numbersCovered: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35], payout: 1, displayName: "Odd" },
    "outerRed": { betType: "RED", numbersCovered: RED_NUMBERS, payout: 1, displayName: "Red" },
    "outerBlack": { betType: "BLACK", numbersCovered: BLACK_NUMBERS, payout: 1, displayName: "Black" },
};

/**
 * Look up a bet configuration by hotspot ID
 */
export function getBetConfig(hotspotId: string): BetConfig | undefined {
    return BET_REGISTRY[hotspotId];
}

/**
 * Check if a winning number is covered by a bet
 */
export function isBetWinner(hotspotId: string, winningNumber: number): boolean {
    const config = BET_REGISTRY[hotspotId];
    if (!config) return false;
    return config.numbersCovered.includes(winningNumber);
}

/**
 * Calculate payout for a bet given the winning number
 * Returns 0 if the bet loses, or (amount * (payout + 1)) if it wins
 */
export function calculateBetPayout(hotspotId: string, amount: number, winningNumber: number): number {
    const config = BET_REGISTRY[hotspotId];
    if (!config) return 0;
    if (!config.numbersCovered.includes(winningNumber)) return 0;
    return amount * (config.payout + 1); // Original bet + winnings
}
