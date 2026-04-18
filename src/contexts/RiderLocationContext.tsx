/**
 * RiderLocationContext
 *
 * Tracks the rider's GPS position and broadcasts it to the server.
 *
 * Transport priority:
 *   1. Socket.io WebSocket  → emits every 2-3 s, only if moved >10 m
 *   2. HTTP POST fallback   → used when socket is disconnected / offline
 *
 * Background tracking (native):
 *   Uses @capacitor-community/background-geolocation so the app keeps
 *   tracking even when minimised (Android foreground service).
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { getRiderApiUrl } from '@/lib/riderApi';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '@/config/env';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface RiderLocationContextType {
  currentLocation: { lat: number; lng: number } | null;
  isTracking: boolean;
  locationError: string | null;
  socketConnected: boolean;
}

const RiderLocationContext = createContext<RiderLocationContextType>({
  currentLocation: null,
  isTracking: false,
  locationError: null,
  socketConnected: false,
});

export const useRiderLocation = () => useContext(RiderLocationContext);

// ─── Helpers ───────────────────────────────────────────────────────────────────
/** Haversine distance in metres */
function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Offline queue ─────────────────────────────────────────────────────────────
interface QueuedUpdate {
  location: { lat: number; lng: number };
  timestamp: string;
}

const offlineQueue: QueuedUpdate[] = [];
const MAX_QUEUE = 20;

function enqueueOffline(location: { lat: number; lng: number }) {
  if (offlineQueue.length >= MAX_QUEUE) offlineQueue.shift();
  offlineQueue.push({ location, timestamp: new Date().toISOString() });
}

// ─── Provider ──────────────────────────────────────────────────────────────────
export function RiderLocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const bgWatcherIdRef = useRef<string | null>(null);
  const webWatchIdRef = useRef<number | null>(null);
  const periodicPushRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<number>(0);
  const lastSocketSentRef = useRef<number>(0);
  const lastSentLocRef = useRef<{ lat: number; lng: number } | null>(null);
  const socketAuthRef = useRef<boolean>(false);

  // ── Socket.io connection ──────────────────────────────────────────────────
  const connectSocket = useCallback(() => {
    const token = localStorage.getItem('riderToken');
    const riderData = localStorage.getItem('riderAuth');
    if (!token || !riderData) return;

    const rider = JSON.parse(riderData);
    const riderId = rider._id || rider.id;

    const baseUrl = getApiUrl();
    const socketUrl = baseUrl.replace('/api', ''); // strip /api path

    if (socketRef.current?.connected) return;

    const socket = io(`${socketUrl}/rider`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('🟢 Rider socket connected');
      setSocketConnected(true);

      // Auth handshake
      socket.emit('rider:connect', { rider_id: riderId, token });
    });

    socket.on('rider:connected', () => {
      socketAuthRef.current = true;
      console.log('✅ Rider socket authenticated');

      // Flush offline queue
      if (offlineQueue.length > 0) {
        console.log(`📤 Flushing ${offlineQueue.length} queued location updates`);
        offlineQueue.forEach(({ location, timestamp }) => {
          socket.emit('rider:location', {
            rider_id: riderId,
            lat: location.lat,
            lng: location.lng,
            status: 'idle',
            order_id: null,
            timestamp,
          });
        });
        offlineQueue.length = 0;
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔴 Rider socket disconnected:', reason);
      setSocketConnected(false);
      socketAuthRef.current = false;
    });

    socket.on('error', (err) => {
      console.warn('Socket error:', err);
    });

    socketRef.current = socket;
  }, []);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    socketAuthRef.current = false;
    setSocketConnected(false);
  }, []);

  // ── Send location (WebSocket preferred, HTTP fallback) ─────────────────────
  const sendLocation = useCallback(async (location: { lat: number; lng: number }, force = false) => {
    const token = localStorage.getItem('riderToken');
    const riderData = localStorage.getItem('riderAuth');
    if (!token || !riderData) return;

    const rider = JSON.parse(riderData);
    const riderId = rider._id || rider.id;

    const now = Date.now();

    // ── Try Socket.io (2-3 s interval, 10 m movement filter) ──
    if (socketRef.current?.connected && socketAuthRef.current) {
      const socketThrottle = force ? 0 : 2500;
      if (now - lastSocketSentRef.current < socketThrottle) return;

      // 10-metre movement filter
      if (!force && lastSentLocRef.current) {
        const dist = distanceMetres(
          lastSentLocRef.current.lat, lastSentLocRef.current.lng,
          location.lat, location.lng
        );
        if (dist < 10) return;
      }

      lastSocketSentRef.current = now;
      lastSentLocRef.current = location;

      socketRef.current.emit('rider:location', {
        rider_id: riderId,
        lat: location.lat,
        lng: location.lng,
        status: 'idle',
        order_id: null,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // ── HTTP fallback (5 s throttle) ──
    if (!navigator.onLine) {
      enqueueOffline(location);
      return;
    }

    if (!force && now - lastSentRef.current < 5000) return;
    lastSentRef.current = now;
    lastSentLocRef.current = location;

    try {
      const apiUrl = getRiderApiUrl('/location');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ riderId, location, timestamp: new Date().toISOString() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch {
      enqueueOffline(location);
    }
  }, []);

  // ── Stop tracking ──────────────────────────────────────────────────────────
  const stopTracking = useCallback(async () => {
    if (periodicPushRef.current) {
      clearInterval(periodicPushRef.current);
      periodicPushRef.current = null;
    }

    if (bgWatcherIdRef.current !== null) {
      try {
        const BackgroundGeolocation = (await import('@capacitor-community/background-geolocation')).default;
        await BackgroundGeolocation.removeWatcher({ id: bgWatcherIdRef.current });
      } catch (e) {
        console.warn('Failed to remove bg geolocation watcher:', e);
      }
      bgWatcherIdRef.current = null;
    }

    if (webWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }

    disconnectSocket();
    setIsTracking(false);
    setCurrentLocation(null);
    setLocationError(null);
  }, [disconnectSocket]);

  // ── Web watchPosition fallback ─────────────────────────────────────────────
  const startWebTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('GPS not available on this device');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(loc);
        setLocationError(null);
        sendLocation(loc);
      },
      (error) => {
        const msg =
          error.code === 1
            ? 'Location permission denied. Enable in phone settings.'
            : error.code === 2
            ? 'GPS signal unavailable. Move to an open area.'
            : 'Location timeout. Check GPS settings.';
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    webWatchIdRef.current = watchId;
    setIsTracking(true);
  }, [sendLocation]);

  // ── Start tracking ─────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (bgWatcherIdRef.current !== null || webWatchIdRef.current !== null) return;

    // Connect socket first
    connectSocket();

    // Immediately get current position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(loc);
          sendLocation(loc, true);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const BackgroundGeolocation = (await import('@capacitor-community/background-geolocation')).default;

        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Location tracking is active — required for live delivery tracking.',
            backgroundTitle: '🛵 Laundrify Rider — Live Tracking ON',
            requestPermissions: true,
            stale: false,
            distanceFilter: 0,
          },
          (position, error) => {
            if (error) {
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
              const loc = { lat: position.latitude, lng: position.longitude };
              setCurrentLocation(loc);
              setLocationError(null);
              sendLocation(loc);
            }
          }
        );

        bgWatcherIdRef.current = watcherId;
        setIsTracking(true);
      } catch (e) {
        console.error('BackgroundGeolocation failed, falling back to web API:', e);
        startWebTracking();
      }
    } else {
      startWebTracking();
    }

    // Periodic force-push every 8 s even when rider isn't moving
    if (periodicPushRef.current) clearInterval(periodicPushRef.current);
    periodicPushRef.current = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCurrentLocation(loc);
            sendLocation(loc, true);
          },
          () => {
            if (!Capacitor.isNativePlatform() && webWatchIdRef.current === null) {
              startWebTracking();
            }
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
        );
      }
    }, 8000);
  }, [connectSocket, sendLocation, startWebTracking]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('riderToken');
    const riderData = localStorage.getItem('riderAuth');

    if (token && riderData) {
      startTracking();
    } else {
      stopTracking();
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'riderToken' && !e.newValue) stopTracking();
    };

    const handleRiderLogout = () => stopTracking();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const t = localStorage.getItem('riderToken');
        if (!t) return;

        // Reconnect socket if needed
        if (!socketRef.current?.connected) connectSocket();

        if (bgWatcherIdRef.current === null && webWatchIdRef.current === null) {
          startTracking();
          return;
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              setCurrentLocation(loc);
              sendLocation(loc, true);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      }
    };

    // Flush queue on reconnect
    const handleOnline = () => {
      if (!socketRef.current?.connected) connectSocket();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('riderLogout', handleRiderLogout);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTracking();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('riderLogout', handleRiderLogout);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startTracking, stopTracking, connectSocket, sendLocation]);

  return (
    <RiderLocationContext.Provider value={{ currentLocation, isTracking, locationError, socketConnected }}>
      {children}
    </RiderLocationContext.Provider>
  );
}
