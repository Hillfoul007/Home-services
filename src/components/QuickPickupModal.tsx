import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Clock,
  User,
  Phone,
  CheckCircle,
  Loader2,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { LocationDetectionService } from "@/services/locationDetectionService";
import LocationUnavailableModal from "./LocationUnavailableModal";

interface QuickPickupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

const QuickPickupModal: React.FC<QuickPickupModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  // Check if user is available for conditional rendering within main component
  // Add mobile viewport fix and z-index styles on modal open
  React.useEffect(() => {
    let styleElement: HTMLStyleElement | null = null;

    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      // Fix for iOS Safari viewport issues
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }

      // Add z-index styles for Select dropdown and modal layering
      styleElement = document.createElement('style');
      styleElement.id = 'quick-pickup-modal-styles';
      styleElement.textContent = `
        [data-radix-popper-content-wrapper] {
          z-index: 999999 !important;
        }
        [data-radix-select-content] {
          z-index: 999999 !important;
        }
        .select-portal {
          z-index: 999999 !important;
        }

        /* Location Unavailable Modal should appear above Quick Pickup Modal */
        .mobile-modal[data-radix-dialog-content] {
          z-index: 99999999 !important;
        }

        /* Quick Pickup Modal z-index */
        [data-quick-pickup-modal] {
          z-index: 50 !important;
        }
      `;
      document.head.appendChild(styleElement);
    } else {
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'unset';

      // Remove z-index styles
      const existingStyle = document.getElementById('quick-pickup-modal-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    }

    return () => {
      document.body.style.overflow = 'unset';
      // Clean up styles on unmount
      if (styleElement && document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, [isOpen]);
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showLocationUnavailable, setShowLocationUnavailable] = useState(false);
  const [detectedLocationText, setDetectedLocationText] = useState("");
  const [addressAutoDetected, setAddressAutoDetected] = useState(false);
  const [detectionAccuracy, setDetectionAccuracy] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    pickup_date: "",
    pickup_time: "",
    house_number: "",
    address: "",
  });

  const locationDetectionService = LocationDetectionService.getInstance();

  // Get minimum selectable date (today or tomorrow based on available time slots)
  const getMinSelectableDate = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // If it's after 7:30 PM (19:30), user can only book for tomorrow or later
    if (currentHour >= 19 && currentMinute >= 30) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    // Otherwise, they can book for today if there are available slots
    return now.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (isOpen) {
      const minDate = getMinSelectableDate();
      setFormData(prev => ({
        ...prev,
        pickup_date: minDate,
        pickup_time: "", // Reset time when modal opens
      }));

      // Automatically trigger precise location detection when modal opens
      console.log("🎯 Quick Pickup modal opened - starting auto location detection");
      autoDetectPreciseLocation();
    } else {
      // Reset indicators when modal closes
      setAddressAutoDetected(false);
      setDetectionAccuracy(null);
      setDetectingLocation(false);
    }
  }, [isOpen]);

  // Auto-detect precise location when modal opens
  const autoDetectPreciseLocation = async () => {
    if (detectingLocation) return; // Prevent multiple simultaneous requests

    setDetectingLocation(true);
    try {
      console.log("🎯 Starting automatic precise location detection...");

      const detectedLocation = await locationDetectionService.detectPreciseLocationGPS();

      if (detectedLocation) {
        console.log("✅ Precise location detected:", detectedLocation);

        // Build comprehensive address from detected components
        const addressParts = [];

        if (detectedLocation.house_number) {
          addressParts.push(detectedLocation.house_number);
        }
        if (detectedLocation.building_name) {
          addressParts.push(detectedLocation.building_name);
        }
        if (detectedLocation.street_name) {
          addressParts.push(detectedLocation.street_name);
        }
        if (detectedLocation.neighborhood) {
          addressParts.push(detectedLocation.neighborhood);
        }
        if (detectedLocation.city && detectedLocation.city !== "Unknown") {
          addressParts.push(detectedLocation.city);
        }
        if (detectedLocation.pincode) {
          addressParts.push(detectedLocation.pincode);
        }

        const preciseAddress = addressParts.length > 0
          ? addressParts.join(', ')
          : detectedLocation.full_address;

        console.log("🏠 Built precise address:", preciseAddress);

        // Auto-populate the address field
        setFormData(prev => ({
          ...prev,
          address: preciseAddress
        }));

        // Set visual indicators
        setAddressAutoDetected(true);
        setDetectionAccuracy(detectedLocation.accuracy || null);

        // Validate the detected location
        const isValid = await validatePickupAddress(preciseAddress);
        if (isValid) {
          toast.success("📍 Precise location detected and validated!");
        }
      } else {
        console.log("⚠️ Could not detect precise location");
        toast.info("📍 Tap the location button to detect your address");
      }
    } catch (error) {
      console.error("❌ Auto location detection failed:", error);
      // Silently fail for auto-detection to avoid annoying users
    } finally {
      setDetectingLocation(false);
    }
  };

  // Helper function to handle date change and reset time
  const handleDateChange = (newDate: string) => {
    setFormData(prev => ({
      ...prev,
      pickup_date: newDate,
      pickup_time: "", // Reset time when date changes
    }));
  };

  // Validate pickup address using same logic as cart save address with enhanced keywords
  const validatePickupAddress = async (address: string): Promise<boolean> => {
    if (!address.trim()) return true; // Allow empty for now, will be caught by form validation

    try {
      // Parse address for validation components
      const addressLower = address.toLowerCase();

      // Extract potential pincode
      const pincodeMatch = address.match(/\b\d{6}\b/);
      const pincode = pincodeMatch ? pincodeMatch[0] : undefined;

      // Extract potential city
      let city = "unknown";
      if (addressLower.includes("gurugram") || addressLower.includes("gurgaon")) {
        city = addressLower.includes("gurugram") ? "gurugram" : "gurgaon";
      } else if (addressLower.includes("delhi")) {
        city = "delhi";
      } else if (addressLower.includes("sector")) {
        // If address contains sector but no specific city, assume Gurugram
        city = "gurugram";
      }

      console.log("🔍 Validating Quick Pickup address:", { address, city, pincode });

      // Extended validation - service available in all Gurugram/Gurgaon
      const validCities = ["gurugram", "gurgaon"];
      const isValidLocation = validCities.some(validCity => addressLower.includes(validCity));

      if (isValidLocation) {
        console.log("✅ Address validated - service available in Gurugram/Gurgaon");
        return true;
      }

      // Fallback to location service check
      const availability = await locationDetectionService.checkLocationAvailability(
        city,
        pincode,
        address
      );

      console.log("✅ Address validation result:", availability);

      if (!availability.is_available) {
        setDetectedLocationText(address);
        setShowLocationUnavailable(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating Quick Pickup address:", error);
      // Allow address if validation fails (fallback)
      return true;
    }
  };

  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      console.log("🎯 Manual precise location detection triggered");

      const detectedLocation = await locationDetectionService.detectPreciseLocationGPS();

      if (detectedLocation) {
        console.log("✅ Manual precise location detected:", detectedLocation);

        // Build the most comprehensive address possible
        const addressComponents = [];

        if (detectedLocation.house_number) {
          addressComponents.push(detectedLocation.house_number);
        }
        if (detectedLocation.building_name) {
          addressComponents.push(detectedLocation.building_name);
        }
        if (detectedLocation.street_name) {
          addressComponents.push(detectedLocation.street_name);
        }
        if (detectedLocation.neighborhood) {
          addressComponents.push(detectedLocation.neighborhood);
        }
        if (detectedLocation.landmark) {
          addressComponents.push(`Near ${detectedLocation.landmark}`);
        }
        if (detectedLocation.city && detectedLocation.city !== "Unknown") {
          addressComponents.push(detectedLocation.city);
        }
        if (detectedLocation.state) {
          addressComponents.push(detectedLocation.state);
        }
        if (detectedLocation.pincode) {
          addressComponents.push(detectedLocation.pincode);
        }

        const comprehensiveAddress = addressComponents.length > 0
          ? addressComponents.join(', ')
          : detectedLocation.full_address;

        console.log("🏠 Built comprehensive address:", comprehensiveAddress);

        setFormData(prev => ({ ...prev, address: comprehensiveAddress }));

        // Set visual indicators
        setAddressAutoDetected(true);
        setDetectionAccuracy(detectedLocation.accuracy || null);

        // Validate the detected location
        const isValid = await validatePickupAddress(comprehensiveAddress);
        if (isValid) {
          const accuracyText = detectedLocation.accuracy
            ? ` (±${Math.round(detectedLocation.accuracy)}m accuracy)`
            : '';
          toast.success(`📍 Precise location detected${accuracyText}!`);
        }
      } else {
        console.log("⚠️ Could not detect precise location, trying fallback");

        // Fallback to basic GPS
        const basicLocation = await locationDetectionService.detectLocationGPS();
        if (basicLocation) {
          setFormData(prev => ({ ...prev, address: basicLocation.full_address }));
          await validatePickupAddress(basicLocation.full_address);
          toast.success("📍 Location detected!");
        } else {
          throw new Error("All location detection methods failed");
        }
      }
    } catch (error) {
      console.error("❌ Location detection failed:", error);
      toast.error("Failed to detect location. Please enter address manually or check location permissions.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("🚀 CONFIRM QUICK PICKUP BUTTON CLICKED!");
    console.log("📋 Form data:", formData);
    console.log("👤 Current user:", currentUser);

    // Validate date
    if (!formData.pickup_date) {
      toast.error("Please select a pickup date");
      return;
    }

    // Validate date is not in the past
    const selectedDate = new Date(formData.pickup_date);
    const minDate = new Date(getMinSelectableDate());
    if (selectedDate < minDate) {
      toast.error("Please select a current or future date");
      return;
    }

    // Validate time slot is available
    if (!formData.pickup_time) {
      if (availableTimeSlots.length === 0) {
        toast.error("No time slots available for the selected date. Please choose a different date.");
      } else {
        toast.error("Please select a pickup time");
      }
      return;
    }

    // Validate selected time is still available
    if (!availableTimeSlots.includes(formData.pickup_time)) {
      toast.error("Selected time slot is no longer available. Please choose another time.");
      return;
    }

    // Validate address
    if (!formData.address.trim()) {
      toast.error("Please enter a pickup address");
      return;
    }

    // Validate pickup address for service availability
    const isAddressValid = await validatePickupAddress(formData.address);
    if (!isAddressValid) {
      return; // Address validation will show the location unavailable modal
    }

    setLoading(true);
    try {
      // Validate required customer data before submission
      const customerName = currentUser?.name || currentUser?.full_name;
      const customerPhone = currentUser?.phone;
      const customerId = currentUser?._id;

      if (!customerId) {
        toast.error("User ID is missing. Please log in again.");
        return;
      }

      if (!customerName) {
        toast.error("User name is missing. Please update your profile.");
        return;
      }

      if (!customerPhone) {
        toast.error("Phone number is missing. Please update your profile.");
        return;
      }

      const quickPickupData = {
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        pickup_date: formData.pickup_date,
        pickup_time: formData.pickup_time,
        house_number: formData.house_number,
        address: formData.address,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      console.log("📋 Submitting quick pickup data:", quickPickupData);
      console.log("🔧 API Client status:", apiClient.getConnectionStatus());

      const response = await apiClient.request<any>("/quick-pickup", {
        method: "POST",
        body: quickPickupData,
      });

      console.log("📋 Quick pickup response:", response);

      if (response.data) {
        toast.success("Quick pickup created successfully! Our rider will contact you soon.");
        onClose();
        // Reset form
        setFormData({
          pickup_date: "",
          pickup_time: "",
          house_number: "",
          address: "",
        });
      } else {
        toast.error(response.error || "Failed to create quick pickup");
      }
    } catch (error) {
      console.error("Quick pickup error:", error);
      toast.error("Failed to create quick pickup");
    } finally {
      setLoading(false);
    }
  };

  // Generate dynamic time slots based on current time and selected date
  const generateTimeSlots = () => {
    const now = new Date();
    const selectedDate = new Date(formData.pickup_date);
    const isToday = selectedDate.toDateString() === now.toDateString();

    const slots = [];
    const startHour = 9; // 9 AM
    const endHour = 20; // 8 PM

    for (let hour = startHour; hour <= endHour; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;

      if (isToday) {
        // If selected date is today, check if time slot is at least 30 minutes from now
        const slotTime = new Date();
        slotTime.setHours(hour, 0, 0, 0);
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

        if (slotTime >= thirtyMinutesFromNow) {
          slots.push(timeString);
        }
      } else {
        // For future dates, all slots are available
        slots.push(timeString);
      }
    }

    return slots;
  };

  const availableTimeSlots = generateTimeSlots();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md max-w-[95vw] w-full mx-auto flex flex-col p-0 overflow-hidden z-[50]"
        data-quick-pickup-modal
        style={{
          position: 'fixed',
          top: '2vh',
          left: '50%',
          transform: 'translateX(-50%)',
          maxHeight: '96vh',
          height: 'auto',
          minHeight: '70vh',
          zIndex: 50,
          marginBottom: 'max(2rem, env(safe-area-inset-bottom, 1rem))'
        }}
      >
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5" />
            Quick Pickup
          </DialogTitle>
          <p className="text-purple-100 text-sm mt-1">
            {!currentUser ? "Please log in to continue" : "Schedule a pickup and our rider will assess your items"}
          </p>
        </DialogHeader>

        {!currentUser ? (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Login Required</h3>
            <p className="text-gray-600 mb-6">Please log in to use the Quick Pickup feature</p>
            <Button onClick={onClose} className="bg-purple-600 hover:bg-purple-700 text-white">
              Close
            </Button>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 text-xs text-gray-500">
                Debug: currentUser = {JSON.stringify(currentUser, null, 2)}
              </div>
            )}
          </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div
              className="flex-1 overflow-y-auto px-6 py-4 space-y-6"
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                overflowY: 'auto',
                touchAction: 'pan-y',
                scrollBehavior: 'smooth',
                flexShrink: 1,
                minHeight: 0
              }}
            >
            {/* User Info Display */}
            <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-lg">
                      {currentUser?.name || currentUser?.full_name || "User"}
                    </div>
                    <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <Phone className="h-4 w-4" />
                      {currentUser?.phone || "No phone"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pickup Date */}
            <div className="space-y-2">
              <Label htmlFor="pickup_date" className="text-sm font-medium text-gray-700">
                📅 Pickup Date *
              </Label>
              <div className="relative">
                <Input
                  id="pickup_date"
                  type="date"
                  value={formData.pickup_date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  min={getMinSelectableDate()}
                  max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // 30 days from now
                  className="h-12 text-base border-gray-300 focus:border-purple-500 focus:ring-purple-500 focus:ring-2 focus:ring-opacity-20 transition-all duration-200 bg-white"
                  style={{
                    colorScheme: 'light',
                    WebkitAppearance: 'none',
                  }}
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Select a date from today onwards (up to 30 days)
              </p>
            </div>

            {/* Pickup Time */}
            <div className="space-y-2">
              <Label htmlFor="pickup_time" className="text-sm font-medium text-gray-700">
                ⏰ Pickup Time *
              </Label>
              <div className="relative">
                <Select
                  value={formData.pickup_time}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, pickup_time: value }))}
                  disabled={!formData.pickup_date || availableTimeSlots.length === 0}
                >
                  <SelectTrigger className="h-12 text-base border-gray-300 focus:border-purple-500 focus:ring-purple-500 focus:ring-2 focus:ring-opacity-20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    <SelectValue placeholder={
                      !formData.pickup_date
                        ? "Select date first"
                        : availableTimeSlots.length === 0
                          ? "No slots available for today"
                          : "Select pickup time"
                    } />
                  </SelectTrigger>
                  <SelectContent
                    className="z-[999999] max-h-[200px] overflow-y-auto bg-white shadow-2xl border border-gray-200 rounded-lg"
                    position="popper"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    avoidCollisions={true}
                    sticky="always"
                  >
                    <div className="p-2">
                      <div className="text-xs text-gray-500 px-2 py-1 border-b mb-1">
                        Available Time Slots
                      </div>
                      {availableTimeSlots.length === 0 ? (
                        <div className="px-2 py-4 text-center text-gray-500 text-sm">
                          No time slots available for this date.
                          <br />
                          <span className="text-xs">Try selecting tomorrow or later.</span>
                        </div>
                      ) : (
                        availableTimeSlots.map((time) => (
                          <SelectItem
                            key={time}
                            value={time}
                            className="cursor-pointer hover:bg-purple-50 focus:bg-purple-50 rounded-md transition-colors py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <Clock className="h-4 w-4 text-purple-600" />
                              </div>
                              <span className="font-medium text-gray-900">
                                {new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="text-gray-500">
                  {formData.pickup_date && availableTimeSlots.length > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      {availableTimeSlots.length} slot{availableTimeSlots.length !== 1 ? 's' : ''} available
                    </span>
                  )}
                  {formData.pickup_date && availableTimeSlots.length === 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3" />
                      No slots available today
                    </span>
                  )}
                </div>
                {formData.pickup_date && (
                  <div className="text-purple-600 font-medium">
                    {new Date(formData.pickup_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* House Number / Flat Number */}
            <div className="space-y-2">
              <Label htmlFor="house_number" className="text-sm font-medium text-gray-700">
                🏠 House No / Flat No (Optional)
              </Label>
              <Input
                id="house_number"
                value={formData.house_number}
                onChange={(e) => setFormData(prev => ({ ...prev, house_number: e.target.value }))}
                placeholder="Enter house number, flat number, or unit (e.g., 123, Flat 4B, Unit 205)"
                className="h-12 text-base border-gray-300 focus:border-purple-500 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500">
                💡 This helps our rider locate you more easily
              </p>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                📍 Pickup Address *
                {detectingLocation && (
                  <span className="ml-2 text-xs text-purple-600 animate-pulse">
                    🎯 Auto-detecting precise location...
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, address: e.target.value }));
                    // Reset auto-detection indicators when user manually edits
                    if (addressAutoDetected) {
                      setAddressAutoDetected(false);
                      setDetectionAccuracy(null);
                    }
                  }}
                  onBlur={async (e) => {
                    if (e.target.value.trim()) {
                      await validatePickupAddress(e.target.value);
                    }
                  }}
                  placeholder={detectingLocation
                    ? "🎯 Detecting your precise address..."
                    : "Enter full address with house number (e.g., 123, Tulip Violet, Sector 69, Gurugram 122101)"
                  }
                  className={`h-12 text-base border-gray-300 focus:border-purple-500 focus:ring-purple-500 flex-1 ${
                    detectingLocation ? 'bg-purple-50 border-purple-200' : ''
                  }`}
                  required
                  disabled={detectingLocation}
                />
                <Button
                  type="button"
                  variant="outline"
                  className={`h-12 w-12 border-gray-300 hover:border-purple-500 hover:bg-purple-50 ${
                    detectingLocation ? 'border-purple-300 bg-purple-50' : ''
                  }`}
                  onClick={detectLocation}
                  disabled={detectingLocation}
                  title={detectingLocation ? "Detecting precise location..." : "Detect my precise location"}
                >
                  {detectingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  ) : (
                    <Navigation className="h-4 w-4 text-purple-600" />
                  )}
                </Button>
              </div>
              {detectingLocation ? (
                <div className="flex items-center gap-2 text-xs text-purple-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Using GPS and multiple providers for maximum accuracy...</span>
                </div>
              ) : addressAutoDetected ? (
                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  <CheckCircle className="h-3 w-3" />
                  <span>
                    ✅ Address auto-detected with precision
                    {detectionAccuracy && ` (±${Math.round(detectionAccuracy)}m accuracy)`}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  💡 Auto-detection starts when modal opens. For best results, include house/flat number, building name, and landmarks
                </p>
              )}
            </div>

            {/* Info Alert */}
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800 leading-relaxed">
                🚚 <strong>How it works:</strong> Our professional rider will visit at your scheduled time to assess and collect your items.
              </AlertDescription>
            </Alert>
          </div>

          {/* Fixed bottom section for submit button */}
          <div
            className="flex-shrink-0 px-6 pt-4 border-t bg-gray-50 safe-area-bottom"
            style={{
              paddingBottom: 'max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 1rem)))',
              marginTop: 'auto',
              position: 'sticky',
              bottom: 0,
              zIndex: 10,
              minHeight: '80px'
            }}
          >
            <Button
              type="submit"
              onClick={(e) => {
                console.log("🔘 Submit button clicked directly!");
                console.log("📝 Loading state:", loading);
                console.log("🎯 Button disabled:", loading);
              }}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 rounded-xl shadow-lg transition-all duration-200 mobile-touch"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Quick Pickup...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Confirm Quick Pickup
                </>
              )}
            </Button>
            </div>
          </form>
        )}
      </DialogContent>

      {/* Location Unavailable Modal with higher z-index */}
      <LocationUnavailableModal
        isOpen={showLocationUnavailable}
        onClose={() => setShowLocationUnavailable(false)}
        detectedLocation={detectedLocationText}
        onExplore={() => {
          // Close both modals and let user explore services
          setShowLocationUnavailable(false);
          onClose();
        }}
        onNavigateHome={() => {
          // Navigate to home to explore available services
          window.location.href = "/";
        }}
      />
    </Dialog>
  );
};

export default QuickPickupModal;
