// src/lib/roulette-chain.ts
import { lineraAdapter } from "./linera-adapter";

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

export type BetType = "StraightUp" | "Color" | "Parity" | "Range" | "Dozen" | "Column";

export type Bet = {
  betType: BetType;
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

export async function fetchRouletteState() {
  return gql<{
    playerBalance: number;
    currentBets: Bet[];
    lastResult: SpinResult | null;
    gameHistory: GameRecord[];
  }>({
    query: `query {
      playerBalance
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
        timestamp
      }
    }`,
  });
}

export function placeBetsAndSpin(bets: Bet[]) {
  const betsInput = bets.map(bet => ({
    betType: convertBetTypeToGraphQL(bet.betType),
    amount: bet.amount,
    selection: bet.selection,
  }));

  return gql({
    query: `mutation PlaceBetsAndSpin($bets: [BetInput!]!) {
      placeBetsAndSpin(bets: $bets)
    }`,
    variables: { bets: betsInput },
  });
}

function convertBetTypeToGraphQL(betType: BetType): string {
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

export function resetRouletteRound() {
  return gql({
    query: `mutation { resetRound }`,
  });
}
