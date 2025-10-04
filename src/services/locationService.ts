// Simplified location service without Supabase dependencies
// This is a stub implementation for demo purposes

import { apiClient } from "@/lib/api";
import { getErrorMessage, logError } from '@/lib/error-utils';
import { MAPS_PERFORMANCE_CONFIG, isFeatureEnabled, getCacheDuration, getMinRequestInterval } from "../config/mapsConfig";
import { performanceMonitor, trackPerformance } from "../utils/mapsPerformanceMonitor";

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface LocationData {
  id: string;
  address: string;
  coordinates: Coordinates;
  name?: string;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceAutocomplete {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GeocodeResult {
  coordinates: Coordinates;
  formatted_address: string;
  place_id?: string;
}

class LocationService {
  private readonly GOOGLE_MAPS_API_KEY = import.meta.env
    .VITE_GOOGLE_MAPS_API_KEY;

  // Simple cache to avoid duplicate API calls
  private geocodeCache = new Map<string, any>();
  private readonly CACHE_DURATION = getCacheDuration('geocoding');

  // Request throttling
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = getMinRequestInterval('geocoding');

  /**
   * Get user's current position using browser geolocation with enhanced accuracy
   */
  async getCurrentPosition(options?: PositionOptions): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      let bestPosition: GeolocationPosition | null = null;
      let attempts = 0;
      const maxAttempts = 3;
      const timeout = 15000;

      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 20000, // Increased timeout for better accuracy
        maximumAge: 0, // Always get fresh position for accuracy
        ...options,
      };

      console.log("�� Requesting geolocation with options:", defaultOptions);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };

          console.log("✅ Geolocation success:", {
            ...coords,
            timestamp: new Date(position.timestamp).toISOString(),
            heading: position.coords.heading,
            speed: position.coords.speed,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
          });

          resolve(coords);
        },
        (error) => {
          const errorMessage = getErrorMessage(error);
          logError("LocationService.getCurrentPosition", error);
          reject(new Error(errorMessage));
        },
        defaultOptions,
      );
    });
  }

  /**
   * Reverse geocode coordinates to human-readable address with maximum detail including area/village
   */
  async reverseGeocode(coordinates: Coordinates): Promise<string> {
    const startTime = Date.now();
    console.log("🔍 Starting enhanced reverse geocoding for:", coordinates);
    console.log("🔧 Current geocoding config:", {
      useSimplified: MAPS_PERFORMANCE_CONFIG.USE_SIMPLIFIED_GEOCODING,
      hasApiKey: !!this.GOOGLE_MAPS_API_KEY,
      reverseGeocodingEnabled: isFeatureEnabled('REVERSE_GEOCODING')
    });

    // Use simplified geocoding if enabled for better performance
    // BUT skip simplified in production to prevent fallback city issues
    if (MAPS_PERFORMANCE_CONFIG.USE_SIMPLIFIED_GEOCODING && !MAPS_PERFORMANCE_CONFIG.DISABLE_COORDINATE_FALLBACK) {
      console.log("🔄 Using simplified geocoding (development mode)");
      return this.simplifiedReverseGeocode(coordinates);
    }

    console.log("🔍 Using full geocoding (production mode or fallback disabled)");

    // Method 1: Google Maps API with multiple result types for maximum detail
    if (this.GOOGLE_MAPS_API_KEY && isFeatureEnabled('REVERSE_GEOCODING')) {
      try {
        // Make multiple requests prioritizing street-level detail
        // Optimized: Use only ONE comprehensive request instead of 5 separate requests
        const requests = [
          // Single comprehensive request with all result types
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&language=en&region=IN&key=${this.GOOGLE_MAPS_API_KEY}`,
        ];

        for (const requestUrl of requests) {
          try {
            // Check cache first
            const cacheKey = requestUrl;
            const cached = this.geocodeCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
              console.log('🚀 Using cached Google Maps result');
              const prioritizedResult = this.selectBestGoogleMapsResult(cached.data.results);
              if (prioritizedResult) {
                return this.formatEnhancedIndianAddress(
                  prioritizedResult.address_components,
                  prioritizedResult.formatted_address,
                  "google_maps",
                );
              }
            }

            // Request throttling
            const now = Date.now();
            if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL) {
              await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime)));
            }
            this.lastRequestTime = Date.now();

            // Add timeout to prevent hanging requests that cause fallback
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

            const response = await fetch(requestUrl, {
              method: 'GET',
              // Don't set content-type header for Google Maps API to avoid CORS issues
              mode: "cors",
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              console.warn(
                `Google Maps API returned ${response.status}: ${response.statusText}`,
              );
              continue;
            }

            const data = await response.json();

            // Cache the result
            this.geocodeCache.set(cacheKey, {
              data,
              timestamp: Date.now()
            });

            if (data.status === "OK" && data.results.length > 0) {
              // Enhanced prioritization for street-level details
              const streetAddressResult = data.results.find((result) =>
                result.types.includes("street_address"),
              );

              const premiseResult = data.results.find(
                (result) =>
                  result.types.includes("premise") ||
                  result.types.includes("subpremise"),
              );

              const routeResult = data.results.find(
                (result) =>
                  result.types.includes("route") ||
                  result.types.includes("intersection"),
              );

              // Use the most detailed result available
              const prioritizedResult = this.selectBestGoogleMapsResult(data.results);

              console.log(
                "✅ Google Maps street-level result:",
                prioritizedResult,
              );
              console.log("🏠 Result types:", prioritizedResult.types);

              // Extract and format detailed components
              const addressComponents = this.extractDetailedComponents(
                prioritizedResult.address_components,
              );
              const enhancedAddress =
                this.formatEnhancedIndianAddress(addressComponents);

              // Only return if we have meaningful street-level detail
              if (
                enhancedAddress &&
                (addressComponents.street_number ||
                  addressComponents.route ||
                  addressComponents.premise ||
                  enhancedAddress.length > 15)
              ) {
                console.log("✅ Street-level address found:", enhancedAddress);
                return enhancedAddress;
              }

              return prioritizedResult.formatted_address;
            }
          } catch (requestError) {
            console.warn(
              "Google Maps request failed, trying next:",
              requestError,
            );
            continue;
          }
        }
      } catch (error) {
        console.warn("Google Maps enhanced reverse geocoding failed:", error);
      }
    }

    // Method 2: Enhanced Nominatim with maximum zoom for street-level detail
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&zoom=19&addressdetails=1&extratags=1&namedetails=1&accept-language=en&countrycodes=in`,
        {
          headers: {
            "User-Agent": "CleanCarePro-LocationService/1.0",
            Accept: "application/json",
          },
          mode: "cors",
        },
      );

      if (!response.ok) {
        console.warn(
          `Nominatim API returned ${response.status}: ${response.statusText}`,
        );
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data && data.address) {
        console.log("✅ Nominatim enhanced result:", data);

        // Extract detailed Indian address components
        const enhancedAddress = this.formatDetailedNominatimAddress(
          data.address,
        );
        return enhancedAddress || data.display_name;
      }
    } catch (error) {
      console.warn("Nominatim enhanced reverse geocoding failed:", error);
    }

    // Method 3: Alternative reverse geocoding service
    try {
      // Use a CORS-friendly reverse geocoding service
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${coordinates.lat}+${coordinates.lng}&key=demo&language=en&countrycode=in&limit=1`,
        {
          headers: {
            Accept: "application/json",
          },
          mode: "cors",
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.results && data.results.length > 0) {
          console.log("✅ OpenCage enhanced result:", data.results[0]);
          return data.results[0].formatted;
        }
      }
    } catch (error) {
      console.warn("OpenCage reverse geocoding failed:", error);
    }

    // Method 4: Fallback with coordinate-based address
    const formattedCoords = await this.formatCoordinatesAsAddress(coordinates);

    // Track performance
    performanceMonitor.trackAPICall('reverseGeocode', startTime, true);

    return formattedCoords;
  }

  /**
   * Simplified reverse geocoding that uses fewer API calls and focuses on basic location info
   * Enhanced to prevent incorrect fallback to city names
   */
  private async simplifiedReverseGeocode(coordinates: Coordinates): Promise<string> {
    console.log("🚀 Using simplified reverse geocoding for better performance");
    console.log("📍 Coordinates to geocode:", coordinates);

    // Check cache first
    const cacheKey = `simplified_${coordinates.lat}_${coordinates.lng}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log('🚀 Using cached simplified result:', cached.data);
      return cached.data;
    }

    // Try Google Maps API with single request first
    if (this.GOOGLE_MAPS_API_KEY) {
      try {
        // Request throttling
        const now = Date.now();
        if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL) {
          await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime)));
        }
        this.lastRequestTime = Date.now();

        console.log("🔍 Making Google Maps geocoding request...");

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&language=en&region=IN&key=${this.GOOGLE_MAPS_API_KEY}`,
          {
            method: 'GET',
            mode: 'cors',
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log("📍 Google Maps API response:", data);

          if (data.status === "OK" && data.results.length > 0) {
            const address = data.results[0].formatted_address;
            console.log("✅ Google Maps geocoding successful:", address);

            // Cache the result
            this.geocodeCache.set(cacheKey, {
              data: address,
              timestamp: Date.now()
            });

            return address;
          } else {
            console.warn("⚠️ Google Maps API returned status:", data.status, "Error:", data.error_message);
          }
        } else {
          console.warn("⚠️ Google Maps API HTTP error:", response.status, response.statusText);
        }
      } catch (error) {
        console.error("❌ Google Maps geocoding request failed:", error);
      }
    } else {
      console.warn("⚠️ No Google Maps API key available for geocoding");
    }

    // Try Nominatim as a more reliable fallback before using coordinate-based fallback
    try {
      console.log("🔄 Trying Nominatim as fallback...");
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&zoom=16&addressdetails=1&accept-language=en`,
        {
          headers: {
            "User-Agent": "CleanCarePro-LocationService/1.0",
            Accept: "application/json",
          },
          mode: "cors",
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("📍 Nominatim response:", data);

        if (data && data.display_name) {
          const address = data.display_name;
          console.log("✅ Nominatim geocoding successful:", address);

          // Cache the result
          this.geocodeCache.set(cacheKey, {
            data: address,
            timestamp: Date.now()
          });

          return address;
        }
      } else {
        console.warn("⚠️ Nominatim API HTTP error:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("❌ Nominatim geocoding failed:", error);
    }

    // Final fallback - use coordinate-based location as last resort
    // Check if coordinate fallback is disabled (to prevent production city switching issues)
    if (MAPS_PERFORMANCE_CONFIG.DISABLE_COORDINATE_FALLBACK) {
      console.warn("⚠️ All geocoding services failed, coordinate fallback disabled in production");
      const genericResult = `Location ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`;

      // Cache the generic result
      this.geocodeCache.set(cacheKey, {
        data: genericResult,
        timestamp: Date.now()
      });

      return genericResult;
    }

    console.warn("⚠️ All geocoding services failed, using coordinate-based fallback");
    const fallbackResult = this.getFallbackLocationName(coordinates);

    // Cache even the fallback to avoid repeated failures
    this.geocodeCache.set(cacheKey, {
      data: fallbackResult,
      timestamp: Date.now()
    });

    return fallbackResult;
  }

  /**
   * Get fallback location name based on coordinates (without API calls)
   * Note: This method should only be used as a last resort to avoid incorrect location detection
   */
  private getFallbackLocationName(coordinates: Coordinates): string {
    // Basic location detection based on coordinates for Indian locations
    const { lat, lng } = coordinates;

    console.log("⚠️ Using fallback location detection for coordinates:", { lat, lng });

    // More precise coordinate ranges to avoid overlaps
    // Gurgaon/Gurugram region (prioritize this since it's the service area)
    if (lat >= 28.35 && lat <= 28.55 && lng >= 76.95 && lng <= 77.15) {
      console.log("📍 Detected Gurugram region");
      return "Gurugram, Haryana, India";
    }

    // Delhi NCR region (excluding Gurgaon)
    if (lat >= 28.45 && lat <= 28.75 && lng >= 77.0 && lng <= 77.5) {
      console.log("📍 Detected Delhi NCR region");
      return "Delhi NCR, India";
    }

    // Mumbai region
    if (lat >= 18.9 && lat <= 19.3 && lng >= 72.7 && lng <= 73.1) {
      console.log("📍 Detected Mumbai region");
      return "Mumbai, Maharashtra, India";
    }

    // Bangalore region
    if (lat >= 12.8 && lat <= 13.1 && lng >= 77.4 && lng <= 77.8) {
      console.log("📍 Detected Bangalore region");
      return "Bangalore, Karnataka, India";
    }

    // Chennai region
    if (lat >= 12.8 && lat <= 13.2 && lng >= 80.1 && lng <= 80.3) {
      console.log("📍 Detected Chennai region");
      return "Chennai, Tamil Nadu, India";
    }

    // Default fallback - return coordinates without presuming location
    console.log("⚠️ No known region matched, using coordinate-based fallback");
    return `Location near ${lat.toFixed(4)}, ${lng.toFixed(4)}, India`;
  }

  /**
   * Select the best result from Google Maps geocoding results
   */
  private selectBestGoogleMapsResult(results: any[]): any {
    if (!results || results.length === 0) return null;

    // Prioritize by result type quality
    const streetAddressResult = results.find((result) =>
      result.types.includes("street_address"),
    );

    const premiseResult = results.find(
      (result) =>
        result.types.includes("premise") ||
        result.types.includes("subpremise"),
    );

    const routeResult = results.find(
      (result) =>
        result.types.includes("route") ||
        result.types.includes("intersection"),
    );

    return streetAddressResult || premiseResult || routeResult || results[0];
  }

  /**
   * Extract detailed components from Google Maps address components with enhanced Indian address support
   */
  private extractDetailedComponents(components: any[]): any {
    const extracted: any = {};

    components.forEach((component) => {
      const types = component.types;
      const longName = component.long_name;
      const shortName = component.short_name;

      // Enhanced extraction for Indian address components with street-level priority
      if (types.includes("street_number")) {
        extracted.street_number = longName;
        extracted.has_street_number = true; // Flag for street-level detection
      } else if (types.includes("route")) {
        extracted.route = longName;
        extracted.has_route = true; // Flag for street detection
      } else if (types.includes("intersection")) {
        extracted.intersection = longName;
      } else if (
        types.includes("political") &&
        types.includes("sublocality_level_3")
      ) {
        extracted.sublocality_level_3 = longName;
      } else if (types.includes("sublocality_level_2")) {
        extracted.sublocality_level_2 = longName;
      } else if (types.includes("sublocality_level_1")) {
        extracted.sublocality_level_1 = longName;
      } else if (types.includes("sublocality")) {
        extracted.sublocality = longName;
      } else if (types.includes("neighborhood")) {
        extracted.neighborhood = longName;
      } else if (types.includes("premise")) {
        extracted.premise = longName;
      } else if (types.includes("subpremise")) {
        extracted.subpremise = longName;
      } else if (types.includes("locality")) {
        extracted.locality = longName;
      } else if (types.includes("administrative_area_level_4")) {
        extracted.area_level_4 = longName; // Village/ward level
      } else if (types.includes("administrative_area_level_3")) {
        extracted.area_level_3 = longName; // Tehsil/Block level
      } else if (types.includes("administrative_area_level_2")) {
        extracted.area_level_2 = longName; // District level
      } else if (types.includes("administrative_area_level_1")) {
        extracted.state = longName;
      } else if (types.includes("postal_code")) {
        extracted.postal_code = longName;
      } else if (types.includes("country")) {
        extracted.country = longName;
      }
    });

    console.log("🔍 Extracted address components:", extracted);
    return extracted;
  }

  /**
   * Format enhanced Indian address from Google Maps components with street-level priority
   */
  private formatEnhancedIndianAddress(components: any): string {
    // Enhanced address formatting prioritizing street-level details
    const addressParts = [];

    // House/Building number (prioritize street number)
    if (components.street_number) {
      addressParts.push(components.street_number);
    }

    // Building/Premise details
    if (components.subpremise) {
      addressParts.push(components.subpremise);
    } else if (
      components.premise &&
      components.premise !== components.street_number
    ) {
      addressParts.push(components.premise);
    }

    // Street/Road name (critical for detailed addressing)
    if (components.route) {
      addressParts.push(components.route);
    } else if (components.intersection) {
      addressParts.push(`Near ${components.intersection}`);
    }

    // Area/Locality details (in order of specificity)
    const areaDetails = [
      components.neighborhood,
      components.sublocality_level_3,
      components.sublocality_level_2,
      components.sublocality_level_1,
      components.sublocality,
    ].filter(Boolean);

    if (areaDetails.length > 0) {
      // Avoid duplication - only add unique area names
      const uniqueAreas = [...new Set(areaDetails)];
      addressParts.push(...uniqueAreas);
    }

    // City/Town
    if (components.locality) {
      addressParts.push(components.locality);
    }

    // Administrative areas (if different from city)
    const adminAreas = [
      components.area_level_4, // Village/Ward
      components.area_level_3, // Tehsil/Block
      components.area_level_2, // District
    ]
      .filter(Boolean)
      .filter((area) => area !== components.locality);

    if (adminAreas.length > 0) {
      addressParts.push(...adminAreas);
    }

    // State
    if (components.state) {
      addressParts.push(components.state);
    }

    // Postal code
    if (components.postal_code) {
      addressParts.push(components.postal_code);
    }

    const formattedAddress = addressParts.join(", ");
    console.log("📝 Formatted Indian address:", formattedAddress);

    return formattedAddress;
  }

  /**
   * Format detailed address from Nominatim response for Indian locations
   */
  private formatDetailedNominatimAddress(address: any): string {
    const parts = [
      address.house_number,
      address.road,
      address.neighbourhood,
      address.suburb,
      address.village,
      address.town,
      address.city_district,
      address.city,
      address.county,
      address.state_district,
      address.state,
      address.postcode,
    ].filter(Boolean);

    return parts.join(", ");
  }

  /**
   * Extract house number from Indian address string
   */
  extractHouseNumber(address: string): {
    houseNumber: string;
    building: string;
    cleanedAddress: string;
  } {
    let houseNumber = "";
    let building = "";
    let cleanedAddress = address;

    // Split address into parts
    const parts = address.split(",").map((part) => part.trim());
    const firstPart = parts[0] || "";

    // Pattern 1: Simple house numbers (123, 45, etc.) - but not pincodes
    const simpleNumberMatch = firstPart.match(/^\s*(\d+)\s*$/);
    if (simpleNumberMatch && !simpleNumberMatch[1].match(/^\d{6}$/)) {
      houseNumber = simpleNumberMatch[1];
      cleanedAddress = parts.slice(1).join(", ").trim();
      return { houseNumber, building, cleanedAddress };
    }

    // Pattern 2: House number with suffix (123A, 45B, etc.)
    const numberSuffixMatch = firstPart.match(/^\s*(\d+[A-Z]+)\s*$/i);
    if (numberSuffixMatch) {
      houseNumber = numberSuffixMatch[1].toUpperCase();
      cleanedAddress = parts.slice(1).join(", ").trim();
      return { houseNumber, building, cleanedAddress };
    }

    // Pattern 3: Alphanumeric formats (A-123, B/45, Plot-67, etc.)
    const alphaNumericMatch = firstPart.match(
      /^\s*([A-Z]*[-\/]?\d+[A-Z]*)\s*$/i,
    );
    if (alphaNumericMatch) {
      houseNumber = alphaNumericMatch[1].toUpperCase();
      cleanedAddress = parts.slice(1).join(", ").trim();
      return { houseNumber, building, cleanedAddress };
    }

    // Pattern 4: House number with description (House No 123, Plot 45, etc.)
    const houseDescMatch = firstPart.match(
      /(house\s+no\.?|plot\s+no\.?|flat\s+no\.?|door\s+no\.?|#)\s*(\d+[A-Z]*)/i,
    );
    if (houseDescMatch) {
      houseNumber = houseDescMatch[2];
      cleanedAddress =
        firstPart.replace(houseDescMatch[0], "").trim() +
        ", " +
        parts.slice(1).join(", ");
      cleanedAddress = cleanedAddress.replace(/^,\s*/, "").trim();
      return { houseNumber, building, cleanedAddress };
    }

    // Pattern 5: Building with flat number (Flat 23, Tower A, etc.)
    const buildingFlatMatch = firstPart.match(
      /(flat|apartment|unit)\s*(\d+[A-Z]*),?\s*(.*)/i,
    );
    if (buildingFlatMatch) {
      houseNumber = buildingFlatMatch[2];
      building = buildingFlatMatch[3] || "";
      cleanedAddress =
        (building ? building + ", " : "") + parts.slice(1).join(", ");
      return { houseNumber, building, cleanedAddress };
    }

    // Pattern 6: Complex building formats (Tower A-123, Block B-45, etc.)
    const complexMatch = firstPart.match(
      /(tower|block|wing|building)\s*([A-Z0-9]*[-\/]?\d+[A-Z]*)/i,
    );
    if (complexMatch) {
      houseNumber = complexMatch[2];
      building = complexMatch[1] + " " + complexMatch[2].split(/[-\/]/)[0];
      cleanedAddress = parts.slice(1).join(", ").trim();
      return { houseNumber, building, cleanedAddress };
    }

    // Pattern 7: Extract any number from first part
    const anyNumberMatch = firstPart.match(/(\d+)/);
    if (anyNumberMatch) {
      houseNumber = anyNumberMatch[1];
      // Try to extract building name from the remaining part
      const buildingPart = firstPart.replace(anyNumberMatch[0], "").trim();
      if (buildingPart.length > 2) {
        building = buildingPart.replace(/[,-]/g, "").trim();
      }
      cleanedAddress = parts.slice(1).join(", ").trim();
    }

    return { houseNumber, building, cleanedAddress };
  }

  /**
   * Get detailed address components from coordinates
   */
  async getDetailedAddressComponents(coordinates: Coordinates): Promise<any> {
    console.log("🔍 Getting detailed address components...");

    if (this.GOOGLE_MAPS_API_KEY) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&key=${this.GOOGLE_MAPS_API_KEY}`,
        );

        const data = await response.json();

        if (data.status === "OK" && data.results.length > 0) {
          console.log("✅ Detailed components from Google:", data.results[0]);
          return data.results[0];
        }
      } catch (error) {
        console.warn("Google Maps component extraction failed:", error);
      }
    }

    // Fallback to Nominatim for detailed components
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&zoom=20&addressdetails=1`,
        {
          headers: {
            "User-Agent": "LaundaryFlash-App/1.0",
          },
        },
      );

      const data = await response.json();

      if (data && data.address) {
        console.log("✅ Detailed components from Nominatim:", data);
        // Convert Nominatim format to Google-like format
        return {
          formatted_address: data.display_name,
          address_components: this.convertNominatimToGoogleFormat(data.address),
          geometry: {
            location: {
              lat: () => parseFloat(data.lat),
              lng: () => parseFloat(data.lon),
            },
          },
        };
      }
    } catch (error) {
      console.warn("Nominatim component extraction failed:", error);
    }

    return null;
  }

  /**
   * Convert Nominatim address format to Google Maps format
   */
  private convertNominatimToGoogleFormat(nominatimAddress: any): any[] {
    const components = [];

    if (nominatimAddress.house_number) {
      components.push({
        long_name: nominatimAddress.house_number,
        short_name: nominatimAddress.house_number,
        types: ["street_number"],
      });
    }

    if (nominatimAddress.road) {
      components.push({
        long_name: nominatimAddress.road,
        short_name: nominatimAddress.road,
        types: ["route"],
      });
    }

    if (nominatimAddress.neighbourhood || nominatimAddress.suburb) {
      components.push({
        long_name: nominatimAddress.neighbourhood || nominatimAddress.suburb,
        short_name: nominatimAddress.neighbourhood || nominatimAddress.suburb,
        types: ["sublocality_level_1", "sublocality"],
      });
    }

    if (
      nominatimAddress.city ||
      nominatimAddress.town ||
      nominatimAddress.village
    ) {
      components.push({
        long_name:
          nominatimAddress.city ||
          nominatimAddress.town ||
          nominatimAddress.village,
        short_name:
          nominatimAddress.city ||
          nominatimAddress.town ||
          nominatimAddress.village,
        types: ["locality"],
      });
    }

    if (nominatimAddress.state) {
      components.push({
        long_name: nominatimAddress.state,
        short_name: nominatimAddress.state,
        types: ["administrative_area_level_1"],
      });
    }

    if (nominatimAddress.postcode) {
      components.push({
        long_name: nominatimAddress.postcode,
        short_name: nominatimAddress.postcode,
        types: ["postal_code"],
      });
    }

    if (nominatimAddress.country) {
      components.push({
        long_name: nominatimAddress.country,
        short_name:
          nominatimAddress.country_code?.toUpperCase() ||
          nominatimAddress.country,
        types: ["country"],
      });
    }

    return components;
  }

  /**
   * Format coordinates as a readable address using geographical context
   */
  private async formatCoordinatesAsAddress(
    coordinates: Coordinates,
  ): Promise<string> {
    // Check if coordinates are in known regions (India focus)
    const { lat, lng } = coordinates;

    // India bounding box check
    if (lat >= 6.0 && lat <= 37.6 && lng >= 68.7 && lng <= 97.25) {
      // Rough region detection for India
      let region = "India";

      if (lat >= 28.4 && lat <= 28.8 && lng >= 76.8 && lng <= 77.3) {
        region = "Gurgaon, Haryana, India";
      } else if (lat >= 28.5 && lat <= 28.7 && lng >= 77.1 && lng <= 77.3) {
        region = "New Delhi, India";
      } else if (lat >= 19.0 && lat <= 19.3 && lng >= 72.7 && lng <= 73.0) {
        region = "Mumbai, Maharashtra, India";
      } else if (lat >= 12.8 && lat <= 13.1 && lng >= 77.4 && lng <= 77.8) {
        region = "Bangalore, Karnataka, India";
      } else if (lat >= 17.3 && lat <= 17.5 && lng >= 78.3 && lng <= 78.6) {
        region = "Hyderabad, Telangana, India";
      }

      return `${lat.toFixed(4)}, ${lng.toFixed(4)}, ${region}`;
    }

    // Default coordinates display
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  /**
   * Geocode address to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    if (!this.GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API key not configured");
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.GOOGLE_MAPS_API_KEY}`,
      );

      const data = await response.json();

      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        return {
          coordinates: {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          },
          formatted_address: result.formatted_address,
          place_id: result.place_id,
        };
      }

      throw new Error(`Geocoding failed: ${data.status}`);
    } catch (error) {
      throw new Error(
        `Geocoding error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get place autocomplete suggestions with enhanced types
   */
  async getPlaceAutocomplete(
    input: string,
    location?: Coordinates,
    radius?: number,
  ): Promise<PlaceAutocomplete[]> {
    if (!this.GOOGLE_MAPS_API_KEY) {
      return [];
    }

    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${this.GOOGLE_MAPS_API_KEY}&components=country:in&types=address|establishment|geocode`;

      if (location) {
        url += `&location=${location.lat},${location.lng}`;
        if (radius) {
          url += `&radius=${radius}`;
        }
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK") {
        return data.predictions || [];
      }

      return [];
    } catch (error) {
      console.warn("Place autocomplete failed:", error);
      return [];
    }
  }

  /**
   * Search for nearby places of interest
   */
  async getNearbyPlaces(
    coordinates: Coordinates,
    radius: number = 500,
    type?: string,
  ): Promise<any[]> {
    if (!this.GOOGLE_MAPS_API_KEY) {
      return [];
    }

    try {
      let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=${radius}&key=${this.GOOGLE_MAPS_API_KEY}`;

      if (type) {
        url += `&type=${type}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK") {
        return data.results || [];
      }

      return [];
    } catch (error) {
      console.warn("Nearby places search failed:", error);
      return [];
    }
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    if (!this.GOOGLE_MAPS_API_KEY) {
      return null;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,types,rating,vicinity&key=${this.GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK") {
        return data.result;
      }

      return null;
    } catch (error) {
      console.warn("Place details failed:", error);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(coord2.lat - coord1.lat);
    const dLon = this.deg2rad(coord2.lng - coord1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(coord1.lat)) *
        Math.cos(this.deg2rad(coord2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Mock methods for database operations (previously Supabase)
   */
  async saveLocationToDatabase(
    locationData: LocationData,
  ): Promise<LocationData> {
    // Mock implementation - save to localStorage
    const existingLocations = JSON.parse(
      localStorage.getItem("saved_locations") || "[]",
    );
    existingLocations.push(locationData);
    localStorage.setItem("saved_locations", JSON.stringify(existingLocations));
    return locationData;
  }

  async getSavedLocations(): Promise<LocationData[]> {
    // Mock implementation - load from localStorage
    return JSON.parse(localStorage.getItem("saved_locations") || "[]");
  }

  async updateLocationInDatabase(
    locationId: string,
    updates: Partial<LocationData>,
  ): Promise<LocationData> {
    // Mock implementation
    const existingLocations = JSON.parse(
      localStorage.getItem("saved_locations") || "[]",
    );
    const updatedLocations = existingLocations.map((loc: LocationData) =>
      loc.id === locationId
        ? { ...loc, ...updates, updatedAt: new Date() }
        : loc,
    );
    localStorage.setItem("saved_locations", JSON.stringify(updatedLocations));
    return updatedLocations.find((loc: LocationData) => loc.id === locationId);
  }

  async deleteLocationFromDatabase(locationId: string): Promise<void> {
    // Mock implementation
    const existingLocations = JSON.parse(
      localStorage.getItem("saved_locations") || "[]",
    );
    const filteredLocations = existingLocations.filter(
      (loc: LocationData) => loc.id !== locationId,
    );
    localStorage.setItem("saved_locations", JSON.stringify(filteredLocations));
  }
}

export const locationService = new LocationService();
