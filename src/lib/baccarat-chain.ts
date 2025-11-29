// src/lib/baccarat-chain.ts
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

export type BaccaratWinner = "Player" | "Banker" | "Tie";

export async function fetchBaccaratState() {
  return gql<{
    balance: number;
    currentBet: number;
    playerHand: { id: string; suit: string; value: string; point_value?: number }[];
    bankerHand: { id: string; suit: string; value: string; point_value?: number }[];
    lastResult: null | {
      playerValue: number;
      bankerValue: number;
      winner: BaccaratWinner;
      isNatural: boolean;
      playerThirdCardValue?: number | null;
      bankerDrewThirdCard: boolean;
      pushed: boolean;
      netProfit: number;
    };
  }>({
    query: `query {
      balance
      currentBet
      playerHand { id suit value }
      bankerHand { id suit value }
      lastResult {
        playerValue
        bankerValue
        winner
        isNatural
        playerThirdCardValue
        bankerDrewThirdCard
        pushed
        netProfit
      }
    }`,
  });
}

export function placeBetAndDeal(bet: number, betType: "Player" | "Banker" | "Tie") {
  // async-graphql maps enum variant fields to camelCase; our args are bet and betType
  const enumLiteral = betType === "Player" ? "PLAYER" : betType === "Banker" ? "BANKER" : "TIE";
  return gql({
    query: `mutation {
      placeBetAndDeal(bet: ${bet}, betType: ${enumLiteral})
    }`,
  });
}

export function resetBaccaratRound() {
  return gql({
    query: `mutation { resetRound }`,
  });
}


