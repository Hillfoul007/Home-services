import React, { useState, useEffect } from "react";
import { CheckCircle, Database, X, Calendar, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingSuccessAlertProps {
  booking: any;
  isVisible: boolean;
  onClose: () => void;
}

const BookingSuccessAlert: React.FC<BookingSuccessAlertProps> = React.memo(
  ({ booking, isVisible, onClose }) => {
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
      if (isVisible) {
        // Auto close after 10 seconds
        const timer = setTimeout(() => {
          onClose();
        }, 10000);

        return () => clearTimeout(timer);
      }
    }, [isVisible, onClose]);

    if (!isVisible || !booking) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-green-200 p-6 max-w-md w-full">
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Order Successfully Placed!
            </h3>
            <p className="text-gray-600 text-sm">
              Your laundry service has been successfully booked. You will
              receive a confirmation call shortly.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-green-600" />
              <span className="text-green-800 font-medium text-sm">
                Stored in MongoDB Database
              </span>
            </div>
            <p className="text-green-700 text-xs">
              Booking ID: #
              {booking.custom_order_id ||
                "CC" +
                  (booking._id
                    ? booking._id.slice(-6).toUpperCase()
                    : new Date().getTime().toString().slice(-6))}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(
                    booking.scheduledDate || booking.scheduled_date,
                  ).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-600">
                  {booking.scheduledTime || booking.scheduled_time}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-blue-500" />
              <p className="text-sm text-gray-900">
                {booking.address || booking.selectedAddress}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-blue-500" />
              <p className="text-sm text-gray-900">
                {booking.provider?.name ||
                  booking.providerName ||
                  "Service Provider"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="outline"
              className="w-full"
            >
              {showDetails ? "Hide Details" : "View Booking Details"}
            </Button>

            {showDetails && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <h4 className="font-medium text-gray-900 mb-2">
                  Booking Details:
                </h4>
                <div className="space-y-1 text-gray-600">
                  <p>
                    Services:{" "}
                    {booking.services
                      ?.map((s: any) => s.name || s)
                      .join(", ") || booking.service}
                  </p>
                  <p>
                    Total Amount: $
                    {booking.totalAmount || booking.total_price || 0}
                  </p>
                  <p>Status: {booking.status || "Confirmed"}</p>
                  <p>
                    Payment:{" "}
                    {booking.paymentStatus ||
                      booking.payment_status ||
                      "Pending"}
                  </p>
                  {booking.specialInstructions && (
                    <p>Instructions: {booking.specialInstructions}</p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={onClose}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Continue
            </Button>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  },
);

BookingSuccessAlert.displayName = "BookingSuccessAlert";

export default BookingSuccessAlert;
