import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/contexts/NotificationContext";
import LaundryIndex from "@/pages/LaundryIndex";
import LocationConfigPage from "@/pages/LocationConfigPage";
import AdminPortal from "@/pages/AdminPortal";
import RiderAuth from "@/pages/rider/RiderAuth";
import RiderDashboard from "@/pages/rider/RiderDashboard";
import RiderOrders from "@/pages/rider/RiderOrders";
import RiderNotificationsPage from "@/pages/rider/RiderNotificationsPage";
import RiderHistory from "@/pages/rider/RiderHistory";
import ErrorBoundary from "@/components/ErrorBoundary";
import InstallPrompt from "@/components/InstallPrompt";
import PWAUpdateNotification from "@/components/PWAUpdateNotification";
import MapsPerformanceIndicator from "@/components/MapsPerformanceIndicator";
import analyticsService from "@/services/analyticsService";

import {
  initializeAuthPersistence,
  restoreAuthState,
} from "@/utils/authPersistence";
import { initializePWAUpdates } from "@/utils/swCleanup";
import "@/utils/testEnvironment"; // Auto-run environment tests in development
import "./App.css";
import "./styles/mobile-fixes.css";
import "./styles/mobile-touch-fixes.css";

// Component to track route changes
function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    const pagePath = location.pathname + location.search;

    // Get page title based on route
    const getPageTitle = (path: string) => {
      if (path.startsWith('/admin')) return 'Admin Portal - Laundrify';
      if (path.startsWith('/rider')) return 'Rider Portal - Laundrify';
      if (path === '/') return 'Home - Laundrify';
      return 'Laundrify';
    };

    analyticsService.trackPageView(pagePath, getPageTitle(pagePath));
  }, [location]);

  return null;
}

function App() {
  // Initialize authentication persistence and restore user session
  useEffect(() => {
    const initializeAuth = async () => {
      // Auto-clear cart on deploy (only once)
      const versionKey = "catalogue-version-v2";
      if (!localStorage.getItem(versionKey)) {
        localStorage.removeItem("cart");
        localStorage.setItem(versionKey, "true");
      }

      // Initialize auth persistence handlers (storage events, page lifecycle, etc.)
      initializeAuthPersistence();

      // Initialize PWA updates and service worker cleanup
      initializePWAUpdates();

      // Restore authentication state from localStorage
      await restoreAuthState();
    };

    initializeAuth();
  }, []);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <Router>
          <AnalyticsTracker />
          <div className="App">
            <Routes>
              <Route path="/" element={<LaundryIndex />} />
              <Route path="/admin" element={<AdminPortal />} />
              <Route
                path="/admin/location-config"
                element={<LocationConfigPage />}
              />
              <Route path="/rider" element={<RiderAuth />} />
              <Route path="/rider/register" element={<RiderAuth />} />
              <Route path="/rider/login" element={<RiderAuth />} />
              <Route path="/rider/dashboard" element={<RiderDashboard />} />
              <Route path="/rider/orders" element={<RiderDashboard />} />
              <Route path="/rider/orders/:orderId" element={<RiderOrders />} />
              <Route path="/rider/notifications" element={<RiderNotificationsPage />} />
              <Route path="/rider/history" element={<RiderHistory />} />
              <Route path="/rider/profile" element={<RiderDashboard />} />
              <Route path="*" element={<LaundryIndex />} />
            </Routes>
            <Toaster />
            <SonnerToaster />
            <InstallPrompt />
            <PWAUpdateNotification />
            <MapsPerformanceIndicator />
          </div>
        </Router>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;
