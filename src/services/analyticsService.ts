/**
 * Google Analytics Service
 * Centralized service for tracking page views, events, and user interactions
 */

import { ENV_CONFIG } from '../config/env';

// Declare gtag function for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

class AnalyticsService {
  private isInitialized = false;
  private gaId: string | null = null;

  constructor() {
    this.init();
  }

  private init() {
    this.gaId = ENV_CONFIG.GOOGLE_ANALYTICS_ID;
    
    if (this.gaId && this.gaId !== '%VITE_GOOGLE_ANALYTICS_ID%') {
      this.isInitialized = true;
      console.log('📊 Google Analytics initialized with ID:', this.gaId);
    } else {
      console.warn('⚠️ Google Analytics ID not found. Analytics tracking disabled.');
    }
  }

  /**
   * Check if analytics is enabled and available
   */
  private isEnabled(): boolean {
    return this.isInitialized && 
           this.gaId !== null && 
           typeof window !== 'undefined' && 
           typeof window.gtag === 'function';
  }

  /**
   * Track page views
   */
  trackPageView(pagePath: string, pageTitle?: string) {
    if (!this.isEnabled()) return;

    try {
      window.gtag('config', this.gaId!, {
        page_path: pagePath,
        page_title: pageTitle || document.title,
        page_location: window.location.href
      });

      console.log('📊 Page view tracked:', pagePath);
    } catch (error) {
      console.error('❌ Error tracking page view:', error);
    }
  }

  /**
   * Track custom events
   */
  trackEvent(eventName: string, parameters?: Record<string, any>) {
    if (!this.isEnabled()) return;

    try {
      window.gtag('event', eventName, {
        event_category: 'engagement',
        event_label: parameters?.label,
        value: parameters?.value,
        ...parameters
      });

      console.log('📊 Event tracked:', eventName, parameters);
    } catch (error) {
      console.error('❌ Error tracking event:', error);
    }
  }

  /**
   * Track button clicks
   */
  trackButtonClick(buttonName: string, location?: string) {
    this.trackEvent('button_click', {
      event_category: 'interaction',
      button_name: buttonName,
      location: location || 'unknown'
    });
  }

  /**
   * Track form submissions
   */
  trackFormSubmission(formName: string, success: boolean = true) {
    this.trackEvent('form_submit', {
      event_category: 'form',
      form_name: formName,
      success: success
    });
  }

  /**
   * Track user authentication events
   */
  trackAuth(action: 'login' | 'signup' | 'logout', method?: string) {
    this.trackEvent(action, {
      event_category: 'auth',
      method: method || 'unknown'
    });
  }

  /**
   * Track service bookings
   */
  trackBooking(serviceType: string, amount?: number) {
    this.trackEvent('booking_created', {
      event_category: 'conversion',
      service_type: serviceType,
      currency: 'INR',
      value: amount
    });
  }

  /**
   * Track search queries
   */
  trackSearch(searchTerm: string, resultsCount?: number) {
    this.trackEvent('search', {
      event_category: 'search',
      search_term: searchTerm,
      results_count: resultsCount
    });
  }

  /**
   * Track errors
   */
  trackError(errorType: string, errorMessage?: string) {
    this.trackEvent('exception', {
      event_category: 'error',
      description: errorMessage || errorType,
      fatal: false
    });
  }

  /**
   * Track user engagement time
   */
  trackEngagement(engagementTime: number) {
    this.trackEvent('user_engagement', {
      event_category: 'engagement',
      engagement_time_msec: engagementTime
    });
  }

  /**
   * Set user properties (for logged in users)
   */
  setUserProperties(properties: Record<string, any>) {
    if (!this.isEnabled()) return;

    try {
      window.gtag('config', this.gaId!, {
        custom_map: properties
      });
    } catch (error) {
      console.error('❌ Error setting user properties:', error);
    }
  }

  /**
   * Track conversion events
   */
  trackConversion(conversionType: string, value?: number) {
    this.trackEvent('conversion', {
      event_category: 'conversion',
      conversion_type: conversionType,
      currency: 'INR',
      value: value
    });
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

// Export both the instance and individual tracking functions for convenience
export default analyticsService;

export const {
  trackPageView,
  trackEvent,
  trackButtonClick,
  trackFormSubmission,
  trackAuth,
  trackBooking,
  trackSearch,
  trackError,
  trackEngagement,
  setUserProperties,
  trackConversion
} = analyticsService;

// Quick tracking functions for common use cases
export const analytics = {
  page: trackPageView,
  click: trackButtonClick,
  form: trackFormSubmission,
  auth: trackAuth,
  booking: trackBooking,
  search: trackSearch,
  error: trackError,
  engagement: trackEngagement,
  conversion: trackConversion
};
