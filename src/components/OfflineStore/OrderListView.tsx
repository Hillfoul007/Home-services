import { Eye, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Service {
  service_name?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
}

interface Order {
  _id: string;
  custom_order_id: string;
  customer_name: string;
  customer_phone: string;
  services: string[];
  item_prices: Service[];
  total_price: number;
  final_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  riderStatus: string;
}

interface OrderListViewProps {
  orders: Order[];
  onViewOrder: (order: Order) => void;
  formatDate: (date: string) => string;
  formatTime: (date: string) => string;
  getStatusColor: (status: string) => string;
}

export default function OrderListView({
  orders,
  onViewOrder,
  formatDate,
  formatTime,
  getStatusColor,
}: OrderListViewProps) {
  if (orders.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-gray-600">No orders found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop View */}
      <div className="hidden md:block">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Services
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-blue-600 font-mono">
                        {order.custom_order_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{order.customer_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-700">{order.customer_phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700 max-w-xs">
                        {order.item_prices && order.item_prices.length > 0
                          ? order.item_prices
                              .map((s) => `${s.service_name || "Service"} x${s.quantity || 1}`)
                              .join(", ")
                          : order.services && order.services.length > 0
                          ? order.services.join(", ")
                          : "No services"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-lg">
                        ₹{(order.final_amount || order.total_price).toFixed(2)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm">
                        <span className="block font-medium">{formatDate(order.created_at)}</span>
                        <span className="text-gray-600">{formatTime(order.created_at)}</span>
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        onClick={() => onViewOrder(order)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 mx-auto"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {orders.map((order) => (
          <Card key={order._id} className="p-4">
            <div className="space-y-3">
              {/* Header with Order ID and Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-600">Order ID</p>
                  <p className="font-bold text-blue-600 font-mono text-sm">
                    {order.custom_order_id}
                  </p>
                </div>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>

              {/* Customer Info */}
              <div className="border-t pt-3">
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-gray-700">{order.customer_phone}</p>
              </div>

              {/* Services */}
              <div className="border-t pt-3">
                <p className="text-sm text-gray-600 mb-1">Services</p>
                <p className="text-sm font-medium">
                  {order.item_prices && order.item_prices.length > 0
                    ? order.item_prices
                        .map((s) => `${s.service_name || "Service"} x${s.quantity || 1}`)
                        .join(", ")
                    : order.services && order.services.length > 0
                    ? order.services.join(", ")
                    : "No services"}
                </p>
              </div>

              {/* Amount and Date */}
              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="font-bold text-lg">
                    ₹{(order.final_amount || order.total_price).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date & Time</p>
                  <p className="text-sm font-medium">{formatDate(order.created_at)}</p>
                  <p className="text-xs text-gray-600">{formatTime(order.created_at)}</p>
                </div>
              </div>

              {/* View Button */}
              <Button
                onClick={() => onViewOrder(order)}
                className="w-full mt-3"
                variant="outline"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
