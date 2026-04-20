/**
 * RiderLocationContext
 *
 * Tracks the rider's GPS position and broadcasts it to the server.
 *
 * Transport priority:
 *   1. Socket.io WebSocket  → emits on every fix (2 s interval from native)
 *   2. HTTP POST fallback   → used when socket is disconnected / offline
 *
 * Location source (in priority order):
 *   Native Android  → LocationForegroundService (Fused Location + Kalman filter)
 *   Web / iOS       → navigator.geolocation.watchPosition + JS Kalman filter
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { getRiderApiUrl } from '@/lib/riderApi';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '@/config/env';
import NativeLocation from '@/plugins/NativeLocation';
import type { PluginListenerHandle } from '@capacitor/core';
import { enqueue, dequeueAll } from '@/utils/locationQueue';

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

// ─── JS Kalman filter (web / iOS path) ────────────────────────────────────────
class KalmanLatLng {
  private variance = -1;
  private lat = 0;
  private lng = 0;
  private tsMs = 0;
  private readonly processNoise: number; // m/s

  constructor(processNoiseMs = 25) {
    this.processNoise = processNoiseMs;
  }

  hasEstimate() { return this.variance >= 0; }

  process(lat: number, lng: number, accuracyM: number, timeMs: number) {
    const acc = Math.max(accuracyM, 1);
    if (this.variance < 0) {
      this.lat = lat; this.lng = lng;
      this.variance = acc * acc;
      this.tsMs = timeMs;
      return;
    }
    const dtSec = Math.max(timeMs - this.tsMs, 0) / 1000;
    this.variance += dtSec * this.processNoise * this.processNoise;
    this.tsMs = timeMs;
    const K = this.variance / (this.variance + acc * acc);
    this.lat += K * (lat - this.lat);
    this.lng += K * (lng - this.lng);
    this.variance = (1 - K) * this.variance;
  }

  getLat() { return this.lat; }
  getLng() { return this.lng; }
}

// Offline queue is provided by locationQueue.ts (IndexedDB-backed)

// ─── Provider ──────────────────────────────────────────────────────────────────
export function RiderLocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef       = useRef<Socket | null>(null);
  const socketAuthRef   = useRef<boolean>(false);
  const webWatchIdRef   = useRef<number | null>(null);
  const periodicRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);
  const lastSentRef     = useRef<number>(0);
  const lastSocketSentRef = useRef<number>(0);
  const lastSentLocRef  = useRef<{ lat: number; lng: number } | null>(null);
  const kalmanRef       = useRef<KalmanLatLng>(new KalmanLatLng(25));

  // ── Socket.io connection ──────────────────────────────────────────────────
  const connectSocket = useCallback(() => {
    const token    = localStorage.getItem('riderToken');
    const riderRaw = localStorage.getItem('riderAuth');
    if (!token || !riderRaw) return;

    const rider   = JSON.parse(riderRaw);
    const riderId = rider._id || rider.id;

    const apiUrl    = getApiUrl();
    const socketUrl = apiUrl.startsWith('http')
      ? apiUrl.replace(/\/api$/, '')
      : window.location.origin;

    if (socketRef.current?.connected) return;

    const socket = io(`${socketUrl}/rider`, {
      // WebSocket first — on server restart WS gets a clean close so socket.io
      // reconnects with a fresh handshake. Polling-first causes 400 loops because
      // the client keeps polling with an invalidated session id.
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 15000,
      reconnectionAttempts: Infinity,
      timeout: 30000,
    });

    socket.on('connect', () => {
      console.log('🟢 Rider socket connected');
      setSocketConnected(true);
      socket.emit('rider:connect', { rider_id: riderId, token });
    });

    socket.on('rider:connected', async () => {
      socketAuthRef.current = true;
      console.log('✅ Rider socket authenticated');

      // Flush IndexedDB offline queue
      const queued = await dequeueAll();
      if (queued.length > 0) {
        console.log(`📤 Flushing ${queued.length} queued updates`);
        queued.forEach(({ lat, lng, status, order_id, timestamp }) => {
          socket.emit('rider:location', {
            rider_id: riderId, lat, lng,
            status: status || 'idle', order_id: order_id || null, timestamp,
          });
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔴 Rider socket disconnected:', reason);
      setSocketConnected(false);
      socketAuthRef.current = false;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('connect_error', (err: Error & { description?: number | string }) => {
      console.warn('Rider socket connect error:', err.message);
      // 400 = stale session id after server restart — force fresh handshake
      const is400 =
        err.description === 400 ||
        String(err.description).includes('400') ||
        (err.message || '').includes('400');
      if (is400) {
        console.warn('Stale socket session — resetting engine for fresh handshake');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket.io as any).engine?.close();
      }
    });

    socket.on('error', (err) => console.warn('Socket error:', err));

    socketRef.current = socket;
  }, []);

  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    socketAuthRef.current = false;
    setSocketConnected(false);
  }, []);

  // ── Send location (socket preferred, HTTP fallback) ────────────────────────
  const sendLocation = useCallback(async (
    location: { lat: number; lng: number },
    force = false
  ) => {
    const token    = localStorage.getItem('riderToken');
    const riderRaw = localStorage.getItem('riderAuth');
    if (!token || !riderRaw) return;

    const rider   = JSON.parse(riderRaw);
    const riderId = rider._id || rider.id;
    const now     = Date.now();

    // ── Socket path ──
    if (socketRef.current?.connected && socketAuthRef.current) {
      // Throttle: native plugin already fires every 2s, no need to double-filter
      // Just apply a 1.5s minimum to avoid burst on reconnect
      if (!force && now - lastSocketSentRef.current < 1500) return;

      lastSocketSentRef.current = now;
      lastSentLocRef.current    = location;

      socketRef.current.emit('rider:location', {
        rider_id: riderId,
        lat:      location.lat,
        lng:      location.lng,
        status:   'idle',
        order_id: null,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // ── HTTP fallback ──
    const ts = new Date().toISOString();
    if (!navigator.onLine) {
      enqueue({ lat: location.lat, lng: location.lng, status: 'idle', order_id: null, timestamp: ts });
      return;
    }
    if (!force && now - lastSentRef.current < 5000) return;
    lastSentRef.current    = now;
    lastSentLocRef.current = location;

    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 8000);
      await fetch(getRiderApiUrl('/location'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ riderId, location, timestamp: ts }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
    } catch {
      enqueue({ lat: location.lat, lng: location.lng, status: 'idle', order_id: null, timestamp: ts });
    }
  }, []);

  // ── Web watchPosition fallback (also used on iOS) ──────────────────────────
  const startWebTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('GPS not available on this device');
      return;
    }

    // Reset Kalman on fresh start
    kalmanRef.current = new KalmanLatLng(25);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const raw = position.coords;
        kalmanRef.current.process(
          raw.latitude, raw.longitude,
          raw.accuracy, position.timestamp
        );
        const loc = { lat: kalmanRef.current.getLat(), lng: kalmanRef.current.getLng() };
        setCurrentLocation(loc);
        setLocationError(null);
        sendLocation(loc);
      },
      (error) => {
        const msg =
          error.code === 1 ? 'Location permission denied. Enable in phone settings.'
          : error.code === 2 ? 'GPS signal unavailable. Move to an open area.'
          : 'Location timeout. Check GPS settings.';
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    webWatchIdRef.current = watchId;
    setIsTracking(true);

    // Periodic force-push every 8 s so desk stays fresh even when not moving
    if (periodicRef.current) clearInterval(periodicRef.current);
    periodicRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const raw = pos.coords;
          kalmanRef.current.process(raw.latitude, raw.longitude, raw.accuracy, pos.timestamp);
          const loc = { lat: kalmanRef.current.getLat(), lng: kalmanRef.current.getLng() };
          setCurrentLocation(loc);
          sendLocation(loc, true);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
      );
    }, 8000);
  }, [sendLocation]);

  // ── Stop tracking ──────────────────────────────────────────────────────────
  const stopTracking = useCallback(async () => {
    if (periodicRef.current) { clearInterval(periodicRef.current); periodicRef.current = null; }

    if (nativeListenerRef.current) {
      await nativeListenerRef.current.remove();
      nativeListenerRef.current = null;
    }
    if (Capacitor.isNativePlatform()) {
      await NativeLocation.stopTracking().catch(() => {});
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

  // ── Start tracking ─────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    connectSocket();

    if (Capacitor.isNativePlatform()) {
      // ── Native Android: Fused Location + foreground service + Kalman ──
      try {
        await NativeLocation.startTracking();

        const handle = await NativeLocation.addListener('location', (update) => {
          const loc = { lat: update.lat, lng: update.lng };
          setCurrentLocation(loc);
          setLocationError(null);
          sendLocation(loc);
        });

        nativeListenerRef.current = handle;
        setIsTracking(true);
        console.log('✅ Native Fused Location tracking started');
      } catch (e) {
        console.error('Native location failed, falling back to web API:', e);
        startWebTracking();
      }
    } else {
      // ── Web / iOS: watchPosition + JS Kalman ──
      startWebTracking();
    }
  }, [connectSocket, sendLocation, startWebTracking]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const token    = localStorage.getItem('riderToken');
    const riderRaw = localStorage.getItem('riderAuth');

    if (token && riderRaw) {
      startTracking();
    } else {
      stopTracking();
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'riderToken' && !e.newValue) stopTracking();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const t = localStorage.getItem('riderToken');
        if (!t) return;
        if (!socketRef.current?.connected) connectSocket();
        // If native is running the service will still be alive; just reconnect socket
        if (!Capacitor.isNativePlatform() && webWatchIdRef.current === null) {
          startWebTracking();
        }
      }
    };

    const handleOnline = () => {
      if (!socketRef.current?.connected) connectSocket();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('riderLogout', stopTracking);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTracking();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('riderLogout', stopTracking);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startTracking, stopTracking, connectSocket, startWebTracking]);

  return (
    <RiderLocationContext.Provider value={{ currentLocation, isTracking, locationError, socketConnected }}>
      {children}
    </RiderLocationContext.Provider>
  );
}
