import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2, Navigation, X } from "lucide-react";
import { locationService, Coordinates } from "@/services/locationService";

interface AddressData {
  flatNo: string;
  flatHouseNo?: string;
  street: string;
  landmark: string;
  village: string;
  city: string;
  pincode: string;
  fullAddress: string;
  coordinates?: Coordinates;
  label?: string;
  type?: string;
}

interface EnhancedAddressFormProps {
  onAddressChange?: (address: AddressData) => void;
  onAddressUpdate?: (address: AddressData) => void;
  initialAddress?: AddressData;
  initialData?: any;
  className?: string;
  showLabel?: boolean;
}

declare global {
  interface Window {
    google: any;
  }
}

const EnhancedAddressForm: React.FC<EnhancedAddressFormProps> = ({
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
  const [isLoadingGoogleMaps, setIsLoadingGoogleMaps] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const autocompleteRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Update address when initialAddress prop changes (for autofill)
  useEffect(() => {
    if (initialAddress) {
      // Check if the address has meaningful data before autofilling
      const hasData =
        initialAddress.flatNo ||
        initialAddress.flatHouseNo ||
        initialAddress.street ||
        initialAddress.village ||
        initialAddress.city ||
        initialAddress.pincode ||
        initialAddress.fullAddress;

      // Only autofill if there's meaningful data and it's different from current state
      if (
        hasData &&
        (address.flatNo !==
          (initialAddress.flatNo || initialAddress.flatHouseNo || "") ||
          address.street !== (initialAddress.street || "") ||
          address.village !== (initialAddress.village || "") ||
          address.city !== (initialAddress.city || "") ||
          address.pincode !== (initialAddress.pincode || "") ||
          address.fullAddress !== (initialAddress.fullAddress || ""))
      ) {
        console.log("📍 Autofilling address from saved data:", initialAddress);
        const updatedAddress = {
          flatNo: initialAddress.flatNo || initialAddress.flatHouseNo || "",
          flatHouseNo:
            initialAddress.flatNo || initialAddress.flatHouseNo || "",
          street: initialAddress.street || "",
          landmark: initialAddress.landmark || "",
          village: initialAddress.village || "",
          city: initialAddress.city || "",
          pincode: initialAddress.pincode || "",
          fullAddress: initialAddress.fullAddress || "",
          label: initialAddress.label || "",
          type: initialAddress.type || "other",
          coordinates: initialAddress.coordinates,
        };
        setAddress(updatedAddress);
        setSearchValue(initialAddress.fullAddress || "");
        console.log("✅ Address autofilled successfully");
      }
    }
  }, [
    initialAddress,
    address.flatNo,
    address.street,
    address.village,
    address.city,
    address.pincode,
    address.fullAddress,
  ]);

  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps) {
      initializeAutocomplete();
    } else {
      loadGoogleMapsAPI();
    }
  }, []);

  // Don't auto-detect location - only when user clicks the button
  // useEffect(() => {
  //   if (!initialAddress?.fullAddress && !address.fullAddress) {
  //     detectCurrentLocation();
  //   }
  // }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const loadGoogleMapsAPI = () => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("Google Maps API key not configured");
      return;
    }

    // Check if script is already loading/loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      console.log("Google Maps script already exists");
      return;
    }

    setIsLoadingGoogleMaps(true);
    const script = document.createElement("script");
    const callbackName = `initGoogleMaps_${Date.now()}`;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;

    (window as any)[callbackName] = () => {
      setIsLoadingGoogleMaps(false);
      initializeAutocomplete();
      delete (window as any)[callbackName];
    };

    document.head.appendChild(script);
  };

  const initializeAutocomplete = () => {
    if (!window.google || !searchInputRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      searchInputRef.current,
      {
        types: ["address"],
        componentRestrictions: { country: "IN" },
        fields: ["address_components", "formatted_address", "geometry"],
      },
    );

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace();
      if (place.address_components) {
        parseGoogleMapsPlace(place);
      }
    });
  };

  const parseGoogleMapsPlace = (place: any) => {
    const components = place.address_components;
    const newAddress: AddressData = {
      flatNo: address.flatNo, // Keep user-entered flat number
      street: "",
      landmark: "", // Never autofill landmark - keep it empty
      village: "",
      city: "",
      pincode: "",
      fullAddress: place.formatted_address || "",
      coordinates: place.geometry?.location
        ? {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          }
        : undefined,
    };

    // Parse address components to extract detailed information
    components.forEach((component: any) => {
      const types = component.types;
      const longName = component.long_name;
      const shortName = component.short_name;

      if (types.includes("street_number")) {
        // House/building number - fill if empty or if location was auto-detected
        if (!newAddress.flatNo || !address.flatNo) {
          newAddress.flatNo = longName;
        }
      } else if (types.includes("route")) {
        // Street name
        newAddress.street = longName;
      } else if (types.includes("sublocality_level_2")) {
        // Sector/Area
        if (!newAddress.street) {
          newAddress.street = longName;
        } else {
          newAddress.street += `, ${longName}`;
        }
      } else if (
        types.includes("sublocality_level_1") ||
        types.includes("sublocality")
      ) {
        // Locality/Neighborhood
        newAddress.village = longName;
      } else if (types.includes("locality")) {
        // City
        newAddress.city = longName;
      } else if (types.includes("administrative_area_level_2")) {
        // District - use as city if city not found
        if (!newAddress.city) {
          newAddress.city = longName;
        }
      } else if (types.includes("administrative_area_level_1")) {
        // State - use as city if neither city nor district found
        if (!newAddress.city && !newAddress.village) {
          newAddress.city = longName;
        }
      } else if (types.includes("postal_code")) {
        // Pincode
        newAddress.pincode = longName;
      } else if (types.includes("premise") || types.includes("establishment")) {
        // Building name - don't use for landmark, but can use for flat number if empty or location detected
        if (
          (!newAddress.flatNo || !address.flatNo) &&
          types.includes("premise")
        ) {
          newAddress.flatNo = longName;
        }
        // Never autofill landmark from location
      }
    });

    // Fallback: if village is empty, use part of city or street
    if (!newAddress.village && newAddress.city) {
      newAddress.village = newAddress.city;
    }

    // If street is empty, try to extract from formatted address
    if (!newAddress.street && place.formatted_address) {
      const addressParts = place.formatted_address.split(",");
      if (addressParts.length > 1) {
        newAddress.street = addressParts[1].trim();
      }
    }

    setAddress(newAddress);
    setSearchValue(place.formatted_address || "");
    setShowSuggestions(false);
    if (onAddressChange) {
      onAddressChange(newAddress);
    }
  };

  const detectCurrentLocation = async () => {
    setIsDetectingLocation(true);
    setLocationDenied(false);

    try {
      let coordinates: Coordinates;

      try {
        // Get user's current location with highest accuracy settings
        coordinates = await locationService.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0, // Don't use cached location
        });
        console.log("📍 Location detected:", coordinates);
        setLocationDenied(false); // Reset denied state on success
      } catch (locationError) {
        console.log("Location detection failed:", locationError);
        // Check if it's a permission denied error
        if (
          locationError.message?.includes("denied") ||
          locationError.code === 1
        ) {
          setLocationDenied(true);
          console.log("Location permission denied by user");
        }
        // Fallback to default coordinates (28.5600, 76.9989)
        console.log("Using fallback coordinates");
        coordinates = { lat: 28.56, lng: 76.9989 };
      }

      // Get address details and fill the form
      await parseLocationData(coordinates);
    } catch (error) {
      console.error("Error detecting location:", error);
      // Final fallback with default coordinates
      const fallbackCoords = { lat: 28.56, lng: 76.9989 };
      await parseLocationData(fallbackCoords);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const parseLocationData = async (coordinates: Coordinates) => {
    try {
      // Try Google Maps first if available
      if (window.google && window.google.maps) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { location: { lat: coordinates.lat, lng: coordinates.lng } },
          (results: any[], status: string) => {
            if (status === "OK" && results[0]) {
              parseGoogleMapsPlace(results[0]);
              return;
            } else {
              // Fallback to alternative methods
              tryAlternativeGeocoding(coordinates);
            }
          },
        );
      } else {
        // No Google Maps, try alternative methods
        await tryAlternativeGeocoding(coordinates);
      }
    } catch (error) {
      console.error("Error parsing location data:", error);
      await tryAlternativeGeocoding(coordinates);
    }
  };

  const tryAlternativeGeocoding = async (coordinates: Coordinates) => {
    try {
      // Try our location service
      const addressString = await locationService.reverseGeocode(coordinates);

      if (
        addressString &&
        addressString !==
          `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`
      ) {
        // Parse the address string to extract components
        const parsedAddress = parseAddressString(addressString, coordinates);
        setAddress(parsedAddress);
        setSearchValue(addressString);
        if (onAddressChange) {
          onAddressChange(parsedAddress);
        }
      } else {
        // Use coordinates as address
        const coordsAddress = createCoordinatesAddress(coordinates);
        setAddress(coordsAddress);
        setSearchValue(coordsAddress.fullAddress);
        if (onAddressChange) {
          onAddressChange(coordsAddress);
        }
      }
    } catch (error) {
      console.error("Alternative geocoding failed:", error);
      // Final fallback
      const coordsAddress = createCoordinatesAddress(coordinates);
      setAddress(coordsAddress);
      setSearchValue(coordsAddress.fullAddress);
      if (onAddressChange) {
        onAddressChange(coordsAddress);
      }
    }
  };

  const parseAddressString = (
    addressString: string,
    coordinates: Coordinates,
  ): AddressData => {
    console.log("🏠 Enhanced parsing address string:", addressString);
    const parts = addressString.split(",").map((part) => part.trim());
    console.log("📍 Address parts for parsing:", parts);

    // Enhanced parsing for better area/village extraction
    let flatNo = "";
    let street = "";
    let village = "";
    let city = "";

    // Extract house/flat number (usually first part if it contains numbers)
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // Skip if it's a pincode (exactly 6 digits)
      if (part.match(/^\d{6}$/)) {
        continue;
      }

      // Look for parts that start with numbers or contain typical house number patterns
      if (
        (part.match(/^\d+/) && !part.match(/^\d{5,}$/)) || // Starts with number like "123" but not 5+ digits
        part.match(/^[A-Z]-?\d+/) || // Like "A-123" or "A123"
        part.match(/^\d+[A-Z]?\/\d+/) || // Like "123/45" or "123A/45"
        part.match(/^(House|Plot|Building|Block)\s*(No\.?)?\s*\d+/i) || // House No 123, Plot 45, etc.
        part.match(/^\d+[-\s][A-Z]+/) || // Like "123-A" or "123 Main"
        part.match(/^[A-Z]\d+/) // Like "A123", "B45"
      ) {
        // Only use if current flatNo is empty (preserve user input)
        if (!address.flatNo) {
          flatNo = part;
          console.log("🏠 House number extracted:", flatNo);
        }
        break;
      }
    }

    // Extract street (first meaningful part after house number)
    let streetStartIndex = flatNo ? 1 : 0; // Start after house number if found
    for (let i = streetStartIndex; i < parts.length; i++) {
      const streetCandidate = parts[i];
      if (
        streetCandidate &&
        streetCandidate !== flatNo &&
        !streetCandidate.match(/^\d+$/) &&
        !streetCandidate.match(/\b\d{6}\b/) && // Not a pincode
        streetCandidate.length > 2 &&
        !streetCandidate.includes("Pradesh") &&
        !streetCandidate.includes("State") &&
        streetCandidate !== "India"
      ) {
        street = streetCandidate;
        console.log("🛣️ Street extracted:", street);
        break;
      }
    }

    // Extract village/area (look for locality indicators)
    const localityIndicators = [
      "extension",
      "colony",
      "sector",
      "block",
      "phase",
      "nagar",
      "ganj",
      "marg",
      "vihar",
      "puram",
      "abad",
    ];

    // Find the most specific locality/village
    for (let i = 1; i < Math.min(parts.length - 1, 5); i++) {
      const part = parts[i];
      if (
        part &&
        part !== flatNo && // Exclude extracted house number
        part !== street && // Exclude already extracted street
        !part.match(/\b\d{6}\b/) && // Not a pincode
        ![
          "India",
          "Delhi",
          "Mumbai",
          "Kolkata",
          "Chennai",
          "Bangalore",
          "Hyderabad",
        ].includes(part) &&
        !part.includes("Pradesh") &&
        !part.includes("State")
      ) {
        // Prefer parts with locality indicators
        if (
          localityIndicators.some((indicator) =>
            part.toLowerCase().includes(indicator),
          )
        ) {
          village = part;
          console.log("🏘️ Village/Area with indicator found:", part);
          break;
        } else if (!village) {
          village = part; // Fallback to first suitable part
        }
      }
    }

    // Extract city (avoid states and country)
    for (let i = Math.max(1, parts.length - 4); i < parts.length; i++) {
      const cityCandidate = parts[i];
      if (
        cityCandidate &&
        cityCandidate !== flatNo && // Exclude extracted house number
        cityCandidate !== street && // Exclude already extracted street
        cityCandidate !== village && // Exclude already extracted village
        !cityCandidate.match(/\b\d{6}\b/) &&
        !cityCandidate.includes("Pradesh") &&
        !cityCandidate.includes("State") &&
        cityCandidate !== "India"
      ) {
        const cleanCity = cityCandidate.replace(/\d{6}/, "").trim();
        if (cleanCity && cleanCity.length > 2) {
          city = cleanCity;
          console.log("🏙️ City extracted:", cleanCity);
          break;
        }
      }
    }

    console.log("📋 Parsed components:", { flatNo, street, village, city });

    return {
      flatNo: address.flatNo || flatNo, // Use user input if available, otherwise extracted
      street: street || parts[1] || "",
      landmark: "", // Never autofill landmark
      village: village || parts[2] || parts[1] || "",
      city: city || parts[parts.length - 3] || parts[parts.length - 2] || "",
      pincode: extractPincode(addressString) || "",
      fullAddress: addressString,
      coordinates,
    };
  };

  const createCoordinatesAddress = (coordinates: Coordinates): AddressData => {
    return {
      flatNo: address.flatNo || "",
      street: address.street || "",
      landmark: address.landmark || "",
      village: address.village || "",
      city: address.city || "",
      pincode: address.pincode || "",
      fullAddress: `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`,
      coordinates,
    };
  };

  const extractPincode = (text: string): string => {
    const pincodeMatch = text.match(/\b\d{6}\b/);
    return pincodeMatch ? pincodeMatch[0] : "";
  };

  const handleFieldChange = (field: keyof AddressData, value: string) => {
    const newAddress = { ...address, [field]: value };

    // Update full address when individual fields change
    if (field !== "fullAddress" && field !== "coordinates") {
      const parts = [
        newAddress.flatNo,
        newAddress.street,
        newAddress.landmark,
        newAddress.village,
        newAddress.city,
        newAddress.pincode,
      ].filter(Boolean);
      newAddress.fullAddress = parts.join(", ");
    }

    setAddress(newAddress);
    if (onAddressChange) {
      onAddressChange(newAddress);
    }
    if (onAddressUpdate) {
      onAddressUpdate(newAddress);
    }
  };

  const handleCombinedAddressChange = (value: string) => {
    // Parse the combined address input and update the individual fields
    const parts = value.split(",").map((part) => part.trim());

    let updatedAddress = { ...address };

    if (parts.length >= 1) {
      updatedAddress.street = parts[0] || "";
    }
    if (parts.length >= 2) {
      updatedAddress.village = parts[1] || "";
    }
    if (parts.length >= 3) {
      // Check if this part is a pincode
      if (/^\d{6}$/.test(parts[2])) {
        updatedAddress.pincode = parts[2];
      } else {
        updatedAddress.city = parts[2];
      }
    }
    if (parts.length >= 4) {
      // Check if last part is a pincode (6 digits)
      const lastPart = parts[parts.length - 1];
      if (/^\d{6}$/.test(lastPart)) {
        updatedAddress.pincode = lastPart;
        // The third part should be city
        updatedAddress.city = parts[2] || "";
      } else {
        updatedAddress.city = lastPart;
      }
    }

    // Update full address
    updatedAddress.fullAddress = value;

    setAddress(updatedAddress);
    if (onAddressChange) {
      onAddressChange(updatedAddress);
    }
    if (onAddressUpdate) {
      onAddressUpdate(updatedAddress);
    }
  };

  const resetForm = () => {
    const emptyAddress: AddressData = {
      flatNo: "",
      street: "",
      landmark: "",
      village: "",
      city: "",
      pincode: "",
      fullAddress: "",
      coordinates: undefined,
    };
    setAddress(emptyAddress);
    setSearchValue("");
    if (onAddressChange) {
      onAddressChange(emptyAddress);
    }
  };

  // Search for places when user types
  useEffect(() => {
    const searchPlaces = async () => {
      if (searchValue.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsSearching(true);
      try {
        let searchComplete = false;

        // Try Google Places API first
        if (window.google && window.google.maps && window.google.maps.places) {
          try {
            const { AutocompleteSuggestion, AutocompleteSessionToken } =
              await window.google.maps.importLibrary("places");
            const sessionToken = new AutocompleteSessionToken();

            const request = {
              input: searchValue,
              sessionToken: sessionToken,
              includedRegionCodes: ["in"],
            };

            const response =
              await AutocompleteSuggestion.fetchAutocompleteSuggestions(
                request,
              );
            const predictions = response.suggestions;

            if (searchComplete) return; // Prevent duplicate calls

            if (predictions && predictions.length > 0) {
              const formattedPredictions = predictions
                .slice(0, 5)
                .map((suggestion: any) => {
                  const placePrediction = suggestion.placePrediction;
                  return {
                    description: placePrediction.text,
                    place_id: placePrediction.placeId,
                    structured_formatting: {
                      main_text:
                        placePrediction.structuredFormat?.mainText ||
                        placePrediction.text,
                      secondary_text:
                        placePrediction.structuredFormat?.secondaryText || "",
                    },
                  };
                });
              setSuggestions(formattedPredictions);
              setShowSuggestions(true);
              setIsSearching(false);
              searchComplete = true;
            } else {
              // Fallback to alternative search
              try {
                await searchAlternativePlaces(searchValue);
                searchComplete = true;
              } catch (error) {
                console.error("Alternative search error:", error);
                setIsSearching(false);
                searchComplete = true;
              }
            }
          } catch (error) {
            console.error("Google Places API error:", error);
            // Fallback to alternative search
            try {
              await searchAlternativePlaces(searchValue);
              searchComplete = true;
            } catch (fallbackError) {
              console.error("Alternative search error:", fallbackError);
              setIsSearching(false);
              searchComplete = true;
            }
          }
        } else {
          // Use alternative search method
          await searchAlternativePlaces(searchValue);
          searchComplete = true;
        }
      } catch (error) {
        console.error("Search error:", error);
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchPlaces, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  // Alternative place search using Nominatim
  const searchAlternativePlaces = async (query: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, India&limit=5&addressdetails=1`,
        {
          headers: {
            "User-Agent": "LaundaryFlash-App/1.0",
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data && Array.isArray(data) && data.length > 0) {
        const formattedSuggestions = data.map((place: any) => ({
          description: place.display_name,
          place_id: place.place_id,
          structured_formatting: {
            main_text: place.name || place.display_name.split(",")[0],
            secondary_text: place.display_name.split(",").slice(1).join(","),
          },
          geometry: {
            location: {
              lat: () => parseFloat(place.lat),
              lng: () => parseFloat(place.lon),
            },
          },
        }));
        setSuggestions(formattedSuggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("Alternative search failed:", error);
      setSuggestions([]);
      setShowSuggestions(false);
      throw error; // Re-throw to let caller handle setIsSearching
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: any) => {
    setSearchValue(suggestion.description);
    setShowSuggestions(false);
    setSuggestions([]);

    try {
      if (
        suggestion.place_id &&
        window.google &&
        window.google.maps &&
        window.google.maps.places
      ) {
        // Get detailed place information using new Place API
        try {
          const { getPlaceDetails } = await import(
            "@/utils/autocompleteSuggestionService"
          );
          const place = await getPlaceDetails(suggestion.place_id);
          if (place) {
            parseGoogleMapsPlace(place);
          }
        } catch (error) {
          console.error("Error getting place details with new API:", error);
        }
      } else if (suggestion.geometry) {
        // Use coordinates to get address details
        const coordinates = {
          lat: suggestion.geometry.location.lat(),
          lng: suggestion.geometry.location.lng(),
        };
        await parseLocationData(coordinates);
      }
    } catch (error) {
      console.error("Error getting place details:", error);
    }
  };

  // Update address whenever individual fields change
  useEffect(() => {
    if (onAddressChange) {
      onAddressChange(address);
    }
  }, [address, onAddressChange]);

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-blue-600" />
            Delivery Address
          </CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location Search */}
        <div className="space-y-3">
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={searchInputRef}
                  placeholder="Type to search places (e.g., MG Road Gurgaon, Sector 15 Delhi)"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  className="w-full"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
            </div>

            {/* Search Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {suggestion.structured_formatting?.main_text ||
                        suggestion.description?.split(",")[0]}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {suggestion.structured_formatting?.secondary_text ||
                        suggestion.description
                          ?.split(",")
                          .slice(1)
                          .join(",")
                          .trim()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location detection buttons */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="default"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    {locationDenied ? "Try Location Again" : "Detect Location"}
                  </>
                )}
              </Button>
            </div>

            {locationDenied && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  📍 Location access was denied. You can manually enter your
                  address or click "Try Location Again" to re-enable location
                  detection.
                </p>
              </div>
            )}
          </div>
        </div>

        {(isLoadingGoogleMaps || isDetectingLocation) && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-700">
              {isDetectingLocation
                ? "Detecting your location and filling address details..."
                : "Loading address suggestions..."}
            </span>
          </div>
        )}

        {/* Address Fields - Optimized Layout */}
        <div className="space-y-4">
          {/* Row 1: House/Flat Number */}
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

          {/* Row 2: Combined Area/Street + City + Pincode */}
          <div>
            <Label htmlFor="combined-address" className="text-sm font-medium">
              📍 Area, City, Pincode *
            </Label>
            <Input
              id="combined-address"
              placeholder="e.g., Sector 15, Gurgaon, 122018"
              value={`${address.street || ""}${address.street && address.village ? ", " : ""}${address.village || ""}${address.village && address.city && address.village !== address.city ? ", " : ""}${address.city && address.city !== address.village ? address.city : ""}${address.pincode ? ", " + address.pincode : ""}`
                .replace(/^, /, "")
                .replace(/, $/, "")}
              onChange={(e) => handleCombinedAddressChange(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          {/* Row 3: Landmark */}
          <div>
            <Label htmlFor="landmark" className="text-sm font-medium">
              🗺️ Landmark
            </Label>
            <Input
              id="landmark"
              placeholder="e.g., Near Metro Station, Opposite Mall"
              value={address.landmark}
              onChange={(e) => handleFieldChange("landmark", e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Address Type */}
          <div>
            <Label htmlFor="address-type" className="text-sm font-medium">
              🏠 Address Type <span className="text-red-500">*</span>
            </Label>
            <select
              id="address-type"
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
              <Label htmlFor="address-label" className="text-sm font-medium">
                🏷️ Address Label (Optional)
              </Label>
              <Input
                id="address-label"
                placeholder="e.g., My Home, Office, Mom's Place"
                value={address.label}
                onChange={(e) => handleFieldChange("label", e.target.value)}
                className="mt-1"
              />
            </div>
          )}
        </div>

        {/* Location Status */}
        {address.coordinates && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <Label className="text-sm font-medium text-green-700">
                📍 Location detected and address filled automatically
              </Label>
            </div>
            {address.coordinates.accuracy &&
              address.coordinates.accuracy <= 20 && (
                <p className="text-xs text-green-600 mt-1">
                  🎯 High accuracy location detected
                </p>
              )}
          </div>
        )}

        {/* Full Address Preview */}
        {address.fullAddress && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <Label className="text-sm font-medium text-gray-700 mb-1 block">
              Complete Address:
            </Label>
            <p className="text-sm text-gray-800">{address.fullAddress}</p>
          </div>
        )}

        {/* Submit Button for SavedAddressesModal */}
        {onAddressUpdate && (
          <div className="mt-6 flex gap-3">
            <Button
              onClick={() => onAddressUpdate(address)}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!address.village || !address.city || !address.pincode}
            >
              Save Address
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedAddressForm;
