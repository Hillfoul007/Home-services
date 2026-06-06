/**
 * RiderLocationContext
 *
 * Tracks the rider's GPS position and broadcasts it to the server.
 *
 * Transport priority:
 *   1. Socket.io WebSocket  → emits on every fix
 *   2. HTTP POST fallback   → used when socket is disconnected / offline
 *   3. Android HTTP fallback inside LocationForegroundService (app killed)
 *
 * Location source (in priority order):
 *   Native Android  → LocationForegroundService (Fused Location + Kalman filter)
 *   Web / iOS       → navigator.geolocation.watchPosition + JS Kalman filter
 *
 * Key improvements:
 *   - saveAuth() called on every start so Android HTTP fallback works when app is killed
 *   - Battery exemption prompt on first native start
 *   - signalLost flag when no fix arrives for >30s (watchdog + visibilitychange)
 *   - Adaptive periodic interval: 8s when moving, 30s when stationary
 *   - heading forwarded from GPS so desk map can show a direction arrow
 *   - rider:new_order socket event re-emitted as DOM event for RiderDashboard
 *   - lastLocationAt exposed so UI can show "GPS stale" warnings
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
export interface RiderLocation {
  lat: number;
  lng: number;
  heading?: number; // degrees 0-360
}

interface RiderLocationContextType {
  currentLocation: RiderLocation | null;
  isTracking: boolean;
  locationError: string | null;
  socketConnected: boolean;
  lastLocationAt: number | null; // epoch ms of last GPS fix
  signalLost: boolean;           // true when >30s without a fix
}

const RiderLocationContext = createContext<RiderLocationContextType>({
  currentLocation: null,
  isTracking: false,
  locationError: null,
  socketConnected: false,
  lastLocationAt: null,
  signalLost: false,
});

export const useRiderLocation = () => useContext(RiderLocationContext);

// ─── Constants ─────────────────────────────────────────────────────────────────
const SIGNAL_LOST_MS        = 30_000;  // declare signal lost after 30s without fix
const MOVING_THRESHOLD_MPS  = 1.4;    // 5 km/h — above this = "moving"
const PERIODIC_MOVING_MS    = 8_000;  // force-push interval when moving
const PERIODIC_IDLE_MS      = 30_000; // force-push interval when stationary

// ─── JS Kalman filter (web / iOS path) ────────────────────────────────────────
class KalmanLatLng {
  private variance = -1;
  private lat = 0;
  private lng = 0;
  private tsMs = 0;
  private readonly processNoise: number;

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

// Haversine speed helper (m/s between two fixes)
function speedMps(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  dtMs: number
): number {
  if (dtMs <= 0) return 0;
  const toRad = (v: number) => v * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const a2 = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  const dist = R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
  return dist / (dtMs / 1000);
}

// ─── Provider ──────────────────────────────────────────────────────────────────
export function RiderLocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<RiderLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastLocationAt, setLastLocationAt] = useState<number | null>(null);
  const [signalLost, setSignalLost] = useState(false);

  const socketRef          = useRef<Socket | null>(null);
  const socketAuthRef      = useRef<boolean>(false);
  const webWatchIdRef      = useRef<number | null>(null);
  const periodicRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeListenerRef  = useRef<PluginListenerHandle | null>(null);
  const lastSentRef        = useRef<number>(0);
  const lastSocketSentRef  = useRef<number>(0);
  const lastSentLocRef     = useRef<RiderLocation | null>(null);
  const lastLocTimestampRef = useRef<number>(0); // ms of last received fix
  const kalmanRef          = useRef<KalmanLatLng>(new KalmanLatLng(25));
  const isMovingRef        = useRef<boolean>(false);
  const batteryExemptionAskedRef = useRef<boolean>(false);

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

    // Instant new-order notification — re-emit as DOM event for RiderDashboard
    socket.on('rider:new_order', (data: unknown) => {
      console.log('📦 New order via socket:', data);
      window.dispatchEvent(new CustomEvent('riderNewOrder', { detail: data }));
    });

    socket.on('disconnect', (reason) => {
      console.log('🔴 Rider socket disconnected:', reason);
      setSocketConnected(false);
      socketAuthRef.current = false;
    });

    socket.on('connect_error', (err: Error & { description?: number | string }) => {
      console.warn('Rider socket connect error:', err.message);
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

  // ── Mark a fresh fix arrived ───────────────────────────────────────────────
  const onFixReceived = useCallback(() => {
    const now = Date.now();
    lastLocTimestampRef.current = now;
    setLastLocationAt(now);
    setSignalLost(false);
    setLocationError(null);
  }, []);

  // ── Send location (socket preferred, HTTP fallback) ────────────────────────
  const sendLocation = useCallback(async (location: RiderLocation, force = false) => {
    const token    = localStorage.getItem('riderToken');
    const riderRaw = localStorage.getItem('riderAuth');
    if (!token || !riderRaw) return;

    const rider   = JSON.parse(riderRaw);
    const riderId = rider._id || rider.id;
    const now     = Date.now();

    // ── Socket path ──
    if (socketRef.current?.connected && socketAuthRef.current) {
      if (!force && now - lastSocketSentRef.current < 1500) return;
      lastSocketSentRef.current = now;
      lastSentLocRef.current    = location;

      socketRef.current.emit('rider:location', {
        rider_id:  riderId,
        lat:       location.lat,
        lng:       location.lng,
        heading:   location.heading ?? 0,
        status:    'idle',
        order_id:  null,
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
      const res = await fetch(getRiderApiUrl('/location'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ riderId, location, timestamp: ts }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (res.status === 401 || res.status === 400) {
        // Token invalid/expired — clear stored credentials so rider is forced to re-login
        localStorage.removeItem('riderToken');
        localStorage.removeItem('riderAuth');
        window.location.href = '/rider/login';
        return;
      }
    } catch {
      enqueue({ lat: location.lat, lng: location.lng, status: 'idle', order_id: null, timestamp: ts });
    }
  }, []);

  // ── Restart periodic push with correct interval based on movement ──────────
  const restartPeriodicWithInterval = useCallback((ms: number) => {
    if (periodicRef.current) clearInterval(periodicRef.current);
    periodicRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const raw = pos.coords;
          kalmanRef.current.process(raw.latitude, raw.longitude, raw.accuracy, pos.timestamp);
          const loc: RiderLocation = {
            lat:     kalmanRef.current.getLat(),
            lng:     kalmanRef.current.getLng(),
            heading: raw.heading ?? undefined,
          };
          setCurrentLocation(loc);
          onFixReceived();
          sendLocation(loc, true);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
      );
    }, ms);
  }, [sendLocation, onFixReceived]);

  // ── Web watchPosition fallback (also used on iOS) ──────────────────────────
  const startWebTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('GPS not available on this device');
      return;
    }

    kalmanRef.current = new KalmanLatLng(25);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const raw = position.coords;
        const prevLoc = lastSentLocRef.current;
        kalmanRef.current.process(raw.latitude, raw.longitude, raw.accuracy, position.timestamp);
        const loc: RiderLocation = {
          lat:     kalmanRef.current.getLat(),
          lng:     kalmanRef.current.getLng(),
          heading: raw.heading ?? undefined,
        };

        // Adaptive interval: switch periodic push rate based on speed
        if (prevLoc) {
          const dt = Date.now() - lastLocTimestampRef.current;
          const spd = speedMps(prevLoc, loc, dt);
          const nowMoving = spd > MOVING_THRESHOLD_MPS;
          if (nowMoving !== isMovingRef.current) {
            isMovingRef.current = nowMoving;
            restartPeriodicWithInterval(nowMoving ? PERIODIC_MOVING_MS : PERIODIC_IDLE_MS);
          }
        }

        setCurrentLocation(loc);
        onFixReceived();
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

    // Start periodic force-push (moving rate by default)
    restartPeriodicWithInterval(PERIODIC_MOVING_MS);
  }, [sendLocation, onFixReceived, restartPeriodicWithInterval]);

  // ── Stop tracking ──────────────────────────────────────────────────────────
  const stopTracking = useCallback(async () => {
    if (periodicRef.current) { clearInterval(periodicRef.current); periodicRef.current = null; }

    if (nativeListenerRef.current) {
      await nativeListenerRef.current.remove();
      nativeListenerRef.current = null;
    }
    if (Capacitor.isNativePlatform()) {
      await NativeLocation.stopTracking().catch(() => {});
      await NativeLocation.clearAuth().catch(() => {});
    }

    if (webWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }

    disconnectSocket();
    setIsTracking(false);
    setCurrentLocation(null);
    setLocationError(null);
    setLastLocationAt(null);
    setSignalLost(false);
  }, [disconnectSocket]);

  // ── Start tracking ─────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    connectSocket();

    if (Capacitor.isNativePlatform()) {
      // ── Native Android: Fused Location + foreground service + Kalman ──
      try {
        await NativeLocation.startTracking();

        // CRITICAL: save auth so the foreground service can HTTP-POST when WebView is paused/killed
        const token    = localStorage.getItem('riderToken') || '';
        const riderRaw = localStorage.getItem('riderAuth');
        const riderId  = riderRaw ? (JSON.parse(riderRaw)._id || JSON.parse(riderRaw).id || '') : '';
        const apiUrl   = getRiderApiUrl('/location');
        if (riderId && token) {
          await NativeLocation.saveAuth({ riderId, token, apiUrl }).catch(() => {});
          console.log('✅ Native auth saved for HTTP fallback');
        }

        // Ask for battery optimisation exemption once per install
        if (!batteryExemptionAskedRef.current) {
          batteryExemptionAskedRef.current = true;
          await NativeLocation.requestBatteryExemption().catch(() => {});
        }

        const handle = await NativeLocation.addListener('location', (update) => {
          const loc: RiderLocation = {
            lat:     update.lat,
            lng:     update.lng,
            heading: update.heading,
          };

          // Adaptive interval for native path too
          const prevLoc = lastSentLocRef.current;
          if (prevLoc) {
            const dt = Date.now() - lastLocTimestampRef.current;
            const spd = speedMps(prevLoc, loc, dt);
            // Native service fires every 2s regardless; we only need to adjust
            // the socket throttle, which is already 1.5s minimum. No periodic needed.
            isMovingRef.current = spd > MOVING_THRESHOLD_MPS;
          }

          setCurrentLocation(loc);
          onFixReceived();
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
  }, [connectSocket, sendLocation, startWebTracking, onFixReceived]);

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
      if (document.visibilityState !== 'visible') return;
      const t = localStorage.getItem('riderToken');
      if (!t) return;

      // Reconnect socket if it dropped while backgrounded
      if (!socketRef.current?.connected) connectSocket();

      if (Capacitor.isNativePlatform()) {
        // Native service keeps running; just refresh auth in case token rotated
        const riderRaw = localStorage.getItem('riderAuth');
        const riderId  = riderRaw ? (JSON.parse(riderRaw)._id || JSON.parse(riderRaw).id || '') : '';
        const apiUrl   = getRiderApiUrl('/location');
        if (riderId) NativeLocation.saveAuth({ riderId, token: t, apiUrl }).catch(() => {});
      } else {
        // Web/iOS: check staleness — if no fix for >30s, restart watchPosition
        const staleMs = Date.now() - lastLocTimestampRef.current;
        if (staleMs > SIGNAL_LOST_MS || webWatchIdRef.current === null) {
          console.log(`[visibility] GPS stale (${Math.round(staleMs / 1000)}s) — restarting watchPosition`);
          // Clear old watch before restarting
          if (webWatchIdRef.current !== null) {
            navigator.geolocation.clearWatch(webWatchIdRef.current);
            webWatchIdRef.current = null;
          }
          if (periodicRef.current) { clearInterval(periodicRef.current); periodicRef.current = null; }
          startWebTracking();
        }
      }
    };

    const handleOnline = async () => {
      if (!socketRef.current?.connected) {
        connectSocket();
      } else if (socketAuthRef.current) {
        const queued = await dequeueAll();
        if (queued.length > 0) {
          const riderRaw = localStorage.getItem('riderAuth');
          const riderId  = riderRaw ? (JSON.parse(riderRaw)._id || JSON.parse(riderRaw).id) : null;
          console.log(`📤 Online: flushing ${queued.length} queued updates`);
          queued.forEach(({ lat, lng, status, order_id, timestamp }) => {
            socketRef.current?.emit('rider:location', {
              rider_id: riderId, lat, lng,
              status: status || 'idle', order_id: order_id || null, timestamp,
            });
          });
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('riderLogout', stopTracking);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Watchdog: reconnect socket + detect signal loss
    const watchdog = setInterval(() => {
      const t = localStorage.getItem('riderToken');
      if (!t) return;

      // Reconnect dead socket
      if (!socketRef.current?.connected) {
        console.log('[watchdog] socket down — reconnecting');
        connectSocket();
      }

      // Detect signal loss
      if (lastLocTimestampRef.current > 0) {
        const staleMs = Date.now() - lastLocTimestampRef.current;
        if (staleMs > SIGNAL_LOST_MS) {
          setSignalLost(true);
          setLocationError('GPS signal lost. Check location permissions.');
          console.warn(`[watchdog] signal lost — last fix ${Math.round(staleMs / 1000)}s ago`);
        }
      }
    }, 10_000);

    return () => {
      clearInterval(watchdog);
      stopTracking();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('riderLogout', stopTracking);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startTracking, stopTracking, connectSocket, startWebTracking]);

  return (
    <RiderLocationContext.Provider value={{
      currentLocation,
      isTracking,
      locationError,
      socketConnected,
      lastLocationAt,
      signalLost,
    }}>
      {children}
    </RiderLocationContext.Provider>
  );
}
