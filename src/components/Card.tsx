/**
 * Card component for displaying playing cards with 3D flip animation
 * @param {Object} props
 * @param {string} props.suit - The suit of the card: 'clubs', 'diamonds', 'hearts', or 'spades'
 * @param {string|number} props.value - The value of the card: 2-10, 'jack', 'queen', 'king', or 'ace'
 * @param {number} props.width - Width of the card in pixels (default: 120)
 * @param {number} props.height - Height of the card in pixels (default: 168)
 * @param {boolean} props.hidden - Show the back of the card (default: false)
 * @param {boolean} props.isFlipped - Whether the card is flipped to show its face (for animation)
 * @param {boolean} props.isInteractive - Whether the card can be clicked to flip
 * @param {function} props.onFlip - Callback when card is flipped
 * @param {boolean} props.glowing - Show glowing effect (for interactive cards)
 * @param {string} props.className - Additional CSS classes
 */

import { useState, useEffect } from 'react';

interface CardProps {
  suit?: 'clubs' | 'diamonds' | 'hearts' | 'spades';
  value?: number | string;
  width?: number;
  height?: number;
  hidden?: boolean;
  isFlipped?: boolean;
  isInteractive?: boolean;
  onFlip?: () => void;
  glowing?: boolean;
  className?: string;
  dealDelay?: number; // Delay before card appears (for dealing animation)
}

export default function Card({
  suit,
  value,
  width = 120,
  height = 168,
  hidden = false,
  isFlipped = true,
  isInteractive = false,
  onFlip,
  glowing = false,
  className = '',
  dealDelay = 0
}: CardProps) {
  const [isDealt, setIsDealt] = useState(dealDelay === 0);
  const [localFlipped, setLocalFlipped] = useState(isFlipped);

  // Handle deal animation delay
  useEffect(() => {
    if (dealDelay > 0) {
      const timer = setTimeout(() => {
        setIsDealt(true);
      }, dealDelay);
      return () => clearTimeout(timer);
    }
  }, [dealDelay]);

  // Sync with external flip state
  useEffect(() => {
    setLocalFlipped(isFlipped);
  }, [isFlipped]);

  const handleClick = () => {
    if (isInteractive && onFlip) {
      onFlip();
    }
  };

  // Validate suit
  const validSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
  if (suit && !validSuits.includes(suit)) {
    console.error(`Invalid suit: ${suit}. Must be one of: ${validSuits.join(', ')}`);
    return null;
  }

  // Validate and normalize value
  const validValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'jack', 'queen', 'king', 'ace'];
  const normalizedValue = value ? String(value).toLowerCase() : '';

  if (value && !validValues.includes(Number(normalizedValue)) && !validValues.includes(normalizedValue)) {
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
  const frontImagePath = suit ? `/poker-cards/${suit}/${filenameValue}.png` : '';
  const backImagePath = '/poker-cards/back.png';

  // If just hidden (legacy behavior), show back
  if (hidden) {
    return (
      <div className={`inline-block ${className}`}>
        <img
          src={backImagePath}
          alt="Card Back"
          width={width}
          height={height}
          className="object-contain rounded-lg"
        />
      </div>
    );
  }

  // If missing suit/value and not hidden
  if (!suit || !value) {
    return null;
  }

  return (
    <div
      className={`inline-block ${className}`}
      style={{
        perspective: '1000px',
        opacity: isDealt ? 1 : 0,
        transform: isDealt ? 'translateY(0)' : 'translateY(-50px)',
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
      }}
    >
      <div
        onClick={handleClick}
        className={`relative ${isInteractive ? 'cursor-pointer' : ''}`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: localFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
        }}
      >
        {/* Glowing effect for interactive cards */}
        {glowing && isInteractive && !localFlipped && (
          <div
            className="absolute inset-0 rounded-lg animate-pulse"
            style={{
              boxShadow: '0 0 20px 5px rgba(255, 215, 0, 0.6), 0 0 40px 10px rgba(255, 215, 0, 0.3)',
              zIndex: 10,
            }}
          />
        )}

        {/* Front face (the actual card) */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <img
            src={frontImagePath}
            alt={`${normalizedValue} of ${suit}`}
            width={width}
            height={height}
            className="object-contain rounded-lg"
          />
        </div>

        {/* Back face */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <img
            src={backImagePath}
            alt="Card Back"
            width={width}
            height={height}
            className="object-contain rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
