/**
 * RiderLiveMap — shows live GPS positions of one or more riders on an OpenStreetMap.
 * Uses Leaflet (no API key needed).
 *
 * Props:
 *   riders   – array of riders with location data
 *   height   – CSS height string (default "220px")
 *   compact  – if true, shows a smaller single-rider view
 */
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

interface RiderLocation {
  _id: string;
  name: string;
  phone?: string;
  location?: { lat: number; lng: number };
  lastLocationUpdate?: string;
  isActive?: boolean;
}

interface Props {
  riders: RiderLocation[];
  height?: string;
  compact?: boolean;
}

// Leaflet loaded lazily to avoid SSR issues
let leafletPromise: Promise<typeof import("leaflet")> | null = null;
function getLeaflet() {
  if (!leafletPromise) {
    leafletPromise = import("leaflet").then((L) => {
      // Fix default marker icon paths broken by bundlers
      // @ts-ignore
      delete L.default.Icon.Default.prototype._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      return L.default;
    });
  }
  return leafletPromise;
}

function timeSince(dateStr?: string) {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RiderLiveMap({ riders, height = "220px", compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());

  const activeRiders = riders.filter(r => r.location?.lat && r.location?.lng);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || activeRiders.length === 0) return;

    // Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let destroyed = false;

    getLeaflet().then((L) => {
      if (destroyed || !containerRef.current) return;
      if (mapRef.current) return; // already initialised

      const first = activeRiders[0].location!;
      const map = L.map(containerRef.current, {
        center: [first.lat, first.lng],
        zoom: compact ? 14 : 12,
        zoomControl: !compact,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Add markers
      activeRiders.forEach(r => {
        if (!r.location) return;
        const marker = L.marker([r.location.lat, r.location.lng])
          .addTo(map)
          .bindPopup(
            `<b>${r.name}</b>${r.phone ? `<br>${r.phone}` : ""}` +
            (r.lastLocationUpdate ? `<br><small>${timeSince(r.lastLocationUpdate)}</small>` : "")
          );
        markersRef.current.set(r._id, marker);
      });

      // Fit bounds to show all riders
      if (!compact && activeRiders.length > 1) {
        const bounds = L.latLngBounds(activeRiders.map(r => [r.location!.lat, r.location!.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      destroyed = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when riders change
  useEffect(() => {
    if (!mapRef.current) return;

    getLeaflet().then((L) => {
      if (!mapRef.current) return;

      activeRiders.forEach(r => {
        if (!r.location) return;
        const existing = markersRef.current.get(r._id);
        if (existing) {
          existing.setLatLng([r.location.lat, r.location.lng]);
          existing.setPopupContent(
            `<b>${r.name}</b>${r.phone ? `<br>${r.phone}` : ""}` +
            (r.lastLocationUpdate ? `<br><small>${timeSince(r.lastLocationUpdate)}</small>` : "")
          );
        } else {
          const marker = L.marker([r.location.lat, r.location.lng])
            .addTo(mapRef.current!)
            .bindPopup(
              `<b>${r.name}</b>${r.phone ? `<br>${r.phone}` : ""}` +
              (r.lastLocationUpdate ? `<br><small>${timeSince(r.lastLocationUpdate)}</small>` : "")
            );
          markersRef.current.set(r._id, marker);
        }
      });

      // Remove markers for riders no longer active
      markersRef.current.forEach((marker, id) => {
        if (!activeRiders.find(r => r._id === id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      });

      // Re-fit bounds for combined view
      if (!compact && activeRiders.length > 1) {
        const bounds = L.latLngBounds(activeRiders.map(r => [r.location!.lat, r.location!.lng]));
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      } else if (activeRiders.length === 1) {
        mapRef.current.setView([activeRiders[0].location!.lat, activeRiders[0].location!.lng]);
      }
    });
  }, [riders]); // eslint-disable-line react-hooks/exhaustive-deps

  // Destroy map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }
    };
  }, []);

  if (activeRiders.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400"
        style={{ height }}
      >
        📡 No active rider locations
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-orange-200" style={{ height }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
