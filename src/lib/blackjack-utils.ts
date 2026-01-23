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
    const val = card.value;
    if (val === 'ace') {
      aces += 1;
      sum += 11;
    } else if (val === 'jack' || val === 'queen' || val === 'king') {
      sum += 10;
    } else if (typeof val === 'number') {
      sum += val;
    } else {
      // Handle string numbers like "8", "10"
      const numVal = parseInt(val, 10);
      sum += isNaN(numVal) ? 0 : numVal;
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
 * Format hand value for display, showing soft values if applicable (e.g., "7 / 17")
 */
export const renderHandValue = (cards: BlackjackCard[]): string => {
  if (cards.length === 0) return "0";

  let sum = 0;
  let aces = 0;

  cards.forEach(card => {
    const val = card.value;
    if (val === 'ace') {
      aces += 1;
      sum += 11;
    } else if (val === 'jack' || val === 'queen' || val === 'king') {
      sum += 10;
    } else if (typeof val === 'number') {
      sum += val;
    } else {
      const numVal = parseInt(val, 10);
      sum += isNaN(numVal) ? 0 : numVal;
    }
  });

  // If there are no aces, just return the sum
  if (aces === 0) return sum.toString();

  // If we have aces, calculate soft and hard totals
  // Hard total is with all aces as 1 except one (possibly)
  // Actually, standard blackjack "soft" display:
  // If sum > 21, we have to reduce.
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces -= 1;
  }

  // After adjustment, if we still have "flexible" aces (those counted as 11)
  // we can show both values if the difference doesn't bust.
  // In our loop above, 'sum' is the highest possible value <= 21 or the lowest > 21.
  // If sum <= 21 and we count one ace as 11 (the rest as 1), it's "soft".
  // If we reduced ALL aces to 1, it's "hard".

  if (aces > 0 && sum <= 21) {
    // This sum has at least one Ace counted as 11.
    // The "hard" value would be sum - 10.
    const hardValue = sum - 10;
    if (hardValue > 0) {
      return `${hardValue} / ${sum}`;
    }
  }

  return sum.toString();
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

