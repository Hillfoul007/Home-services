// API utility functions with error handling and rate limit management

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  isRateLimited?: boolean;
  status?: number;
}

import { getApiBaseUrl, isBackendAvailable } from "../config/env";

export const API_BASE_URL = getApiBaseUrl();

// Enhanced fetch with error handling and rate limit detection
export const safeFetch = async <T = any>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000,
): Promise<ApiResponse<T>> => {
  try {
    // Check if backend is available first
    if (!isBackendAvailable()) {
      return {
        error: "Backend service not available in this environment",
        success: false,
      };
    }

    // Add timeout to all requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Handle rate limiting
    if (response.status === 429) {
      return {
        error: "API rate limit exceeded. Please try again later.",
        isRateLimited: true,
        status: 429,
      };
    }

    // Handle other HTTP errors
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If error response is not JSON, use status text
      }

      return {
        error: errorMessage,
        status: response.status,
      };
    }

    // Parse successful response
    const data = await response.json();
    return { data, status: response.status };
  } catch (error: any) {
    // Handle network errors, timeouts, etc.
    if (error.name === "AbortError") {
      return {
        error: "Request timed out. Please check your connection and try again.",
        status: 408,
      };
    }

    return {
      error: error.message || "Network error. Please check your connection.",
      status: 0,
    };
  }
};

// Retry logic for important requests
export const retryFetch = async <T = any>(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 2,
  delayMs: number = 1000,
): Promise<ApiResponse<T>> => {
  let lastError: ApiResponse<T> = { error: "Unknown error" };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await safeFetch<T>(url, options);

    // If successful, return immediately
    if (result.data !== undefined) {
      return result;
    }

    // If rate limited, don't retry immediately
    if (result.isRateLimited) {
      return result;
    }

    lastError = result;

    // If this isn't the last attempt, wait before retrying
    if (attempt < maxRetries) {
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * (attempt + 1)),
      );
    }
  }

  return lastError;
};

// Specific API functions
export const apiHelpers = {
  // Check if email exists
  checkEmail: async (
    email: string,
  ): Promise<ApiResponse<{ exists: boolean }>> => {
    return safeFetch(`${API_BASE_URL}/auth/check-email`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  // Check if phone exists
  checkPhone: async (
    phone: string,
  ): Promise<ApiResponse<{ exists: boolean }>> => {
    return safeFetch(`${API_BASE_URL}/auth/check-phone`, {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },

  // Register user
  registerUser: async (
    userData: any,
  ): Promise<ApiResponse<{ user: any; token: string }>> => {
    return safeFetch(
      `${API_BASE_URL}/auth/register`,
      {
        method: "POST",
        body: JSON.stringify(userData),
      },
      15000,
    ); // Longer timeout for registration
  },

  // Geocode location
  geocodeLocation: async (
    lat: number,
    lng: number,
  ): Promise<ApiResponse<{ address: string }>> => {
    return safeFetch(
      `${API_BASE_URL}/location/geocode`,
      {
        method: "POST",
        body: JSON.stringify({ lat, lng }),
      },
      5000,
    ); // Shorter timeout for location
  },
};

export default { safeFetch, retryFetch, apiHelpers, API_BASE_URL };
