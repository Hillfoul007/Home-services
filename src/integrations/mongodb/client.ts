// Production MongoDB client - production-ready implementation
// This file exports all the helpers that work with the MongoDB backend API

// Import from production implementation
export {
  authHelpers,
  bookingHelpers,
  addressHelpers,
  getCurrentUser,
  isLoggedIn,
  clearAuthData,
  sendNotification,
} from "../production/client";

// Re-export types for backward compatibility
export type * from "./types";

// Configuration
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api",
  frontendUrl: import.meta.env.VITE_FRONTEND_URL || "http://localhost:8080",
};

// Helper to check if backend is available
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(
      `${config.apiBaseUrl.replace("/api", "")}/health`,
    );
    const data = await response.json();

    if (response.ok) {
      return {
        isAvailable: true,
        status: data.status,
        timestamp: data.timestamp,
        environment: data.environment,
      };
    }

    return { isAvailable: false, error: "Backend health check failed" };
  } catch (error) {
    console.error("Backend health check error:", error);
    return { isAvailable: false, error: "Cannot connect to backend" };
  }
};

// Helper to get auth token
export const getAuthToken = () => {
  return localStorage.getItem("cleancare_token");
};

// Rider helpers (keeping existing implementation for now)
export { riderHelpers } from "./riderHelpers";
