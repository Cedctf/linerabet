// All possible card values and suits
export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'jack', 'queen', 'king', 'ace'] as const;

export type Suit = typeof SUITS[number];
export type Value = typeof VALUES[number];

export interface BlackjackCard {
  suit: Suit;
  value: Value;
  id: string;
}

/**
 * Create a full deck of 52 cards
 */
export const createDeck = (): BlackjackCard[] => {
  const deck: BlackjackCard[] = [];
  SUITS.forEach(suit => {
    VALUES.forEach(value => {
      deck.push({ suit, value, id: `${value}_of_${suit}` });
    });
  });
  return deck;
};

/**
 * Shuffle array using Fisher-Yates algorithm
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Calculate hand value for blackjack
 * Aces count as 11 or 1, face cards count as 10
 */
export const calculateHandValue = (cards: BlackjackCard[]): number => {
  let sum = 0;
  let aces = 0;

  cards.forEach(card => {
    if (card.value === 'ace') {
      aces += 1;
      sum += 11;
    } else if (['jack', 'queen', 'king'].includes(card.value as string)) {
      sum += 10;
    } else {
      sum += card.value as number;
    }
  });

  // Adjust for aces if bust
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces -= 1;
  }

  return sum;
};

/**
 * Determine the winner of a blackjack game
 */
export const determineWinner = (
  playerValue: number,
  dealerValue: number,
  playerBust: boolean,
  dealerBust: boolean
): string => {
  if (playerBust) {
    return 'Dealer Wins - You Bust!';
  } else if (dealerBust) {
    return 'You Win - Dealer Bust!';
  } else if (playerValue > dealerValue) {
    return 'You Win!';
  } else if (dealerValue > playerValue) {
    return 'Dealer Wins!';
  } else {
    return 'Push (Tie)';
  }
};

/**
 * Get the numeric value of a card (for comparing splits)
 * Face cards all count as 10
 */
export const getCardNumericValue = (card: BlackjackCard): number => {
  if (card.value === 'ace') {
    return 11;
  } else if (['jack', 'queen', 'king'].includes(card.value as string)) {
    return 10;
  } else {
    return card.value as number;
  }
};

/**
 * Check if a hand can be split
 * A hand can be split if it has exactly 2 cards with the same value
 */
export const canSplit = (cards: BlackjackCard[]): boolean => {
  if (cards.length !== 2) return false;
  return getCardNumericValue(cards[0]) === getCardNumericValue(cards[1]);
};

/**
 * Check if double down is available
 * Double down is only available on the initial 2-card hand
 */
export const canDoubleDown = (cards: BlackjackCard[]): boolean => {
  return cards.length === 2;
};

