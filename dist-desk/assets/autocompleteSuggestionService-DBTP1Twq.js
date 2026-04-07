import { g as getCacheDuration, a as getMinRequestInterval, M as MAPS_PERFORMANCE_CONFIG } from './index-BSH2qCvN.js';
import './ui-Db-Nz096.js';
import './vendor-ChAiEvka.js';

class AutocompleteSuggestionService {
  AutocompleteSuggestion = null;
  AutocompleteSessionToken = null;
  isInitialized = false;
  // Caching for autocomplete results
  autocompleteCache = /* @__PURE__ */ new Map();
  CACHE_DURATION = getCacheDuration("autocomplete");
  // Request throttling
  lastRequestTime = 0;
  MIN_REQUEST_INTERVAL = getMinRequestInterval("autocomplete");
  /**
   * Initialize the AutocompleteSuggestion service
   */
  async initialize() {
    if (this.isInitialized) return;
    try {
      if (!window.google?.maps) {
        throw new Error("Google Maps API not loaded");
      }
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await window.google.maps.importLibrary("places");
      this.AutocompleteSuggestion = AutocompleteSuggestion;
      this.AutocompleteSessionToken = AutocompleteSessionToken;
      this.isInitialized = true;
      console.log("✅ AutocompleteSuggestion service initialized");
    } catch (error) {
      console.error(
        "❌ Failed to initialize AutocompleteSuggestion service:",
        error
      );
      throw error;
    }
  }
  /**
   * Create a new session token for tracking autocomplete sessions
   */
  createSessionToken() {
    if (!this.AutocompleteSessionToken) {
      throw new Error("AutocompleteSuggestion service not initialized");
    }
    return new this.AutocompleteSessionToken();
  }
  /**
   * Fetch autocomplete suggestions using the new API
   */
  async fetchSuggestions(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!this.AutocompleteSuggestion) {
      throw new Error("AutocompleteSuggestion service not available");
    }
    try {
      const cacheKey = `${request.input}_${JSON.stringify(request.includedRegionCodes || ["in"])}`;
      const cached = this.autocompleteCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log("🚀 Using cached autocomplete result for:", request.input);
        return cached.data;
      }
      const now = Date.now();
      if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL) {
        await new Promise((resolve) => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - (now - this.lastRequestTime)));
      }
      this.lastRequestTime = Date.now();
      const sessionToken = request.sessionToken || this.createSessionToken();
      const apiRequest = {
        input: request.input,
        sessionToken,
        includedRegionCodes: request.includedRegionCodes || ["in"]
      };
      const response = await this.AutocompleteSuggestion.fetchAutocompleteSuggestions(
        apiRequest
      );
      if (!response.suggestions) {
        return [];
      }
      const suggestions = response.suggestions.map((suggestion) => {
        const placePrediction = suggestion.placePrediction;
        return {
          description: placePrediction.text,
          place_id: placePrediction.placeId,
          structured_formatting: {
            main_text: placePrediction.structuredFormat?.mainText || placePrediction.text,
            secondary_text: placePrediction.structuredFormat?.secondaryText || ""
          }
        };
      });
      const limitedSuggestions = suggestions.slice(0, MAPS_PERFORMANCE_CONFIG.MAX_AUTOCOMPLETE_SUGGESTIONS);
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
  async searchInIndia(input, sessionToken) {
    return this.fetchSuggestions({
      input,
      includedRegionCodes: ["in"],
      sessionToken
    });
  }
  /**
   * Search for places globally with specific region preferences
   */
  async searchGlobal(input, regionCodes = ["in", "us", "ca", "gb", "au"], sessionToken) {
    return this.fetchSuggestions({
      input,
      includedRegionCodes: regionCodes,
      sessionToken
    });
  }
  /**
   * Get place details using the new Place API (replaces deprecated PlacesService)
   */
  async getPlaceDetails(placeId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    try {
      if (!window.google?.maps?.places) {
        throw new Error("Google Maps Places API not loaded");
      }
      const { Place } = await window.google.maps.importLibrary("places");
      const place = new Place({
        id: placeId,
        requestedLanguage: "en"
        // or use user's preferred language
      });
      await place.fetchFields({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "addressComponents",
          "types"
        ]
      });
      const convertedPlace = {
        place_id: place.id,
        name: place.displayName,
        formatted_address: place.formattedAddress,
        geometry: {
          location: place.location ? {
            lat: place.location.lat,
            lng: place.location.lng
          } : null
        },
        address_components: place.addressComponents?.map((component) => ({
          long_name: component.longText,
          short_name: component.shortText,
          types: component.types
        })) || [],
        types: place.types || []
      };
      return convertedPlace;
    } catch (error) {
      console.error("Error fetching place details with new Places API:", error);
      return this.getPlaceDetailsLegacy(placeId);
    }
  }
  /**
   * Legacy fallback for place details using PlacesService
   */
  async getPlaceDetailsLegacy(placeId) {
    return new Promise((resolve, reject) => {
      if (!window.google?.maps?.places) {
        reject(new Error("Google Maps Places API not loaded"));
        return;
      }
      const service = new window.google.maps.places.PlacesService(
        document.createElement("div")
      );
      service.getDetails(
        {
          placeId,
          fields: [
            "place_id",
            "name",
            "formatted_address",
            "geometry",
            "address_components",
            "types"
          ]
        },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            resolve(place);
          } else {
            reject(new Error(`PlacesService error: ${status}`));
          }
        }
      );
    });
  }
  /**
   * Check if the service is ready to use
   */
  isReady() {
    return this.isInitialized && this.AutocompleteSuggestion && this.AutocompleteSessionToken;
  }
  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      error: this.isInitialized ? void 0 : "Service not initialized"
    };
  }
}
const autocompleteSuggestionService = new AutocompleteSuggestionService();
const getPlaceDetails = (placeId) => autocompleteSuggestionService.getPlaceDetails(placeId);

export { autocompleteSuggestionService, getPlaceDetails };
