import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  MapPin,
  Navigation,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import useAddressAutofill, {
  AddressAutofillOptions,
} from "@/hooks/useAddressAutofill";
import { ParsedAddress } from "@/utils/autocompleteSuggestionService";

export interface SmartAddressInputProps {
  initialAddress?: Partial<ParsedAddress>;
  onAddressChange?: (address: ParsedAddress) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  options?: AddressAutofillOptions;
  showValidation?: boolean;
  showCurrentLocation?: boolean;
  placeholder?: string;
  className?: string;
}

export const SmartAddressInput: React.FC<SmartAddressInputProps> = ({
  initialAddress = {},
  onAddressChange,
  onValidationChange,
  options = {},
  showValidation = true,
  showCurrentLocation = true,
  placeholder = "Search for your address...",
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const {
    address,
    suggestions,
    isLoading,
    validation,
    error,
    updateAddressField,
    searchAddresses,
    autofillFromSuggestion,
    autofillFromCurrentLocation,
    clearSuggestions,
    getDisplayAddress,
    isServiceReady,
  } = useAddressAutofill(initialAddress, options);

  // Notify parent of address changes
  useEffect(() => {
    onAddressChange?.(address);
  }, [address, onAddressChange]);

  // Notify parent of validation changes
  useEffect(() => {
    onValidationChange?.(validation.isValid, validation.missingFields);
  }, [validation, onValidationChange]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    searchAddresses(value);
    setShowSuggestions(true);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: any) => {
    setSearchQuery(suggestion.description);
    setShowSuggestions(false);

    const result = await autofillFromSuggestion(suggestion);
    if (result) {
      setShowAddressForm(true);
    }
  };

  // Handle current location
  const handleCurrentLocation = async () => {
    const result = await autofillFromCurrentLocation();
    if (result) {
      setSearchQuery("Current Location");
      setShowAddressForm(true);
    }
  };

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        searchInputRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSuggestions]);

  // Show form if address has some data
  useEffect(() => {
    const hasAddressData = Object.values(address).some(
      (value) => value && value.toString().trim().length > 0,
    );
    if (hasAddressData && !showAddressForm) {
      setShowAddressForm(true);
    }
  }, [address, showAddressForm]);

  const displayAddress = getDisplayAddress();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10 pr-12"
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>

        {/* Current Location Button */}
        {showCurrentLocation && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCurrentLocation}
            disabled={isLoading}
            className="mt-2 w-full text-blue-600 hover:text-blue-700"
          >
            <Navigation className="h-4 w-4 mr-2" />
            Use Current Location
          </Button>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Service Status */}
        {!isServiceReady() && (
          <div className="mt-2 flex items-center gap-2 text-sm text-orange-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Initializing address service...
          </div>
        )}
      </div>

      {/* Address Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Card
          className="relative z-50 max-h-64 overflow-y-auto"
          ref={suggestionsRef}
        >
          <CardContent className="p-0">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.place_id}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                onClick={() => handleSuggestionSelect(suggestion)}
              >
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {suggestion.structured_formatting.main_text}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {suggestion.structured_formatting.secondary_text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Address Form Fields */}
      {showAddressForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Address Details</h3>
              {showValidation && (
                <Badge
                  variant={validation.isValid ? "default" : "destructive"}
                  className="text-xs"
                >
                  {validation.isValid ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Complete
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Incomplete
                    </>
                  )}
                </Badge>
              )}
            </div>

            {/* Current Address Display */}
            {displayAddress && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  {displayAddress}
                </p>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 gap-4">
              {/* Flat/House Number */}
              <div>
                <Label htmlFor="flatNo" className="text-sm font-medium">
                  🏠 Flat/House No.
                </Label>
                <Input
                  id="flatNo"
                  placeholder="e.g., A-101, House No. 45"
                  value={address.flatNo || ""}
                  onChange={(e) => updateAddressField("flatNo", e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Street */}
              <div>
                <Label htmlFor="street" className="text-sm font-medium">
                  🛣️ Street/Road <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="street"
                  placeholder="e.g., MG Road, Sector 15"
                  value={address.street || ""}
                  onChange={(e) => updateAddressField("street", e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              {/* Area/Locality */}
              <div>
                <Label htmlFor="area" className="text-sm font-medium">
                  🏘️ Area/Locality <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="area"
                  placeholder="e.g., Connaught Place, Bandra"
                  value={address.area || ""}
                  onChange={(e) => updateAddressField("area", e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              {/* Landmark */}
              <div>
                <Label htmlFor="landmark" className="text-sm font-medium">
                  📍 Landmark (Optional)
                </Label>
                <Input
                  id="landmark"
                  placeholder="e.g., Near Metro Station, Opposite Mall"
                  value={address.landmark || ""}
                  onChange={(e) =>
                    updateAddressField("landmark", e.target.value)
                  }
                  className="mt-1"
                />
              </div>

              {/* City and Pincode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city" className="text-sm font-medium">
                    🏙️ City
                  </Label>
                  <Input
                    id="city"
                    placeholder="e.g., Delhi, Mumbai"
                    value={address.city || ""}
                    onChange={(e) => updateAddressField("city", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="pincode" className="text-sm font-medium">
                    📮 Pincode <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pincode"
                    placeholder="e.g., 110001"
                    value={address.pincode || ""}
                    onChange={(e) =>
                      updateAddressField("pincode", e.target.value)
                    }
                    className="mt-1"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              {/* State */}
              <div>
                <Label htmlFor="state" className="text-sm font-medium">
                  🗺️ State
                </Label>
                <Input
                  id="state"
                  placeholder="e.g., Delhi, Maharashtra"
                  value={address.state || ""}
                  onChange={(e) => updateAddressField("state", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Validation Messages */}
            {showValidation &&
              !validation.isValid &&
              validation.suggestions.length > 0 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        Complete your address:
                      </p>
                      <ul className="text-sm text-orange-700 mt-1 space-y-1">
                        {validation.suggestions.map((suggestion, index) => (
                          <li key={index}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartAddressInput;
