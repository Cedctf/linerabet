// src/lib/baccarat-chain.ts
import { lineraAdapter } from "./linera-adapter";

type GqlPayload = { query: string; variables?: Record<string, unknown> };

export async function gql<T = any>(body: GqlPayload): Promise<T> {
  // Use the adapter to query the application directly via WASM
  try {
    const result = await lineraAdapter.queryApplication<any>(body.query, body.variables);
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

export async function fetchBaccaratState(owner: string) {
  return gql<{
    player: {
      playerBalance: number;
      baccarat: {
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
        gameHistory: any[];
      };
    } | null;
  }>({
    query: `query GetState($owner: AccountOwner!) {
      player(owner: $owner) {
        playerBalance
        baccarat {
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
           gameHistory {
             result {
                 playerValue
                 bankerValue
                 winner
             }
             bet
             betType
             timestamp
           }
        }
      }
    }`,
    variables: { owner },
  });
}

export async function placeBetAndDeal(bet: number, betType: "Player" | "Banker" | "Tie") {
  // async-graphql maps enum variant fields to camelCase; our args are bet and betType
  const enumLiteral = betType === "Player" ? "PLAYER" : betType === "Banker" ? "BANKER" : "TIE";
  const mutation = `mutation {
    baccaratPlaceBetAndDeal(bet: ${bet}, betType: ${enumLiteral})
  }`;
  return lineraAdapter.mutate(mutation);
}

export async function resetBaccaratRound() {
  const mutation = `mutation { baccaratResetRound }`;
  return lineraAdapter.mutate(mutation);
}


