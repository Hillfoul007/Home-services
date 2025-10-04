import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2, Navigation, Search, X, Sparkles } from "lucide-react";
import SmartAddressInput from "./SmartAddressInput";
import { ParsedAddress } from "@/utils/autocompleteSuggestionService";

interface AddressData {
  flatNo: string;
  flatHouseNo?: string;
  street: string;
  landmark: string;
  village: string;
  city: string;
  pincode: string;
  fullAddress: string;
  coordinates?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  label?: string;
  type?: string;
}

interface SimplifiedAddressFormProps {
  onAddressChange?: (address: AddressData) => void;
  onAddressUpdate?: (address: AddressData) => void;
  initialAddress?: AddressData;
  initialData?: any;
  className?: string;
  showLabel?: boolean;
}

const SimplifiedAddressForm: React.FC<SimplifiedAddressFormProps> = ({
  onAddressChange,
  onAddressUpdate,
  initialAddress,
  initialData,
  className = "",
  showLabel = false,
}) => {
  const [address, setAddress] = useState<AddressData>({
    flatNo: initialData?.flatHouseNo || initialAddress?.flatNo || "",
    flatHouseNo: initialData?.flatHouseNo || initialAddress?.flatHouseNo || "",
    street: initialData?.street || initialAddress?.street || "",
    landmark: initialData?.landmark || initialAddress?.landmark || "",
    village: initialData?.village || initialAddress?.village || "",
    city: initialData?.city || initialAddress?.city || "",
    pincode: initialData?.pincode || initialAddress?.pincode || "",
    fullAddress: initialAddress?.fullAddress || "",
    label: initialData?.label || "",
    type: initialData?.type || "other",
    ...initialAddress,
  });

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [useSmartInput, setUseSmartInput] = useState(false);

  // Update parent when address changes
  useEffect(() => {
    if (onAddressChange) {
      onAddressChange(address);
    }
  }, [address, onAddressChange]);

  // Convert ParsedAddress to AddressData format
  const convertParsedToAddressData = (
    parsedAddress: ParsedAddress,
  ): AddressData => {
    const parts = [
      parsedAddress.flatNo,
      parsedAddress.street,
      parsedAddress.landmark && `Near ${parsedAddress.landmark}`,
      parsedAddress.area,
      parsedAddress.city,
      parsedAddress.pincode,
    ].filter(Boolean);

    return {
      flatNo: parsedAddress.flatNo || "",
      flatHouseNo: parsedAddress.flatNo || "",
      street: parsedAddress.street || "",
      landmark: parsedAddress.landmark || "",
      village: parsedAddress.area || parsedAddress.city || "",
      city: parsedAddress.city || "",
      pincode: parsedAddress.pincode || "",
      fullAddress: parsedAddress.formattedAddress || parts.join(", "),
      coordinates: parsedAddress.coordinates,
      label: address.label,
      type: address.type,
    };
  };

  // Handle smart address input change
  const handleSmartAddressChange = (parsedAddress: ParsedAddress) => {
    const newAddress = convertParsedToAddressData(parsedAddress);
    setAddress(newAddress);
  };

  // Handle individual field changes
  const handleFieldChange = (field: keyof AddressData, value: string) => {
    setAddress((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-generate full address
      const parts = [
        updated.flatNo,
        updated.street,
        updated.landmark && `Near ${updated.landmark}`,
        updated.village,
        updated.city,
        updated.pincode,
      ].filter(Boolean);

      updated.fullAddress = parts.join(", ");
      return updated;
    });
  };

  // Reset form
  const resetForm = () => {
    setAddress({
      flatNo: "",
      flatHouseNo: "",
      street: "",
      landmark: "",
      village: "",
      city: "",
      pincode: "",
      fullAddress: "",
      label: "",
      type: "other",
    });
    setSearchValue("");
    setSearchResults([]);
    setShowSearchResults(false);
    setLocationError("");
  };

  // Detect current location
  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      return;
    }

    setIsDetectingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;

          // Reverse geocode the coordinates to get address
          const addressFromCoords = await reverseGeocode(latitude, longitude);

          setAddress((prev) => ({
            ...prev,
            coordinates: { lat: latitude, lng: longitude, accuracy },
            ...addressFromCoords,
            fullAddress:
              `${addressFromCoords.flatNo || ""}, ${addressFromCoords.street || ""}, ${addressFromCoords.village || ""}, ${addressFromCoords.city || ""}, ${addressFromCoords.pincode || ""}`
                .replace(/^, |, $|, , /g, ", ")
                .replace(/^, |, $/g, ""),
          }));

          setIsDetectingLocation(false);
        } catch (error) {
          console.error("Error getting address from coordinates:", error);
          setLocationError("Could not get address details from your location");
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError(getLocationErrorMessage(error.code));
        setIsDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      },
    );
  };

  // Get user-friendly error message
  const getLocationErrorMessage = (code: number) => {
    switch (code) {
      case 1:
        return "Location access denied. Please enable location permissions.";
      case 2:
        return "Location unavailable. Please check your GPS.";
      case 3:
        return "Location request timed out. Please try again.";
      default:
        return "Unable to get your location. Please enter manually.";
    }
  };

  // Simple reverse geocoding using a free service
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      // Use a free reverse geocoding service
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      );

      if (!response.ok) throw new Error("Geocoding failed");

      const data = await response.json();

      // Extract house number from address components
      let flatNo = "";
      if (data.streetNumber) {
        flatNo = data.streetNumber;
      } else if (data.street && data.street.match(/^\d+/)) {
        // If street starts with number, extract it as house number
        const match = data.street.match(/^(\d+[\w\/\-]*)/);
        if (match) {
          flatNo = match[1];
        }
      }

      return {
        flatNo: flatNo || "",
        street: data.locality || data.city || "",
        village: data.city || data.locality || "",
        city: data.city || data.principalSubdivision || "",
        pincode: data.postcode || "",
      };
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return {
        street: "",
        village: "",
        city: "",
        pincode: "",
      };
    }
  };

  // Search for locations
  const searchLocation = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);

    try {
      // Use a free geocoding service for search
      const response = await fetch(
        `https://api.bigdatacloud.net/data/forward-geocode?query=${encodeURIComponent(query)}&key=bdc_8b3ea0c90b6b4b7392ec4b8b8e3e8b3e`,
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    }

    setIsSearching(false);
  };

  // Handle search input
  const handleSearchChange = (value: string) => {
    setSearchValue(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      searchLocation(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Select search result
  const selectSearchResult = (result: any) => {
    const addressData = {
      street: result.locality || result.city || "",
      village: result.city || result.locality || "",
      city: result.city || result.principalSubdivision || "",
      pincode: result.postcode || "",
      coordinates: {
        lat: result.latitude,
        lng: result.longitude,
      },
    };

    setAddress((prev) => ({
      ...prev,
      ...addressData,
      fullAddress:
        `${addressData.street}, ${addressData.village}, ${addressData.city}, ${addressData.pincode}`
          .replace(/^, |, $|, , /g, ", ")
          .replace(/^, |, $/g, ""),
    }));

    setSearchValue(
      result.formattedAddress || `${addressData.city}, ${addressData.pincode}`,
    );
    setShowSearchResults(false);
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            Address Details
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={useSmartInput ? "default" : "outline"}
              size="sm"
              onClick={() => setUseSmartInput(!useSmartInput)}
              className={useSmartInput ? "bg-green-600 hover:bg-green-700" : ""}
              title={
                useSmartInput
                  ? "Switch to manual form"
                  : "Use smart address input"
              }
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {useSmartInput ? "Smart" : "Manual"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700"
              title="Clear all fields"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {useSmartInput ? (
          /* Smart Address Input */
          <SmartAddressInput
            initialAddress={{
              flatNo: address.flatNo,
              street: address.street,
              area: address.village,
              landmark: address.landmark,
              city: address.city,
              pincode: address.pincode,
              formattedAddress: address.fullAddress,
              coordinates: address.coordinates,
            }}
            onAddressChange={handleSmartAddressChange}
            options={{
              preserveUserInput: true,
              overrideEmpty: true,
              enableValidation: true,
              enableGeolocation: true,
            }}
            showValidation={true}
            showCurrentLocation={true}
            placeholder="🚀 Smart search: Just type any address and I'll autofill everything!"
            className="space-y-4"
          />
        ) : (
          /* Manual Address Form */
          <>
            {/* Location Detection */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="default"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Detecting Location...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    Detect My Location
                  </>
                )}
              </Button>

              {locationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{locationError}</p>
                </div>
              )}
            </div>

            {/* Location Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">🔍 Search Location</Label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search any location on Earth (e.g., Times Square New York, Connaught Place Delhi)"
                    value={searchValue}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() =>
                      searchResults.length > 0 && setShowSearchResults(true)
                    }
                    className="pl-10"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>

                {/* Search Results */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.slice(0, 5).map((result, index) => (
                      <div
                        key={index}
                        onClick={() => selectSearchResult(result)}
                        className="px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {result.formattedAddress ||
                            `${result.city}, ${result.principalSubdivision}`}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {result.locality && `${result.locality}, `}
                          {result.country}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Address Form Fields */}
            <div className="space-y-4">
              {/* Flat/House Number */}
              <div>
                <Label htmlFor="flatNo" className="text-sm font-medium">
                  🏠 Flat/House No. (Optional)
                </Label>
                <Input
                  id="flatNo"
                  placeholder="e.g., A-101, House No. 45 (optional)"
                  value={address.flatNo}
                  onChange={(e) => handleFieldChange("flatNo", e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Street/Area */}
              <div>
                <Label htmlFor="street" className="text-sm font-medium">
                  🛣️ Street/Area <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="street"
                  placeholder="e.g., Sector 15, MG Road"
                  value={address.street}
                  onChange={(e) => handleFieldChange("street", e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              {/* City */}
              <div>
                <Label htmlFor="city" className="text-sm font-medium">
                  🏙️ City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="e.g., Delhi, Mumbai, New York"
                  value={address.city}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              {/* State/Village */}
              <div>
                <Label htmlFor="village" className="text-sm font-medium">
                  📍 State/Region
                </Label>
                <Input
                  id="village"
                  placeholder="e.g., Delhi, Maharashtra, New York"
                  value={address.village}
                  onChange={(e) => handleFieldChange("village", e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Pincode */}
              <div>
                <Label htmlFor="pincode" className="text-sm font-medium">
                  📮 Pincode/Zip <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pincode"
                  placeholder="e.g., 110001, 400001, 10001"
                  value={address.pincode}
                  onChange={(e) => handleFieldChange("pincode", e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              {/* Landmark */}
              <div>
                <Label htmlFor="landmark" className="text-sm font-medium">
                  🗺️ Landmark (Optional)
                </Label>
                <Input
                  id="landmark"
                  placeholder="e.g., Near Metro Station, Opposite Mall"
                  value={address.landmark}
                  onChange={(e) =>
                    handleFieldChange("landmark", e.target.value)
                  }
                  className="mt-1"
                />
              </div>

              {/* Address Type */}
              <div>
                <Label htmlFor="type" className="text-sm font-medium">
                  🏠 Address Type <span className="text-red-500">*</span>
                </Label>
                <select
                  id="type"
                  value={address.type || "other"}
                  onChange={(e) => handleFieldChange("type", e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="home">🏠 Home</option>
                  <option value="office">🏢 Office</option>
                  <option value="other">📍 Other</option>
                </select>
              </div>

              {/* Address Label */}
              {showLabel && (
                <div>
                  <Label htmlFor="label" className="text-sm font-medium">
                    🏷️ Address Label (Optional)
                  </Label>
                  <Input
                    id="label"
                    placeholder="e.g., My Home, Office, Mom's Place"
                    value={address.label}
                    onChange={(e) => handleFieldChange("label", e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Common Elements - shown for both smart and manual modes */}

        {/* Location Status */}
        {address.coordinates && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                📍 Location coordinates saved
              </span>
            </div>
          </div>
        )}

        {/* Full Address Preview */}
        {address.fullAddress && (
          <div className="p-3 bg-gray-50 rounded-lg border">
            <Label className="text-sm font-medium text-gray-700 mb-1 block">
              Complete Address:
            </Label>
            <p className="text-sm text-gray-800">{address.fullAddress}</p>
          </div>
        )}

        {/* Save Button */}
        {onAddressUpdate && (
          <Button
            onClick={() => onAddressUpdate(address)}
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={!address.street || !address.city || !address.pincode}
          >
            Save Address
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default SimplifiedAddressForm;
