import React from 'react';
import { MapPin, Search, Clock, Bell, User } from 'lucide-react';

/**
 * Advanced Mobile Header Component
 * Features: Glassmorphism, smooth animations, optimal touch targets
 */
export const AdvancedMobileHeader: React.FC<{
  logo: React.ReactNode;
  title: string;
  subtitle?: string;
  actions: React.ReactNode;
  hasPendingNotification?: boolean;
}> = ({ logo, title, subtitle, actions, hasPendingNotification }) => {
  return (
    <header className="mobile-header sticky top-0 z-40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            {logo}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="mobile-header-brand truncate">{title}</h1>
            {subtitle && <p className="mobile-card-subtitle truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="mobile-header-actions flex-shrink-0">
          {hasPendingNotification && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
};

/**
 * Advanced Mobile Search Component
 * Features: Voice search integration, icon placement, focus states
 */
export const AdvancedMobileSearch: React.FC<{
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onVoiceSearch?: () => void;
  icon?: React.ReactNode;
}> = ({ placeholder = "Search services", value, onChange, onVoiceSearch, icon }) => {
  return (
    <div className="mobile-search-container px-4 py-2">
      <div className="relative">
        <div className="mobile-search-icon">
          {icon || <Search size={20} />}
        </div>
        <input
          type="text"
          className="mobile-search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Search"
        />
        {onVoiceSearch && (
          <button
            onClick={onVoiceSearch}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
            aria-label="Voice search"
            type="button"
          >
            🎤
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Advanced Mobile Chip Filter Component
 * Features: Horizontal scroll, snap points, active state animations
 */
export const AdvancedMobileChips: React.FC<{
  items: Array<{ id: string; label: string; icon?: string }>;
  activeId?: string;
  onChange: (id: string) => void;
}> = ({ items, activeId, onChange }) => {
  return (
    <div className="mobile-chip-container px-4">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`mobile-chip ${activeId === item.id ? 'active' : ''}`}
          type="button"
        >
          {item.icon && <span className="mr-1">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Advanced Mobile Location Card
 * Features: Glassmorphism, interactive location selection, visual hierarchy
 */
export const AdvancedMobileLocationCard: React.FC<{
  location: string;
  deliveryTime: string;
  onLocationClick: () => void;
  isRequestingLocation?: boolean;
  onQuickPickup: () => void;
}> = ({ location, deliveryTime, onLocationClick, isRequestingLocation, onQuickPickup }) => {
  return (
    <div className="px-4 py-3">
      <div className="mobile-card mobile-card-full relative overflow-hidden">
        <div className="mobile-card-header">
          <div>
            <div className="mobile-card-title flex items-center gap-2">
              <Clock size={18} />
              <span>Delivery in {deliveryTime}</span>
            </div>
          </div>
          <div className="mobile-card-badge">Available</div>
        </div>

        <div
          onClick={onLocationClick}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity my-3"
        >
          <MapPin size={16} className={isRequestingLocation ? 'animate-pulse' : ''} />
          <span className="mobile-card-subtitle">
            {isRequestingLocation ? 'Detecting...' : location}
          </span>
        </div>

        <button
          onClick={onQuickPickup}
          className="mobile-button mobile-button-primary w-full mt-3"
          type="button"
        >
          <span>⚡ Quick Pickup</span>
        </button>
      </div>
    </div>
  );
};

/**
 * Advanced Mobile Service Card
 * Features: Hover effects, quantity controls, action buttons
 */
export const AdvancedMobileServiceCard: React.FC<{
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  image?: string;
  isPopular?: boolean;
  quantity?: number;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  onViewDetails: () => void;
}> = ({
  id,
  name,
  category,
  price,
  unit,
  image,
  isPopular,
  quantity = 0,
  onAddToCart,
  onRemoveFromCart,
  onViewDetails,
}) => {
  return (
    <div className="mobile-card h-full flex flex-col">
      {/* Image Section */}
      <div className="relative mb-3 aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-2xl">
            {category[0]}
          </div>
        )}
        {isPopular && (
          <div className="absolute top-2 right-2 mobile-card-badge bg-red-500 border-0">
            Popular
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 flex flex-col">
        <h3 className="mobile-card-title line-clamp-2 mb-1">{name}</h3>
        <p className="mobile-card-subtitle text-xs mb-3">{category}</p>

        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-lg font-bold">₹{price}</span>
          <span className="text-xs text-gray-400">{unit}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex gap-2 mt-auto">
        {quantity > 0 ? (
          <div className="flex items-center gap-1 flex-1">
            <button
              onClick={onRemoveFromCart}
              className="mobile-button mobile-button-secondary mobile-button-sm flex-1"
              type="button"
            >
              −
            </button>
            <span className="font-semibold min-w-[30px] text-center">{quantity}</span>
            <button
              onClick={onAddToCart}
              className="mobile-button mobile-button-primary mobile-button-sm flex-1"
              type="button"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={onAddToCart}
            className="mobile-button mobile-button-primary mobile-button-sm flex-1"
            type="button"
          >
            Add
          </button>
        )}
        <button
          onClick={onViewDetails}
          className="mobile-button mobile-button-secondary mobile-button-sm flex-1"
          type="button"
        >
          Details
        </button>
      </div>
    </div>
  );
};

/**
 * Advanced Mobile Grid Layout
 * Features: Responsive columns, optimized spacing for mobile
 */
export const AdvancedMobileGrid: React.FC<{
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}> = ({ children, columns = 2 }) => {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
  }[columns];

  return (
    <div className={`mobile-grid ${gridClass} px-4 py-4`}>
      {children}
    </div>
  );
};

/**
 * Advanced Mobile Bottom Sheet (Modal)
 * Features: Native mobile feel, swipe-friendly, proper safe area handling
 */
export const AdvancedMobileBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showHandle?: boolean;
}> = ({ isOpen, onClose, title, children, showHandle = true }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="mobile-modal-overlay" onClick={onClose} />
      <div className="mobile-bottom-sheet mobile-safe-area-bottom">
        {showHandle && <div className="mobile-bottom-sheet-handle" />}
        {title && <h2 className="text-lg font-bold px-6 py-4">{title}</h2>}
        <div className="mobile-bottom-sheet-content">
          {children}
        </div>
      </div>
    </>
  );
};

/**
 * Advanced Mobile Floating Action Button Group
 * Features: Multiple actions, smooth animations, proper positioning
 */
export const AdvancedMobileFABGroup: React.FC<{
  primary: { icon: React.ReactNode; onClick: () => void; label?: string };
  secondary?: Array<{ icon: React.ReactNode; onClick: () => void; label?: string }>;
}> = ({ primary, secondary }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="mobile-fab-group">
      {isExpanded && secondary && (
        <>
          {secondary.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                item.onClick();
                setIsExpanded(false);
              }}
              className="mobile-fab"
              title={item.label}
              type="button"
              style={{
                animation: `slideUp ${150 + index * 50}ms ease-out`,
              }}
            >
              {item.icon}
            </button>
          ))}
        </>
      )}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mobile-fab"
        title={primary.label}
        type="button"
      >
        {primary.icon}
      </button>
    </div>
  );
};

/**
 * Advanced Mobile Loading Skeleton
 * Features: Shimmer animation, realistic placeholders
 */
export const AdvancedMobileSkeleton: React.FC<{
  variant?: 'card' | 'text' | 'image';
  className?: string;
}> = ({ variant = 'card', className = '' }) => {
  const baseClass = 'mobile-skeleton';
  
  if (variant === 'text') {
    return <div className={`${baseClass} h-4 w-3/4 rounded-md ${className}`} />;
  }
  if (variant === 'image') {
    return <div className={`${baseClass} aspect-square rounded-lg ${className}`} />;
  }
  
  return (
    <div className={`${baseClass} rounded-xl p-4 ${className}`}>
      <div className={`${baseClass} h-24 rounded-lg mb-3`} />
      <div className={`${baseClass} h-4 w-full rounded-md mb-2`} />
      <div className={`${baseClass} h-4 w-2/3 rounded-md`} />
    </div>
  );
};

/**
 * Advanced Mobile Empty State
 * Features: Compelling design, clear call to action
 */
export const AdvancedMobileEmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {icon && <div className="text-4xl mb-4">{icon}</div>}
      <h2 className="mobile-section-title text-center">{title}</h2>
      {description && (
        <p className="mobile-card-subtitle text-center mb-6">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mobile-button mobile-button-primary"
          type="button"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
