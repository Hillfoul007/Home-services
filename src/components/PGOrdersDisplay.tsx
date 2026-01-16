import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { formatDateTimeIST } from "@/utils/timeUtils";
import { apiClient } from "@/lib/apiClient";

interface PGOrder {
  _id: string;
  order_id: string;
  pg_name: string;
  city: string;
  customer_name: string;
  number_of_items: number;
  item_price: number;
  final_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  vendor_details?: {
    name: string;
    phone: string;
  };
}

interface PGOrdersDisplayProps {
  currentUser?: any;
  onBack: () => void;
}

const PGOrdersDisplay: React.FC<PGOrdersDisplayProps> = ({
  currentUser,
  onBack,
}) => {
  const [pgOrders, setPGOrders] = useState<PGOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    loadPGOrders();
  }, [currentUser]);

  const loadPGOrders = async () => {
    if (!currentUser?.id && !currentUser?._id && !currentUser?.phone) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.request<any>("/pg/user/orders", "GET");
      if (response.data.success) {
        setPGOrders(response.data.data || []);
      }
    } catch (error) {
      console.error("Error loading PG orders:", error);
      setPGOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "created":
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "vendor_assigned":
        return "bg-purple-100 text-purple-800";
      case "picked_up":
        return "bg-yellow-100 text-yellow-800";
      case "ready_for_delivery":
      case "delivery_assigned":
        return "bg-orange-100 text-orange-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filterOrders = (tab: string) => {
    if (tab === "all") return pgOrders;
    if (tab === "active")
      return pgOrders.filter((o) => !["completed", "cancelled"].includes(o.status));
    if (tab === "completed")
      return pgOrders.filter((o) => o.status === "completed");
    if (tab === "cancelled")
      return pgOrders.filter((o) => o.status === "cancelled");
    return pgOrders;
  };

  const filteredOrders = filterOrders(activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 py-3 sm:px-6 sm:py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900 p-1 sm:p-2"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
                  PG Orders
                </h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                  {pgOrders.length}{" "}
                  {pgOrders.length === 1 ? "order" : "orders"} found
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-3 py-3 sm:px-6 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-laundrify-purple" />
          </div>
        ) : pgOrders.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                No PG Orders Yet
              </h3>
              <p className="text-gray-600 mb-8">
                Start placing PG orders to see them here.
              </p>
              <Button
                onClick={onBack}
                className="bg-gradient-to-r from-laundrify-purple to-laundrify-pink hover:from-laundrify-purple/90 hover:to-laundrify-pink/90 text-white px-6 py-3 rounded-xl font-medium"
              >
                Start New Order
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All ({pgOrders.length})</TabsTrigger>
                <TabsTrigger value="active">
                  Active (
                  {pgOrders.filter(
                    (o) => !["completed", "cancelled"].includes(o.status)
                  ).length}
                  )
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed (
                  {pgOrders.filter((o) => o.status === "completed").length})
                </TabsTrigger>
                <TabsTrigger value="cancelled">
                  Cancelled (
                  {pgOrders.filter((o) => o.status === "cancelled").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Orders List */}
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <Card
                  key={order._id}
                  className="overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all"
                >
                  <CardHeader className="pb-3 px-3 py-3 bg-gradient-to-r from-purple-50 to-pink-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-base text-laundrify-purple">
                          #{order.order_id}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {order.pg_name} • {order.city}
                        </p>
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="px-3 py-3 space-y-3">
                    {/* Order Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Items</p>
                        <p className="font-semibold text-gray-900">
                          {order.number_of_items}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Per Item</p>
                        <p className="font-semibold text-gray-900">
                          ₹{order.item_price}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total</p>
                        <p className="font-semibold text-laundrify-purple">
                          ₹{order.final_amount}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Payment</p>
                        <Badge
                          variant={
                            order.payment_status === "paid"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {order.payment_status}
                        </Badge>
                      </div>
                    </div>

                    {/* Order Info */}
                    <div className="border-t pt-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="h-4 w-4 text-gray-400" />
                        Created: {formatDateTimeIST(order.created_at)}
                      </div>
                      {order.vendor_details && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Phone className="h-4 w-4 text-gray-400" />
                          Vendor: {order.vendor_details.name}
                        </div>
                      )}
                    </div>

                    {/* Instruction Book for New Orders */}
                    {order.status === "created" && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <p className="text-blue-900 font-semibold mb-2">
                          Pack Instructions:
                        </p>
                        <ol className="space-y-1 text-blue-800 ml-4 list-decimal text-xs">
                          <li>Pack clothes in polybag near PG box</li>
                          <li>Write Order ID on the polybag</li>
                          <li>Drop in Laundrify box</li>
                        </ol>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {filteredOrders.length === 0 && (
                <Card className="text-center py-8">
                  <CardContent>
                    <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No {activeTab} orders</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PGOrdersDisplay;
