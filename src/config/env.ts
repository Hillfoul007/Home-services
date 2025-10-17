/**
 * Centralized Environment Configuration
 * Single source of truth for all URLs and environment variables
 */

// Environment detection
export const isDevelopment = () => import.meta.env.DEV;
export const isProduction = () => import.meta.env.PROD;

// URL Configuration
const DEVELOPMENT_API_URL = "/api"; // Use relative path for vite proxy
const PRODUCTION_API_URL = "https://home-services-5alb.onrender.com/api";

// Frontend URLs for CORS configuration
export const FRONTEND_URLS = {
  development: [
    "http://localhost:10000",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:10000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000"
  ],
  production: [
    "https://laundrify.online",
    "https://www.laundrify.online",
    "https://laundrify-app-5su7.onrender.com",
    "https://testversion.onrender.com", 
    "https://cleancarepro-1-p2oc.onrender.com",
    "https://cleancare-pro-production.up.railway.app",
    // Add Builder.io domains
    "https://*.builder.codes",
    "https://*.fly.dev",
    "https://*.vercel.app",
    "https://*.netlify.app"
  ]
};

// Backend URLs
export const BACKEND_URLS = {
  development: DEVELOPMENT_API_URL,
  production: PRODUCTION_API_URL
};

// Main API URL getter
export const getApiUrl = (): string => {
  // First check for explicit environment variable
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  if (envApiUrl && envApiUrl.trim() !== "") {
    console.log(`🔧 Using explicit env API URL: ${envApiUrl}`);
    return envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`;
  }

  // Detect environment based on hostname
  const hostname = window.location.hostname;
  const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const isFlyDev = hostname.includes("fly.dev");
  const isBuilderCodes = hostname.includes("builder.codes");
  const isRenderCom = hostname.includes("onrender.com"); // Add render.com detection
  const isProductionDomain = hostname === "www.laundrify.online" || hostname === "laundrify.online";

  console.log(`🔍 API URL Detection:`, {
    hostname,
    isLocalhost,
    isFlyDev,
    isBuilderCodes,
    isRenderCom,
    isProductionDomain,
    envApiUrl,
    developmentUrl: DEVELOPMENT_API_URL,
    productionUrl: PRODUCTION_API_URL
  });

  // For localhost, use development API
  if (isLocalhost) {
    console.log(`🏠 Using development API: ${DEVELOPMENT_API_URL}`);
    return DEVELOPMENT_API_URL;
  }

  // Check if we're in development mode (vite dev server)
  const isDevelopment = import.meta.env.DEV;
  if (isDevelopment) {
    console.log(`🔧 Development mode detected, using local API via proxy: ${DEVELOPMENT_API_URL}`);
    return DEVELOPMENT_API_URL;
  }

  // For production environments only
  if (isFlyDev || isBuilderCodes || isRenderCom || isProductionDomain) {
    console.log(`🌐 Using production backend API: ${PRODUCTION_API_URL}`);
    return PRODUCTION_API_URL;
  }

  // Default fallback
  console.log(`🚀 Using default production API: ${PRODUCTION_API_URL}`);
  return PRODUCTION_API_URL;
};

// Check if backend is available (for hosted environments)
export const shouldUseBackend = (): boolean => {
  const hostname = window.location.hostname;

  // Allow backend for your specific app domain
  if (hostname.includes("856f989be1cb4050ba0283a2e091d533-f5a549ca82f54c089dcd22f9b.fly.dev")) {
    return true;
  }

  // Disable backend for other fly.dev environments that don't have backend
  if (hostname.includes("fly.dev") && !hostname.includes("backend")) {
    return false;
  }

  return true;
};

// Backward compatibility aliases
export const isBackendAvailable = shouldUseBackend;
export const getApiBaseUrl = getApiUrl;

// Environment variables
export const ENV_CONFIG = {
  // API Configuration
  API_URL: getApiUrl(),
  USE_BACKEND: shouldUseBackend(),
  
  // Authentication
  AUTH_TOKEN_KEY: "laundrify_token",
  USER_DATA_KEY: "laundrify_user",
  
  // Google Services
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  GOOGLE_ANALYTICS_ID: import.meta.env.VITE_GOOGLE_ANALYTICS_ID,
  
  // SMS Service
  DVHOSTING_API_KEY: import.meta.env.VITE_DVHOSTING_API_KEY,
  
  // App Settings
  APP_NAME: "Laundrify",
  APP_VERSION: "1.0.0",
  
  // Timeouts
  API_TIMEOUT: 30000, // 30 seconds
  OTP_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  
  // Development flags
  DEBUG_MODE: isDevelopment(),
  ENABLE_LOGGING: isDevelopment()
};

// Helper functions
export const log = (...args: any[]) => {
  if (ENV_CONFIG.ENABLE_LOGGING) {
    console.log(...args);
  }
};

export const logError = (...args: any[]) => {
  console.error(...args);
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem(ENV_CONFIG.AUTH_TOKEN_KEY) || localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Export as both 'config' and 'ENV_CONFIG' for compatibility
export const config = ENV_CONFIG;
export default ENV_CONFIG;
