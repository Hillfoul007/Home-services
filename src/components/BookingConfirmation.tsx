import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  User,
  ArrowLeft,
} from "lucide-react";

interface BookingConfirmationProps {
  bookingData: {
    services: { name: string; price: number; quantity?: number }[];
    selectedDate: Date;
    selectedTime: string;
    selectedAddress: string;
    additionalDetails: string;
    isMultipleServices: boolean;
    provider?: { name: string; image?: string; price?: number };
    currentUser: any;
  };
  onConfirmBooking: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

const BookingConfirmation: React.FC<BookingConfirmationProps> = ({
  bookingData,
  onConfirmBooking,
  onBack,
  isProcessing,
}) => {
  const {
    services,
    selectedDate,
    selectedTime,
    selectedAddress,
    additionalDetails,
    isMultipleServices,
    provider,
    currentUser,
  } = bookingData;

  const calculatePricing = () => {
    let basePrice = 0;

    if (isMultipleServices) {
      basePrice = services.reduce(
        (total, service) => total + service.price * (service.quantity || 1),
        0,
      );
    } else {
      basePrice = provider?.price || 80;
    }

    const serviceCharges = basePrice * 0.1;
    const taxAmount = (basePrice + serviceCharges) * 0.12;
    const discount = basePrice > 200 ? basePrice * 0.05 : 0;
    const subtotal = basePrice + serviceCharges + taxAmount;
    const finalAmount = subtotal - discount;

    return {
      basePrice,
      serviceCharges,
      taxAmount,
      discount,
      subtotal,
      finalAmount,
    };
  };

  const pricing = calculatePricing();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Compact Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Confirm Booking
          </h1>
          <p className="text-sm text-gray-600">
            Review and confirm your service
          </p>
        </div>

        {/* Customer & Service Info */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm">
              <User className="w-4 h-4 mr-2" />
              {currentUser?.name ||
                currentUser?.profile?.full_name ||
                "Customer"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isMultipleServices ? (
              <div className="space-y-2">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center text-sm"
                  >
                    <span>{service.name}</span>
                    <span className="font-medium">
                      ${service.price * (service.quantity || 1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-sm">{provider?.name || "Service"}</span>
                <span className="font-medium">${provider?.price || 80}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule & Location */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 text-gray-500 mr-3" />
                <span>
                  {selectedDate.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <Clock className="w-4 h-4 text-gray-500 ml-4 mr-2" />
                <span>{selectedTime}</span>
              </div>
              <div className="flex items-start text-sm">
                <MapPin className="w-4 h-4 text-gray-500 mr-3 mt-0.5" />
                <span className="text-gray-700">{selectedAddress}</span>
              </div>
              {additionalDetails && (
                <div className="p-2 bg-yellow-50 rounded text-xs">
                  <strong>Note:</strong> {additionalDetails}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Summary */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm">
              <DollarSign className="w-4 h-4 mr-2" />
              Total Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Service Price</span>
                <span>${pricing.basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Service Fee</span>
                <span>${pricing.serviceCharges.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Tax (12%)</span>
                <span>${pricing.taxAmount.toFixed(2)}</span>
              </div>
              {pricing.discount > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Discount</span>
                  <span>-${pricing.discount.toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total Amount</span>
                <span>${pricing.finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={onConfirmBooking}
            disabled={isProcessing}
            className="w-full bg-green-600 hover:bg-green-700 py-3 text-white font-semibold"
          >
            {isProcessing ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Confirming...
              </div>
            ) : (
              `Confirm Booking - $${pricing.finalAmount.toFixed(2)}`
            )}
          </Button>

          <Button variant="outline" onClick={onBack} className="w-full py-3">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Details
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-blue-700 text-xs text-center">
            💡 Pay after service completion
          </p>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
