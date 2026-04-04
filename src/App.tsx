import { HashRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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
import MapsPerformanceIndicator from "@/components/MapsPerformanceIndicator";
import analyticsService from "@/services/analyticsService";

import {
  initializeAuthPersistence,
  restoreAuthState,
} from "@/utils/authPersistence";
import { initializePWAUpdates } from "@/utils/swCleanup";
import "@/utils/testEnvironment"; // Auto-run environment tests in development
import ForceUpdateModal from "@/components/ForceUpdateModal";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getApiUrl } from "@/config/env";
import VendorLogin from "@/pages/vendor/VendorLogin";
import VendorDashboard from "@/pages/vendor/VendorDashboard";
import VendorOrderDetails from "@/pages/vendor/VendorOrderDetails";
import MainWebsite from "@/pages/MainWebsite";
import PGBooking from "@/pages/PGBooking";
import AdminVehicleManagement from "@/components/AdminVehicleManagement";
import VehicleDashboard from "@/components/VehicleDashboard";
import OfflineStoreAuth from "@/pages/OfflineStoreAuth";
import OfflineStoreDeskPage from "@/pages/OfflineStoreDeskPage";
import DeskLogin from "@/pages/desk/DeskLogin";
import DeskDashboard from "@/pages/desk/DeskDashboard";
import RiderDeskLogin from "@/pages/rider-desk/RiderDeskLogin";
import RiderDeskDashboard from "@/pages/rider-desk/RiderDeskDashboard";
import "./App.css";
import "./styles/mobile-fixes.css";
import "./styles/mobile-touch-fixes.css";

// Redirect guard: ensures native Capacitor apps land on the correct route
// based on their app ID, regardless of stale build-injected redirects
function AppRedirectGuard() {
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const hash = location.pathname;
    // Map app IDs to their correct starting routes
    const appRoutes: Record<string, { prefix: string; login: string }> = {
      "com.laundrify.desk.app":  { prefix: "/desk",       login: "/desk" },
      "com.laundrify.rider.app": { prefix: "/rider-desk",  login: "/rider-desk" },
      "com.laundrify.laundry.app": { prefix: "/",          login: "/" },
    };

    CapacitorApp.getInfo().then(({ id }) => {
      const route = appRoutes[id];
      if (!route) return;
      // If the current route doesn't belong to this app, redirect to the app's login
      if (route.prefix !== "/" && !hash.startsWith(route.prefix)) {
        window.location.hash = `#${route.login}`;
      }
    }).catch(() => {});
  }, []);

  return null;
}

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
  const [updateConfig, setUpdateConfig] = useState<{
    isOpen: boolean;
    latestVersion: string;
    updateUrl: { android?: string; ios?: string };
  }>({
    isOpen: false,
    latestVersion: "",
    updateUrl: {},
  });

  // helper function to compare semantic versions 
  const compareVersions = (v1: string, v2: string) => {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  };

  // Initialize authentication persistence and restore user session
  useEffect(() => {
    const checkAppUpdates = async () => {
      // Only check on native platforms (iOS/Android via Capacitor)
      if (!Capacitor.isNativePlatform()) return;

      try {
        const url = `${getApiUrl().replace(/\/$/, '')}/config/mobile-app-version`;
        const response = await fetch(url);
        
        if (response.ok) {
          const configDetails = await response.json();
          const { minRequiredVersion, latestVersion, updateUrl } = configDetails;

          const appInfo = await CapacitorApp.getInfo();
          const currentVersion = appInfo.version;

          if (compareVersions(currentVersion, minRequiredVersion) < 0) {
            console.warn(`[App Update] App is outdated. Current: ${currentVersion}, Min Required: ${minRequiredVersion}`);
            setUpdateConfig({
              isOpen: true,
              latestVersion,
              updateUrl,
            });
          }
        }
      } catch (error) {
        console.error("Failed to check for app updates:", error);
      }
    };

    const initializeAuth = async () => {
      // Auto-clear cart on deploy (only once)
      const versionKey = "catalogue-version-v2";
      if (!localStorage.getItem(versionKey)) {
        localStorage.removeItem("cart");
        localStorage.setItem(versionKey, "true");
      }

      // Initialize auth persistence handlers (storage events, page lifecycle, etc.)
      initializeAuthPersistence();

      // Initialize global push notifications for all devices
      import("@/services/MobilePushService").then((mod) => {
        mod.default.getInstance().initialize();
      });

      // Initialize PWA updates and service worker cleanup
      // Disabled: causes service worker loading issues
      // initializePWAUpdates();

      // Restore authentication state from localStorage
      await restoreAuthState();
      
      // After auth restores, check for forces updates
      await checkAppUpdates();
    };

    initializeAuth();
  }, []);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <Router>
          <AppRedirectGuard />
          <AnalyticsTracker />
          <div className="App">
            <Routes>
              <Route path="/" element={<LaundryIndex />} />
              <Route path="/main" element={<MainWebsite />} />
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
              <Route path="/vendor/login" element={<VendorLogin />} />
              <Route path="/vendor/dashboard" element={<VendorDashboard />} />
              <Route path="/vendor/orders/:orderId" element={<VendorOrderDetails />} />
              <Route path="/pg-booking" element={<PGBooking />} />
              <Route path="/admin/vehicles" element={<AdminVehicleManagement />} />
              <Route path="/driver/dashboard" element={<VehicleDashboard />} />
              <Route path="/offlinestore/login" element={<OfflineStoreAuth />} />
              <Route path="/offlinestore/desk" element={<OfflineStoreDeskPage />} />
              {/* Vendor Desk */}
              <Route path="/desk" element={<DeskLogin />} />
              <Route path="/desk/dashboard" element={<DeskDashboard />} />
              {/* Rider Desk */}
              <Route path="/rider-desk" element={<RiderDeskLogin />} />
              <Route path="/rider-desk/dashboard" element={<RiderDeskDashboard />} />
              <Route path="*" element={<LaundryIndex />} />
            </Routes>
            <Toaster />
            <SonnerToaster />
            <MapsPerformanceIndicator />
            <ForceUpdateModal 
              isOpen={updateConfig.isOpen}
              latestVersion={updateConfig.latestVersion}
              updateUrl={updateConfig.updateUrl}
            />
          </div>
        </Router>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;
