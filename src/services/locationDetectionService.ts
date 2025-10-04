import { config, getApiUrl, shouldUseBackend } from "../config/env";

export interface DetectedLocationData {
  full_address: string;
  city: string;
  state?: string;
  country?: string;
  pincode?: string;
  house_number?: string;
  building_name?: string;
  street_name?: string;
  neighborhood?: string;
  landmark?: string;
  formatted_address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  detection_method: "gps" | "ip" | "manual" | "autocomplete" | "precise_gps";
  accuracy?: number;
  confidence_score?: number;
}

export interface LocationAvailabilityResponse {
  success: boolean;
  is_available: boolean;
  message?: string;
  error?: string;
}

export interface DetectedLocationResponse {
  success: boolean;
  data?: any;
  is_available?: boolean;
  error?: string;
}

export class LocationDetectionService {
  private static instance: LocationDetectionService;
  private apiBaseUrl: string;

  constructor() {
    // Use centralized API URL configuration
    this.apiBaseUrl = shouldUseBackend() ? getApiUrl() : null;
  }

  public static getInstance(): LocationDetectionService {
    if (!LocationDetectionService.instance) {
      LocationDetectionService.instance = new LocationDetectionService();
    }
    return LocationDetectionService.instance;
  }

  /**
   * Save detected location to backend
   */
  async saveDetectedLocation(
    locationData: DetectedLocationData,
  ): Promise<DetectedLocationResponse> {
    try {
      console.log("📍 Saving detected location:", locationData);

      if (!this.apiBaseUrl) {
        console.warn("⚠️ No API URL configured for location detection");
        return {
          success: false,
          error: "API not configured",
        };
      }

      const response = await fetch(`${this.apiBaseUrl}/detected-locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(locationData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Location saved to backend:", result);

      return result;
    } catch (error) {
      console.error("❌ Failed to save detected location:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if location is available for service
   */
  async checkLocationAvailability(
    city: string,
    pincode?: string,
    fullAddress?: string,
    coordinates?: { lat: number; lng: number },
  ): Promise<LocationAvailabilityResponse> {
    try {
      // Validate that city is provided and not empty
      if (!city || city.trim() === "") {
        console.warn("⚠️ City is empty or undefined, using fallback value");
        city = "unknown";
      }

      // Always perform local check as primary method for consistency
      console.log("🔍 Checking location availability:", { city, pincode, fullAddress });

      if (!this.apiBaseUrl || !shouldUseBackend()) {
        // Use local check when backend is not available
        const localResult = this.checkAvailabilityLocal(city, pincode, coordinates, fullAddress);
        console.log("📍 Local availability check result:", localResult);
        return localResult;
      }

      const requestData = {
        city: city.trim(),
        pincode: pincode?.trim() || undefined,
        full_address: fullAddress?.trim() || undefined,
        coordinates: coordinates || undefined,
      };

      console.log("🌐 Backend request data:", requestData);

      const response = await fetch(
        `${this.apiBaseUrl}/detected-locations/check-availability`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        },
      );

      const responseText = await response.text();
      console.log("🌐 Backend response text:", responseText);

      if (!response.ok) {
        console.warn(`❌ Backend availability check failed (${response.status}): ${responseText}`);
        console.warn("Falling back to local check");
        const localResult = this.checkAvailabilityLocal(city, pincode, coordinates, fullAddress);
        console.log("📍 Fallback local availability check result:", localResult);
        return localResult;
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("❌ Failed to parse backend response:", parseError);
        console.log("Falling back to local check");
        return this.checkAvailabilityLocal(city, pincode, coordinates, fullAddress);
      }

      console.log("✅ Backend availability check result:", result);
      return result;
    } catch (error) {
      console.error("❌ Failed to check availability:", error);
      // Fallback to local check
      return this.checkAvailabilityLocal(city, pincode, coordinates, fullAddress);
    }
  }

  /**
   * Check if coordinates are in Sector 69, Gurugram using bounding box
   */
  private isInSector69(lat: number, lng: number): boolean {
    // Bounding box for Sector 69, Gurugram
    const minLat = 28.3940;
    const maxLat = 28.3980;
    const minLng = 77.0350;
    const maxLng = 77.0390;

    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  }

  /**
   * Local fallback for availability check
   */
  private checkAvailabilityLocal(
    city: string,
    pincode?: string,
    coordinates?: { lat: number; lng: number },
    fullAddress?: string,
  ): LocationAvailabilityResponse {
    const normalizedCity = city?.toLowerCase().trim();

    // Define available cities - extended to all Gurugram/Gurgaon
    const availableCities = ["gurgaon", "gurugram"];

    // Check if city matches Gurgaon or Gurugram
    const isAvailableCity = availableCities.some((availableCity) => {
      return normalizedCity?.includes(availableCity) ||
             fullAddress?.toLowerCase().includes(availableCity);
    });

    if (isAvailableCity) {
      return {
        success: true,
        is_available: true,
        message: "Service available in Gurugram/Gurgaon",
      };
    }

    // If no matches found
    return {
      success: true,
      is_available: false,
      message: "Service currently available only in Gurugram/Gurgaon area.",
    };
  }

  /**
   * Detect location using browser geolocation API
   */
  async detectLocationGPS(): Promise<DetectedLocationData | null> {
    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocation not supported");
      }

      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000, // 5 minutes
          });
        },
      );

      const { latitude, longitude } = position.coords;
      console.log("📍 GPS coordinates detected:", { latitude, longitude });

      // Try to get address from coordinates using reverse geocoding
      const addressData = await this.reverseGeocode(latitude, longitude);

      if (addressData) {
        return {
          ...addressData,
          coordinates: { lat: latitude, lng: longitude },
          detection_method: "gps",
        };
      }

      return {
        full_address: `Coordinates: ${latitude}, ${longitude}`,
        city: "Unknown",
        coordinates: { lat: latitude, lng: longitude },
        detection_method: "gps",
      };
    } catch (error) {
      console.error("❌ GPS detection failed:", error);
      return null;
    }
  }

  /**
   * High-precision GPS detection with multiple geocoding providers for Quick Pickup
   */
  async detectPreciseLocationGPS(): Promise<DetectedLocationData | null> {
    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocation not supported");
      }

      console.log("🎯 Starting high-precision location detection...");

      // Request high-accuracy position with more aggressive settings
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000, // Longer timeout for better accuracy
            maximumAge: 0, // Always get fresh location
          });
        },
      );

      const { latitude, longitude, accuracy } = position.coords;
      console.log("🎯 High-precision GPS coordinates:", {
        latitude,
        longitude,
        accuracy: accuracy ? `${accuracy}m` : 'unknown'
      });

      // Try multiple geocoding providers for best results
      const geocodingResults = await this.multiProviderGeocode(latitude, longitude);

      if (geocodingResults.length > 0) {
        // Use the best result (highest confidence)
        const bestResult = geocodingResults[0];

        return {
          ...bestResult,
          coordinates: { lat: latitude, lng: longitude },
          detection_method: "precise_gps",
          accuracy: accuracy,
          confidence_score: bestResult.confidence_score || 0.9,
        };
      }

      // Fallback if no geocoding worked
      return {
        full_address: `High-precision coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        city: "Unknown",
        coordinates: { lat: latitude, lng: longitude },
        detection_method: "precise_gps",
        accuracy: accuracy,
      };
    } catch (error) {
      console.error("❌ High-precision GPS detection failed:", error);
      return null;
    }
  }

  /**
   * Multi-provider geocoding for best accuracy
   */
  private async multiProviderGeocode(lat: number, lng: number): Promise<DetectedLocationData[]> {
    const results: DetectedLocationData[] = [];

    try {
      // Try Google Maps first (most accurate for Indian addresses)
      console.log("🗺️ Trying Google Maps geocoding...");
      const googleResult = await this.geocodeWithGoogle(lat, lng);
      if (googleResult) {
        results.push({ ...googleResult, confidence_score: 0.95 });
      }
    } catch (error) {
      console.warn("Google Maps geocoding failed:", error);
    }

    try {
      // Try Nominatim (OpenStreetMap) as backup
      console.log("🌍 Trying Nominatim geocoding...");
      const nominatimResult = await this.geocodeWithNominatim(lat, lng);
      if (nominatimResult) {
        results.push({ ...nominatimResult, confidence_score: 0.8 });
      }
    } catch (error) {
      console.warn("Nominatim geocoding failed:", error);
    }

    // Sort by confidence score
    results.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));

    console.log(`🎯 Geocoding results: ${results.length} providers successful`);
    return results;
  }

  /**
   * Geocode with Google Maps API
   */
  private async geocodeWithGoogle(lat: number, lng: number): Promise<Omit<DetectedLocationData, "coordinates" | "detection_method"> | null> {
    if (!(window as any).google?.maps) {
      throw new Error("Google Maps not available");
    }

    const geocoder = new (window as any).google.maps.Geocoder();
    const result = await new Promise((resolve, reject) => {
      geocoder.geocode(
        { location: { lat, lng } },
        (results: any, status: any) => {
          if (status === "OK" && results[0]) {
            resolve(results[0]);
          } else {
            reject(new Error("Google geocoding failed"));
          }
        },
      );
    });

    return this.parseGoogleMapsResult(result);
  }

  /**
   * Geocode with Nominatim (OpenStreetMap)
   */
  private async geocodeWithNominatim(lat: number, lng: number): Promise<Omit<DetectedLocationData, "coordinates" | "detection_method"> | null> {
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
    nominatimUrl.searchParams.set('lat', lat.toString());
    nominatimUrl.searchParams.set('lon', lng.toString());
    nominatimUrl.searchParams.set('format', 'json');
    nominatimUrl.searchParams.set('addressdetails', '1');
    nominatimUrl.searchParams.set('zoom', '18'); // Maximum detail
    nominatimUrl.searchParams.set('extratags', '1'); // Additional building info

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'QuickPickupApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error("Nominatim request failed");
    }

    const data = await response.json();
    return this.parseNominatimResult(data);
  }

  /**
   * Reverse geocode coordinates to address with enhanced house number detection
   */
  private async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<Omit<
    DetectedLocationData,
    "coordinates" | "detection_method"
  > | null> {
    try {
      // Try Google Maps Geocoding API if available (more accurate for house numbers)
      if ((window as any).google?.maps) {
        const geocoder = new (window as any).google.maps.Geocoder();
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode(
            { location: { lat, lng } },
            (results: any, status: any) => {
              if (status === "OK" && results[0]) {
                resolve(results[0]);
              } else {
                reject(new Error("Geocoding failed"));
              }
            },
          );
        });

        return this.parseGoogleMapsResult(result);
      }

      // Enhanced Nominatim request for more detailed address info
      const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
      nominatimUrl.searchParams.set('lat', lat.toString());
      nominatimUrl.searchParams.set('lon', lng.toString());
      nominatimUrl.searchParams.set('format', 'json');
      nominatimUrl.searchParams.set('addressdetails', '1');
      nominatimUrl.searchParams.set('zoom', '18'); // Higher zoom for more detailed address

      const response = await fetch(nominatimUrl.toString());

      if (!response.ok) throw new Error("Nominatim request failed");

      const data = await response.json();

      // Enhanced address parsing to include house numbers and building names
      const addressComponents = [];
      const address = data.address || {};

      // Add house number if available
      if (address.house_number) {
        addressComponents.push(address.house_number);
      }

      // Add building or house name
      if (address.building || address.house) {
        addressComponents.push(address.building || address.house);
      }

      // Add road/street
      if (address.road) {
        addressComponents.push(address.road);
      }

      // Add neighborhood/suburb
      if (address.neighbourhood || address.suburb) {
        addressComponents.push(address.neighbourhood || address.suburb);
      }

      // Add sector or residential area
      if (address.residential) {
        addressComponents.push(address.residential);
      }

      // Add city/town
      const city = address.city || address.town || address.village || "Unknown";
      if (city !== "Unknown") {
        addressComponents.push(city);
      }

      // Add state
      if (address.state) {
        addressComponents.push(address.state);
      }

      // Add postal code
      if (address.postcode) {
        addressComponents.push(address.postcode);
      }

      const enhancedAddress = addressComponents.length > 0
        ? addressComponents.join(', ')
        : (data.display_name || "Unknown address");

      return {
        full_address: enhancedAddress,
        city: city,
        state: address.state || "",
        country: address.country || "India",
        pincode: address.postcode || "",
      };
    } catch (error) {
      console.error("❌ Reverse geocoding failed:", error);
      return null;
    }
  }

  /**
   * Parse Google Maps geocoding result with enhanced address component extraction
   */
  private parseGoogleMapsResult(
    result: any,
  ): Omit<DetectedLocationData, "coordinates" | "detection_method"> {
    const components = result.address_components || [];

    let houseNumber = "";
    let route = "";
    let neighborhood = "";
    let sublocality = "";
    let city = "";
    let state = "";
    let country = "";
    let pincode = "";
    let buildingName = "";
    let landmark = "";

    components.forEach((component: any) => {
      const types = component.types || [];

      if (types.includes("street_number")) {
        houseNumber = component.long_name;
      } else if (types.includes("route")) {
        route = component.long_name;
      } else if (types.includes("neighborhood")) {
        neighborhood = component.long_name;
      } else if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
        sublocality = component.long_name;
      } else if (types.includes("premise") || types.includes("establishment")) {
        buildingName = component.long_name;
      } else if (types.includes("point_of_interest")) {
        landmark = component.long_name;
      } else if (
        types.includes("locality") ||
        types.includes("administrative_area_level_2")
      ) {
        city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        state = component.long_name;
      } else if (types.includes("country")) {
        country = component.long_name;
      } else if (types.includes("postal_code")) {
        pincode = component.long_name;
      }
    });

    // Build comprehensive address with all available details
    const addressParts = [];

    if (houseNumber) addressParts.push(houseNumber);
    if (buildingName) addressParts.push(buildingName);
    if (route) addressParts.push(route);
    if (neighborhood) addressParts.push(neighborhood);
    if (sublocality) addressParts.push(sublocality);
    if (city) addressParts.push(city);
    if (state) addressParts.push(state);
    if (pincode) addressParts.push(pincode);

    const enhancedAddress = addressParts.length > 0
      ? addressParts.join(', ')
      : (result.formatted_address || "Unknown address");

    return {
      full_address: enhancedAddress,
      formatted_address: result.formatted_address || enhancedAddress,
      city: city || "Unknown",
      state,
      country: country || "India",
      pincode,
      house_number: houseNumber,
      building_name: buildingName,
      street_name: route,
      neighborhood: neighborhood || sublocality,
      landmark: landmark,
    };
  }

  /**
   * Parse Nominatim result with detailed address extraction
   */
  private parseNominatimResult(data: any): Omit<DetectedLocationData, "coordinates" | "detection_method"> {
    const address = data.address || {};

    // Extract detailed components
    const houseNumber = address.house_number || "";
    const buildingName = address.building || address.house || "";
    const streetName = address.road || "";
    const neighborhood = address.neighbourhood || address.suburb || address.residential || "";
    const city = address.city || address.town || address.village || "Unknown";
    const state = address.state || "";
    const country = address.country || "India";
    const pincode = address.postcode || "";
    const landmark = address.amenity || address.shop || "";

    // Build comprehensive address
    const addressParts = [];

    if (houseNumber) addressParts.push(houseNumber);
    if (buildingName) addressParts.push(buildingName);
    if (streetName) addressParts.push(streetName);
    if (neighborhood) addressParts.push(neighborhood);
    if (city !== "Unknown") addressParts.push(city);
    if (state) addressParts.push(state);
    if (pincode) addressParts.push(pincode);

    const enhancedAddress = addressParts.length > 0
      ? addressParts.join(', ')
      : (data.display_name || "Unknown address");

    return {
      full_address: enhancedAddress,
      formatted_address: data.display_name || enhancedAddress,
      city: city,
      state,
      country,
      pincode,
      house_number: houseNumber,
      building_name: buildingName,
      street_name: streetName,
      neighborhood: neighborhood,
      landmark: landmark,
    };
  }
}
