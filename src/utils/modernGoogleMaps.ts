import { Loader } from "@googlemaps/js-api-loader";
import { MAPS_PERFORMANCE_CONFIG, isFeatureEnabled } from "../config/mapsConfig";

export interface MapConfig {
  center: { lat: number; lng: number };
  zoom: number;
  mapTypeId?: google.maps.MapTypeId;
  disableDefaultUI?: boolean;
  gestureHandling?: "auto" | "cooperative" | "greedy" | "none";
}

export interface MarkerConfig {
  position: { lat: number; lng: number };
  title?: string;
  content?: HTMLElement | string;
  gmpClickable?: boolean;
}

class ModernGoogleMapsService {
  private loader: Loader;
  private isLoaded = false;
  private map: google.maps.Map | null = null;
  private markers: (
    | google.maps.marker.AdvancedMarkerElement
    | google.maps.Marker
  )[] = [];

  constructor() {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

    if (!apiKey) {
      console.error(
        "❌ Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY",
      );
    }

    if (!mapId || mapId.trim() === "") {
      console.warn(
        "⚠️ Google Maps Map ID not configured. Advanced Markers will not be available. Set VITE_GOOGLE_MAPS_MAP_ID to enable Advanced Markers.",
      );
    }

    this.loader = new Loader({
      apiKey: apiKey || "",
      version: "weekly",
      libraries: ["places", "marker"], // Include marker library for fallback
    });
  }

  /**
   * Initialize Google Maps API
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    try {
      await this.loader.load();

      // Load marker library for AdvancedMarkerElement (only if not disabled for performance)
      const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
      if (mapId && mapId.trim() !== "" && !MAPS_PERFORMANCE_CONFIG.DISABLE_ADVANCED_MARKERS) {
        try {
          await google.maps.importLibrary("marker");
          console.log("✅ Google Maps Marker library loaded for Advanced Markers");
        } catch (error) {
          console.warn("⚠️ Failed to load Marker library, will use regular markers:", error);
        }
      } else if (MAPS_PERFORMANCE_CONFIG.DISABLE_ADVANCED_MARKERS) {
        console.log("⚡ Advanced Markers disabled for better performance");
      }

      this.isLoaded = true;
      console.log("✅ Google Maps API loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load Google Maps API:", error);
      throw new Error("Google Maps API failed to load");
    }
  }

  /**
   * Create a map instance with modern configuration
   */
  async createMap(
    container: HTMLElement,
    config: MapConfig,
  ): Promise<google.maps.Map> {
    await this.initialize();

    const defaultConfig: MapConfig = {
      center: { lat: 28.6139, lng: 77.209 }, // Delhi, India
      zoom: 12,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      disableDefaultUI: false,
      gestureHandling: "auto",
      ...config,
    };

    const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

    const mapConfig: any = {
      ...defaultConfig,
      // Enhanced user experience options
      clickableIcons: false,
      fullscreenControl: true,
      streetViewControl: true,
      mapTypeControl: true,
    };

    // Only add Map ID if it's configured and not empty
    if (mapId && mapId.trim() !== "") {
      mapConfig.mapId = mapId;
      console.log("🗺️ Using Map ID for Advanced Markers (styles controlled via cloud console):", mapId);
    } else {
      // Only add custom styles if no mapId is present
      const styles = MAPS_PERFORMANCE_CONFIG.USE_LIGHTWEIGHT_MAP_STYLES
        ? [
            // Lightweight styles for better performance
            {
              featureType: "poi",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "transit",
              stylers: [{ visibility: "off" }],
            },
          ]
        : [
            // Full styles for better appearance
            {
              featureType: "poi.business",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "poi.park",
              elementType: "labels.text",
              stylers: [{ visibility: "off" }],
            },
          ];

      mapConfig.styles = styles;
      console.log(
        "🗺️ No Map ID configured, using",
        MAPS_PERFORMANCE_CONFIG.USE_LIGHTWEIGHT_MAP_STYLES ? "lightweight" : "full",
        "styles and regular markers"
      );
    }

    this.map = new google.maps.Map(container, mapConfig);

    console.log("🗺️ Modern Google Map created successfully");
    return this.map;
  }

  /**
   * Add marker using AdvancedMarkerElement if Map ID available, otherwise regular Marker
   */
  async addAdvancedMarker(
    config: MarkerConfig,
  ): Promise<google.maps.marker.AdvancedMarkerElement | google.maps.Marker> {
    if (!this.map) {
      throw new Error("Map must be created before adding markers");
    }

    await this.initialize();

    const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

    // Use AdvancedMarkerElement if Map ID is available and configured
    if (
      mapId &&
      mapId.trim() !== "" &&
      google.maps.marker?.AdvancedMarkerElement
    ) {
      try {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: this.map,
          position: config.position,
          title: config.title,
          gmpClickable: config.gmpClickable ?? true,
        });

        // If custom content is provided, use it
        if (config.content) {
          let contentElement: HTMLElement;

          if (typeof config.content === "string") {
            contentElement = document.createElement("div");
            contentElement.innerHTML = config.content;
            contentElement.className = "custom-marker-content";
          } else {
            contentElement = config.content;
          }

          marker.content = contentElement;
        }

        this.markers.push(marker as any);
        console.log("📍 Advanced marker added successfully");
        return marker;
      } catch (error) {
        console.warn(
          "AdvancedMarkerElement failed, falling back to regular marker:",
          error,
        );
      }
    } else if (!mapId || mapId.trim() === "") {
      console.log("📍 Using regular marker (Map ID not configured)");
    }

    // Fallback to regular Marker
    const marker = new google.maps.Marker({
      map: this.map,
      position: config.position,
      title: config.title,
      clickable: config.gmpClickable ?? true,
    });

    this.markers.push(marker as any);
    console.log("📍 Regular marker added successfully");
    return marker as any;
  }

  /**
   * Create custom marker with modern styling
   */
  createCustomMarkerContent(options: {
    icon?: string;
    color?: string;
    size?: number;
    text?: string;
  }): HTMLElement {
    const { icon = "📍", color = "#EA4335", size = 40, text } = options;

    const markerElement = document.createElement("div");
    markerElement.className = "modern-custom-marker";
    markerElement.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${size * 0.5}px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: transform 0.2s ease;
      position: relative;
    `;

    const iconElement = document.createElement("span");
    iconElement.textContent = icon;
    iconElement.style.cssText = `
      color: white;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
    `;

    markerElement.appendChild(iconElement);

    if (text) {
      const textElement = document.createElement("div");
      textElement.textContent = text;
      textElement.style.cssText = `
        position: absolute;
        top: ${size + 5}px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        white-space: nowrap;
        z-index: 1000;
      `;
      markerElement.appendChild(textElement);
    }

    // Add hover effects
    markerElement.addEventListener("mouseenter", () => {
      markerElement.style.transform = "scale(1.1)";
    });

    markerElement.addEventListener("mouseleave", () => {
      markerElement.style.transform = "scale(1)";
    });

    return markerElement;
  }

  /**
   * Add multiple markers with clustering support
   */
  async addMultipleMarkers(
    configs: MarkerConfig[],
  ): Promise<
    (google.maps.marker.AdvancedMarkerElement | google.maps.Marker)[]
  > {
    const promises = configs.map((config) => this.addAdvancedMarker(config));
    return Promise.all(promises);
  }

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    this.markers.forEach((marker) => {
      if (marker instanceof google.maps.Marker) {
        marker.setMap(null);
      } else {
        marker.map = null;
      }
    });
    this.markers = [];
    console.log("🧹 All markers cleared");
  }

  /**
   * Fit map bounds to show all markers
   */
  fitMarkersInView(): void {
    if (!this.map || this.markers.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    this.markers.forEach((marker) => {
      let position;
      if (marker instanceof google.maps.Marker) {
        position = marker.getPosition();
      } else {
        position = marker.position;
      }

      if (position) {
        bounds.extend(position);
      }
    });

    this.map.fitBounds(bounds);

    // Ensure minimum zoom level
    google.maps.event.addListenerOnce(this.map, "bounds_changed", () => {
      if (this.map && this.map.getZoom() && this.map.getZoom()! > 15) {
        this.map.setZoom(15);
      }
    });
  }

  /**
   * Get current map center
   */
  getCenter(): { lat: number; lng: number } | null {
    if (!this.map) return null;

    const center = this.map.getCenter();
    if (!center) return null;

    return {
      lat: center.lat(),
      lng: center.lng(),
    };
  }

  /**
   * Set map center with animation
   */
  setCenter(position: { lat: number; lng: number }, zoom?: number): void {
    if (!this.map) return;

    this.map.panTo(position);

    if (zoom !== undefined) {
      this.map.setZoom(zoom);
    }
  }

  /**
   * Add click listener to map
   */
  addClickListener(callback: (event: google.maps.MapMouseEvent) => void): void {
    if (!this.map) return;

    this.map.addListener("click", callback);
  }

  /**
   * Add marker click listener
   */
  addMarkerClickListener(
    marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker,
    callback: (event: any) => void,
  ): void {
    marker.addListener("click", callback);
  }

  /**
   * Create info window for modern markers
   */
  createInfoWindow(content: string | HTMLElement): google.maps.InfoWindow {
    return new google.maps.InfoWindow({
      content,
      headerDisabled: false,
      maxWidth: 300,
    });
  }

  /**
   * Show info window at marker position
   */
  showInfoWindow(
    infoWindow: google.maps.InfoWindow,
    marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker,
  ): void {
    if (!this.map) return;

    if (marker instanceof google.maps.Marker) {
      infoWindow.open(this.map, marker);
    } else {
      infoWindow.open({
        map: this.map,
        anchor: marker,
      });
    }
  }

  /**
   * Get map instance
   */
  getMap(): google.maps.Map | null {
    return this.map;
  }

  /**
   * Destroy map and clean up resources
   */
  destroy(): void {
    this.clearMarkers();
    this.map = null;
    console.log("🗑️ Map destroyed and resources cleaned up");
  }

  /**
   * Check if Google Maps API is available
   */
  isApiAvailable(): boolean {
    return this.isLoaded && typeof google !== "undefined" && google.maps;
  }

  /**
   * Get API load status
   */
  getLoadStatus(): { loaded: boolean; error?: string } {
    return {
      loaded: this.isLoaded,
      error: this.isLoaded ? undefined : "API not loaded yet",
    };
  }
}

// Export singleton instance
export const modernGoogleMaps = new ModernGoogleMapsService();

// Export utility functions
export const createMarkerIcon = (options: {
  icon?: string;
  color?: string;
  size?: number;
  text?: string;
}) => modernGoogleMaps.createCustomMarkerContent(options);

export const loadGoogleMaps = () => modernGoogleMaps.initialize();

// CSS for custom markers (inject into document head)
const injectMarkerStyles = () => {
  if (document.getElementById("modern-google-maps-styles")) return;

  const style = document.createElement("style");
  style.id = "modern-google-maps-styles";
  style.textContent = `
    .modern-custom-marker {
      animation: markerDrop 0.3s ease-out;
    }

    @keyframes markerDrop {
      0% {
        transform: translateY(-30px) scale(0.8);
        opacity: 0;
      }
      100% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }

    .modern-custom-marker:hover {
      z-index: 1000;
    }
  `;

  document.head.appendChild(style);
};

// Auto-inject styles when module loads
if (typeof document !== "undefined") {
  injectMarkerStyles();
}
