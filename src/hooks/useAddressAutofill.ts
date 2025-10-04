import { useState, useCallback, useRef } from "react";
import {
  autocompleteSuggestionService,
  parseGooglePlaceToAddress,
  parseFormattedAddress,
  smartAutofillAddress,
  validateAddressCompleteness,
  formatAddressDisplay,
  AutocompletePrediction,
  ParsedAddress,
} from "@/utils/autocompleteSuggestionService";

export interface AddressAutofillOptions {
  preserveUserInput?: boolean;
  overrideEmpty?: boolean;
  enableValidation?: boolean;
  enableGeolocation?: boolean;
}

export interface AddressAutofillState {
  address: ParsedAddress;
  suggestions: AutocompletePrediction[];
  isLoading: boolean;
  isValidating: boolean;
  validation: {
    isValid: boolean;
    missingFields: string[];
    suggestions: string[];
  };
  error: string | null;
}

export const useAddressAutofill = (
  initialAddress: Partial<ParsedAddress> = {},
  options: AddressAutofillOptions = {},
) => {
  const {
    preserveUserInput = true,
    overrideEmpty = true,
    enableValidation = true,
    enableGeolocation = true,
  } = options;

  const [state, setState] = useState<AddressAutofillState>({
    address: { ...initialAddress },
    suggestions: [],
    isLoading: false,
    isValidating: false,
    validation: {
      isValid: false,
      missingFields: [],
      suggestions: [],
    },
    error: null,
  });

  const sessionTokenRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session token
  const initializeSessionToken = useCallback(async () => {
    try {
      await autocompleteSuggestionService.initialize();
      sessionTokenRef.current =
        autocompleteSuggestionService.createSessionToken();
    } catch (error) {
      console.error("Failed to initialize autocomplete service:", error);
    }
  }, []);

  // Update address field
  const updateAddressField = useCallback(
    (field: keyof ParsedAddress, value: string) => {
      setState((prev) => {
        const newAddress = { ...prev.address, [field]: value };

        let newValidation = prev.validation;
        if (enableValidation) {
          newValidation = validateAddressCompleteness(newAddress);
        }

        return {
          ...prev,
          address: newAddress,
          validation: newValidation,
        };
      });
    },
    [enableValidation],
  );

  // Search for address suggestions
  const searchAddresses = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setState((prev) => ({ ...prev, suggestions: [], error: null }));
        return;
      }

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Debounce search
      searchTimeoutRef.current = setTimeout(async () => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
          if (!sessionTokenRef.current) {
            await initializeSessionToken();
          }

          const suggestions = await autocompleteSuggestionService.searchInIndia(
            query,
            sessionTokenRef.current,
          );

          setState((prev) => ({
            ...prev,
            suggestions,
            isLoading: false,
          }));
        } catch (error) {
          console.error("Address search error:", error);
          setState((prev) => ({
            ...prev,
            error: "Failed to search addresses",
            suggestions: [],
            isLoading: false,
          }));
        }
      }, 300);
    },
    [initializeSessionToken],
  );

  // Autofill from selected suggestion
  const autofillFromSuggestion = useCallback(
    async (suggestion: AutocompletePrediction) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Get detailed place information
        const placeDetails =
          await autocompleteSuggestionService.getPlaceDetails(
            suggestion.place_id,
          );

        // Parse the place details
        const parsedAddress = parseGooglePlaceToAddress(placeDetails);

        // Smart autofill preserving existing user input
        const newAddress = smartAutofillAddress(parsedAddress, state.address, {
          preserveUserInput,
          overrideEmpty,
        });

        let newValidation = state.validation;
        if (enableValidation) {
          newValidation = validateAddressCompleteness(newAddress);
        }

        setState((prev) => ({
          ...prev,
          address: newAddress,
          suggestions: [],
          isLoading: false,
          validation: newValidation,
        }));

        // Create new session token for next search
        sessionTokenRef.current =
          autocompleteSuggestionService.createSessionToken();

        return newAddress;
      } catch (error) {
        console.error("Failed to get place details:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to get place details",
          isLoading: false,
        }));
        return null;
      }
    },
    [state.address, preserveUserInput, overrideEmpty, enableValidation],
  );

  // Autofill from formatted address string
  const autofillFromString = useCallback(
    (formattedAddress: string) => {
      const parsedAddress = parseFormattedAddress(formattedAddress);

      const newAddress = smartAutofillAddress(parsedAddress, state.address, {
        preserveUserInput,
        overrideEmpty,
      });

      let newValidation = state.validation;
      if (enableValidation) {
        newValidation = validateAddressCompleteness(newAddress);
      }

      setState((prev) => ({
        ...prev,
        address: newAddress,
        validation: newValidation,
      }));

      return newAddress;
    },
    [state.address, preserveUserInput, overrideEmpty, enableValidation],
  );

  // Get current location and autofill
  const autofillFromCurrentLocation = useCallback(async () => {
    if (!enableGeolocation) return null;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          });
        },
      );

      const { latitude, longitude } = position.coords;

      // Reverse geocode the coordinates
      const geocoder = new google.maps.Geocoder();
      const results = await new Promise<google.maps.GeocoderResult[]>(
        (resolve, reject) => {
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results, status) => {
              if (status === "OK" && results) {
                resolve(results);
              } else {
                reject(new Error(`Geocoding failed: ${status}`));
              }
            },
          );
        },
      );

      if (results.length > 0) {
        const bestResult = results[0];
        const parsedAddress = parseGooglePlaceToAddress(bestResult);

        const newAddress = smartAutofillAddress(parsedAddress, state.address, {
          preserveUserInput,
          overrideEmpty,
        });

        let newValidation = state.validation;
        if (enableValidation) {
          newValidation = validateAddressCompleteness(newAddress);
        }

        setState((prev) => ({
          ...prev,
          address: newAddress,
          isLoading: false,
          validation: newValidation,
        }));

        return newAddress;
      }
    } catch (error) {
      console.error("Geolocation failed:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to get current location",
        isLoading: false,
      }));
    }

    return null;
  }, [
    state.address,
    preserveUserInput,
    overrideEmpty,
    enableValidation,
    enableGeolocation,
  ]);

  // Clear all fields
  const clearAddress = useCallback(() => {
    const emptyAddress: ParsedAddress = {};
    setState((prev) => ({
      ...prev,
      address: emptyAddress,
      suggestions: [],
      error: null,
      validation: {
        isValid: false,
        missingFields: [],
        suggestions: [],
      },
    }));
  }, []);

  // Validate current address
  const validateCurrentAddress = useCallback(() => {
    const validation = validateAddressCompleteness(state.address);
    setState((prev) => ({ ...prev, validation }));
    return validation;
  }, [state.address]);

  // Get formatted display address
  const getDisplayAddress = useCallback(() => {
    return formatAddressDisplay(state.address);
  }, [state.address]);

  // Reset suggestions
  const clearSuggestions = useCallback(() => {
    setState((prev) => ({ ...prev, suggestions: [] }));
  }, []);

  // Set complete address object
  const setAddress = useCallback(
    (address: ParsedAddress) => {
      let newValidation = state.validation;
      if (enableValidation) {
        newValidation = validateAddressCompleteness(address);
      }

      setState((prev) => ({
        ...prev,
        address,
        validation: newValidation,
      }));
    },
    [enableValidation],
  );

  // Initialize on first use
  useState(() => {
    initializeSessionToken();
  });

  return {
    // State
    address: state.address,
    suggestions: state.suggestions,
    isLoading: state.isLoading,
    validation: state.validation,
    error: state.error,

    // Actions
    updateAddressField,
    searchAddresses,
    autofillFromSuggestion,
    autofillFromString,
    autofillFromCurrentLocation,
    clearAddress,
    clearSuggestions,
    setAddress,
    validateCurrentAddress,
    getDisplayAddress,

    // Utils
    isServiceReady: () => autocompleteSuggestionService.isReady(),
  };
};

export default useAddressAutofill;
