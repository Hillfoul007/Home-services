/**
 * Production Environment Configuration
 * Handles proper API URL detection for production deployment
 */

import { getApiUrl } from './env';

// Define the correct production API URL - now uses centralized config
export const PRODUCTION_API_URL = "https://home-services-5alb.onrender.com/api";

export const getProductionApiUrl = (): string => {
  // Use centralized API URL detection
  const apiUrl = getApiUrl();

  console.log("🔍 API URL Detection:", {
    hostname: window.location.hostname,
    currentUrl: window.location.href,
    apiUrl,
  });

  console.log("🚀 Using centralized API URL:", apiUrl);
  return apiUrl;
};

// Export a flag to check if backend should be used
export const shouldUseBackend = (): boolean => {
  const hostname = window.location.hostname;

  // Disable backend for certain hosted environments
  if (hostname.includes("fly.dev")) {
    return false;
  }

  // For now, use backend but the AddressService will handle 404 gracefully
  // TODO: Ensure Railway deployment has latest code with address routes
  return true;
};
