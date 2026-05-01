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
import PWAUpdateNotification from "@/components/PWAUpdateNotification";
import analyticsService from "@/services/analyticsService";

import {
  initializeAuthPersistence,
  restoreAuthState,
} from "@/utils/authPersistence";
import { initializePWAUpdates, setSwReloadCallback } from "@/utils/swCleanup";
import "@/utils/testEnvironment"; // Auto-run environment tests in development
import ForceUpdateModal from "@/components/ForceUpdateModal";
import { APP_VERSION } from "@/config/version";
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
import DeskReadyPage from "@/pages/desk/DeskReadyPage";
import RiderDeskLogin from "@/pages/rider-desk/RiderDeskLogin";
import RiderDeskDashboard from "@/pages/rider-desk/RiderDeskDashboard";
import SchoolManagerLogin from "@/pages/school/SchoolManagerLogin";
import SchoolManagerDashboard from "@/pages/school/SchoolManagerDashboard";
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
      "com.laundrify.rider.app": { prefix: "/rider-desk",  login: "/rider-desk/dashboard" },
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
    currentVersion: string;
    updateUrl: { android?: string; ios?: string };
    isWebUpdate: boolean;
  }>({
    isOpen: false,
    latestVersion: "",
    currentVersion: APP_VERSION,
    updateUrl: {},
    isWebUpdate: false,
  });

  // Compare semantic versions: returns -1, 0, or 1
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

  // Show a blocking update modal (web or native)
  const triggerForceUpdate = (latestVersion: string, updateUrl: { android?: string; ios?: string }, currentVersion: string, isWeb: boolean) => {
    setUpdateConfig({ isOpen: true, latestVersion, currentVersion, updateUrl, isWebUpdate: isWeb });
  };

  useEffect(() => {
    const checkAppUpdates = async () => {
      try {
        const url = `${getApiUrl().replace(/\/$/, '')}/config/mobile-app-version`;
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

        if (!response.ok) return;
        const config = await response.json();
        const { minRequiredVersion, latestVersion, updateUrl = {} } = config;
        if (!minRequiredVersion) return;

        if (Capacitor.isNativePlatform()) {
          // Native: get real version from Capacitor
          const appInfo = await CapacitorApp.getInfo();
          const currentVersion = appInfo.version;
          if (compareVersions(currentVersion, minRequiredVersion) < 0) {
            console.warn(`[Update] Native outdated: ${currentVersion} < ${minRequiredVersion}`);
            triggerForceUpdate(latestVersion, updateUrl, currentVersion, false);
          }
        } else {
          // Web: compare embedded APP_VERSION against server minimum
          const currentVersion = APP_VERSION;
          if (compareVersions(currentVersion, minRequiredVersion) < 0) {
            console.warn(`[Update] Web outdated: ${currentVersion} < ${minRequiredVersion}`);
            triggerForceUpdate(latestVersion, updateUrl, currentVersion, true);
          }
        }
      } catch (error) {
        // Silent — don't block app if version check fails
        console.warn("[Update] Version check failed:", error);
      }
    };

    const initializeAuth = async () => {
      // Auto-clear cart on first run after version bump
      const versionKey = `catalogue-version-${APP_VERSION}`;
      if (!localStorage.getItem(versionKey)) {
        localStorage.removeItem("cart");
        localStorage.setItem(versionKey, "true");
      }

      // Initialize auth persistence handlers
      initializeAuthPersistence();

      // Push notifications
      import("@/services/MobilePushService").then((mod) => {
        mod.default.getInstance().initialize();
      });

      // Register service worker + wire auto-reload on non-native
      if (!Capacitor.isNativePlatform()) {
        // When SW posts SW_UPDATED → hard reload to get new code
        setSwReloadCallback(() => {
          console.log('[SW] Reloading for new version...');
          window.location.reload();
        });
        initializePWAUpdates();
      }

      // Restore auth state
      await restoreAuthState();

      // Check for mandatory update (runs on every app open)
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
              <Route path="/desk/ready" element={<DeskReadyPage />} />
              {/* Rider Desk */}
              <Route path="/rider-desk" element={<RiderDeskLogin />} />
              <Route path="/rider-desk/dashboard" element={<RiderDeskDashboard />} />
              {/* School Manager */}
              <Route path="/school-manager" element={<SchoolManagerLogin />} />
              <Route path="/school-manager/dashboard" element={<SchoolManagerDashboard />} />
              <Route path="*" element={<LaundryIndex />} />
            </Routes>
            <Toaster />
            <SonnerToaster />
            <MapsPerformanceIndicator />
            <PWAUpdateNotification />
            <ForceUpdateModal
              isOpen={updateConfig.isOpen}
              latestVersion={updateConfig.latestVersion}
              currentVersion={updateConfig.currentVersion}
              updateUrl={updateConfig.updateUrl}
              isWebUpdate={updateConfig.isWebUpdate}
            />
          </div>
        </Router>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;
