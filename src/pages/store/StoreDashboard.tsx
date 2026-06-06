import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LogOut, Plus, Eye, Trash2, Phone, User, Clock, Calendar,
  Save, Store, Package, Search,
} from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/config/env";
import { getSortedServices } from "@/data/laundryServices";

interface StoreInfo {
  _id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  address: string;
  phone: string;
}

interface ServiceItem {
  service_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  _id: string;
  custom_order_id: string;
  customer_name: string;
  customer_phone: string;
  services: string[];
  item_prices: ServiceItem[];
  total_price: number;
  final_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  riderStatus: string;
  is_store_order?: boolean;
  assigned_store_id?: string;
}

const STATUS_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  processing: "bg-orange-100 text-orange-800",
  ready: "bg-teal-100 text-teal-800",
  completed: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
  delivered: "bg-green-100 text-green-800",
  vendor_assigned: "bg-purple-100 text-purple-800",
};

const ALL_STATUSES = ["created", "pending", "confirmed", "processing", "ready", "completed", "delivered", "cancelled"];

const ACTIVE_STATUSES = new Set(["created", "pending", "confirmed", "processing", "ready", "vendor_assigned"]);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function StoreDashboard() {
  const navigate = useNavigate();
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "create">("orders");

  // Orders tab state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editedOrder, setEditedOrder] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Create order tab state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([
    { service_name: "", quantity: 1, unit_price: 0, total_price: 0 },
  ]);
  const [discountType, setDiscountType] = useState<"amount" | "percentage">("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("store_token");
    const info = localStorage.getItem("store_info");
    if (!token || !info) {
      navigate("/store");
      return;
    }
    try {
      setStoreInfo(JSON.parse(info));
    } catch {
      navigate("/store");
    }
  }, [navigate]);

  const fetchOrders = async () => {
    const token = localStorage.getItem("store_token");
    if (!token) return;
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams({ sortBy });
      if (filterStatus) params.set("filterStatus", filterStatus);
      const res = await fetch(`${getApiUrl()}/store/orders/my-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      } else {
        toast.error(data.error || "Failed to fetch orders");
      }
    } catch {
      toast.error("Error fetching orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (storeInfo) fetchOrders();
  }, [storeInfo, sortBy, filterStatus]);

  const filteredOrders = orders.filter((o) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      o.custom_order_id?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s) ||
      o.customer_phone?.includes(searchTerm)
    );
  });

  const activeOrders = filteredOrders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const inactiveOrders = filteredOrders.filter((o) => !ACTIVE_STATUSES.has(o.status));

  const handleLogout = () => {
    localStorage.removeItem("store_token");
    localStorage.removeItem("store_info");
    navigate("/store");
  };

  // ─── Order detail ──────────────────────────────────────────────────────────

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    setEditedOrder({ ...order });
    setIsEditMode(false);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedOrder) return;
    const token = localStorage.getItem("store_token");
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${getApiUrl()}/store/orders/${selectedOrder._id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Status updated");
        setSelectedOrder(data.order);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch {
      toast.error("Error updating status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!selectedOrder || !editedOrder) return;
    const token = localStorage.getItem("store_token");
    setSavingOrder(true);
    try {
      const res = await fetch(`${getApiUrl()}/store/orders/${selectedOrder._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: editedOrder.customer_name,
          customer_phone: editedOrder.customer_phone,
          item_prices: editedOrder.item_prices,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Order updated");
        setSelectedOrder(data.order);
        setEditedOrder(data.order);
        setIsEditMode(false);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to update order");
      }
    } catch {
      toast.error("Error updating order");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    if (!window.confirm("Delete this order? This cannot be undone.")) return;
    const token = localStorage.getItem("store_token");
    try {
      const res = await fetch(`${getApiUrl()}/store/orders/${selectedOrder._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Order deleted");
        setSelectedOrder(null);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to delete order");
      }
    } catch {
      toast.error("Error deleting order");
    }
  };

  // ─── Create order ──────────────────────────────────────────────────────────

  const handleServiceChange = (index: number, field: keyof ServiceItem, value: any) => {
    const items = [...serviceItems];
    const item = { ...items[index], [field]: value };
    if (field === "service_name") {
      const match = getSortedServices().find((s) => s.name === value);
      if (match) {
        item.unit_price = match.price;
        item.total_price = item.quantity * match.price;
      }
    }
    if (field === "quantity" || field === "unit_price") {
      item.total_price = (field === "quantity" ? value : item.quantity) * (field === "unit_price" ? value : item.unit_price);
    }
    items[index] = item;
    setServiceItems(items);
  };

  const subtotal = serviceItems.reduce((s, i) => s + i.total_price, 0);
  const discountAmount = discountType === "percentage" ? (subtotal * discountValue) / 100 : discountValue;
  const finalAmount = Math.max(0, subtotal - discountAmount);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      toast.error("Customer name and phone are required");
      return;
    }
    if (serviceItems.some((s) => !s.service_name)) {
      toast.error("Please fill in all service names");
      return;
    }
    const token = localStorage.getItem("store_token");
    setCreatingOrder(true);
    try {
      const res = await fetch(`${getApiUrl()}/store/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          address,
          services: serviceItems,
          total_price: subtotal,
          discount_amount: discountAmount,
          final_amount: finalAmount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Order ${data.order.custom_order_id} created!`);
        setCustomerName("");
        setCustomerPhone("");
        setAddress("");
        setServiceItems([{ service_name: "", quantity: 1, unit_price: 0, total_price: 0 }]);
        setDiscountValue(0);
        setActiveTab("orders");
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to create order");
      }
    } catch {
      toast.error("Error creating order");
    } finally {
      setCreatingOrder(false);
    }
  };

  if (!storeInfo) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{storeInfo.store_name}</h1>
              <p className="text-xs text-gray-500">Code: {storeInfo.store_code} · ID: {storeInfo.store_id}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 flex gap-6">
          {(["orders", "create"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 font-medium border-b-2 capitalize transition-all ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "orders" ? "📋 My Orders" : "➕ Create Order"}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ── Create Order Tab ── */}
        {activeTab === "create" && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6">Create New Order</h2>
            <form onSubmit={handleCreateOrder} className="space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-4">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                    <Input placeholder="Enter customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                    <Input
                      type="tel"
                      placeholder="10-digit phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address <span className="text-gray-400 text-xs">(optional)</span></label>
                    <Input placeholder="Delivery address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Services / Cart */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Cart</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setServiceItems([...serviceItems, { service_name: "", quantity: 1, unit_price: 0, total_price: 0 }])}>
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {serviceItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white p-3 rounded-lg border">
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-500 mb-1">Service</label>
                        <Select
                          value={item.service_name || ""}
                          onValueChange={(value) => {
                            const realValue = value === "__none__" ? "" : value;
                            handleServiceChange(idx, "service_name", realValue);
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select service">
                              {item.service_name ? (
                                <>{item.service_name} — ₹{item.unit_price || 0}</>
                              ) : (
                                "Select service"
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select service</SelectItem>
                            {getSortedServices().map((svc) => (
                              <SelectItem key={svc.id || svc.name} value={svc.name}>
                                {svc.name} — ₹{svc.price}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Qty</label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleServiceChange(idx, "quantity", parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Rate ₹</label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleServiceChange(idx, "unit_price", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Total</label>
                        <div className="px-3 py-2 bg-gray-100 border rounded text-sm font-semibold">₹{item.total_price.toFixed(0)}</div>
                      </div>
                      <div className="col-span-1 flex items-end pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={serviceItems.length === 1}
                          onClick={() => setServiceItems(serviceItems.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">Discount</label>
                <div className="flex gap-2 mb-3">
                  {(["amount", "percentage"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setDiscountType(t); setDiscountValue(0); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        discountType === t ? "bg-orange-600 text-white" : "bg-white text-orange-600 border border-orange-300"
                      }`}
                    >
                      {t === "amount" ? "Amount (₹)" : "Percentage (%)"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min={0}
                    max={discountType === "percentage" ? 100 : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder={discountType === "percentage" ? "Enter %" : "Enter amount"}
                    className="border-orange-300"
                  />
                  <div className="px-4 py-2 bg-white border border-orange-300 rounded text-sm font-semibold text-orange-600 whitespace-nowrap">
                    −₹{discountAmount.toFixed(0)}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="flex justify-end">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 min-w-[280px] space-y-2">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal</span>
                    <span className="font-semibold">₹{subtotal.toFixed(0)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-orange-600 text-sm">
                      <span>Discount {discountType === "percentage" ? `(${discountValue}%)` : ""}</span>
                      <span>−₹{discountAmount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="border-t border-blue-200 pt-2 flex justify-between">
                    <span className="text-lg font-bold text-blue-700">Final Amount</span>
                    <span className="text-xl font-bold text-blue-700">₹{finalAmount.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-8" disabled={creatingOrder}>
                  <Save className="w-4 h-4 mr-2" />
                  {creatingOrder ? "Creating..." : "Create Order"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* ── Orders Tab ── */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <p className="text-sm text-gray-500">Total Orders</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-orange-600">{activeOrders.length}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-gray-500">Store Orders</p>
                <p className="text-2xl font-bold text-blue-600">{orders.filter((o) => o.is_store_order).length}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-gray-500">Assigned</p>
                <p className="text-2xl font-bold text-purple-600">{orders.filter((o) => !o.is_store_order).length}</p>
              </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by ID, name or phone"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">All Status</option>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s} className="capitalize">{s}</option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "recent" | "oldest")}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="recent">Recent First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </Card>

            {loadingOrders ? (
              <Card className="p-12 text-center">
                <p className="text-gray-500">Loading orders...</p>
              </Card>
            ) : filteredOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No orders found</p>
                <Button onClick={() => setActiveTab("create")} className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create First Order
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Active Orders */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                      🔴 Active Orders ({activeOrders.length})
                    </span>
                  </div>
                  {activeOrders.length === 0 ? (
                    <Card className="p-6 text-center bg-green-50 border-green-200">
                      <p className="text-green-700 font-medium">✓ All caught up — no active orders!</p>
                    </Card>
                  ) : (
                    <OrderTable orders={activeOrders} onView={openOrder} />
                  )}
                </div>

                {/* Inactive (collapsed) */}
                {inactiveOrders.length > 0 && (
                  <div className="border-t pt-4">
                    <button
                      onClick={() => setShowInactive(!showInactive)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <span className="font-semibold text-gray-700">
                        📦 Inactive Orders ({inactiveOrders.length})
                      </span>
                      <span className={`text-gray-500 transition-transform ${showInactive ? "rotate-180" : ""}`}>▼</span>
                    </button>
                    {showInactive && (
                      <div className="mt-4">
                        <OrderTable orders={inactiveOrders} onView={openOrder} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Order Detail Modal */}
      {selectedOrder && editedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold font-mono text-blue-600">{selectedOrder.custom_order_id}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedOrder.is_store_order ? "Store Order" : "Assigned Order"}
                  </p>
                </div>
                <button onClick={() => { setSelectedOrder(null); setIsEditMode(false); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>

              <div className="space-y-4">
                {/* Customer */}
                <div className={`p-4 rounded-lg ${isEditMode ? "bg-blue-50" : "bg-gray-50"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Customer</h3>
                    {!isEditMode && selectedOrder.is_store_order && (
                      <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>Edit</Button>
                    )}
                  </div>
                  {isEditMode ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500">Name</label>
                        <Input value={editedOrder.customer_name} onChange={(e) => setEditedOrder({ ...editedOrder, customer_name: e.target.value })} className="mt-1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Phone</label>
                        <Input value={editedOrder.customer_phone} onChange={(e) => setEditedOrder({ ...editedOrder, customer_phone: e.target.value })} className="mt-1" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /><span>{editedOrder.customer_name}</span></div>
                      <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span>{editedOrder.customer_phone}</span></div>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className={`p-4 rounded-lg ${isEditMode ? "bg-blue-50" : "bg-gray-50"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Items</h3>
                    {isEditMode && (
                      <Button variant="outline" size="sm" onClick={() => setEditedOrder({ ...editedOrder, item_prices: [...(editedOrder.item_prices || []), { service_name: "", quantity: 1, unit_price: 0, total_price: 0 }] })}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                  {editedOrder.item_prices?.length > 0 ? editedOrder.item_prices.map((item: ServiceItem, i: number) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                      {isEditMode ? (
                        <div className="grid grid-cols-12 gap-2 w-full">
                          <div className="col-span-5">
                            <Select
                              value={item.service_name || ""}
                              onValueChange={(value) => {
                                const realValue = value === "__none__" ? "" : value;
                                const items = [...editedOrder.item_prices];
                                const matched = getSortedServices().find((s) => s.name === realValue);
                                items[i] = {
                                  ...items[i],
                                  service_name: realValue,
                                  ...(matched ? { unit_price: matched.price, total_price: items[i].quantity * matched.price } : {}),
                                };
                                setEditedOrder({ ...editedOrder, item_prices: items });
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Select service">
                                  {item.service_name || "Select service"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Select service</SelectItem>
                                {getSortedServices().map((svc) => (
                                  <SelectItem key={svc.id || svc.name} value={svc.name}>
                                    {svc.name} — ₹{svc.price}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input type="number" className="col-span-2 text-sm" value={item.quantity}
                            onChange={(e) => {
                              const items = [...editedOrder.item_prices];
                              items[i] = { ...items[i], quantity: +e.target.value || 1, total_price: (+e.target.value || 1) * items[i].unit_price };
                              setEditedOrder({ ...editedOrder, item_prices: items });
                            }}
                          />
                          <Input type="number" className="col-span-3 text-sm" value={item.unit_price}
                            onChange={(e) => {
                              const items = [...editedOrder.item_prices];
                              items[i] = { ...items[i], unit_price: +e.target.value || 0, total_price: items[i].quantity * (+e.target.value || 0) };
                              setEditedOrder({ ...editedOrder, item_prices: items });
                            }}
                          />
                          <Button variant="ghost" size="sm" className="col-span-2 text-red-500"
                            onClick={() => setEditedOrder({ ...editedOrder, item_prices: editedOrder.item_prices.filter((_: any, j: number) => j !== i) })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm">{item.service_name} × {item.quantity}</span>
                          <span className="font-semibold text-sm">₹{item.total_price ?? item.unit_price * item.quantity}</span>
                        </>
                      )}
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500">No items listed</p>
                  )}
                </div>

                {/* Amount & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-500">Final Amount</p>
                    <p className="text-2xl font-bold text-blue-700">₹{selectedOrder.final_amount || selectedOrder.total_price}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">Status</p>
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => handleStatusUpdate(e.target.value)}
                      disabled={updatingStatus || isEditMode}
                      className="w-full border rounded px-2 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                    >
                      {ALL_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(selectedOrder.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(selectedOrder.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {isEditMode ? (
                    <>
                      <Button variant="outline" className="flex-1" onClick={() => { setIsEditMode(false); setEditedOrder({ ...selectedOrder }); }}>Cancel</Button>
                      <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleSaveOrder} disabled={savingOrder}>
                        {savingOrder ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" className="flex-1" onClick={() => setSelectedOrder(null)}>Close</Button>
                      {selectedOrder.is_store_order && (
                        <Button variant="destructive" className="flex-1" onClick={handleDeleteOrder}>
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: order table ───────────────────────────────────────────────

function OrderTable({ orders, onView }: { orders: Order[]; onView: (o: Order) => void }) {
  return (
    <div className="space-y-3">
      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Order ID", "Customer", "Phone", "Items", "Amount", "Status", "Date", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-semibold text-blue-600">{o.custom_order_id}</span>
                  {!o.is_store_order && <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Assigned</span>}
                </td>
                <td className="px-4 py-3 font-medium text-sm">{o.customer_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{o.customer_phone}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {o.item_prices?.length > 0
                    ? o.item_prices.map((s) => `${s.service_name} ×${s.quantity}`).join(", ")
                    : (o.services || []).join(", ")}
                </td>
                <td className="px-4 py-3 font-bold text-sm">₹{o.final_amount || o.total_price}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-700"}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(o.created_at)}</td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm" onClick={() => onView(o)}>
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {orders.map((o) => (
          <Card key={o._id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-mono font-bold text-blue-600 text-sm">{o.custom_order_id}</p>
                {!o.is_store_order && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Assigned</span>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-700"}`}>
                {o.status}
              </span>
            </div>
            <p className="font-medium text-sm">{o.customer_name}</p>
            <p className="text-sm text-gray-500">{o.customer_phone}</p>
            <div className="flex justify-between items-center mt-3">
              <span className="font-bold">₹{o.final_amount || o.total_price}</span>
              <Button variant="outline" size="sm" onClick={() => onView(o)}>View</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
