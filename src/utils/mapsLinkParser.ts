/**
 * Utility to parse Google Maps links and extract coordinates
 */

export interface ParsedMapsLink {
  coordinates: { lat: number; lng: number } | null;
  address: string | null;
  placeId: string | null;
  error: string | null;
}

/**
 * Parse various Google Maps URL formats to extract latitude and longitude
 * Supports:
 * - https://www.google.com/maps/place/.../@12.9716,77.5946,17z
 * - https://maps.google.com/?q=12.9716,77.5946
 * - https://www.google.com/maps/search/.../@lat,lng,z
 * - Direct coordinates like "12.9716,77.5946"
 */
export const parseGoogleMapsLink = (mapsUrl: string): ParsedMapsLink => {
  const result: ParsedMapsLink = {
    coordinates: null,
    address: null,
    placeId: null,
    error: null,
  };

  if (!mapsUrl || typeof mapsUrl !== "string" || mapsUrl.trim() === "") {
    result.error = "URL is empty or invalid";
    return result;
  }

  const url = mapsUrl.trim();

  try {
    // Try to match coordinates in @lat,lng format (common in Google Maps share links)
    // Pattern: /@(-?\d+\.?\d*),(-?\d+\.?\d*)
    const coordPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const coordMatch = url.match(coordPattern);

    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        result.coordinates = { lat, lng };
        return result;
      }
    }

    // Try to match q= parameter (Google Maps search query)
    // Pattern: ?q=lat,lng or &q=lat,lng
    const qParamPattern = /[?&]q=([^&]+)/;
    const qMatch = url.match(qParamPattern);

    if (qMatch) {
      const qValue = decodeURIComponent(qMatch[1]);
      // Try to extract coordinates from q value
      const qCoordPattern = /(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const qCoordMatch = qValue.match(qCoordPattern);

      if (qCoordMatch) {
        const lat = parseFloat(qCoordMatch[1]);
        const lng = parseFloat(qCoordMatch[2]);

        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          result.coordinates = { lat, lng };
          return result;
        }
      }

      // If q param contains an address, store it
      if (qValue && !qValue.match(/^\d+\.\d+/)) {
        result.address = qValue;
      }
    }

    // Try to extract place ID if present
    // Pattern: /place/...+...+pid...
    const pidPattern = /\/place\/([^/@?]+)/;
    const pidMatch = url.match(pidPattern);

    if (pidMatch) {
      result.placeId = pidMatch[1];
    }

    // Try to match direct coordinates if just numbers separated by comma
    if (url.match(/^-?\d+\.?\d*,-?\d+\.?\d*$/)) {
      const parts = url.split(",");
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        result.coordinates = { lat, lng };
        return result;
      }
    }

    // If we got here, we couldn't find coordinates
    if (!result.coordinates) {
      result.error = "Could not extract coordinates from the provided URL. Please ensure it's a valid Google Maps link.";
    }

    return result;
  } catch (error) {
    result.error = `Error parsing URL: ${error instanceof Error ? error.message : "Unknown error"}`;
    return result;
  }
};

/**
 * Validate if a string looks like a Google Maps URL
 */
export const isGoogleMapsUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;

  const mapsPatterns = [
    /google\.com\/maps/i,
    /maps\.google\./i,
    /goo\.gl\/maps/i,
    //@-?\d+\.?\d*,-?\d+\.?\d*/, // coordinates pattern
    /^-?\d+\.?\d*,-?\d+\.?\d*$/, // direct coordinates
  ];

  return mapsPatterns.some(pattern => pattern.test(url));
};

/**
 * Format coordinates as a Google Maps URL
 */
export const createGoogleMapsUrl = (lat: number, lng: number, zoom: number = 17): string => {
  return `https://www.google.com/maps/@${lat},${lng},${zoom}z`;
};

/**
 * Extract formatted address from Google Maps search URL
 */
export const extractAddressFromMapsUrl = (mapsUrl: string): string | null => {
  const url = mapsUrl.trim();

  // Try to get address from search query
  const searchPattern = /\/maps\/search\/([^/@?]+)/;
  const searchMatch = url.match(searchPattern);

  if (searchMatch) {
    return decodeURIComponent(searchMatch[1]).replace(/\+/g, " ");
  }

  // Try to get from q parameter
  const qParamPattern = /[?&]q=([^&]+)/;
  const qMatch = url.match(qParamPattern);

  if (qMatch) {
    const qValue = decodeURIComponent(qMatch[1]);
    // Make sure it's not just coordinates
    if (!qValue.match(/^-?\d+\.?\d*,-?\d+\.?\d*$/)) {
      return qValue;
    }
  }

  return null;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
