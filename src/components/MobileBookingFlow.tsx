import React, { useState } from "react";
import { Button } from "@/components/ui/button";
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
  User,
  Phone,
  Calendar,
  Star,
  Shield,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import ProfessionalDateTimePicker from "./ProfessionalDateTimePicker";
import PhoneOtpAuthModal from "./PhoneOtpAuthModal";
import LocationDetector from "./LocationDetector.tsx";
import BookingConfirmation from "./BookingConfirmation";
import { bookingHelpers } from "@/integrations/mongodb/client";

interface MobileBookingFlowProps {
  provider?: any;
  services?: any[];
  isMultipleServices?: boolean;
  currentUser?: any;
  userLocation?: string;
  locationCoordinates?: { lat: number; lng: number } | null;
  onBookingComplete: () => void;
  onLoginSuccess?: (user: any) => void;
}

const MobileBookingFlow: React.FC<MobileBookingFlowProps> = ({
  provider,
  services = [],
  isMultipleServices = false,
  currentUser,
  userLocation,
  locationCoordinates,
  onBookingComplete,
  onLoginSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
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

  const totalSteps = 4;

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

  const getDeliveryCharge = () => 0; // Free delivery

  const getHandlingFee = () => 0; // Free handling fee as shown in UI

  const calculateFinalAmount = () => {
    const basePrice = calculateTotalPrice();
    const deliveryCharge = getDeliveryCharge();
    const handlingFee = getHandlingFee();
    return Math.round((basePrice + deliveryCharge + handlingFee) * 100) / 100;
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 2:
        return selectedDate && selectedTime;
      case 3:
        return selectedAddress.trim();
      case 4:
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps && validateStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1);
      setError("");
    } else {
      setError("Please complete all required fields");
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError("");
    }
  };

  const handleBookService = async () => {
    if (!currentUser) {
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

    // Validate user with robust validation
    if (
      !currentUser ||
      !currentUser._id ||
      currentUser._id.trim().length === 0
    ) {
      setError("Please sign in to book a service.");
      setShowAuthModal(true);
      return;
    }

    const customerId = currentUser._id;

    setIsProcessing(true);
    setError("");

    try {
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

      const bookingData = {
        customer_id: customerId,
        service: isMultipleServices
          ? services.map((s) => s.name).join(", ")
          : provider?.name || "Service",
        service_type: isMultipleServices
          ? "Multiple Services"
          : "Single Service",
        services: isMultipleServices
          ? services.map((s) => `${s.name} (x${s.quantity})`)
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
          ? "Multiple Providers"
          : provider?.provider || "Home Services",
        address: completeAddress || selectedAddress,
        coordinates: addressCoordinates,
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
        charges_breakdown: {
          base_price: calculateTotalPrice(),
          service_fee: getDeliveryCharge(),
          delivery_fee: 0,
          handling_fee: getHandlingFee(),
          tax_amount:
            (calculateTotalPrice() + getDeliveryCharge() + getHandlingFee()) *
            0.12,
          discount: 0,
        },
      };

      const { data, error: bookingError } =
        await bookingHelpers.createBooking(bookingData);

      if (bookingError) {
        setError(bookingError.message || "Failed to create booking");
      } else {
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

        setShowConfirmation(true);

        // Call booking complete callback
        if (onBookingComplete) {
          onBookingComplete();
        }
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

  const handleLoginSuccess = (user: any) => {
    setShowAuthModal(false);
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
            : [{ name: provider?.name, price: provider?.price }],
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Service Summary
              </h2>
              <p className="text-gray-600">Review your selected services</p>
            </div>

            <div className="space-y-4">
              {isMultipleServices ? (
                services.map((service, index) => (
                  <Card key={index} className="border-2 border-blue-100">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {service.name}
                          </h3>
                          <p className="text-gray-600">by {service.provider}</p>
                          <p className="text-sm text-gray-500">
                            Qty: {service.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">
                            ${service.price * service.quantity}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-2 border-blue-100">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-xl">
                          {provider?.name}
                        </h3>
                        <p className="text-gray-600">by {provider?.provider}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-blue-600">
                          ${provider?.price}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{provider?.duration}</span>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Star className="h-3 w-3 mr-1" />
                        {provider?.rating}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Clock className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Select Date & Time
              </h2>
              <p className="text-gray-600">Choose when you want the service</p>
            </div>

            <Card className="border-2 border-blue-100">
              <CardContent className="p-6">
                <ProfessionalDateTimePicker
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onDateChange={setSelectedDate}
                  onTimeChange={setSelectedTime}
                />
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <MapPin className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Service Address
              </h2>
              <p className="text-gray-600">
                Where should we provide the service?
              </p>
            </div>

            <Card className="border-2 border-blue-100">
              <CardContent className="p-6 space-y-6">
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

                <div className="grid grid-cols-1 gap-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        House/Building No.
                      </Label>
                      <Input
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
                      <Label className="text-sm font-medium text-gray-700">
                        Floor
                      </Label>
                      <Input
                        placeholder="e.g., 2nd, Ground"
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
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Apartment/Society Name
                    </Label>
                    <Input
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
                    <Label className="text-sm font-medium text-gray-700">
                      Nearby Landmark
                    </Label>
                    <Input
                      placeholder="e.g., Near City Mall, Opposite Metro"
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

                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Special Instructions
                    </Label>
                    <Input
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
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <DollarSign className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Payment Summary
              </h2>
              <p className="text-gray-600">Review your booking details</p>
            </div>

            <Card className="border-2 border-blue-100">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between text-lg">
                  <span>Service Price</span>
                  <span className="font-semibold">
                    ${calculateTotalPrice()}
                  </span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Delivery Fee</span>
                  <div className="flex items-center gap-2">
                    <span className="line-through text-gray-400 text-sm">
                      ₹30
                    </span>
                    <span className="font-medium">FREE</span>
                  </div>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Handling Fee</span>
                  <div className="flex items-center gap-2">
                    <span className="line-through text-gray-400 text-sm">
                      ₹9
                    </span>
                    <span className="font-medium">FREE</span>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total Amount</span>
                    <span className="text-blue-600">
                      ${calculateFinalAmount()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="p-6">
                <div className="text-center">
                  <Shield className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-blue-700">
                    Secure Payment • 100% Satisfaction Guarantee
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label className="text-lg font-medium text-gray-700 mb-2 block">
                Additional Notes (Optional)
              </Label>
              <Textarea
                placeholder="Any special requirements or instructions..."
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                className="min-h-20"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-20">
      {/* Progress Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            onClick={prevStep}
            variant="ghost"
            className="p-2"
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">Book Service</h1>
          <div className="w-8"></div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <div key={step} className="flex-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  step <= currentStep
                    ? "bg-gradient-to-r from-blue-500 to-purple-600"
                    : "bg-gray-200"
                }`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Service</span>
          <span>DateTime</span>
          <span>Address</span>
          <span>Payment</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {renderStep()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex gap-3">
          {currentStep > 1 && (
            <Button
              onClick={prevStep}
              variant="outline"
              className="flex-1 py-3 rounded-xl"
            >
              Back
            </Button>
          )}

          {currentStep < totalSteps ? (
            <Button
              onClick={nextStep}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl"
              disabled={!validateStep(currentStep + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleBookService}
              className="flex-1 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 rounded-xl"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Booking
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <PhoneOtpAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
};

export default MobileBookingFlow;
