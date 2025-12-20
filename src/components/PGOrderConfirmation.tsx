import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Printer, Copy, ArrowLeft } from "lucide-react";
import { createSuccessNotification } from "@/utils/notificationUtils";

interface PGOrder {
  _id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  num_items: number;
  total_price: number;
  pg_details: {
    name: string;
    city: string;
    address: string;
    phone: string;
  };
  pickup_date: string;
  createdAt: string;
}

const PGOrderConfirmation: React.FC = () => {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState<PGOrder | null>(
    location.state?.order || null
  );
  const [loading, setLoading] = useState(!order);

  useEffect(() => {
    if (!order && orderId) {
      fetchOrder();
    }
  }, [orderId, order]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      // Note: Implement the endpoint to fetch single order if needed
      // For now, order is passed via state
    } catch (error) {
      console.error("Error fetching order:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyOrderId = () => {
    if (order) {
      navigator.clipboard.writeText(order.order_id);
      createSuccessNotification("Copied!", "Order ID copied to clipboard");
    }
  };

  if (loading || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading order details...</p>
      </div>
    );
  }

  const pickupDate = new Date(order.pickup_date).toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-laundrify-purple/10 to-background p-4">
      <div className="max-w-md mx-auto pt-4 pb-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="px-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">Order Confirmed</h1>
        </div>

        {/* Success Badge */}
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Your order has been placed!
          </h2>
          <p className="text-gray-600">Your PG laundry will be picked up soon</p>
        </div>

        {/* Order ID Card */}
        <Card className="p-6 mb-6 border-2 border-laundrify-purple/30">
          <p className="text-sm text-gray-600 mb-2">Order ID</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xl font-bold text-laundrify-purple font-mono">
              {order.order_id}
            </p>
            <Button
              onClick={handleCopyOrderId}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Save this order ID for reference</p>
        </Card>

        {/* Instruction Book */}
        <Card className="p-6 mb-6 border border-orange-200 bg-orange-50">
          <h3 className="font-semibold text-gray-900 mb-4">📋 Instructions</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex gap-3">
              <div className="font-bold text-orange-600 flex-shrink-0">1.</div>
              <p>
                <strong>Pack Your Clothes:</strong> Pack all your laundry items
                into a polybag
              </p>
            </div>
            <div className="flex gap-3">
              <div className="font-bold text-orange-600 flex-shrink-0">2.</div>
              <p>
                <strong>Paste Sticker:</strong> Paste the sticker provided near
                the box area of your PG
              </p>
            </div>
            <div className="flex gap-3">
              <div className="font-bold text-orange-600 flex-shrink-0">3.</div>
              <p>
                <strong>Write Order ID:</strong> Write your order ID (
                <span className="font-mono font-bold">{order.order_id}</span>)
                on the sticker
              </p>
            </div>
            <div className="flex gap-3">
              <div className="font-bold text-orange-600 flex-shrink-0">4.</div>
              <p>
                <strong>Drop in Box:</strong> Drop the packet inside the
                Laundrify box placed in your PG
              </p>
            </div>
          </div>
        </Card>

        {/* Order Summary */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>

          {/* PG Details */}
          <div className="mb-4 pb-4 border-b">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              PG Location
            </p>
            <p className="font-semibold text-gray-900">{order.pg_details.name}</p>
            <p className="text-sm text-gray-600">{order.pg_details.address}</p>
            <p className="text-sm text-gray-600">📞 {order.pg_details.phone}</p>
          </div>

          {/* Service Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Service</span>
              <span className="font-medium">Laundry & Iron</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Number of Items</span>
              <span className="font-medium">{order.num_items}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Price per Item</span>
              <span className="font-medium">₹25</span>
            </div>

            {/* Price Section */}
            <div className="border-t pt-3 flex justify-between text-base font-bold">
              <span>Total Amount</span>
              <span className="text-laundrify-purple">₹{order.total_price}</span>
            </div>
          </div>
        </Card>

        {/* Customer Details */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">Name</p>
              <p className="font-medium text-gray-900">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-gray-600">Phone</p>
              <p className="font-medium text-gray-900">{order.customer_phone}</p>
            </div>
            <div>
              <p className="text-gray-600">Pickup Date</p>
              <p className="font-medium text-gray-900">{pickupDate}</p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="w-full"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Order Details
          </Button>

          <Button
            onClick={() => navigate("/")}
            className="w-full bg-laundrify-purple hover:bg-laundrify-purple/90 text-white"
          >
            Back to Home
          </Button>
        </div>

        {/* Footer Note */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
          <p>
            Our staff will pick up your laundry from the PG box on{" "}
            <strong>{pickupDate}</strong>. Your order will be ready within 48
            hours.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PGOrderConfirmation;
