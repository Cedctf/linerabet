/**
 * Card component for displaying playing cards
 * @param {Object} props
 * @param {string} props.suit - The suit of the card: 'clubs', 'diamonds', 'hearts', or 'spades'
 * @param {string|number} props.value - The value of the card: 2-10, 'jack', 'queen', 'king', or 'ace'
 * @param {number} props.width - Width of the card in pixels (default: 120)
 * @param {number} props.height - Height of the card in pixels (default: 168)
 * @param {boolean} props.variant - Use variant version (2) for face cards (default: false)
 * @param {string} props.className - Additional CSS classes
 */

interface CardProps {
  suit: 'clubs' | 'diamonds' | 'hearts' | 'spades';
  value: number | string;
  width?: number;
  height?: number;
  variant?: boolean;
  className?: string;
}

export default function Card({ 
  suit, 
  value, 
  width = 120, 
  height = 168, 
  variant = false,
  className = '' 
}: CardProps) {
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

  // Construct the filename
  const faceCards = ['jack', 'queen', 'king'];
  const isFaceCard = faceCards.includes(normalizedValue);
  // Automatically use variant (2.svg) for J, Q, K; use variant prop for ace
  const shouldUseVariant = isFaceCard || (variant && normalizedValue === 'ace');
  const variantSuffix = shouldUseVariant ? '2' : '';
  const filename = `${normalizedValue}_of_${suit}${variantSuffix}.svg`;
  const imagePath = `/Playing Cards/SVG-cards-1.3/${filename}`;

  return (
    <div className={`inline-block ${className}`}>
      <img
        src={imagePath}
        alt={`${normalizedValue} of ${suit}`}
        width={width}
        height={height}
        className="object-contain"
      />
    </div>
  );
}

