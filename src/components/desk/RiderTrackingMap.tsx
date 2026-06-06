/**
 * RiderTrackingMap — Google Maps SDK live rider map.
 *
 * Features:
 *  • Google Maps JS API (satellite + roadmap toggle)
 *  • Custom AdvancedMarkerElement with smooth CSS-interpolated movement
 *  • Polyline trail — last 30 positions per rider (fades old segments)
 *  • Speed badge on marker (km/h)
 *  • Click rider → fly-to + info panel
 *  • Status filter toolbar
 *  • Fit-all button
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RiderSocketState } from '@/hooks/useRiderSocket';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const TRAIL_LENGTH = 30; // positions per rider

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  riders: RiderSocketState[];
  height?: string;
  onSelectRider?: (rider: RiderSocketState) => void;
  selectedRiderId?: string | null;
}

interface RiderMarkerState {
  overlay: google.maps.OverlayView;
  el: HTMLDivElement;
  trail: google.maps.Polyline;
  trailCoords: google.maps.LatLngLiteral[];
  currentLatLng: google.maps.LatLngLiteral;
  animFrame: number;
}

// ─── Google Maps loader ───────────────────────────────────────────────────────
let mapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof google !== 'undefined' && google.maps?.Map) return Promise.resolve();
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    // Use initScript approach without `callback` param — avoids the
    // "deprecated parameters" console warning from Maps v3.56+.
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });

  return mapsPromise;
}

// ─── Status colours ───────────────────────────────────────────────────────────
const STATUS: Record<string, { bg: string; border: string; label: string }> = {
  idle:       { bg: '#22c55e', border: '#16a34a', label: 'Idle' },
  assigned:   { bg: '#f97316', border: '#ea580c', label: 'Assigned' },
  delivering: { bg: '#f97316', border: '#ea580c', label: 'Delivering' },
  offline:    { bg: '#9ca3af', border: '#6b7280', label: 'Offline' },
};

function getStatus(r: RiderSocketState) {
  if (r.connected === false) return STATUS.offline;
  return STATUS[r.status] || STATUS.idle;
}

function initials(name: string) {
  return (name || 'R')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─── Smooth lat/lng interpolation ─────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ─── Custom marker overlay ────────────────────────────────────────────────────
function createMarkerOverlay(
  map: google.maps.Map,
  rider: RiderSocketState,
  onClick: () => void
): { overlay: google.maps.OverlayView; el: HTMLDivElement } {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute;
    cursor: pointer;
    transform: translate(-50%, -50%);
    transition: transform 0.15s ease;
    user-select: none;
  `;
  updateMarkerEl(el, rider, false);

  class RiderOverlay extends google.maps.OverlayView {
    private pos: google.maps.LatLng;
    constructor(lat: number, lng: number) {
      super();
      this.pos = new google.maps.LatLng(lat, lng);
    }
    onAdd() { this.getPanes()!.overlayMouseTarget.appendChild(el); }
    draw() {
      const proj = this.getProjection();
      if (!proj) return;
      const px = proj.fromLatLngToDivPixel(this.pos)!;
      el.style.left = `${px.x}px`;
      el.style.top  = `${px.y}px`;
    }
    onRemove() { el.parentNode?.removeChild(el); }
    updatePos(lat: number, lng: number) {
      this.pos = new google.maps.LatLng(lat, lng);
      this.draw();
    }
    getPos() { return this.pos; }
  }

  const overlay = new RiderOverlay(rider.lat, rider.lng);
  overlay.setMap(map);
  el.addEventListener('click', onClick);

  return { overlay: overlay as google.maps.OverlayView, el };
}

function updateMarkerEl(el: HTMLDivElement, rider: RiderSocketState, selected: boolean) {
  const s    = getStatus(rider);
  const size = selected ? 48 : 40;
  const ring = selected
    ? `box-shadow:0 0 0 3px #fff,0 0 0 6px ${s.bg};`
    : `box-shadow:0 2px 6px rgba(0,0,0,0.3);`;
  const speedKmh = Math.round((rider.speed_ms || 0) * 3.6);
  const speedBadge = speedKmh > 2
    ? `<div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);
         background:rgba(0,0,0,0.7);color:#fff;font-size:9px;padding:1px 4px;border-radius:8px;
         white-space:nowrap;">${speedKmh} km/h</div>`
    : '';

  el.innerHTML = `
    <div style="position:relative;display:inline-block;">
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${s.bg};border:2.5px solid ${s.border};
        color:#fff;display:flex;align-items:center;justify-content:center;
        font-size:${selected ? 15 : 13}px;font-weight:700;
        ${ring}
        transition:all 0.25s ease;
      ">${initials(rider.name || 'Rider')}</div>
      <div style="
        position:absolute;top:${size + 2}px;left:50%;transform:translateX(-50%);
        background:rgba(0,0,0,0.72);color:#fff;font-size:10px;
        padding:1px 6px;border-radius:4px;white-space:nowrap;
      ">${(rider.name || 'Rider').split(' ')[0]}</div>
      ${speedBadge}
    </div>
  `;
}

// ─── Trail colour by age ──────────────────────────────────────────────────────
function trailStrokeColor(rider: RiderSocketState) {
  const s = getStatus(rider);
  return s.bg;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RiderTrackingMap({
  riders,
  height = '500px',
  onSelectRider,
  selectedRiderId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const markersRef   = useRef<Map<string, RiderMarkerState>>(new Map());
  const [filter, setFilter]   = useState<'all' | 'idle' | 'delivering'>('all');
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType]   = useState<'roadmap' | 'satellite'>('roadmap');

  const visibleRiders = riders.filter((r) => {
    if (!r.lat || !r.lng) return false;
    if (filter === 'idle')      return r.status === 'idle';
    if (filter === 'delivering') return r.status === 'assigned' || r.status === 'delivering';
    return true;
  });

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPS_KEY) return;
    let cancelled = false;

    loadGoogleMaps().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const defaultCenter = visibleRiders.length > 0
        ? { lat: visibleRiders[0].lat, lng: visibleRiders[0].lng }
        : { lat: 28.6139, lng: 77.209 }; // New Delhi

      const map = new google.maps.Map(containerRef.current, {
        center:            defaultCenter,
        zoom:              13,
        mapTypeId:         'roadmap',
        disableDefaultUI:  false,
        zoomControl:       true,
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
        ],
      });

      mapRef.current = map;
      setMapReady(true);
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync map type ───────────────────────────────────────────────────────────
  useEffect(() => {
    mapRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  // ── Update markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    visibleRiders.forEach((r) => {
      const isSelected = r.rider_id === selectedRiderId;
      const existing = markersRef.current.get(r.rider_id);

      if (existing) {
        // ── Update existing marker ──────────────────────────────────────────
        updateMarkerEl(existing.el, r, isSelected);

        // Smooth animated move via interpolation
        const target = { lat: r.lat, lng: r.lng };
        const start  = existing.currentLatLng;

        if (start.lat !== target.lat || start.lng !== target.lng) {
          let progress = 0;
          if (existing.animFrame) cancelAnimationFrame(existing.animFrame);

          const animate = () => {
            progress = Math.min(progress + 0.08, 1); // ~12 frames ≈ 200 ms at 60 fps
            const interp = {
              lat: lerp(start.lat, target.lat, progress),
              lng: lerp(start.lng, target.lng, progress),
            };
            (existing.overlay as any).updatePos?.(interp.lat, interp.lng);
            if (progress < 1) {
              existing.animFrame = requestAnimationFrame(animate);
            } else {
              existing.currentLatLng = target;
            }
          };
          existing.animFrame = requestAnimationFrame(animate);
        }

        // Update trail
        const coords = existing.trailCoords;
        coords.push({ lat: r.lat, lng: r.lng });
        if (coords.length > TRAIL_LENGTH) coords.shift();
        existing.trail.setPath(coords);
        existing.trail.setOptions({ strokeColor: trailStrokeColor(r) });

      } else {
        // ── Create new marker ───────────────────────────────────────────────
        const { overlay, el } = createMarkerOverlay(map, r, () => onSelectRider?.(r));

        const trail = new google.maps.Polyline({
          map,
          path:         [{ lat: r.lat, lng: r.lng }],
          strokeColor:  trailStrokeColor(r),
          strokeOpacity: 0.6,
          strokeWeight:  3,
          icons: [
            {
              icon:   { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2 },
              offset: '100%',
            },
          ],
        });

        markersRef.current.set(r.rider_id, {
          overlay,
          el,
          trail,
          trailCoords:    [{ lat: r.lat, lng: r.lng }],
          currentLatLng:  { lat: r.lat, lng: r.lng },
          animFrame:      0,
        });

        updateMarkerEl(el, r, isSelected);
      }
    });

    // ── Remove riders no longer visible ────────────────────────────────────────
    markersRef.current.forEach((state, id) => {
      if (!visibleRiders.find((r) => r.rider_id === id)) {
        cancelAnimationFrame(state.animFrame);
        state.overlay.setMap(null);
        state.trail.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // ── Auto-fly to selected rider ─────────────────────────────────────────────
    if (selectedRiderId) {
      const sel = visibleRiders.find((r) => r.rider_id === selectedRiderId);
      if (sel) {
        mapRef.current?.panTo({ lat: sel.lat, lng: sel.lng });
        mapRef.current?.setZoom(16);
      }
    }
  }, [visibleRiders, selectedRiderId, mapReady, onSelectRider]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fit all riders ──────────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    if (!mapRef.current || visibleRiders.length === 0) return;
    if (visibleRiders.length === 1) {
      mapRef.current.panTo({ lat: visibleRiders[0].lat, lng: visibleRiders[0].lng });
      mapRef.current.setZoom(15);
    } else {
      const bounds = new google.maps.LatLngBounds();
      visibleRiders.forEach((r) => bounds.extend({ lat: r.lat, lng: r.lng }));
      mapRef.current.fitBounds(bounds, 64);
    }
  }, [visibleRiders]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      markersRef.current.forEach((s) => {
        cancelAnimationFrame(s.animFrame);
        s.overlay.setMap(null);
        s.trail.setMap(null);
      });
      markersRef.current.clear();
    };
  }, []);

  const idleCount      = riders.filter((r) => r.status === 'idle').length;
  const deliveringCount = riders.filter((r) => r.status === 'assigned' || r.status === 'delivering').length;
  const offlineCount   = riders.filter((r) => r.connected === false).length;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { key: 'all',        label: `All (${riders.filter((r) => r.lat).length})`, active: 'bg-gray-800 text-white border-gray-800', inactive: 'bg-white text-gray-600 border-gray-300 hover:border-gray-500' },
            { key: 'idle',       label: `🟢 Idle (${idleCount})`,        active: 'bg-green-600 text-white border-green-600', inactive: 'bg-white text-green-600 border-green-300 hover:border-green-500' },
            { key: 'delivering', label: `🛵 Delivering (${deliveringCount})`, active: 'bg-orange-500 text-white border-orange-500', inactive: 'bg-white text-orange-500 border-orange-300 hover:border-orange-500' },
          ] as const
        ).map((btn) => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filter === btn.key ? btn.active : btn.inactive
            }`}
          >
            {btn.label}
          </button>
        ))}

        {offlineCount > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
            ⚫ Offline ({offlineCount})
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Map type toggle */}
          <button
            onClick={() => setMapType((t) => (t === 'roadmap' ? 'satellite' : 'roadmap'))}
            className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:border-gray-500 transition-colors"
            title="Toggle satellite view"
          >
            {mapType === 'roadmap' ? '🛰 Satellite' : '🗺 Map'}
          </button>
          <button
            onClick={fitAll}
            className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:border-gray-500 transition-colors"
            title="Zoom to all riders"
          >
            ⊞ Fit all
          </button>
        </div>
      </div>

      {/* ── Map canvas ── */}
      <div
        className="rounded-xl overflow-hidden border border-gray-200 shadow-sm relative"
        style={{ height }}
      >
        {!MAPS_KEY && (
          <div className="absolute inset-0 flex items-center justify-center bg-yellow-50 z-10">
            <p className="text-sm text-yellow-700 font-medium">
              VITE_GOOGLE_MAPS_API_KEY not set
            </p>
          </div>
        )}
        {visibleRiders.length === 0 && MAPS_KEY && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 z-10 gap-2 pointer-events-none">
            <span className="text-3xl">📡</span>
            <p className="text-sm text-gray-500 font-medium">No rider locations yet</p>
            <p className="text-xs text-gray-400">Riders appear once they share GPS</p>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* ── Legend ── */}
      <div className="flex gap-4 text-xs text-gray-500">
        {Object.entries(STATUS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: v.bg }}
            />
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}
