import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { getRiderApiUrl } from '@/lib/riderApi';

interface RiderLocationContextType {
  currentLocation: { lat: number; lng: number } | null;
  isTracking: boolean;
  locationError: string | null;
}

const RiderLocationContext = createContext<RiderLocationContextType>({
  currentLocation: null,
  isTracking: false,
  locationError: null,
});

export const useRiderLocation = () => useContext(RiderLocationContext);

export function RiderLocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // For native background geolocation, the watcher ID is a string
  const bgWatcherIdRef = useRef<string | null>(null);
  // For web fallback, the watcher ID is a number
  const webWatchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  const updateLocationOnServer = useCallback(async (location: { lat: number; lng: number }, force = false) => {
    // Throttle server updates to once every 15 seconds (unless forced)
    const now = Date.now();
    if (!force && now - lastSentRef.current < 15000) return;
    lastSentRef.current = now;

    try {
      const token = localStorage.getItem('riderToken');
      const riderData = localStorage.getItem('riderAuth');
      if (!token || !riderData) return;
      if (!navigator.onLine) return;

      const rider = JSON.parse(riderData);
      const apiUrl = getRiderApiUrl('/location');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          riderId: rider._id,
          location,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      // Silent fail for background location updates
      console.warn('Background location update failed:', error);
    }
  }, []);

  const stopTracking = useCallback(async () => {
    // Clear periodic push
    if (periodicPushRef.current) {
      clearInterval(periodicPushRef.current);
      periodicPushRef.current = null;
    }

    // Stop native background geolocation watcher
    if (bgWatcherIdRef.current !== null) {
      try {
        const BackgroundGeolocation = (await import('@capacitor-community/background-geolocation')).default;
        await BackgroundGeolocation.removeWatcher({ id: bgWatcherIdRef.current });
      } catch (e) {
        console.warn('Failed to remove background geolocation watcher:', e);
      }
      bgWatcherIdRef.current = null;
    }

    // Stop web fallback watcher
    if (webWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }

    setIsTracking(false);
    setCurrentLocation(null);
    setLocationError(null);
  }, []);

  // Periodic forced push every 60 seconds even if no movement
  const periodicPushRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTracking = useCallback(async () => {
    // Already tracking
    if (bgWatcherIdRef.current !== null || webWatchIdRef.current !== null) return;

    // Immediately get current position and push to server (forced)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(loc);
          updateLocationOnServer(loc, true);
        },
        () => { /* silent — watchPosition will handle errors */ },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    if (Capacitor.isNativePlatform()) {
      // ── Native: use background geolocation so location works even when app is closed ──
      try {
        const BackgroundGeolocation = (await import('@capacitor-community/background-geolocation')).default;

        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Laundrify is tracking your location for deliveries.',
            backgroundTitle: 'Laundrify Rider — Location Active',
            requestPermissions: true,
            stale: false,
            distanceFilter: 10, // update every 10 metres movement (was 30)
          },
          (position, error) => {
            if (error) {
              console.error('BackgroundGeolocation error:', error);
              const msg =
                error.code === 'NOT_AUTHORIZED'
                  ? 'Location permission denied. Enable in phone settings.'
                  : error.code === 'TIMEOUT'
                  ? 'GPS timeout. Check GPS settings.'
                  : 'GPS signal unavailable.';
              setLocationError(msg);
              return;
            }
            if (position) {
              const location = { lat: position.latitude, lng: position.longitude };
              setCurrentLocation(location);
              setLocationError(null);
              updateLocationOnServer(location);
            }
          }
        );

        bgWatcherIdRef.current = watcherId;
        setIsTracking(true);
        console.log('✅ Background geolocation started, watcher:', watcherId);
      } catch (e) {
        console.error('BackgroundGeolocation failed, falling back to web API:', e);
        // Fall through to web watchPosition below
        startWebTracking();
      }
    } else {
      startWebTracking();
    }

    // Periodic force-push every 60 seconds even when rider isn't moving
    if (periodicPushRef.current) clearInterval(periodicPushRef.current);
    periodicPushRef.current = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCurrentLocation(loc);
            updateLocationOnServer(loc, true);
          },
          () => { /* silent */ },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
      }
    }, 60000);
  }, [updateLocationOnServer]); // eslint-disable-line react-hooks/exhaustive-deps

  const startWebTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('GPS not available on this device');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(location);
        setLocationError(null);
        updateLocationOnServer(location);
      },
      (error) => {
        console.error('RiderLocationContext: GPS error', error);
        const msg =
          error.code === 1
            ? 'Location permission denied. Enable in phone settings.'
            : error.code === 2
            ? 'GPS signal unavailable. Move to an open area.'
            : 'Location timeout. Check GPS settings.';
        setLocationError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    webWatchIdRef.current = watchId;
    setIsTracking(true);
  }, [updateLocationOnServer]);

  // Start/stop tracking based on rider auth state
  useEffect(() => {
    const token = localStorage.getItem('riderToken');
    const riderData = localStorage.getItem('riderAuth');

    if (token && riderData) {
      startTracking();
    } else {
      stopTracking();
    }

    // Listen for logout from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'riderToken' && !e.newValue) {
        stopTracking();
      }
    };

    // Listen for custom logout event dispatched by RiderLayout
    const handleRiderLogout = () => {
      stopTracking();
    };

    // Push location when app comes back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const t = localStorage.getItem('riderToken');
        if (t && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              setCurrentLocation(loc);
              updateLocationOnServer(loc, true);
            },
            () => { /* silent */ },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('riderLogout', handleRiderLogout);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTracking();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('riderLogout', handleRiderLogout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startTracking, stopTracking, updateLocationOnServer]);

  return (
    <RiderLocationContext.Provider value={{ currentLocation, isTracking, locationError }}>
      {children}
    </RiderLocationContext.Provider>
  );
}
