import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getRiderApiUrl } from '@/lib/riderApi';

interface RiderLocationContextType {
  currentLocation: { lat: number; lng: number } | null;
  isTracking: boolean;
}

const RiderLocationContext = createContext<RiderLocationContextType>({
  currentLocation: null,
  isTracking: false,
});

export const useRiderLocation = () => useContext(RiderLocationContext);

export function RiderLocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  const updateLocationOnServer = useCallback(async (location: { lat: number; lng: number }) => {
    // Throttle server updates to once every 30 seconds
    const now = Date.now();
    if (now - lastSentRef.current < 30000) return;
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

  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return; // Already tracking
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(location);
        updateLocationOnServer(location);
      },
      (error) => {
        console.error('RiderLocationContext: GPS error', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    watchIdRef.current = watchId;
    setIsTracking(true);
  }, [updateLocationOnServer]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setCurrentLocation(null);
  }, []);

  // Start/stop tracking based on rider auth state
  useEffect(() => {
    const token = localStorage.getItem('riderToken');
    const riderData = localStorage.getItem('riderAuth');

    if (token && riderData) {
      startTracking();
    } else {
      stopTracking();
    }

    // Listen for logout (storage changes from other tabs or manual clear)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'riderToken' && !e.newValue) {
        stopTracking();
      }
    };

    // Listen for custom logout event dispatched by RiderLayout
    const handleRiderLogout = () => {
      stopTracking();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('riderLogout', handleRiderLogout);

    return () => {
      stopTracking();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('riderLogout', handleRiderLogout);
    };
  }, [startTracking, stopTracking]);

  return (
    <RiderLocationContext.Provider value={{ currentLocation, isTracking }}>
      {children}
    </RiderLocationContext.Provider>
  );
}
