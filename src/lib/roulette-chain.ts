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

export async function resetRouletteRound() {
  const mutation = `mutation { rouletteResetRound }`;
  return lineraAdapter.mutate(mutation);
}

