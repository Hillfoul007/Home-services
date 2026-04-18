/**
 * RiderTrackingMap  –  Zomato/Swiggy-style live rider map for the desk dashboard.
 *
 * Features:
 *  • Live positions from Socket.io (updates every 2-3 s)
 *  • Colour-coded markers: green = idle, orange = delivering, grey = offline
 *  • Smooth marker animation (CSS transitions)
 *  • Click rider → zoom + show details panel
 *  • Filter by status
 *  • "Zoom to all" button
 *
 * Leaflet is loaded lazily (no API key required).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap, Marker, DivIcon } from 'leaflet';
import type { RiderSocketState } from '@/hooks/useRiderSocket';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  riders: RiderSocketState[];
  height?: string;
  onSelectRider?: (rider: RiderSocketState) => void;
  selectedRiderId?: string | null;
}

// ─── Leaflet loader ───────────────────────────────────────────────────────────
let leafletPromise: Promise<typeof import('leaflet')> | null = null;
function getLeaflet() {
  if (!leafletPromise) {
    leafletPromise = import('leaflet').then((mod) => {
      const L = mod.default;
      // @ts-ignore – fix broken bundler default icons
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      return L;
    });
  }
  return leafletPromise;
}

function ensureLeafletCss() {
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
}

// ─── Marker icon builder ──────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  idle: '#22c55e',       // green
  assigned: '#f97316',   // orange
  delivering: '#f97316', // orange
  offline: '#9ca3af',    // grey
};

function buildIcon(L: typeof import('leaflet'), status: string, selected: boolean, name: string): DivIcon {
  const color = STATUS_COLOR[status] || STATUS_COLOR.idle;
  const ring = selected ? `box-shadow:0 0 0 3px #fff,0 0 0 5px ${color};` : '';
  const size = selected ? 44 : 36;
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const html = `
    <div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:${selected ? 14 : 12}px;font-weight:700;
      border:2px solid #fff;
      transition:all 0.3s ease;
      ${ring}
    ">${initials}</div>
    <div style="
      position:absolute;top:${size+2}px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.7);color:#fff;
      font-size:10px;padding:1px 5px;border-radius:4px;
      white-space:nowrap;pointer-events:none;
    ">${name.split(' ')[0]}</div>
  `;

  return L.divIcon({
    html: `<div style="position:relative">${html}</div>`,
    className: '',
    iconSize: [size, size + 20],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RiderTrackingMap({
  riders,
  height = '480px',
  onSelectRider,
  selectedRiderId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [filter, setFilter] = useState<'all' | 'idle' | 'delivering'>('all');
  const [mapReady, setMapReady] = useState(false);

  const visibleRiders = riders.filter((r) => {
    if (!r.lat || !r.lng) return false;
    if (filter === 'idle') return r.status === 'idle';
    if (filter === 'delivering') return r.status === 'assigned' || r.status === 'delivering';
    return true;
  });

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    ensureLeafletCss();
    let destroyed = false;

    getLeaflet().then((L) => {
      if (destroyed || !containerRef.current || mapRef.current) return;

      const defaultCenter: [number, number] =
        visibleRiders.length > 0
          ? [visibleRiders[0].lat, visibleRiders[0].lng]
          : [28.6139, 77.209]; // New Delhi fallback

      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      destroyed = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update markers whenever riders or selection changes ─────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    getLeaflet().then((L) => {
      if (!mapRef.current) return;
      const map = mapRef.current;

      // Upsert markers
      visibleRiders.forEach((r) => {
        const isSelected = r.rider_id === selectedRiderId;
        const icon = buildIcon(L, r.connected === false ? 'offline' : r.status, isSelected, r.name || 'Rider');

        const existing = markersRef.current.get(r.rider_id);
        if (existing) {
          // Smooth position update
          existing.setLatLng([r.lat, r.lng]);
          existing.setIcon(icon);
          existing.setPopupContent(buildPopupHtml(r));
        } else {
          const marker = L.marker([r.lat, r.lng], { icon })
            .addTo(map)
            .bindPopup(buildPopupHtml(r), { maxWidth: 220 });

          marker.on('click', () => {
            onSelectRider?.(r);
          });

          markersRef.current.set(r.rider_id, marker);
        }
      });

      // Remove markers no longer visible
      markersRef.current.forEach((marker, id) => {
        if (!visibleRiders.find((r) => r.rider_id === id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      });

      // Auto-zoom to selected rider
      if (selectedRiderId) {
        const sel = visibleRiders.find((r) => r.rider_id === selectedRiderId);
        if (sel) map.flyTo([sel.lat, sel.lng], 15, { animate: true, duration: 0.8 });
      }
    });
  }, [visibleRiders, selectedRiderId, mapReady, onSelectRider]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fit all riders ──────────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    if (!mapRef.current || visibleRiders.length === 0) return;
    getLeaflet().then((L) => {
      if (!mapRef.current) return;
      if (visibleRiders.length === 1) {
        mapRef.current.flyTo([visibleRiders[0].lat, visibleRiders[0].lng], 14);
      } else {
        const bounds = L.latLngBounds(visibleRiders.map((r) => [r.lat, r.lng]));
        mapRef.current.fitBounds(bounds, { padding: [48, 48], animate: true });
      }
    });
  }, [visibleRiders]);

  // ── Destroy on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  const idleCount = riders.filter((r) => r.status === 'idle').length;
  const deliveringCount = riders.filter(
    (r) => r.status === 'assigned' || r.status === 'delivering'
  ).length;
  const offlineCount = riders.filter((r) => r.connected === false).length;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter buttons */}
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            filter === 'all'
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
          }`}
        >
          All ({riders.filter((r) => r.lat).length})
        </button>
        <button
          onClick={() => setFilter('idle')}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            filter === 'idle'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-green-600 border-green-300 hover:border-green-500'
          }`}
        >
          🟢 Idle ({idleCount})
        </button>
        <button
          onClick={() => setFilter('delivering')}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            filter === 'delivering'
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-orange-500 border-orange-300 hover:border-orange-500'
          }`}
        >
          🛵 Delivering ({deliveringCount})
        </button>
        {offlineCount > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
            ⚫ Offline ({offlineCount})
          </span>
        )}

        <button
          onClick={fitAll}
          className="ml-auto px-3 py-1 rounded-full text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:border-gray-500 transition-colors"
          title="Zoom to all riders"
        >
          ⊞ Fit all
        </button>
      </div>

      {/* ── Map canvas ── */}
      <div
        className="rounded-xl overflow-hidden border border-gray-200 shadow-sm relative"
        style={{ height }}
      >
        {visibleRiders.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 gap-2">
            <span className="text-3xl">📡</span>
            <p className="text-sm text-gray-500 font-medium">No rider locations available</p>
            <p className="text-xs text-gray-400">Riders appear here once they share their GPS</p>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* ── Legend ── */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" /> Idle
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-500" /> Delivering
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-400" /> Offline
        </span>
      </div>
    </div>
  );
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────
function buildPopupHtml(r: RiderSocketState): string {
  const statusLabel =
    r.connected === false
      ? '⚫ Offline'
      : r.status === 'idle'
      ? '🟢 Idle'
      : '🛵 Delivering';

  const ago = timeSince(r.timestamp);

  return `
    <div style="font-family:system-ui,sans-serif;min-width:160px">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px">${r.name || 'Rider'}</div>
      ${r.phone ? `<div style="font-size:11px;color:#555">${r.phone}</div>` : ''}
      <div style="font-size:11px;margin-top:4px">${statusLabel}</div>
      ${r.order_id ? `<div style="font-size:10px;color:#888">Order: ${r.order_id}</div>` : ''}
      ${ago ? `<div style="font-size:10px;color:#aaa;margin-top:2px">Updated ${ago}</div>` : ''}
    </div>
  `;
}

function timeSince(dateStr?: string): string | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
