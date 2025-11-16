import { SUITS, VALUES, type BlackjackCard } from "./blackjack-utils";

export type BaccaratBetOption = "PLAYER" | "BANKER" | "TIE";

export const BANKER_COMMISSION = 0.05;
const DEFAULT_DECKS = 6;
const TIE_PAYOUT_MULTIPLIER = 8;

export interface BaccaratCard extends BlackjackCard {
  pointValue: number;
}

export interface BaccaratRound {
  playerHand: BaccaratCard[];
  bankerHand: BaccaratCard[];
  playerValue: number;
  bankerValue: number;
  winner: BaccaratBetOption;
  isNatural: boolean;
  playerThirdCardValue: number | null;
  bankerDrewThirdCard: boolean;
}

export interface BaccaratBetResult extends BaccaratRound {
  betType: BaccaratBetOption;
  betAmount: number;
  netProfit: number;
  commissionPaid: number;
  payoutMultiplier: number;
  pushed: boolean;
}

function buildDeck(numDecks = DEFAULT_DECKS): BaccaratCard[] {
  const deck: BaccaratCard[] = [];
  for (let d = 0; d < numDecks; d += 1) {
    for (const suit of SUITS) {
      for (const value of VALUES) {
        const card: BaccaratCard = {
          suit,
          value,
          id: `${value}_of_${suit}_deck_${d}_${deck.length}`,
          pointValue: typeof value === "number" ? (value === 10 ? 0 : value) : value === "ace" ? 1 : 0,
        };
        deck.push(card);
      }
    }
  }
  return shuffle(deck);
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function calculateHandValue(hand: BaccaratCard[]): number {
  const sum = hand.reduce((acc, card) => acc + card.pointValue, 0);
  return sum % 10;
}

function shouldPlayerDraw(value: number): boolean {
  return value <= 5;
}

function shouldBankerDraw(bankerValue: number, playerThirdCardValue: number | null): boolean {
  if (bankerValue >= 7) return false;
  if (playerThirdCardValue === null) return bankerValue <= 5;

  if (bankerValue <= 2) return true;
  if (bankerValue === 3) return playerThirdCardValue !== 8;
  if (bankerValue === 4) return playerThirdCardValue >= 2 && playerThirdCardValue <= 7;
  if (bankerValue === 5) return playerThirdCardValue >= 4 && playerThirdCardValue <= 7;
  if (bankerValue === 6) return playerThirdCardValue === 6 || playerThirdCardValue === 7;
  return false;
}

function dealRound(): BaccaratRound {
  const deck = buildDeck();
  const draw = () => {
    const card = deck.pop();
    if (!card) {
      throw new Error("Deck is empty while dealing Baccarat round");
    }
    return card;
  };

  const playerHand = [draw(), draw()];
  const bankerHand = [draw(), draw()];

  let playerValue = calculateHandValue(playerHand);
  let bankerValue = calculateHandValue(bankerHand);
  const isNatural = playerValue >= 8 || bankerValue >= 8;

  let playerThirdCardValue: number | null = null;
  let bankerDrewThirdCard = false;

  if (!isNatural) {
    if (shouldPlayerDraw(playerValue)) {
      const third = draw();
      playerHand.push(third);
      playerThirdCardValue = third.pointValue;
      playerValue = calculateHandValue(playerHand);
    }

    if (shouldBankerDraw(bankerValue, playerThirdCardValue)) {
      const third = draw();
      bankerHand.push(third);
      bankerDrewThirdCard = true;
      bankerValue = calculateHandValue(bankerHand);
    } else {
      bankerValue = calculateHandValue(bankerHand);
    }
  }

  let winner: BaccaratBetOption = "TIE";
  if (playerValue > bankerValue) winner = "PLAYER";
  else if (bankerValue > playerValue) winner = "BANKER";

  return {
    playerHand,
    bankerHand,
    playerValue,
    bankerValue,
    winner,
    isNatural,
    playerThirdCardValue,
    bankerDrewThirdCard,
  };
}

function settleBet(
  round: BaccaratRound,
  betAmount: number,
  betType: BaccaratBetOption,
): Pick<BaccaratBetResult, "netProfit" | "commissionPaid" | "payoutMultiplier" | "pushed"> {
  if (betAmount <= 0) {
    throw new Error("Bet amount must be greater than zero");
  }

  if (round.winner === betType) {
    if (betType === "PLAYER") {
      return { netProfit: betAmount, commissionPaid: 0, payoutMultiplier: 1, pushed: false };
    }
    if (betType === "BANKER") {
      const commission = +(betAmount * BANKER_COMMISSION).toFixed(2);
      return {
        netProfit: +(betAmount - commission).toFixed(2),
        commissionPaid: commission,
        payoutMultiplier: +(1 - BANKER_COMMISSION),
        pushed: false,
      };
    }
    return {
      netProfit: betAmount * TIE_PAYOUT_MULTIPLIER,
      commissionPaid: 0,
      payoutMultiplier: TIE_PAYOUT_MULTIPLIER,
      pushed: false,
    };
  }

  if (round.winner === "TIE" && betType !== "TIE") {
    return { netProfit: 0, commissionPaid: 0, payoutMultiplier: 0, pushed: true };
  }

  return { netProfit: -betAmount, commissionPaid: 0, payoutMultiplier: -1, pushed: false };
}

export function playBaccaratRound(betAmount: number, betType: BaccaratBetOption): BaccaratBetResult {
  const round = dealRound();
  const settlement = settleBet(round, betAmount, betType);

  return {
    ...round,
    betAmount,
    betType,
    ...settlement,
  };
}
