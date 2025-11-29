// src/lib/linera.ts
import { lineraAdapter } from "./linera-adapter";

type GqlPayload = { query: string; variables?: Record<string, unknown> };

export async function gql<T = any>(body: GqlPayload): Promise<T> {
  // Use the adapter to query the application directly via WASM
  // This avoids needing a separate local service running on port 8080
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

// NOTE: Your service returns CamelCase enums.
// If your page types still use UPPER_SNAKE_CASE, update them there.

export type GameRecord = {
  playerHand: { suit: string; value: string; id: string }[];
  dealerHand: { suit: string; value: string; id: string }[];
  bet: number;
  result: "PlayerBlackjack" | "PlayerWin" | "DealerWin" | "PlayerBust" | "DealerBust" | "Push";
  payout: number;
  timestamp: number;
};

export async function fetchState() {
  return gql<{
    balance: number;
    currentBet: number;
    allowedBets: number[];
    phase: "WaitingForBet" | "BettingPhase" | "PlayerTurn" | "DealerTurn" | "RoundComplete";
    lastResult:
    | null
    | "PlayerBlackjack"
    | "PlayerWin"
    | "DealerWin"
    | "PlayerBust"
    | "DealerBust"
    | "Push";
    playerHand: { suit: string; value: string; id: string }[];
    dealerHand: { suit: string; value: string; id: string }[];
    roundStartTime: number;
    gameHistory: GameRecord[];
  }>({
    query: `query {
      balance
      currentBet
      allowedBets
      phase
      lastResult
      playerHand { id suit value }
      dealerHand { id suit value }
      roundStartTime
      gameHistory {
        playerHand { id suit value }
        dealerHand { id suit value }
        bet
        result
        payout
        timestamp
      }
    }`,
  });
}

// Betting and game operations
export function enterBettingPhase() {
  return gql({ query: `mutation { enterBettingPhase }` });
}

export function startGame(bet: number) {
  return gql({ query: `mutation { startGame(bet: ${bet}) }` });
}

export function hit() {
  return gql({ query: `mutation { hit }` });
}
export function stand() {
  return gql({ query: `mutation { stand }` });
}
