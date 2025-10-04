/**
 * Modern Google Places AutocompleteSuggestion service utility
 * Replaces the deprecated AutocompleteService with the new AutocompleteSuggestion API
 */

import { MAPS_PERFORMANCE_CONFIG, isFeatureEnabled, getCacheDuration, getMinRequestInterval } from "../config/mapsConfig";

export interface AutocompletePrediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface AutocompleteRequest {
  input: string;
  includedRegionCodes?: string[];
  types?: string[];
  sessionToken?: any;
}

class AutocompleteSuggestionService {
  private AutocompleteSuggestion: any = null;
  private AutocompleteSessionToken: any = null;
  private isInitialized = false;

  // Caching for autocomplete results
  private autocompleteCache = new Map<string, any>();
  private readonly CACHE_DURATION = getCacheDuration('autocomplete');

  // Request throttling
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = getMinRequestInterval('autocomplete');

  /**
   * Initialize the AutocompleteSuggestion service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (!window.google?.maps) {
        throw new Error("Google Maps API not loaded");
      }

      const { AutocompleteSuggestion, AutocompleteSessionToken } =
        await window.google.maps.importLibrary("places");

      this.AutocompleteSuggestion = AutocompleteSuggestion;
      this.AutocompleteSessionToken = AutocompleteSessionToken;
      this.isInitialized = true;

      console.log("✅ AutocompleteSuggestion service initialized");
    } catch (error) {
      console.error(
        "❌ Failed to initialize AutocompleteSuggestion service:",
        error,
      );
      throw error;
    }
  }

  /**
   * Create a new session token for tracking autocomplete sessions
   */
  createSessionToken(): any {
    if (!this.AutocompleteSessionToken) {
      throw new Error("AutocompleteSuggestion service not initialized");
    }
    return new this.AutocompleteSessionToken();
  }

  /**
   * Fetch autocomplete suggestions using the new API
   */
  async fetchSuggestions(
    request: AutocompleteRequest,
  ): Promise<AutocompletePrediction[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.AutocompleteSuggestion) {
      throw new Error("AutocompleteSuggestion service not available");
    }

    try {
      // Check cache first
      const cacheKey = `${request.input}_${JSON.stringify(request.includedRegionCodes || ['in'])}`;
      const cached = this.autocompleteCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log('🚀 Using cached autocomplete result for:', request.input);
        return cached.data;
      }

      // Request throttling
      const now = Date.now();
      if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime)));
      }
      this.lastRequestTime = Date.now();

      const sessionToken = request.sessionToken || this.createSessionToken();

      const apiRequest = {
        input: request.input,
        sessionToken: sessionToken,
        includedRegionCodes: request.includedRegionCodes || ["in"],
      };

      const response =
        await this.AutocompleteSuggestion.fetchAutocompleteSuggestions(
          apiRequest,
        );

      if (!response.suggestions) {
        return [];
      }

      const suggestions = response.suggestions.map((suggestion: any) => {
        const placePrediction = suggestion.placePrediction;
        return {
          description: placePrediction.text,
          place_id: placePrediction.placeId,
          structured_formatting: {
            main_text:
              placePrediction.structuredFormat?.mainText ||
              placePrediction.text,
            secondary_text:
              placePrediction.structuredFormat?.secondaryText || "",
          },
        };
      });

      // Limit suggestions for better performance
      const limitedSuggestions = suggestions.slice(0, MAPS_PERFORMANCE_CONFIG.MAX_AUTOCOMPLETE_SUGGESTIONS);

      // Cache the results
      this.autocompleteCache.set(cacheKey, {
        data: limitedSuggestions,
        timestamp: Date.now()
      });

      return limitedSuggestions;
    } catch (error) {
      console.error("Error fetching autocomplete suggestions:", error);
      throw error;
    }
  }

  /**
   * Search for places in India specifically
   */
  async searchInIndia(
    input: string,
    sessionToken?: any,
  ): Promise<AutocompletePrediction[]> {
    return this.fetchSuggestions({
      input,
      includedRegionCodes: ["in"],
      sessionToken,
    });
  }

  /**
   * Search for places globally with specific region preferences
   */
  async searchGlobal(
    input: string,
    regionCodes: string[] = ["in", "us", "ca", "gb", "au"],
    sessionToken?: any,
  ): Promise<AutocompletePrediction[]> {
    return this.fetchSuggestions({
      input,
      includedRegionCodes: regionCodes,
      sessionToken,
    });
  }

  /**
   * Get place details using the new Place API (replaces deprecated PlacesService)
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!window.google?.maps?.places) {
        throw new Error("Google Maps Places API not loaded");
      }

      // Use the new Place API
      const { Place } = await window.google.maps.importLibrary("places");

      const place = new Place({
        id: placeId,
        requestedLanguage: "en", // or use user's preferred language
      });

      // Fetch the fields we need
      await place.fetchFields({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "addressComponents",
          "types",
        ],
      });

      // Convert to the format expected by existing code
      const convertedPlace = {
        place_id: place.id,
        name: place.displayName,
        formatted_address: place.formattedAddress,
        geometry: {
          location: place.location
            ? {
                lat: place.location.lat,
                lng: place.location.lng,
              }
            : null,
        },
        address_components:
          place.addressComponents?.map((component: any) => ({
            long_name: component.longText,
            short_name: component.shortText,
            types: component.types,
          })) || [],
        types: place.types || [],
      };

      return convertedPlace;
    } catch (error) {
      console.error("Error fetching place details with new Places API:", error);

      // Fallback to old API if new one fails
      return this.getPlaceDetailsLegacy(placeId);
    }
  }

  /**
   * Legacy fallback for place details using PlacesService
   */
  private async getPlaceDetailsLegacy(placeId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!window.google?.maps?.places) {
        reject(new Error("Google Maps Places API not loaded"));
        return;
      }

      const service = new window.google.maps.places.PlacesService(
        document.createElement("div"),
      );

      service.getDetails(
        {
          placeId: placeId,
          fields: [
            "place_id",
            "name",
            "formatted_address",
            "geometry",
            "address_components",
            "types",
          ],
        },
        (place, status) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            place
          ) {
            resolve(place);
          } else {
            reject(new Error(`PlacesService error: ${status}`));
          }
        },
      );
    });
  }

  /**
   * Check if the service is ready to use
   */
  isReady(): boolean {
    return (
      this.isInitialized &&
      this.AutocompleteSuggestion &&
      this.AutocompleteSessionToken
    );
  }

  /**
   * Get initialization status
   */
  getStatus(): { initialized: boolean; error?: string } {
    return {
      initialized: this.isInitialized,
      error: this.isInitialized ? undefined : "Service not initialized",
    };
  }
}

// Export singleton instance
export const autocompleteSuggestionService =
  new AutocompleteSuggestionService();

// Export convenience functions
export const searchPlacesInIndia = (input: string, sessionToken?: any) =>
  autocompleteSuggestionService.searchInIndia(input, sessionToken);

export const searchPlacesGlobal = (
  input: string,
  regionCodes?: string[],
  sessionToken?: any,
) =>
  autocompleteSuggestionService.searchGlobal(input, regionCodes, sessionToken);

export const getPlaceDetails = (placeId: string) =>
  autocompleteSuggestionService.getPlaceDetails(placeId);

export const createSessionToken = () =>
  autocompleteSuggestionService.createSessionToken();

/**
 * Enhanced address parsing and autofill utility
 */
export interface ParsedAddress {
  flatNo?: string;
  street?: string;
  area?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  formattedAddress?: string;
}

export class AddressParser {
  /**
   * Parse Google Places address components into structured format
   */
  static parseAddressComponents(place: any): ParsedAddress {
    const result: ParsedAddress = {
      formattedAddress: place.formatted_address,
    };

    if (place.geometry?.location) {
      result.coordinates = {
        lat:
          typeof place.geometry.location.lat === "function"
            ? place.geometry.location.lat()
            : place.geometry.location.lat,
        lng:
          typeof place.geometry.location.lng === "function"
            ? place.geometry.location.lng()
            : place.geometry.location.lng,
      };
    }

    if (!place.address_components) {
      // Fallback to parsing formatted address
      return this.parseFormattedAddress(place.formatted_address || "");
    }

    // Parse address components
    place.address_components.forEach((component: any) => {
      const types = component.types;
      const longName = component.long_name;
      const shortName = component.short_name;

      if (types.includes("street_number")) {
        result.flatNo = longName;
      } else if (types.includes("route")) {
        result.street = longName;
      } else if (
        types.includes("sublocality_level_1") ||
        types.includes("sublocality")
      ) {
        if (!result.area) result.area = longName;
      } else if (types.includes("locality")) {
        result.city = longName;
      } else if (types.includes("administrative_area_level_1")) {
        result.state = longName;
      } else if (types.includes("postal_code")) {
        result.pincode = longName;
      } else if (types.includes("country")) {
        result.country = longName;
      } else if (
        types.includes("neighborhood") ||
        types.includes("sublocality_level_2")
      ) {
        // Use for area if not already set
        if (!result.area) result.area = longName;
      }
    });

    // If area is missing, try to construct from sublocality and locality
    if (!result.area && result.city) {
      result.area = result.city;
    }

    return result;
  }

  /**
   * Parse formatted address string when components are not available
   */
  static parseFormattedAddress(formattedAddress: string): ParsedAddress {
    const result: ParsedAddress = {
      formattedAddress,
    };

    const parts = formattedAddress.split(",").map((part) => part.trim());

    // Extract pincode
    const pincodeMatch = formattedAddress.match(/\b\d{6}\b/);
    if (pincodeMatch) {
      result.pincode = pincodeMatch[0];
    }

    // Extract potential house/flat number from first part
    if (parts.length > 0) {
      const firstPart = parts[0];
      const houseNumberPatterns = [
        /^(\d+[A-Z]?)\s+/, // "123A Main Street"
        /^([A-Z]-?\d+)\s+/, // "A-123 Main Street"
        /^(\d+\/\d+)\s+/, // "123/45 Main Street"
        /^(House|Plot|Flat|Door)\s*(No\.?)?\s*(\d+[A-Z]?)/i, // "House No 123"
        /^(\d+)\s+(Street|Road|Lane|Marg|Block)/i, // "123 Main Street"
      ];

      for (const pattern of houseNumberPatterns) {
        const match = firstPart.match(pattern);
        if (match) {
          result.flatNo = match[1] || match[3];
          // Remove house number from the part to get street name
          const streetName = firstPart.replace(pattern, "").trim();
          if (streetName) result.street = streetName;
          break;
        }
      }

      // If no house number found, use first part as street
      if (!result.street && !result.flatNo) {
        result.street = firstPart;
      }
    }

    // Process remaining parts for area, city, state
    const cleanParts = parts.filter((part) => {
      if (!part || part.length < 2) return false;
      if (part.match(/^\d{6}$/)) return false; // Skip pincode
      if (part.toLowerCase() === "india") return false; // Skip country
      if (result.flatNo && part.includes(result.flatNo)) return false; // Skip part with house number
      return true;
    });

    if (cleanParts.length >= 2) {
      // Second part is likely area/locality
      result.area = cleanParts[1];

      // Third part might be city
      if (cleanParts.length >= 3) {
        result.city = cleanParts[2];
      }

      // Last part (before country) might be state
      if (cleanParts.length >= 4) {
        result.state = cleanParts[cleanParts.length - 1];
      }
    } else if (cleanParts.length === 1) {
      result.area = cleanParts[0];
    }

    return result;
  }

  /**
   * Smart autofill that preserves existing user input
   */
  static smartAutofill(
    parsedAddress: ParsedAddress,
    currentValues: Partial<ParsedAddress>,
    options: {
      preserveUserInput?: boolean;
      overrideEmpty?: boolean;
    } = {},
  ): ParsedAddress {
    const { preserveUserInput = true, overrideEmpty = true } = options;

    const result = { ...currentValues };

    Object.keys(parsedAddress).forEach((key) => {
      const typedKey = key as keyof ParsedAddress;
      const newValue = parsedAddress[typedKey];
      const currentValue = currentValues[typedKey];

      if (newValue) {
        if (!currentValue || (!preserveUserInput && overrideEmpty)) {
          // @ts-ignore - TypeScript issue with dynamic key assignment
          result[typedKey] = newValue;
        } else if (preserveUserInput && !currentValue.toString().trim()) {
          // Only fill if current value is empty/whitespace
          // @ts-ignore
          result[typedKey] = newValue;
        }
      }
    });

    return result;
  }

  /**
   * Validate address completeness
   */
  static validateAddress(address: ParsedAddress): {
    isValid: boolean;
    missingFields: string[];
    suggestions: string[];
  } {
    const requiredFields = ["street", "area", "pincode"];
    const missingFields: string[] = [];
    const suggestions: string[] = [];

    requiredFields.forEach((field) => {
      const typedField = field as keyof ParsedAddress;
      if (!address[typedField] || !address[typedField]?.toString().trim()) {
        missingFields.push(field);
      }
    });

    // Provide suggestions based on missing fields
    if (missingFields.includes("street")) {
      suggestions.push("Add street name or road details");
    }
    if (missingFields.includes("area")) {
      suggestions.push("Specify area, locality, or neighborhood");
    }
    if (missingFields.includes("pincode")) {
      suggestions.push("Enter 6-digit pincode");
    }

    // Additional validations
    if (address.pincode && !address.pincode.match(/^\d{6}$/)) {
      suggestions.push("Pincode should be 6 digits");
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
      suggestions,
    };
  }

  /**
   * Generate display text for address
   */
  static formatDisplayAddress(address: ParsedAddress): string {
    const parts: string[] = [];

    if (address.flatNo) parts.push(address.flatNo);
    if (address.street) parts.push(address.street);
    if (address.landmark) parts.push(`Near ${address.landmark}`);
    if (address.area) parts.push(address.area);
    if (address.city && address.city !== address.area) parts.push(address.city);
    if (address.pincode) parts.push(address.pincode);

    return parts.join(", ");
  }
}

// Export convenience functions for address parsing
export const parseGooglePlaceToAddress = (place: any): ParsedAddress =>
  AddressParser.parseAddressComponents(place);

export const parseFormattedAddress = (
  formattedAddress: string,
): ParsedAddress => AddressParser.parseFormattedAddress(formattedAddress);

export const smartAutofillAddress = (
  parsedAddress: ParsedAddress,
  currentValues: Partial<ParsedAddress>,
  options?: { preserveUserInput?: boolean; overrideEmpty?: boolean },
): ParsedAddress =>
  AddressParser.smartAutofill(parsedAddress, currentValues, options);

export const validateAddressCompleteness = (address: ParsedAddress) =>
  AddressParser.validateAddress(address);

export const formatAddressDisplay = (address: ParsedAddress): string =>
  AddressParser.formatDisplayAddress(address);
