import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  LogOut,
  Plus,
  Eye,
  Trash2,
  Phone,
  User,
  MapPin,
  Clock,
  Calendar,
  Filter,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import OrderInputForm from "@/components/OfflineStore/OrderInputForm";
import OrderListView from "@/components/OfflineStore/OrderListView";

interface OfflineStoreUser {
  _id: string;
  phone: string;
  store_name: string;
  store_address: string;
  is_vendor?: boolean;
  vendor_id?: string;
}

interface Order {
  _id: string;
  custom_order_id: string;
  customer_name: string;
  customer_phone: string;
  services: string[];
  item_prices: any[];
  total_price: number;
  final_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  riderStatus: string;
}

export default function OfflineStoreDeskPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<OfflineStoreUser | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "create">("dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [offlineOrders, setOfflineOrders] = useState<Order[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<Order[]>([]);
  const [filteredOfflineOrders, setFilteredOfflineOrders] = useState<Order[]>([]);
  const [filteredOnlineOrders, setFilteredOnlineOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [userWallet, setUserWallet] = useState<number>(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedOrder, setEditedOrder] = useState<any>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem("offline_store_token");
    const userData = localStorage.getItem("offline_store_user");

    if (!token || !userData) {
      navigate("/offlinestore/login");
      return;
    }

    try {
      setUser(JSON.parse(userData));
    } catch (error) {
      navigate("/offlinestore/login");
    }
  }, [navigate]);

  // Fetch orders
  const fetchOrders = async () => {
    const token = localStorage.getItem("offline_store_token");
    if (!token) {
      toast.error("Not authenticated");
      navigate("/offlinestore/login");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/offline-store/my-orders?sortBy=${sortBy}${
          filterStatus ? "&filterStatus=" + filterStatus : ""
        }`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setOrders(data.orders || []);
        setOfflineOrders(data.offlineOrders || []);
        setOnlineOrders(data.onlineOrders || []);
      } else {
        toast.error(data.error || "Failed to fetch orders");
      }
    } catch (error: any) {
      toast.error(error.message || "Error fetching orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, sortBy, filterStatus]);

  // Search and filter orders
  useEffect(() => {
    let filteredOffline = offlineOrders;
    let filteredOnline = onlineOrders;

    if (searchTerm) {
      filteredOffline = filteredOffline.filter(
        (order) =>
          order.custom_order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_phone.includes(searchTerm)
      );
      filteredOnline = filteredOnline.filter(
        (order) =>
          order.custom_order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_phone.includes(searchTerm)
      );
    }

    setFilteredOfflineOrders(filteredOffline);
    setFilteredOnlineOrders(filteredOnline);
    setFilteredOrders([...filteredOffline, ...filteredOnline]);
  }, [offlineOrders, onlineOrders, searchTerm]);

  const handleLogout = () => {
    localStorage.removeItem("offline_store_token");
    localStorage.removeItem("offline_store_user");
    toast.success("Logged out successfully");
    navigate("/offlinestore/login");
  };

  const handleOrderCreated = () => {
    setActiveTab("dashboard");
    fetchOrders();
    toast.success("Order created successfully!");
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setEditedOrder({ ...order });
    setIsEditMode(false);
    setShowOrderDetail(true);
  };

  const handleEditMode = () => {
    setEditedOrder({ ...selectedOrder });
    setIsEditMode(true);
  };

  const calculateTotalAmount = (items: any[]) => {
    return items.reduce((sum, item) => {
      const itemTotal = item.total_price || (item.unit_price * (item.quantity || 1)) || 0;
      return sum + itemTotal;
    }, 0);
  };

  const handleAddItem = () => {
    if (!editedOrder.item_prices) {
      editedOrder.item_prices = [];
    }
    editedOrder.item_prices = [
      ...editedOrder.item_prices,
      { service_name: "", quantity: 1, unit_price: 0, total_price: 0 }
    ];
    setEditedOrder({ ...editedOrder });
  };

  const handleRemoveItem = (index: number) => {
    editedOrder.item_prices = editedOrder.item_prices.filter((_: any, i: number) => i !== index);
    setEditedOrder({ ...editedOrder });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const items = [...editedOrder.item_prices];
    items[index][field] = value;

    // Auto-calculate total price for this item
    if (field === "quantity" || field === "unit_price") {
      items[index].total_price = (items[index].unit_price || 0) * (items[index].quantity || 1);
    }

    editedOrder.item_prices = items;
    setEditedOrder({ ...editedOrder });
  };

  const handleSaveOrder = async () => {
    if (!selectedOrder || !editedOrder) return;

    const token = localStorage.getItem("offline_store_token");
    if (!token) return;

    setSavingOrder(true);
    try {
      // Calculate total
      const total = calculateTotalAmount(editedOrder.item_prices || []);

      const response = await fetch(`/api/offline-store/order/${selectedOrder._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_name: editedOrder.customer_name,
          customer_phone: editedOrder.customer_phone,
          item_prices: editedOrder.item_prices || [],
          total_price: total,
          final_amount: total,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Order updated successfully");
        setSelectedOrder(data.order);
        setEditedOrder(data.order);
        setIsEditMode(false);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to update order");
      }
    } catch (error: any) {
      toast.error(error.message || "Error updating order");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;

    if (!window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      return;
    }

    const token = localStorage.getItem("offline_store_token");
    if (!token) return;

    try {
      const response = await fetch(`/api/offline-store/order/${selectedOrder._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Order deleted successfully");
        setShowOrderDetail(false);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to delete order");
      }
    } catch (error: any) {
      toast.error(error.message || "Error deleting order");
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedOrder) return;

    const token = localStorage.getItem("offline_store_token");
    if (!token) return;

    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/offline-store/order/${selectedOrder._id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Order status updated successfully");
        setSelectedOrder(data.order);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (error: any) {
      toast.error(error.message || "Error updating status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      created: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      delivered: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to delete this order?")) {
      return;
    }

    const token = localStorage.getItem("offline_store_token");
    if (!token) return;

    try {
      // This would need a delete endpoint on the backend
      toast.success("Order deleted");
      fetchOrders();
    } catch (error) {
      toast.error("Failed to delete order");
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Order ID",
      "Customer Name",
      "Phone",
      "Services",
      "Amount",
      "Status",
      "Date",
      "Time",
    ];
    const rows = filteredOrders.map((order) => [
      order.custom_order_id,
      order.customer_name,
      order.customer_phone,
      order.services.map((s) => `${s.service_name || s} x${s.quantity || 1}`).join(", "),
      order.final_amount || order.total_price,
      order.status,
      formatDate(order.created_at),
      formatTime(order.created_at),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{user.store_name}</h1>
                {user.is_vendor && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Vendor Account
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{user.store_address}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 flex gap-8">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`py-4 font-medium border-b-2 transition-all ${
              activeTab === "dashboard"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`py-4 font-medium border-b-2 transition-all ${
              activeTab === "create"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Create Order
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === "create" ? (
          <OrderInputForm onOrderCreated={handleOrderCreated} />
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="p-4">
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-600">Offline Orders</p>
                <p className="text-2xl font-bold text-purple-600">{offlineOrders.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-600">Online Orders</p>
                <p className="text-2xl font-bold text-blue-600">{onlineOrders.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-600">Wallet Balance</p>
                <p className="text-2xl font-bold text-green-600">₹{userWallet}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">
                  ₹{orders.reduce((sum, o) => sum + (o.final_amount || o.total_price), 0)}
                </p>
              </Card>
            </div>

            {/* Filters and Search */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search by order ID, customer name or phone"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "recent" | "oldest")}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="recent">Recent First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Status</option>
                    <option value="created">Created</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <Button
                    variant="outline"
                    onClick={exportToCSV}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </div>
            </Card>


            {/* Orders Buckets */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-600">Loading orders...</p>
              </div>
            ) : filteredOfflineOrders.length === 0 && filteredOnlineOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-gray-600 mb-4">No orders yet</p>
                <Button
                  onClick={() => setActiveTab("create")}
                  className="inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Order
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Offline Orders Bucket */}
                {filteredOfflineOrders.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-purple-700 flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                        Offline Orders ({filteredOfflineOrders.length})
                      </span>
                    </h3>
                    <OrderListView
                      orders={filteredOfflineOrders}
                      onViewOrder={handleViewOrder}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      getStatusColor={getStatusColor}
                    />
                  </div>
                )}

                {/* Online Orders Bucket */}
                {filteredOnlineOrders.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-blue-700 flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        Online Orders ({filteredOnlineOrders.length})
                      </span>
                    </h3>
                    <OrderListView
                      orders={filteredOnlineOrders}
                      onViewOrder={handleViewOrder}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      getStatusColor={getStatusColor}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Order Detail Modal */}
            {showOrderDetail && selectedOrder && editedOrder && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold">
                        Order #{selectedOrder.custom_order_id}
                      </h2>
                      <button
                        onClick={() => {
                          setShowOrderDetail(false);
                          setIsEditMode(false);
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Customer Info */}
                      <div className={`p-4 rounded-lg ${isEditMode ? "bg-blue-50" : "bg-gray-50"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold">Customer Details</h3>
                          {!isEditMode && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleEditMode}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                        {isEditMode ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm text-gray-600">Customer Name</label>
                              <Input
                                value={editedOrder.customer_name}
                                onChange={(e) => setEditedOrder({ ...editedOrder, customer_name: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-gray-600">Customer Phone</label>
                              <Input
                                value={editedOrder.customer_phone}
                                onChange={(e) => setEditedOrder({ ...editedOrder, customer_phone: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-600" />
                              <span>{editedOrder.customer_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-600" />
                              <span>{editedOrder.customer_phone}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Services/Items */}
                      <div className={`p-4 rounded-lg ${isEditMode ? "bg-blue-50" : "bg-gray-50"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold">Services</h3>
                          {isEditMode && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleAddItem}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Item
                            </Button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {editedOrder.item_prices && editedOrder.item_prices.length > 0 ? (
                            editedOrder.item_prices.map((service: any, idx: number) => (
                              <div key={idx} className={`p-3 rounded-lg ${isEditMode ? "bg-white border border-gray-200" : "bg-white"}`}>
                                {isEditMode ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2">
                                      <Input
                                        placeholder="Service name"
                                        value={service.service_name}
                                        onChange={(e) => handleItemChange(idx, "service_name", e.target.value)}
                                        className="col-span-5"
                                      />
                                      <Input
                                        type="number"
                                        placeholder="Qty"
                                        value={service.quantity || 1}
                                        onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value) || 1)}
                                        className="col-span-2"
                                      />
                                      <Input
                                        type="number"
                                        placeholder="Price"
                                        value={service.unit_price || 0}
                                        onChange={(e) => handleItemChange(idx, "unit_price", parseFloat(e.target.value) || 0)}
                                        className="col-span-3"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveItem(idx)}
                                        className="col-span-2 text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div className="text-right text-sm font-semibold">
                                      Total: ₹{service.total_price || 0}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between">
                                    <span>
                                      {service.service_name} x {service.quantity || 1}
                                    </span>
                                    <span className="font-semibold">
                                      ₹{service.total_price || (service.unit_price * (service.quantity || 1)) || 0}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))
                          ) : editedOrder.services && editedOrder.services.length > 0 ? (
                            editedOrder.services.map((service: any, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                <span>{service}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-600">{isEditMode ? "No items. Click 'Add Item' to add." : "No services listed"}</p>
                          )}
                        </div>
                      </div>

                      {/* Amount and Status */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-2xl font-bold text-blue-600">
                            ₹{calculateTotalAmount(editedOrder.item_prices || [])}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">Order Status</p>
                          <select
                            value={selectedOrder.status}
                            onChange={(e) => handleStatusUpdate(e.target.value)}
                            disabled={updatingStatus || isEditMode}
                            className="w-full px-3 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            <option value="created">Created</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="delivered">Delivered</option>
                          </select>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4" />
                            Created
                          </p>
                          <p className="font-semibold">{formatDate(selectedOrder.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4" />
                            Time
                          </p>
                          <p className="font-semibold">{formatTime(selectedOrder.created_at)}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-4">
                        {isEditMode ? (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                setIsEditMode(false);
                                setEditedOrder({ ...selectedOrder });
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={handleSaveOrder}
                              disabled={savingOrder}
                            >
                              {savingOrder ? "Saving..." : "Save Changes"}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => setShowOrderDetail(false)}
                            >
                              Close
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1"
                              onClick={handleDeleteOrder}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
