import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Phone,
  User,
  Package,
  Home,
  Eye,
} from "lucide-react";
import { bookingHelpers } from "../integrations/mongodb/bookingHelpers";

interface BookingConfirmedProps {
  bookingData: {
    bookingId: string;
    custom_order_id?: string; // <-- Add this line
    services: any[];
    totalAmount: number;
    pickupDate: string;
    pickupTime: string;
    address: any;
    customerName: string;
    customerPhone: string;
  };
  onGoHome: () => void;
  onViewBookings: () => void;
}

const BookingConfirmed: React.FC<BookingConfirmedProps> = ({
  bookingData,
  onGoHome,
  onViewBookings,
}) => {
  const [customOrderId, setCustomOrderId] = useState<string | null>(null);
  const [isIphone, setIsIphone] = useState(false);

  useEffect(() => {
    // Detect iPhone for specific handling
    const isiOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIphone(isiOS);
  }, []);

  useEffect(() => {
    // Only fetch if custom_order_id is not already present
    if (!bookingData.custom_order_id && bookingData.bookingId) {
      // Add delay for iPhone to ensure state is ready
      const fetchDelay = isIphone ? 500 : 0;

      setTimeout(() => {
        bookingHelpers
          .getBookingById(bookingData.bookingId)
          .then((result) => {
            if (result.data && result.data.custom_order_id) {
              setCustomOrderId(result.data.custom_order_id);

              // Force re-render on iPhone by triggering a state update
              if (isIphone) {
                setTimeout(() => {
                  setCustomOrderId(result.data.custom_order_id);
                }, 100);
              }
            } else {
              console.log(
                "Custom order ID not found in booking data:",
                result.data,
              );

              // Generate a fallback order ID for iPhone
              if (isIphone && bookingData.bookingId) {
                const fallbackId = `CC${bookingData.bookingId.slice(-6).toUpperCase()}`;
                setCustomOrderId(fallbackId);
                console.log(
                  "🍎 iPhone fallback order ID generated:",
                  fallbackId,
                );
              }
            }
          })
          .catch((error) => {
            console.error("Failed to fetch booking details:", error);

            // Always provide a fallback ID on iPhone
            if (isIphone && bookingData.bookingId) {
              const fallbackId = `CC${bookingData.bookingId.slice(-6).toUpperCase()}`;
              setCustomOrderId(fallbackId);
              console.log("🍎 iPhone error fallback order ID:", fallbackId);
            }
          });
      }, fetchDelay);
    }
  }, [bookingData.custom_order_id, bookingData.bookingId, isIphone]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getAddressString = (address: any) => {
    if (typeof address === "string") return address;
    if (address?.fullAddress) return address.fullAddress;

    return [
      address?.flatNo,
      address?.street,
      address?.landmark,
      address?.village,
      address?.city,
      address?.pincode,
    ]
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className="min-h-screen bg-green-50">
      {/* Compact Header */}
      <div className="bg-white shadow-sm px-4 py-3">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-900">
            Booking Confirmed!
          </h1>
        </div>
      </div>

      {/* Compact Content */}
      <div className="p-4 space-y-3">
        {/* Booking ID */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-green-700 mb-1">Order ID</p>
            <p className="text-lg font-bold text-green-900">
              #
              {(() => {
                // Priority order for order ID display with iPhone-specific handling
                if (bookingData.custom_order_id) {
                  return bookingData.custom_order_id;
                }

                if (customOrderId) {
                  return customOrderId;
                }

                if (bookingData.bookingId) {
                  const fallbackId = `CC${bookingData.bookingId.slice(-6).toUpperCase()}`;
                  // On iPhone, ensure the ID is always displayed
                  if (isIphone) {
                    // Set the custom order ID to prevent "Generating..." from showing
                    setTimeout(() => setCustomOrderId(fallbackId), 0);
                  }
                  return fallbackId;
                }

                // Last resort for iPhone
                if (isIphone) {
                  const timestamp = Date.now().toString().slice(-6);
                  return `CC${timestamp}`;
                }

                return "Generating...";
              })()}
            </p>
          </CardContent>
        </Card>

        {/* Items & Schedule Combined */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Items & Schedule</span>
            </div>

            {/* Items */}
            <div className="space-y-1 mb-3">
              {bookingData.services.map((service, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {typeof service === "string" ? service : service.name}
                  </span>
                  <span className="font-medium">
                    {typeof service === "object" && service.quantity
                      ? `x${service.quantity}`
                      : "x1"}
                  </span>
                </div>
              ))}
            </div>

            {/* Schedule */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-3 w-3 text-gray-500" />
                <span className="text-gray-700">
                  {formatDate(bookingData.pickupDate)}
                </span>
                <Clock className="h-3 w-3 text-gray-500 ml-2" />
                <span className="text-gray-700">{bookingData.pickupTime}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address & Contact */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-red-600" />
              <span className="font-medium text-sm">Address & Contact</span>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-gray-700">
                {getAddressString(bookingData.address)}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <User className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600">
                  {bookingData.customerName}
                </span>
                <Phone className="h-3 w-3 text-gray-500 ml-2" />
                <span className="text-gray-600">
                  {bookingData.customerPhone}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Amount */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Total Amount</span>
              </div>
              <span className="text-xl font-bold text-blue-900">
                ₹{bookingData.totalAmount}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={onViewBookings}
            className="w-full bg-green-600 hover:bg-green-700 py-3"
          >
            <Eye className="h-4 w-4 mr-2" />
            View My Bookings
          </Button>
          <Button onClick={onGoHome} variant="outline" className="w-full py-3">
            <Home className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmed;
