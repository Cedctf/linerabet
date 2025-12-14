
import classNames from "classnames";
import { ValueType } from "../components/roulette/Global";
import type { Item, PlacedChip } from "../components/roulette/Global";
import { lineraAdapter } from "./linera-adapter";

// Standard American Roulette sequence for the wheel
export const WHEEL_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25,
    17, 34, 6, 27, 13, 36, 11,
    30, 8, 23, 10, 5, 24, 16, 33,
    1, 20, 14, 31, 9, 22, 18, 29,
    7, 28, 12, 35, 3, 26
];

export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 29, 28, 31, 33, 35];

export type RouletteBetType = "Number" | "Red" | "Black" | "Even" | "Odd" | "Low" | "High";

export interface ChainRouletteRecord {
    winning_number: number;
    total_bet: number;
    payout: number;
    timestamp: number;
}

export const calculatePayout = (chip: PlacedChip, winningNum: number): number => {
    // Same logic as before
    const { item, sum } = chip;
    switch (item.type) {
        case ValueType.NUMBER:
            return item.value === winningNum ? sum * 36 : 0;
        case ValueType.RED:
            return !BLACK_NUMBERS.includes(winningNum) && winningNum !== 0 ? sum * 2 : 0;
        case ValueType.BLACK:
            return BLACK_NUMBERS.includes(winningNum) ? sum * 2 : 0;
        case ValueType.EVEN:
            return (winningNum !== 0 && winningNum % 2 === 0) ? sum * 2 : 0;
        case ValueType.ODD:
            return (winningNum !== 0 && winningNum % 2 !== 0) ? sum * 2 : 0;
        case ValueType.NUMBERS_1_18:
            return (winningNum >= 1 && winningNum <= 18) ? sum * 2 : 0;
        case ValueType.NUMBERS_19_36:
            return (winningNum >= 19 && winningNum <= 36) ? sum * 2 : 0;
        // Splits/Corners ignored in this version
        default:
            return 0;
    }
};

export const getChipClasses = (val: number, selectedChip: number | null) => {
    const selected = selectedChip === val;
    const base = "relative w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all shadow-lg cursor-pointer";
    let colorClass = "";
    switch (val) {
        case 1: colorClass = "border-white bg-gradient-to-br from-red-500 to-red-700"; break;
        case 2: colorClass = "border-white bg-gradient-to-br from-blue-500 to-blue-700"; break;
        case 3: colorClass = "border-white bg-gradient-to-br from-green-500 to-green-700"; break;
        case 4: colorClass = "border-white bg-gradient-to-br from-purple-500 to-purple-700"; break;
        case 5: colorClass = "border-white bg-gradient-to-br from-gray-800 to-black"; break;
        default: colorClass = "border-white bg-gray-500";
    }
    if (selected) {
        return classNames(base, "scale-110 border-yellow-400 bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-[0_0_15px_#facc15]");
    }
    return classNames(base, colorClass, "hover:scale-105");
};

/* --- Imported from roulette-chain.ts --- */

type GqlPayload = { query: string; variables?: Record<string, unknown> };

export async function gql<T = any>(body: GqlPayload): Promise<T> {
    // Use the adapter to query the application directly via WASM
    try {
        const result = await lineraAdapter.queryApplication<any>(body);
        if (result.errors?.length) {
            throw new Error(result.errors.map((e: any) => e.message).join("; "));
        }
        return result.data as T;
    } catch (error) {
        console.error("GraphQL Query Error:", error);
        throw error;
    }
}

// NOTE: These types might conflict with RouletteBetType above if not careful.
// Renaming to distinguish or keeping as legacy reference.
export type ChainBetType = "StraightUp" | "Color" | "Parity" | "Range" | "Dozen" | "Column";

export type Bet = {
    betType: ChainBetType;
    amount: number;
    selection: number;
};

export type BetResult = {
    bet: Bet;
    won: boolean;
    payout: number;
};

export type SpinResult = {
    winningNumber: number;
    isRed: boolean | null;
    totalPayout: number;
    betResults: BetResult[];
};

export type GameRecord = {
    bets: Bet[];
    spinResult: SpinResult;
    timestamp: number;
};


export async function fetchRouletteState(owner: string) {
    return gql<{
        player: {
            playerBalance: number;
            roulette: {
                currentBets: Bet[];
                lastResult: SpinResult | null;
                gameHistory: GameRecord[];
            };
        } | null;
    }>({
        query: `query GetState($owner: AccountOwner!) {
      player(owner: $owner) {
        playerBalance
        roulette {
          currentBets {
            betType
            amount
            selection
          }
          lastResult {
            winningNumber
            isRed
            totalPayout
            betResults {
              bet {
                betType
                amount
                selection
              }
              won
              payout
            }
          }
          gameHistory {
            bets {
              betType
              amount
              selection
            }
            spinResult {
              winningNumber
              isRed
              totalPayout
            }
            timestamp
          }
        }
      }
    }`,
        variables: { owner },
    });
}

// NOTE: This uses the old mutation name. Keeping for reference.
export async function placeBetsAndSpin(bets: Bet[]) {
    const betsInput = bets.map(bet => ({
        betType: convertBetTypeToGraphQL(bet.betType),
        amount: bet.amount,
        selection: bet.selection,
    }));

    const mutation = `mutation PlaceBetsAndSpin($bets: [RouletteBetInput!]!) {
    roulettePlaceBetsAndSpin(bets: $bets)
  }`;

    return lineraAdapter.mutate(mutation, { bets: betsInput });
}

function convertBetTypeToGraphQL(betType: ChainBetType): string {
    switch (betType) {
        case "StraightUp":
            return "STRAIGHT_UP";
        case "Color":
            return "COLOR";
        case "Parity":
            return "PARITY";
        case "Range":
            return "RANGE";
        case "Dozen":
            return "DOZEN";
        case "Column":
            return "COLUMN";
        default:
            return betType;
    }
}

export async function resetRouletteRound() {
    const mutation = `mutation { rouletteResetRound }`;
    return lineraAdapter.mutate(mutation);
}
