/**
 * Environment Test Utility
 * Use this to verify all URLs and configurations are working correctly
 */

import { getApiUrl, shouldUseBackend, ENV_CONFIG, getAuthHeaders } from '../config/env';

export const testEnvironmentConfiguration = async () => {
  console.log('🔧 Testing Environment Configuration...');
  
  const results = {
    apiUrl: getApiUrl(),
    useBackend: shouldUseBackend(),
    hostname: window.location.hostname,
    environment: ENV_CONFIG.DEBUG_MODE ? 'development' : 'production',
    backendAvailable: false,
    corsConfigured: false
  };
  
  console.log('📊 Environment Results:', results);
  
  // Test backend connectivity if enabled
  if (results.useBackend) {
    try {
      console.log('🌐 Testing backend connectivity...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced timeout

      const response = await fetch(`${results.apiUrl}/health`, {
        method: 'GET',
        headers: getAuthHeaders(),
        signal: controller.signal,
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'include' // Include credentials
      });

      clearTimeout(timeoutId);
      
      if (response.ok) {
        results.backendAvailable = true;
        results.corsConfigured = true;
        console.log('✅ Backend is reachable and CORS is configured');
      } else {
        console.log(`⚠️ Backend responded with status: ${response.status}`);
      }
    } catch (error: any) {
      console.log('❌ Backend connectivity test failed:', error.message);
      
      if (error.name === 'AbortError') {
        console.log('⏰ Request timed out - backend may be starting up');
      } else if (error.message.includes('CORS')) {
        console.log('🚫 CORS error detected - check backend CORS configuration');
      } else if (error.message.includes('fetch')) {
        console.log('🌐 Network error - backend may not be running');
      }
    }
  } else {
    console.log('🏠 Backend disabled for this environment - using local storage');
  }
  
  console.log('�� Configuration Summary:');
  console.log(`   API URL: ${results.apiUrl}`);
  console.log(`   Backend Enabled: ${results.useBackend}`);
  console.log(`   Backend Available: ${results.backendAvailable}`);
  console.log(`   CORS Configured: ${results.corsConfigured}`);
  console.log(`   Environment: ${results.environment}`);
  
  return results;
};

// Auto-run test in development
if (ENV_CONFIG.DEBUG_MODE) {
  // Run test after DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(testEnvironmentConfiguration, 1000);
    });
  } else {
    setTimeout(testEnvironmentConfiguration, 1000);
  }
}

export default testEnvironmentConfiguration;
