/**
 * Google Maps Performance Configuration
 * Optimizes Google Maps usage for better performance and accuracy
 */

// Detect production environment
const isProduction = () => {
  const hostname = window?.location?.hostname;
  return hostname && !hostname.includes("localhost") && !hostname.includes("127.0.0.1");
};

export const MAPS_PERFORMANCE_CONFIG = {
  // Reduce API calls by using simpler methods - disabled in production to prevent fallback issues
  // In production, use full geocoding to avoid incorrect city fallbacks
  USE_SIMPLIFIED_GEOCODING: !isProduction(),
  
  // Cache settings
  GEOCODING_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  AUTOCOMPLETE_CACHE_DURATION: 2 * 60 * 1000, // 2 minutes
  
  // Request throttling
  MIN_GEOCODING_INTERVAL: 1000, // 1 second between geocoding requests
  MIN_AUTOCOMPLETE_INTERVAL: 300, // 300ms between autocomplete requests
  
  // Fallback to local data when possible - disabled in production to prevent city switching
  PREFER_LOCAL_FALLBACK: !isProduction(),

  // Disable coordinate-based city fallback in production
  DISABLE_COORDINATE_FALLBACK: isProduction(),
  
  // Limit the number of autocomplete suggestions
  MAX_AUTOCOMPLETE_SUGGESTIONS: 5,
  
  // Disable advanced features for better performance
  DISABLE_ADVANCED_MARKERS: false, // Can be set to true for better performance
  DISABLE_PLACE_DETAILS: false, // Can be set to true to reduce API calls
  
  // Map styling options
  USE_LIGHTWEIGHT_MAP_STYLES: true,
  
  // Enable/disable specific features
  FEATURES: {
    REVERSE_GEOCODING: true,
    AUTOCOMPLETE: true,
    PLACE_DETAILS: true,
    NEARBY_SEARCH: false, // Disable to reduce API calls
    DIRECTIONS: true,
  }
};

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (feature: keyof typeof MAPS_PERFORMANCE_CONFIG.FEATURES): boolean => {
  return MAPS_PERFORMANCE_CONFIG.FEATURES[feature];
};

/**
 * Get cache duration for a specific service
 */
export const getCacheDuration = (service: 'geocoding' | 'autocomplete'): number => {
  return service === 'geocoding' 
    ? MAPS_PERFORMANCE_CONFIG.GEOCODING_CACHE_DURATION
    : MAPS_PERFORMANCE_CONFIG.AUTOCOMPLETE_CACHE_DURATION;
};

/**
 * Get minimum request interval for throttling
 */
export const getMinRequestInterval = (service: 'geocoding' | 'autocomplete'): number => {
  return service === 'geocoding'
    ? MAPS_PERFORMANCE_CONFIG.MIN_GEOCODING_INTERVAL
    : MAPS_PERFORMANCE_CONFIG.MIN_AUTOCOMPLETE_INTERVAL;
};
