// src/lib/linera.ts

// Safe URL resolution for both server & browser:
function resolveServiceUrl(): string {
  // 1) Build-time env (Next.js will inline this when available)
  const fromBuild =
    // eslint-disable-next-line no-undef
    (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_LINERA_SERVICE_URL) ||
    undefined;

  // 2) <meta name="linera-service-url" content="..."> (optional, runtime override)
  const fromMeta =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="linera-service-url"]')?.getAttribute("content") ??
        undefined
      : undefined;

  // 3) Hardcoded default (TESTNET)
  const fallback =
    "http://127.0.0.1:8080/chains/35b61dea8829e27eb61a5e17e54fb88d68379e75077c4f33f4416142fdcd680a/applications/5c6883bded962a6c83a98a9497fc0d5b173a5c23e4c3f73cbb4b310db00c9f58";

  return fromBuild || fromMeta || fallback;
}

export const LINERA_SERVICE_URL = resolveServiceUrl();

type GqlPayload = { query: string; variables?: Record<string, unknown> };

export async function gql<T = any>(body: GqlPayload): Promise<T> {
  const res = await fetch(LINERA_SERVICE_URL, {
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
