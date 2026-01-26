/**
 * Extract coordinates from various Google Maps link formats
 * Supports:
 * - https://maps.google.com/?q=40.7128,-74.0060
 * - https://www.google.com/maps/place/40.7128,-74.0060
 * - https://maps.google.com/maps?q=loc:40.7128,-74.0060
 * - https://goo.gl/maps/xxxxx (returns null - needs reverse lookup)
 * @param {string} googleMapsLink - Google Maps URL
 * @returns {object|null} - { lat: number, lng: number } or null if invalid
 */
function extractCoordinatesFromGoogleMapsLink(googleMapsLink) {
  if (!googleMapsLink || typeof googleMapsLink !== 'string') {
    return null;
  }

  // Trim and decode URL encoding
  const link = decodeURIComponent(googleMapsLink.trim());

  // Pattern 1: q=40.7128,-74.0060 (direct coordinates in query param)
  const pattern1 = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const match1 = link.match(pattern1);
  if (match1) {
    return {
      lat: parseFloat(match1[1]),
      lng: parseFloat(match1[2]),
    };
  }

  // Pattern 2: /place/40.7128,-74.0060 or @40.7128,-74.0060
  const pattern2 = /(?:place|@)(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const match2 = link.match(pattern2);
  if (match2) {
    return {
      lat: parseFloat(match2[1]),
      lng: parseFloat(match2[2]),
    };
  }

  // Pattern 3: loc:40.7128,-74.0060
  const pattern3 = /loc:(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const match3 = link.match(pattern3);
  if (match3) {
    return {
      lat: parseFloat(match3[1]),
      lng: parseFloat(match3[2]),
    };
  }

  // Pattern 4: Maps embed format with @lat,lng,zoom
  const pattern4 = /@(-?\d+\.?\d*),(-?\d+\.?\d*),/;
  const match4 = link.match(pattern4);
  if (match4) {
    return {
      lat: parseFloat(match4[1]),
      lng: parseFloat(match4[2]),
    };
  }

  // No valid coordinates found
  return null;
}

/**
 * Validate coordinates format
 * @param {object} coordinates - { lat: number, lng: number }
 * @returns {boolean} - true if valid
 */
function validateCoordinates(coordinates) {
  if (!coordinates || typeof coordinates !== 'object') {
    return false;
  }

  const { lat, lng } = coordinates;
  
  // Latitude: -90 to 90
  // Longitude: -180 to 180
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

module.exports = {
  extractCoordinatesFromGoogleMapsLink,
  validateCoordinates,
};
