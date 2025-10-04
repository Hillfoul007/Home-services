import { useState, useEffect, useCallback, useRef } from "react";
import {
  locationService,
  type Coordinates,
  type LocationData,
  type GeocodeResult,
} from "@/services/locationService";
import { authHelpers } from "@/integrations/mongodb/client";
import { getErrorMessage, logError } from '@/lib/error-utils';

export interface UseLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean;
  autoGeocoding?: boolean;
  saveToDatabase?: boolean;
}

export interface LocationState {
  currentLocation: Coordinates | null;
  currentAddress: string;
  isLoading: boolean;
  isDetecting: boolean;
  error: string | null;
  isSupported: boolean;
  permissionStatus: "prompt" | "granted" | "denied" | "unknown";
  savedLocations: LocationData[];
  favoriteLocations: LocationData[];
}

export interface UseLocationReturn extends LocationState {
  detectLocation: () => Promise<void>;
  getCurrentLocation: () => Promise<void>;
  clearLocation: () => void;
  clearError: () => void;
  updateAddress: (address: string, coordinates?: Coordinates) => void;
  geocodeAddress: (address: string) => Promise<GeocodeResult | null>;
  reverseGeocode: (coordinates: Coordinates) => Promise<string | null>;
  saveLocation: (
    address: string,
    coordinates: Coordinates,
    opts?: { name?: string; isFavorite?: boolean },
  ) => Promise<LocationData | null>;
  removeLocation: (locationId: string) => Promise<void>;
  toggleFavorite: (locationId: string, isFavorite: boolean) => Promise<void>;
  refreshSavedLocations: () => Promise<void>;
  startWatching: () => void;
  stopWatching: () => void;
}

const defaultOptions: UseLocationOptions = {
  enableHighAccuracy: true,
  timeout: 15000, // Increased timeout to give GPS more time
  maximumAge: 30000, // Reduced to prefer fresher GPS readings
  watchPosition: false,
  autoGeocoding: true,
  saveToDatabase: false,
};

export const useLocation = (
  options: UseLocationOptions = {},
): UseLocationReturn => {
  const opts = { ...defaultOptions, ...options };
  const watchIdRef = useRef<number | null>(null);

  const [state, setState] = useState<LocationState>({
    currentLocation: null,
    currentAddress: "",
    isLoading: false,
    isDetecting: false,
    error: null,
    isSupported: "geolocation" in navigator,
    permissionStatus: "unknown",
    savedLocations: [],
    favoriteLocations: [],
  });

  // Clear any error messages
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Update address and coordinates
  const updateAddress = useCallback(
    (address: string, coordinates?: Coordinates) => {
      setState((prev) => ({
        ...prev,
        currentAddress: address,
        currentLocation: coordinates || prev.currentLocation,
        error: null,
      }));
    },
    [],
  );

  // Clear location data
  const clearLocation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentLocation: null,
      currentAddress: "",
      error: null,
    }));
  }, []);

  // Check geolocation permission
  const checkPermission = useCallback(async () => {
    if (!navigator.permissions) {
      setState((prev) => ({ ...prev, permissionStatus: "unknown" }));
      return;
    }

    try {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });
      setState((prev) => ({ ...prev, permissionStatus: permission.state }));

      permission.addEventListener("change", () => {
        setState((prev) => ({ ...prev, permissionStatus: permission.state }));
      });
    } catch (error) {
      console.warn("Could not query geolocation permission:", error);
      setState((prev) => ({ ...prev, permissionStatus: "unknown" }));
    }
  }, []);

  // Get current position
  const getCurrentPosition = useCallback((): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coordinates: Coordinates = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          resolve(coordinates);
        },
        (error) => {
          const errorMessage = getErrorMessage(error);
          logError("useLocation.getCurrentPosition", error);
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          timeout: opts.timeout,
          maximumAge: opts.maximumAge,
        },
      );
    });
  }, [opts.enableHighAccuracy, opts.timeout, opts.maximumAge]);

  // Reverse geocode coordinates to address
  const reverseGeocode = useCallback(
    async (coordinates: Coordinates): Promise<string | null> => {
      try {
        const address = await locationService.reverseGeocode(coordinates);
        return address;
      } catch (error) {
        console.error("Reverse geocoding failed:", error);
        return null;
      }
    },
    [],
  );

  // Geocode address to coordinates
  const geocodeAddress = useCallback(
    async (address: string): Promise<GeocodeResult | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        const result = await locationService.geocodeAddress(address);
        setState((prev) => ({ ...prev, isLoading: false }));
        return result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Geocoding failed",
        }));
        return null;
      }
    },
    [],
  );

  // Detect current location
  const detectLocation = useCallback(async () => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation is not supported by this browser",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isDetecting: true,
      isLoading: true,
      error: null,
    }));

    try {
      const coordinates = await getCurrentPosition();
      setState((prev) => ({
        ...prev,
        currentLocation: coordinates,
        isDetecting: false,
        isLoading: opts.autoGeocoding,
      }));

      // Auto-geocode if enabled
      if (opts.autoGeocoding) {
        try {
          const address = await reverseGeocode(coordinates);
          setState((prev) => ({
            ...prev,
            currentAddress: address || "",
            isLoading: false,
          }));
        } catch (geocodeError) {
          console.warn("Auto-geocoding failed:", geocodeError);
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logError("useLocation.detectLocation", error);
      setState((prev) => ({
        ...prev,
        isDetecting: false,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [
    state.isSupported,
    opts.autoGeocoding,
    getCurrentPosition,
    reverseGeocode,
  ]);

  // Save location to database (mock implementation)
  const saveLocation = useCallback(
    async (
      address: string,
      coordinates: Coordinates,
      options: { name?: string; isFavorite?: boolean } = {},
    ): Promise<LocationData | null> => {
      if (!opts.saveToDatabase) {
        console.warn("saveToDatabase option is disabled");
        return null;
      }

      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const fullLocationData: LocationData = {
          id: `loc_${Date.now()}`,
          address,
          coordinates,
          name: options.name || address,
          isFavorite: options.isFavorite || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // For demo purposes, save to localStorage
        const existingLocations = JSON.parse(
          localStorage.getItem("saved_locations") || "[]",
        );
        existingLocations.push(fullLocationData);
        localStorage.setItem(
          "saved_locations",
          JSON.stringify(existingLocations),
        );

        setState((prev) => ({
          ...prev,
          isLoading: false,
          savedLocations: [...prev.savedLocations, fullLocationData],
        }));

        return fullLocationData;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to save location",
        }));
        return null;
      }
    },
    [opts.saveToDatabase, state.currentAddress, state.currentLocation],
  );

  // Remove saved location
  const removeLocation = useCallback(
    async (locationId: string): Promise<void> => {
      try {
        const existingLocations = JSON.parse(
          localStorage.getItem("saved_locations") || "[]",
        );
        const filteredLocations = existingLocations.filter(
          (loc: LocationData) => loc.id !== locationId,
        );
        localStorage.setItem(
          "saved_locations",
          JSON.stringify(filteredLocations),
        );

        setState((prev) => ({
          ...prev,
          savedLocations: prev.savedLocations.filter(
            (loc) => loc.id !== locationId,
          ),
          favoriteLocations: prev.favoriteLocations.filter(
            (loc) => loc.id !== locationId,
          ),
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "Failed to remove location",
        }));
      }
    },
    [],
  );

  // Toggle favorite status
  const toggleFavorite = useCallback(
    async (locationId: string, isFavorite: boolean): Promise<void> => {
      try {
        const existingLocations = JSON.parse(
          localStorage.getItem("saved_locations") || "[]",
        );
        const updatedLocations = existingLocations.map((loc: LocationData) =>
          loc.id === locationId
            ? { ...loc, isFavorite, updatedAt: new Date() }
            : loc,
        );
        localStorage.setItem(
          "saved_locations",
          JSON.stringify(updatedLocations),
        );

        setState((prev) => ({
          ...prev,
          savedLocations: prev.savedLocations.map((loc) =>
            loc.id === locationId
              ? { ...loc, isFavorite, updatedAt: new Date() }
              : loc,
          ),
          favoriteLocations: isFavorite
            ? [
                ...prev.favoriteLocations,
                prev.savedLocations.find((loc) => loc.id === locationId)!,
              ]
            : prev.favoriteLocations.filter((loc) => loc.id !== locationId),
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update favorite status",
        }));
      }
    },
    [],
  );

  // Refresh saved locations
  const refreshSavedLocations = useCallback(async () => {
    try {
      const existingLocations = JSON.parse(
        localStorage.getItem("saved_locations") || "[]",
      );
      const favoriteLocations = existingLocations.filter(
        (loc: LocationData) => loc.isFavorite,
      );

      setState((prev) => ({
        ...prev,
        savedLocations: existingLocations,
        favoriteLocations,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load saved locations",
      }));
    }
  }, []);

  // Start watching position
  const startWatching = useCallback(() => {
    if (!navigator.geolocation || !opts.watchPosition) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coordinates: Coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setState((prev) => ({
          ...prev,
          currentLocation: coordinates,
          error: null,
        }));

        // Auto-geocode if enabled
        if (opts.autoGeocoding) {
          reverseGeocode(coordinates)
            .then((address) => {
              setState((prev) => ({
                ...prev,
                currentAddress: address || "",
              }));
            })
            .catch((error) => {
              console.warn("Auto-geocoding failed:", error);
            });
        }
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          error: `Location watching failed: ${error.message}`,
        }));
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      },
    );
  }, [
    opts.watchPosition,
    opts.enableHighAccuracy,
    opts.timeout,
    opts.maximumAge,
    opts.autoGeocoding,
    reverseGeocode,
  ]);

  // Stop watching position
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Initialize
  useEffect(() => {
    checkPermission();

    // Load saved locations if enabled
    if (opts.saveToDatabase) {
      refreshSavedLocations();
    }

    // Start watching if enabled
    if (opts.watchPosition) {
      startWatching();
    }

    // Cleanup on unmount
    return () => {
      stopWatching();
    };
  }, [
    checkPermission,
    refreshSavedLocations,
    startWatching,
    opts.saveToDatabase,
    opts.watchPosition,
    stopWatching,
  ]);

  return {
    ...state,
    detectLocation,
    getCurrentLocation: detectLocation,
    clearLocation,
    clearError,
    updateAddress,
    geocodeAddress,
    reverseGeocode,
    saveLocation,
    removeLocation,
    toggleFavorite,
    refreshSavedLocations,
    startWatching,
    stopWatching,
  };
};
