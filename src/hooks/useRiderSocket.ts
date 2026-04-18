/**
 * useRiderSocket
 *
 * Connects the desk dashboard to the Socket.io /desk namespace and
 * maintains a live map of rider states.
 *
 * Returns:
 *   riderMap   – Map<riderId, RiderSocketState>
 *   connected  – whether the socket is authenticated
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '@/config/env';

export interface RiderSocketState {
  rider_id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  status: 'idle' | 'assigned' | 'delivering' | string;
  order_id: string | null;
  timestamp: string;
  connected?: boolean;
}

export function useRiderSocket(token?: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [riderMap, setRiderMap] = useState<Map<string, RiderSocketState>>(new Map());

  const upsertRider = useCallback((data: Partial<RiderSocketState> & { rider_id: string }) => {
    setRiderMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(data.rider_id) || {} as RiderSocketState;
      next.set(data.rider_id, { ...existing, ...data });
      return next;
    });
  }, []);

  useEffect(() => {
    const baseUrl = getApiUrl().replace('/api', '');

    const socket = io(`${baseUrl}/desk`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🟢 Desk socket connected');
      // Send auth
      socket.emit('desk:connect', { token: token || undefined });
    });

    socket.on('desk:connected', () => {
      console.log('✅ Desk socket authenticated');
      setConnected(true);
      // Request fresh snapshot
      socket.emit('desk:snapshot');
    });

    // Full snapshot (on connect or manual refresh)
    socket.on('riders:snapshot', (riders: RiderSocketState[]) => {
      setRiderMap((prev) => {
        const next = new Map(prev);
        riders.forEach((r) => next.set(r.rider_id, r));
        return next;
      });
    });

    // Incremental location update
    socket.on('rider:location_update', (data: RiderSocketState) => {
      upsertRider(data);
    });

    // Status-only change (no location)
    socket.on('rider:status_update', (data: { rider_id: string; status: string; order_id: string | null }) => {
      setRiderMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.rider_id);
        if (existing) {
          next.set(data.rider_id, { ...existing, status: data.status, order_id: data.order_id });
        }
        return next;
      });
    });

    // Rider went offline
    socket.on('rider:disconnected', ({ rider_id }: { rider_id: string }) => {
      setRiderMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(rider_id);
        if (existing) next.set(rider_id, { ...existing, connected: false });
        return next;
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('🔴 Desk socket disconnected:', reason);
      setConnected(false);
    });

    socket.on('error', (err: unknown) => {
      console.warn('Desk socket error:', err);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, upsertRider]);

  const requestSnapshot = useCallback(() => {
    socketRef.current?.emit('desk:snapshot');
  }, []);

  return { riderMap, connected, requestSnapshot };
}
