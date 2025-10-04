import React, { useState } from "react";
import { MapPin, Search, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LocationManagerProps {
  onLocationChange: (
    location: string,
    coordinates?: { lat: number; lng: number },
    additionalData?: any,
  ) => void;
  className?: string;
  showInTopBar?: boolean;
  enableSaveToDatabase?: boolean;
  showFavorites?: boolean;
  showHistory?: boolean;
}

const LocationManager: React.FC<LocationManagerProps> = ({
  onLocationChange,
  className = "",
  showInTopBar = false,
  enableSaveToDatabase = true,
  showFavorites = true,
  showHistory = true,
}) => {
  const [searchValue, setSearchValue] = useState<string>("");
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [currentAddress, setCurrentAddress] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const handleSearchSubmit = () => {
    if (searchValue.trim()) {
      setCurrentAddress(searchValue.trim());
      onLocationChange(searchValue.trim(), undefined, {
        formatted_address: searchValue.trim(),
      });
    }
  };

  const handleDetectLocation = () => {
    setIsDetecting(true);
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // Try to get a readable address using reverse geocoding
        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
          if (!apiKey) {
            console.warn("Google Maps API key not configured");
            setCurrentAddress("Current Location");
            onLocationChange("Current Location", coordinates, {
              formatted_address: "Current Location",
              coordinates,
            });
            return;
          }

          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&key=${apiKey}`,
            {
              method: "GET",
            },
          );
          const data = await response.json();

          let address = "Current Location";
          if (data.status === "OK" && data.results.length > 0) {
            address = data.results[0].formatted_address;
          }

          setCurrentAddress(address);
          onLocationChange(address, coordinates, {
            formatted_address: address,
            coordinates,
          });
        } catch (error) {
          console.warn("Reverse geocoding failed:", error);
          const address = "Current Location";
          setCurrentAddress(address);
          onLocationChange(address, coordinates, {
            formatted_address: address,
            coordinates,
          });
        }

        setIsDetecting(false);
      },
      (error) => {
        let errorMessage = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
        setError(errorMessage);
        setIsDetecting(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  if (showInTopBar) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center bg-white rounded-lg border border-gray-200 px-3 py-2">
          <MapPin className="w-4 h-4 text-gray-500 mr-2" />
          <span className="text-sm text-gray-700 truncate max-w-[200px]">
            {currentAddress || "Select location"}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDetectLocation}
          disabled={isDetecting}
        >
          <Navigation className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Location Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearchSubmit()}
                  placeholder="Enter address or location..."
                  className="pl-10"
                />
              </div>
              <Button
                onClick={handleSearchSubmit}
                disabled={!searchValue.trim()}
              >
                Search
              </Button>
            </div>

            <Button
              onClick={handleDetectLocation}
              disabled={isDetecting}
              variant="outline"
              className="w-full"
            >
              <Navigation className="w-4 h-4 mr-2" />
              {isDetecting ? "Detecting..." : "Use Current Location"}
            </Button>
          </div>

          {currentAddress && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Current Location
                  </p>
                  <p className="text-sm text-blue-700">{currentAddress}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationManager;
