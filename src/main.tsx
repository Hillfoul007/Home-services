import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import PerformanceMonitor from "./utils/performanceMonitor";
import { initializeErrorHandlers } from "./utils/errorHandlers";
import "./utils/runClearTestVerifications";
import "./utils/globalVerificationManager";

// Initialize Sentry if DSN provided
const SENTRY_DSN = (import.meta as any).env?.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  try {
    // Lazy import to avoid build errors when Sentry not installed/configured
    try {
      const modulePath = '@sentry' + '/react';
      // Use @vite-ignore to avoid static analysis when Sentry isn't installed
      // @ts-ignore
      const Sentry = await import(/* @vite-ignore */ modulePath);
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.1,
      });
      console.log('✅ Sentry initialized');
    } catch (e) {
      console.warn('⚠️ Sentry import failed or not installed', e);
    }
  } catch (e) {
    console.warn('⚠️ Sentry not initialized (missing package or config)', e);
  }
}

// Initialize performance monitoring
const perfMonitor = PerformanceMonitor.getInstance();
perfMonitor.init();

// Initialize global error handlers
initializeErrorHandlers();

// Function to handle URL corruption detection and cleanup
function handleURLCorruption() {
  if (typeof window === 'undefined') return false;

  const currentURL = window.location.href;
  const hasCorruptedURL = /[a-f0-9]{32}-[a-f0-9]{20}\.fly\.dev[a-zA-Z0-9]+/.test(currentURL);

  if (hasCorruptedURL) {
    console.log('🚨 URL corruption detected in main.tsx, clearing cache...');

    // Clear all storage
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
      }
    } catch (e) {
      console.warn('Could not clear storage:', e);
    }

    // Try to redirect to clean URL
    const cleanURL = currentURL.replace(/[a-zA-Z0-9]+$/, '');
    if (cleanURL !== currentURL) {
      console.log('🔧 Redirecting to clean URL:', cleanURL);
      window.location.href = cleanURL;
      return true; // Indicate we're redirecting
    }
  }

  return false; // No corruption detected or redirect needed
}

// Check for URL corruption and handle it
const isRedirecting = handleURLCorruption();

// Only render the app if we're not redirecting due to URL corruption
if (!isRedirecting) {
  createRoot(document.getElementById("root")!).render(<App />);
}
