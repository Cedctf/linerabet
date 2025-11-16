// src/lib/baccarat-chain.ts
import { LINERA_SERVICE_URL as DEFAULT_URL } from "./linera";

function resolveBaccaratServiceUrl(): string {
  const fromBuild =
    (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_BACCARAT_SERVICE_URL) ||
    // eslint-disable-next-line no-undef
    (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_BACCARAT_SERVICE_URL) ||
    undefined;

  const fromMeta =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="baccarat-service-url"]')?.getAttribute("content") ??
        undefined
      : undefined;

  // Provided URL fallback from user; last resort -> fall back to generic LINERA_SERVICE_URL
  const hardcoded =
    "http://localhost:8080/chains/503a882ee3d12921f772699e47db7c7035381a1f54a68322ed8df8aa80ccf846/applications/d52899cd1558f88e739daf59bb24d50da5c6b179d27e38d0d6f70c569bfe04b2";

  return fromBuild || fromMeta || hardcoded || DEFAULT_URL;
}

export const BACCARAT_SERVICE_URL = resolveBaccaratServiceUrl();

type GqlPayload = { query: string; variables?: Record<string, unknown> };

export async function gql<T = any>(body: GqlPayload): Promise<T> {
  const res = await fetch(BACCARAT_SERVICE_URL, {
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


