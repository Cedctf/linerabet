/**
 * Card component for displaying playing cards
 * @param {Object} props
 * @param {string} props.suit - The suit of the card: 'clubs', 'diamonds', 'hearts', or 'spades'
 * @param {string|number} props.value - The value of the card: 2-10, 'jack', 'queen', 'king', or 'ace'
 * @param {number} props.width - Width of the card in pixels (default: 120)
 * @param {number} props.height - Height of the card in pixels (default: 168)
 * @param {boolean} props.hidden - Show the back of the card (default: false)
 * @param {string} props.className - Additional CSS classes
 */

interface CardProps {
  suit?: 'clubs' | 'diamonds' | 'hearts' | 'spades';
  value?: number | string;
  width?: number;
  height?: number;
  hidden?: boolean;
  className?: string;
}

export default function Card({
  suit,
  value,
  width = 120,
  height = 168,
  hidden = false,
  className = ''
}: CardProps) {
  // If hidden, show the back of the card
  if (hidden) {
    return (
      <div className={`inline-block ${className}`}>
        <img
          src="/poker-cards/back.png"
          alt="Card Back"
          width={width}
          height={height}
          className="object-contain rounded-lg"
        />
      </div>
    );
  }

  // Use default rendering if suit/value are missing but not hidden (should generally not happen if typed correctly)
  if (!suit || !value) {
    return null;
  }

  // Validate suit
  const validSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
  if (!validSuits.includes(suit)) {
    console.error(`Invalid suit: ${suit}. Must be one of: ${validSuits.join(', ')}`);
    return null;
  }

  // Validate and normalize value
  const validValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'jack', 'queen', 'king', 'ace'];
  const normalizedValue = String(value).toLowerCase();

  if (!validValues.includes(Number(normalizedValue)) && !validValues.includes(normalizedValue)) {
    console.error(`Invalid value: ${value}. Must be one of: ${validValues.join(', ')}`);
    return null;
  }

  // Map value to filename (A, J, Q, K, or number)
  let filenameValue = normalizedValue;
  if (normalizedValue === 'ace') filenameValue = 'A';
  else if (normalizedValue === 'jack') filenameValue = 'J';
  else if (normalizedValue === 'queen') filenameValue = 'Q';
  else if (normalizedValue === 'king') filenameValue = 'K';

  // Construct the filename
  const imagePath = `/poker-cards/${suit}/${filenameValue}.png`;

  return (
    <div className={`inline-block ${className}`}>
      <img
        src={imagePath}
        alt={`${normalizedValue} of ${suit}`}
        width={width}
        height={height}
        className="object-contain rounded-lg"
      />
    </div>
  );
}

