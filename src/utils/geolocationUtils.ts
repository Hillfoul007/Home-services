export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface GeolocationError {
  code: number;
  message: string;
  PERMISSION_DENIED: number;
  POSITION_UNAVAILABLE: number;
  TIMEOUT: number;
}

export interface GeolocationResult {
  success: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  error?: string;
  errorCode?: number;
}

/**
 * Get user's current position with proper error handling
 */
export const getCurrentPosition = (
  options: GeolocationOptions = {},
): Promise<GeolocationResult> => {
  return new Promise((resolve) => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      resolve({
        success: false,
        error: "Geolocation is not supported by this browser",
        errorCode: -1,
      });
      return;
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
      ...options,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          success: true,
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        });
      },
      (error: GeolocationPositionError) => {
        let errorMessage = "Failed to get location";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
          default:
            errorMessage = "Unknown geolocation error";
        }

        console.warn("Geolocation error:", {
          code: error.code,
          message: error.message,
          customMessage: errorMessage,
        });

        resolve({
          success: false,
          error: errorMessage,
          errorCode: error.code,
        });
      },
      defaultOptions,
    );
  });
};

/**
 * Check if geolocation permission is granted
 */
export const checkGeolocationPermission = async (): Promise<string> => {
  if (!navigator.permissions) {
    return "unknown";
  }

  try {
    const permission = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return permission.state;
  } catch (error) {
    console.warn("Could not query geolocation permission:", error);
    return "unknown";
  }
};

/**
 * Get user-friendly error message for geolocation errors
 */
export const getGeolocationErrorMessage = (
  error: GeolocationPositionError,
): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Please enable location access in your browser settings";
    case error.POSITION_UNAVAILABLE:
      return "Your location could not be determined. Please try again.";
    case error.TIMEOUT:
      return "Location request timed out. Please try again.";
    default:
      return "Unable to get your location. Please try again.";
  }
};

/**
 * Check if geolocation is available and accessible
 */
export const isGeolocationAvailable = (): boolean => {
  return "geolocation" in navigator;
};
