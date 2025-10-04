
import React from 'react';

const StarRating = ({ rating, size = 'sm' }) => {
  const stars = Array.from({ length: 5 }, (_, index) => {
    const filled = index < Math.floor(rating);
    const halfFilled = index === Math.floor(rating) && rating % 1 !== 0;
    
    const sizeClass = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
    
    return (
      <span
        key={index}
        className={`${sizeClass} inline-block`}
      >
        {filled ? (
          <span className="text-amber-400">★</span>
        ) : halfFilled ? (
          <span className="text-amber-400">☆</span>
        ) : (
          <span className="text-gray-300">☆</span>
        )}
      </span>
    );
  });

  return <div className="flex items-center space-x-1">{stars}</div>;
};

export default StarRating;
