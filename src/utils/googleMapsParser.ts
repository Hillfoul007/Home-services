/**
 * Google Maps Link Parser
 * Extracts coordinates from various Google Maps URL formats
 */

export interface GoogleMapsCoordinates {
  lat: number;
  lng: number;
}

/**
 * Parse various Google Maps URL formats to extract coordinates
 * Supports:
 * - https://maps.google.com/?q=28.3984,77.0648
 * - https://www.google.com/maps/place/...@28.3984,77.0648
 * - https://www.google.com/maps/search/...@28.3984,77.0648
 * - Shortened URLs (requires resolving)
 */
export function parseGoogleMapsLink(url: string): GoogleMapsCoordinates | null {
  if (!url || typeof url !== 'string') {
    console.warn('❌ Invalid URL provided');
    return null;
  }

  try {
    // Normalize the URL
    const normalizedUrl = url.trim().toLowerCase();

    // Pattern 1: @lat,lng format (most common in modern Google Maps URLs)
    const coordinatePattern = /@([-\d.]+),([-\d.]+)/;
    const coordinateMatch = normalizedUrl.match(coordinatePattern);
    if (coordinateMatch) {
      const lat = parseFloat(coordinateMatch[1]);
      const lng = parseFloat(coordinateMatch[2]);
      if (isValidCoordinate(lat, lng)) {
        console.log('✅ Found coordinates from @lat,lng format:', { lat, lng });
        return { lat, lng };
      }
    }

    // Pattern 2: ?q=lat,lng format (Google Maps direct link)
    const qPattern = /[?&]q=([-\d.]+),([-\d.]+)/;
    const qMatch = normalizedUrl.match(qPattern);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lng = parseFloat(qMatch[2]);
      if (isValidCoordinate(lat, lng)) {
        console.log('✅ Found coordinates from ?q=lat,lng format:', { lat, lng });
        return { lat, lng };
      }
    }

    // Pattern 3: Extract from place or search URLs with coordinates in the middle
    const placePattern = /maps\/(place|search)\/([^@]+)@([-\d.]+),([-\d.]+)/;
    const placeMatch = normalizedUrl.match(placePattern);
    if (placeMatch) {
      const lat = parseFloat(placeMatch[3]);
      const lng = parseFloat(placeMatch[4]);
      if (isValidCoordinate(lat, lng)) {
        console.log('✅ Found coordinates from place/search URL:', { lat, lng });
        return { lat, lng };
      }
    }

    console.warn('⚠️ Could not parse coordinates from URL:', url);
    return null;

  } catch (error) {
    console.error('❌ Error parsing Google Maps link:', error);
    return null;
  }
}

/**
 * Validate if coordinates are within valid ranges
 * Latitude: -90 to 90
 * Longitude: -180 to 180
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

/**
 * Generate a Google Maps link from coordinates
 */
export function generateGoogleMapsLink(lat: number, lng: number): string {
  if (!isValidCoordinate(lat, lng)) {
    console.warn('❌ Invalid coordinates for link generation');
    return '';
  }
  return `https://www.google.com/maps/search/${lat},${lng}/@${lat},${lng},15z`;
}

/**
 * Extract all coordinate pairs from a URL
 * Returns the first valid pair found
 */
export function extractCoordinatesFromUrl(url: string): GoogleMapsCoordinates | null {
  return parseGoogleMapsLink(url);
}
