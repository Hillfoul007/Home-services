/**
 * Global error handlers to catch and manage unhandled errors gracefully
 */

export const initializeErrorHandlers = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // Handle network-related errors gracefully
    if (error?.message?.includes('Failed to fetch')) {
      console.log('🌐 Network connectivity issue detected');
      event.preventDefault(); // Prevent default error logging
      return;
    }

    if (error?.name === 'AbortError') {
      console.log('⏰ Request was cancelled');
      event.preventDefault();
      return;
    }

    // Handle other fetch-related errors
    if (error?.message?.includes('fetch')) {
      console.log('📡 API request failed:', error.message);
      event.preventDefault();
      return;
    }

    // Let other errors bubble up normally
    console.error('🚨 Unhandled promise rejection:', error);
  });

  // Handle general JavaScript errors
  window.addEventListener('error', (event) => {
    // Handle fetch-related errors
    if (event.error?.message?.includes('Failed to fetch')) {
      console.log('🌐 Fetch error caught by global handler');
      event.preventDefault();
      return;
    }

    // Let other errors bubble up
    console.error('🚨 Global error:', event.error);
  });

  console.log('🛡️ Global error handlers initialized');
};

/**
 * Check if error is network-related
 */
export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  
  const message = error.message || '';
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('net::') ||
    error.name === 'AbortError' ||
    error.code === 'NETWORK_ERROR'
  );
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyError = (error: any): string => {
  if (!navigator.onLine) {
    return 'You appear to be offline. Please check your internet connection.';
  }

  if (isNetworkError(error)) {
    return 'Connection issue. Please try again in a moment.';
  }

  if (error?.status === 401) {
    return 'Session expired. Please log in again.';
  }

  if (error?.status === 403) {
    return 'Access denied. Please contact support.';
  }

  if (error?.status >= 500) {
    return 'Server error. Please try again later.';
  }

  return 'Something went wrong. Please try again.';
};

export default {
  initializeErrorHandlers,
  isNetworkError,
  getUserFriendlyError
};
