import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Eye, MessageCircle, Edit2 } from "lucide-react";
import { createSuccessNotification, createErrorNotification } from "@/utils/notificationUtils";
import PGWhatsappService from "@/services/pgWhatsappService";

interface PGOrder {
  _id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  num_items: number;
  total_price: number;
  status: string;
  pg_details: {
    name: string;
    city: string;
    address: string;
    phone: string;
  };
  assigned_vendor?: {
    name: string;
    phone: string;
  };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  picked_up: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

const AdminPGOrders: React.FC = () => {
  const [orders, setOrders] = useState<PGOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<PGOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<PGOrder | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/pg-orders/");
      const data = await response.json();

      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      createErrorNotification("Error", "Failed to fetch PG orders");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!editingOrder || !newStatus) {
      createErrorNotification("Error", "Please select a status");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/pg-orders/${editingOrder.order_id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        createSuccessNotification("Success", "Order status updated");
        setEditingOrder(null);
        setNewStatus("");
        fetchOrders();
      } else {
        createErrorNotification("Error", data.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      createErrorNotification("Error", "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async (order: PGOrder, recipientType: "vendor" | "customer") => {
    try {
      const whatsappService = PGWhatsappService.getInstance();
      let success = false;

      if (recipientType === "vendor" && order.assigned_vendor) {
        success = await whatsappService.notifyVendor(
          order.assigned_vendor.phone,
          order.order_id,
          order.pg_details.name,
          order.num_items,
          order.total_price
        );
      } else if (recipientType === "customer") {
        success = await whatsappService.sendStatusUpdate(
          order.customer_phone,
          order.order_id,
          order.pg_details.name,
          order.status
        );
      } else {
        createErrorNotification("Error", `No ${recipientType} phone number available`);
        return;
      }

      if (success) {
        createSuccessNotification("Success", `WhatsApp message sent to ${recipientType}`);
      } else {
        createErrorNotification("Error", "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      createErrorNotification("Error", "Failed to send message");
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = filterStatus === "all" || order.status === filterStatus;
    const matchesSearch =
      order.order_id.toLowerCase().includes(searchText.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchText.toLowerCase()) ||
      order.pg_details.name.toLowerCase().includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">PG Orders Management</h2>

        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search by order ID, customer, or PG..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="picked_up">Picked Up</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-500">No PG orders found</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order._id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {order.order_id}
                      </h3>
                      <Badge className={statusColors[order.status] || "bg-gray-100"}>
                        {order.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {order.customer_name} • {order.customer_phone}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      📍 {order.pg_details.name}, {order.pg_details.city}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">
                      ₹{order.total_price}
                    </p>
                    <p className="text-sm text-gray-600">{order.num_items} items</p>
                  </div>
                </div>

                {/* Vendor Info */}
                {order.assigned_vendor && (
                  <div className="bg-blue-50 p-3 rounded mb-4">
                    <p className="text-sm font-medium text-gray-700">Assigned Vendor</p>
                    <p className="text-sm text-gray-900">{order.assigned_vendor.name}</p>
                    <p className="text-sm text-gray-600">{order.assigned_vendor.phone}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Dialog>
                    <Button
                      onClick={() => {
                        setViewingOrder(order);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Order Details - {order.order_id}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Customer</p>
                          <p className="text-gray-900">{order.customer_name}</p>
                          <p className="text-sm text-gray-600">{order.customer_phone}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">PG Location</p>
                          <p className="text-gray-900">{order.pg_details.name}</p>
                          <p className="text-sm text-gray-600">
                            {order.pg_details.address}
                          </p>
                          <p className="text-sm text-gray-600">
                            {order.pg_details.city}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Items & Price</p>
                          <p className="text-gray-900">
                            {order.num_items} items × ₹25 = ₹{order.total_price}
                          </p>
                        </div>
                        {order.assigned_vendor && (
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Assigned Vendor
                            </p>
                            <p className="text-gray-900">{order.assigned_vendor.name}</p>
                            <p className="text-sm text-gray-600">
                              {order.assigned_vendor.phone}
                            </p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <Button
                      onClick={() => {
                        setEditingOrder(order);
                        setNewStatus(order.status);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Change Status
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Status - {order.order_id}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">New Status</label>
                          <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="picked_up">Picked Up</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="ready">Ready</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleStatusChange}
                            className="flex-1 bg-blue-600"
                            disabled={loading}
                          >
                            Update Status
                          </Button>
                          <Button
                            onClick={() => setEditingOrder(null)}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {order.assigned_vendor && (
                    <Button
                      onClick={() => handleSendWhatsApp(order, "vendor")}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Notify Vendor
                    </Button>
                  )}

                  <Button
                    onClick={() => handleSendWhatsApp(order, "customer")}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Notify Customer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminPGOrders;
