// src/lib/roulette-chain.ts
import { LINERA_SERVICE_URL as DEFAULT_URL } from "./linera";

function resolveRouletteServiceUrl(): string {
  const fromBuild =
    (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_ROULETTE_SERVICE_URL) ||
    // eslint-disable-next-line no-undef
    (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_ROULETTE_SERVICE_URL) ||
    undefined;

  const fromMeta =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="roulette-service-url"]')?.getAttribute("content") ??
        undefined
      : undefined;

  // Placeholder URL - will need to be updated with actual roulette app URL
  const hardcoded =
    "http://localhost:8080/chains/503a882ee3d12921f772699e47db7c7035381a1f54a68322ed8df8aa80ccf846/applications/f56b382e9ca70912a0a31b28c654525a534318b6d6d3d19387272445c5042586";

  return fromBuild || fromMeta || hardcoded || DEFAULT_URL;
}

export const ROULETTE_SERVICE_URL = resolveRouletteServiceUrl();

type GqlPayload = { query: string; variables?: Record<string, unknown> };

export async function gql<T = any>(body: GqlPayload): Promise<T> {
  const res = await fetch(ROULETTE_SERVICE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphQL ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (data.errors?.length) {
    throw new Error(data.errors.map((e: any) => e.message).join("; "));
  }
  return data.data as T;
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
