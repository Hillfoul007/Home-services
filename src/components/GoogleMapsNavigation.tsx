import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation, MapPin, Route, ExternalLink } from "lucide-react";

interface GoogleMapsNavigationProps {
  destination: {
    lat: number;
    lng: number;
    address: string;
  };
  origin?: {
    lat: number;
    lng: number;
    address?: string;
  };
  onDirectionsReady?: (duration: string, distance: string) => void;
  className?: string;
}

const GoogleMapsNavigation: React.FC<GoogleMapsNavigationProps> = ({
  destination,
  origin,
  onDirectionsReady,
  className = "",
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [directionsService, setDirectionsService] = useState<any>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<{
    duration: string;
    distance: string;
  } | null>(null);
  const [error, setError] = useState<string>("");

  // Check for Google Maps availability
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsGoogleMapsLoaded(true);
        return;
      }
    };

    // Check immediately
    checkGoogleMaps();

    // Listen for Google Maps loaded event
    const handleGoogleMapsLoaded = () => {
      checkGoogleMaps();
    };

    window.addEventListener("google-maps-loaded", handleGoogleMapsLoaded);

    return () => {
      window.removeEventListener("google-maps-loaded", handleGoogleMapsLoaded);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (isGoogleMapsLoaded && mapRef.current && !map) {
      const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

      const mapConfig: any = {
        zoom: 13,
        center: destination,
      };

      // Only add styles if no mapId is present (to avoid conflicts)
      if (!mapId || mapId.trim() === "") {
        mapConfig.styles = [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ];
      } else {
        mapConfig.mapId = mapId;
      }

      const mapInstance = new window.google.maps.Map(mapRef.current, mapConfig);

      const directionsServiceInstance =
        new window.google.maps.DirectionsService();
      const directionsRendererInstance =
        new window.google.maps.DirectionsRenderer({
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: "#2563eb",
            strokeWeight: 4,
          },
        });

      directionsRendererInstance.setMap(mapInstance);

      setMap(mapInstance);
      setDirectionsService(directionsServiceInstance);
      setDirectionsRenderer(directionsRendererInstance);
    }
  }, [isGoogleMapsLoaded, destination, map]);

  // Calculate route
  useEffect(() => {
    if (directionsService && directionsRenderer && origin) {
      calculateRoute();
    } else if (map && !origin) {
      // Show just the destination marker if no origin
      const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

      // Only use Advanced Markers if Map ID is configured and available
      if (
        mapId &&
        mapId.trim() !== "" &&
        window.google.maps.marker?.AdvancedMarkerElement
      ) {
        try {
          new window.google.maps.marker.AdvancedMarkerElement({
            position: destination,
            map: map,
            title: destination.address,
          });
          console.log("📍 Using Advanced Marker for destination");
        } catch (error) {
          console.warn(
            "Failed to create Advanced Marker, falling back to regular marker:",
            error,
          );
          // Fallback to regular marker if Advanced Marker fails
          new window.google.maps.Marker({
            position: destination,
            map: map,
            title: destination.address,
            icon: {
              url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            },
          });
        }
      } else {
        // Use regular marker when Map ID is not configured
        new window.google.maps.Marker({
          position: destination,
          map: map,
          title: destination.address,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          },
        });
        console.log(
          "📍 Using regular Marker for destination (no Map ID configured)",
        );
      }
    }
  }, [directionsService, directionsRenderer, origin, destination]);

  const calculateRoute = async () => {
    if (!directionsService || !directionsRenderer || !origin) return;

    try {
      const request = {
        origin: origin,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false,
      };

      directionsService.route(request, (result: any, status: string) => {
        if (status === "OK") {
          directionsRenderer.setDirections(result);

          const route = result.routes[0];
          const leg = route.legs[0];

          const routeData = {
            duration: leg.duration.text,
            distance: leg.distance.text,
          };

          setRouteInfo(routeData);
          onDirectionsReady?.(routeData.duration, routeData.distance);
          setError("");
        } else {
          console.error("Directions request failed:", status);
          setError("Could not calculate route");
        }
      });
    } catch (error) {
      console.error("Error calculating route:", error);
      setError("Error calculating route");
    }
  };

  const openInGoogleMaps = () => {
    let url = "";
    if (origin) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`;
    }
    window.open(url, "_blank");
  };

  const getCurrentLocationAndNavigate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          const url = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
          window.open(url, "_blank");
        },
        (error) => {
          console.error("Error getting location:", {
            code: error.code,
            message: error.message,
          });
          // Fallback to destination only
          openInGoogleMaps();
        },
      );
    } else {
      // Fallback to destination only
      openInGoogleMaps();
    }
  };

  if (!isGoogleMapsLoaded) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <Navigation className="w-5 h-5 animate-spin" />
            <span>Loading Google Maps...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Navigation className="w-5 h-5 text-blue-600" />
          <span>Navigation</span>
        </CardTitle>
        {routeInfo && (
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <Route className="w-4 h-4" />
              <span>{routeInfo.distance}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>⏱️</span>
              <span>{routeInfo.duration}</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map Container */}
        <div
          ref={mapRef}
          className="w-full h-64 rounded-lg border border-gray-200"
          style={{ minHeight: "256px" }}
        />

        {error && <div className="text-red-600 text-sm">{error}</div>}

        {/* Navigation Controls */}
        <div className="space-y-2">
          <Button
            onClick={getCurrentLocationAndNavigate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Start Navigation
          </Button>

          <Button
            onClick={openInGoogleMaps}
            variant="outline"
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Google Maps
          </Button>
        </div>

        {/* Destination Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-start space-x-2">
            <MapPin className="w-4 h-4 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Destination</p>
              <p className="text-sm text-gray-600">{destination.address}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleMapsNavigation;
