import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EnhancedBookingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings?: any[];
  currentUser?: any;
  onBookingUpdate?: (booking: any) => void;
}

// Simplified component to prevent build errors
const EnhancedBookingHistoryModal: React.FC<
  EnhancedBookingHistoryModalProps
> = ({ isOpen, onClose, bookings = [] }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Booking History</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {bookings.map((booking, index) => (
            <Card key={booking.id || index}>
              <CardHeader>
                <CardTitle className="text-lg">
                  Booking #
                  {booking.custom_order_id ||
                    booking.order_id ||
                    "Order ID not available"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  <strong>Status:</strong> {booking.status}
                </p>
                <p>
                  <strong>Total:</strong> ₹
                  {booking.totalAmount ||
                    booking.total_price ||
                    booking.final_amount ||
                    0}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {booking.pickupDate || booking.scheduled_date}
                </p>
              </CardContent>
            </Card>
          ))}
          {bookings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No bookings found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedBookingHistoryModal;
