import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import type { User } from "@/integrations/mongodb/models/User";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  MapPin,
  Clock,
  DollarSign,
  User as UserIcon,
  Phone,
} from "lucide-react";
import ProfessionalDateTimePicker from "./ProfessionalDateTimePicker";
import PhoneOtpAuthModal from "./PhoneOtpAuthModal";
import LocationDetector from "./LocationDetector.tsx";
import BookingConfirmation from "./BookingConfirmation";
import BookingSuccessAlert from "./BookingSuccessAlert";
import { adaptiveBookingHelpers } from "@/integrations/adaptive/bookingHelpers";
import { userValidation } from "@/utils/userValidation";
import { bookingTestHelper } from "@/utils/bookingTestHelper";
import { getServicePriceWithFallback } from "@/utils/servicePricing";


interface BookingFlowProps {
  provider?: any;
  services?: any[];
  isMultipleServices?: boolean;
  currentUser?: User;
  userLocation?: string;
  locationCoordinates?: { lat: number; lng: number } | null;
  onBookingComplete: () => void;
  onLoginSuccess?: (user: any) => void;
}

const BookingFlow: React.FC<BookingFlowProps> = ({
  provider,
  services = [],
  isMultipleServices = false,
  currentUser,
  userLocation,
  locationCoordinates,
  onBookingComplete,
  onLoginSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedAddress, setSelectedAddress] = useState(userLocation || "");
  const [addressCoordinates, setAddressCoordinates] = useState(
    locationCoordinates || null,
  );
  const [addressDetails, setAddressDetails] = useState({
    landmark: "",
    floor: "",
    area: "",
    houseNumber: "",
    apartmentName: "",
    instructions: "",
  });
  const [additionalDetails, setAdditionalDetails] = useState("");


  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<any>(null);

  const calculateTotalPrice = () => {
    if (isMultipleServices) {
      return services.reduce(
        (total, service) =>
          total + (service.price * (service.quantity || 1) || 80),
        0,
      );
    }
    return provider?.price || 80;
  };

  const getDeliveryCharge = () => {
    return 0; // Free delivery
  };

  const getHandlingFee = () => {
    return 0; // Free handling fee as shown in UI
  };



  const calculateFinalAmount = () => {
    const basePrice = calculateTotalPrice();
    const deliveryCharge = getDeliveryCharge();
    const handlingFee = getHandlingFee();
    const subtotal = basePrice + deliveryCharge + handlingFee;

    return Math.round(subtotal * 100) / 100;
  };





  const handleBookService = async () => {
    console.log("🚀 Starting booking process...");
    bookingTestHelper.runDiagnostic();

    if (!currentUser) {
      console.log("❌ No current user found");
      setError("Please sign in first to book a service");
      setShowAuthModal(true);
      return;
    }

    if (!selectedDate || !selectedTime) {
      setError("Please select date and time");
      return;
    }

    if (!selectedAddress.trim()) {
      setError("Please provide your address");
      return;
    }

    // Ensure we have a valid customer ID using robust validation
    if (!userValidation.isValidUser(currentUser)) {
      console.log("❌ User validation failed:", currentUser);
      setError("Please sign in to book a service.");
      setShowAuthModal(true);
      return;
    }

    const customerId = currentUser._id;
    console.log("✅ User validated. Customer ID:", customerId);

    setIsProcessing(true);
    setError("");

    try {
      const customerId = currentUser._id || currentUser.uid || currentUser.id;
      // Construct complete address
      const completeAddress = [
        addressDetails.houseNumber,
        addressDetails.apartmentName,
        selectedAddress,
        addressDetails.area,
        addressDetails.landmark && `Near ${addressDetails.landmark}`,
        addressDetails.floor && `Floor: ${addressDetails.floor}`,
      ]
        .filter(Boolean)
        .join(", ");

      // Prepare item prices for accurate booking history
      const itemPrices = isMultipleServices
        ? services.map((service) => {
            const serviceInfo = getServicePriceWithFallback(service.name);
            const unitPrice = service.price || serviceInfo.unitPrice;
            const quantity = service.quantity || 1;
            return {
              service_name: service.name,
              quantity: quantity,
              unit_price: unitPrice,
              total_price: unitPrice * quantity,
            };
          })
        : [
            {
              service_name: provider?.name || "Service",
              quantity: 1,
              unit_price:
                provider?.price ||
                getServicePriceWithFallback(provider?.name || "Service")
                  .unitPrice,
              total_price:
                provider?.price ||
                getServicePriceWithFallback(provider?.name || "Service")
                  .unitPrice,
            },
          ];

      const bookingData = {
        customer_id: customerId,
        service: isMultipleServices
          ? services.map((s) => s.name).join(", ")
          : provider?.name || "Service",
        service_type: isMultipleServices
          ? "Multiple Services"
          : "Single Service",
        services: isMultipleServices
          ? services.map((s) => s.name)
          : [provider?.name || "Service"],
        scheduled_date: selectedDate.toISOString().split("T")[0],
        scheduled_time: selectedTime,
        // Set delivery date to 2 days after pickup and delivery time to 6 PM
        delivery_date: (() => {
          const deliveryDate = new Date(selectedDate);
          deliveryDate.setDate(deliveryDate.getDate() + 2);
          return deliveryDate.toISOString().split("T")[0];
        })(),
        delivery_time: "6:00 PM",
        provider_name: isMultipleServices
          ? "CleanCare Pro"
          : provider?.provider || "CleanCare Pro",
        address: completeAddress || selectedAddress,
        coordinates: addressCoordinates || { lat: 0, lng: 0 },
        additional_details: [
          additionalDetails,
          addressDetails.instructions &&
            `Instructions: ${addressDetails.instructions}`,
        ]
          .filter(Boolean)
          .join("\n"),
        total_price: calculateTotalPrice(),
        final_amount: calculateFinalAmount(),

        special_instructions: [
          additionalDetails,
          addressDetails.instructions,
          addressDetails.landmark && `Landmark: ${addressDetails.landmark}`,
          addressDetails.floor && `Floor: ${addressDetails.floor}`,
        ]
          .filter(Boolean)
          .join(", "),
        address_details: addressDetails,
        item_prices: itemPrices,
        charges_breakdown: {
          base_price: calculateTotalPrice(),
          service_fee: getDeliveryCharge(),
          delivery_fee: 0,
          handling_fee: getHandlingFee(),
          tax_amount:
            (calculateTotalPrice() + getDeliveryCharge() + getHandlingFee()) *
            0.12,

        },
        // For backward compatibility with different booking systems
        pickupDate: selectedDate.toISOString().split("T")[0],
        pickupTime: selectedTime,
        totalAmount: calculateFinalAmount(),
        userId: customerId,
        paymentStatus: "pending",
        status: "pending",
      };

      // Log the booking attempt
      bookingTestHelper.logBookingAttempt(bookingData);

      const { data, error: bookingError } =
        await adaptiveBookingHelpers.createBooking(bookingData);

      // Log the result
      bookingTestHelper.logBookingResult(
        { data, error: bookingError },
        "AdaptiveBookingHelpers",
      );

      if (bookingError) {
        console.error("❌ Booking creation failed:", bookingError);
        setError(bookingError.message || "Failed to create booking");
      } else if (data) {
        console.log("✅ Booking created successfully:", data);
        // Store the completed booking data
        setCompletedBooking(data);

        // Clear cart after successful booking
        localStorage.removeItem("laundry_cart");
        localStorage.removeItem("mobile_service_cart");
        localStorage.removeItem("service_cart");
        localStorage.removeItem("cleancare_cart");
        localStorage.removeItem("laundry_booking_form");
        localStorage.removeItem("cleancare_booking_form");

        // Dispatch cart clear event
        const clearCartEvent = new CustomEvent("clearCart");
        window.dispatchEvent(clearCartEvent);

        // Close confirmation modal and show success alert
        setShowConfirmation(false);
        setShowBookingSuccess(true);
      } else {
        console.error("❌ No data returned from booking creation");
        setError("No response from booking service. Please try again.");
      }
    } catch (error: any) {
      setError(
        error.message ||
          "Network error. Please check your connection and try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    if (onBookingComplete) {
      onBookingComplete();
    }
  };

  const handleLoginSuccess = (user: any) => {
    setShowAuthModal(false);

    // Call parent's login success handler
    if (onLoginSuccess) {
      onLoginSuccess(user);
    }
  };

  if (showConfirmation) {
    return (
      <BookingConfirmation
        bookingData={{
          services: isMultipleServices
            ? services
            : [
                {
                  name: provider?.name || "Service",
                  price: provider?.price || 80,
                },
              ],
          selectedDate: selectedDate!,
          selectedTime,
          selectedAddress,
          additionalDetails,
          isMultipleServices,
          provider,
          currentUser,
        }}
        onConfirmBooking={handleBookService}
        onBack={() => setShowConfirmation(false)}
        isProcessing={isProcessing}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Book Your Service
        </h2>
        <p className="text-gray-600">
          Schedule your service at your convenience
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Details Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserIcon className="h-5 w-5" />
                Selected Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isMultipleServices ? (
                  services.map((service, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-gray-600">
                          by {service.provider} • Qty: {service.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ${service.price * service.quantity}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{provider?.name}</p>
                      <p className="text-sm text-gray-600">
                        by {provider?.provider}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {provider?.duration}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          ⭐ {provider?.rating}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">
                        ${provider?.price}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Date & Time Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProfessionalDateTimePicker
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onDateChange={setSelectedDate}
                onTimeChange={setSelectedTime}
              />
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Service Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <LocationDetector
                onAddressSelect={(address, coordinates) => {
                  setSelectedAddress(address);
                  setAddressCoordinates(coordinates);
                }}
                onLocationChange={(location, coordinates) => {
                  setSelectedAddress(location);
                  setAddressCoordinates(coordinates || null);
                }}
                defaultValue={selectedAddress}
              />

              {/* Additional Address Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label
                    htmlFor="houseNumber"
                    className="text-sm font-medium text-gray-700"
                  >
                    House/Building Number
                  </Label>
                  <Input
                    id="houseNumber"
                    placeholder="e.g., 123, A-45"
                    value={addressDetails.houseNumber}
                    onChange={(e) =>
                      setAddressDetails({
                        ...addressDetails,
                        houseNumber: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="floor"
                    className="text-sm font-medium text-gray-700"
                  >
                    Floor Number
                  </Label>
                  <Input
                    id="floor"
                    placeholder="e.g., Ground, 2nd, 15th"
                    value={addressDetails.floor}
                    onChange={(e) =>
                      setAddressDetails({
                        ...addressDetails,
                        floor: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="apartmentName"
                    className="text-sm font-medium text-gray-700"
                  >
                    Apartment/Society Name
                  </Label>
                  <Input
                    id="apartmentName"
                    placeholder="e.g., Green Valley Apartments"
                    value={addressDetails.apartmentName}
                    onChange={(e) =>
                      setAddressDetails({
                        ...addressDetails,
                        apartmentName: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="area"
                    className="text-sm font-medium text-gray-700"
                  >
                    Area/Locality
                  </Label>
                  <Input
                    id="area"
                    placeholder="e.g., Sector 25, Downtown"
                    value={addressDetails.area}
                    onChange={(e) =>
                      setAddressDetails({
                        ...addressDetails,
                        area: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label
                    htmlFor="landmark"
                    className="text-sm font-medium text-gray-700"
                  >
                    Nearby Landmark
                  </Label>
                  <Input
                    id="landmark"
                    placeholder="e.g., Near City Mall, Opposite Metro Station"
                    value={addressDetails.landmark}
                    onChange={(e) =>
                      setAddressDetails({
                        ...addressDetails,
                        landmark: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label
                    htmlFor="instructions"
                    className="text-sm font-medium text-gray-700"
                  >
                    Special Instructions
                  </Label>
                  <Input
                    id="instructions"
                    placeholder="e.g., Ring doorbell twice, Ask for John"
                    value={addressDetails.instructions}
                    onChange={(e) =>
                      setAddressDetails({
                        ...addressDetails,
                        instructions: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Any special instructions or requirements..."
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                className="min-h-20"
              />
            </CardContent>
          </Card>
        </div>

        {/* Price Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5" />
                Price Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Service Price</span>
                  <span>${calculateTotalPrice()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Delivery Charge</span>
                  <div className="flex items-center gap-2">
                    <span className="line-through text-gray-400 text-xs">
                      ₹30
                    </span>
                    <span className="font-medium">FREE</span>
                  </div>
                </div>

                <div className="flex justify-between text-sm text-green-600">
                  <span>Handling Fee</span>
                  <div className="flex items-center gap-2">
                    <span className="line-through text-gray-400 text-xs">
                      ₹9
                    </span>
                    <span className="font-medium">FREE</span>
                  </div>
                </div>

              </div>



              <div className="border-t pt-2">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Amount</span>
                  <span>${calculateFinalAmount()}</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button
                onClick={() => setShowConfirmation(true)}
                disabled={
                  !selectedDate || !selectedTime || !selectedAddress.trim()
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                size="lg"
              >
                Review Booking - ${calculateFinalAmount()}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                No payment required now. Pay after service completion.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Authentication Modal */}
      <PhoneOtpAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Booking Success Alert */}
      <BookingSuccessAlert
        booking={completedBooking}
        isVisible={showBookingSuccess}
        onClose={() => {
          setShowBookingSuccess(false);

          // Ensure cart is cleared on success alert close as well
          localStorage.removeItem("laundry_cart");
          localStorage.removeItem("mobile_service_cart");
          localStorage.removeItem("service_cart");
          localStorage.removeItem("cleancare_cart");
          const clearCartEvent = new CustomEvent("clearCart");
          window.dispatchEvent(clearCartEvent);

          if (onBookingComplete) {
            onBookingComplete();
          }
        }}
      />
    </div>
  );
};

export default BookingFlow;
