import React, { useState, useEffect } from "react";
import clsx from "clsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Package,
  Calendar,
  DollarSign,
  Edit3,
  Eye,
  Store,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSortedServices } from "@/data/laundryServices";

interface CartItem {
  service_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  _key: string;
}

interface VendorOption {
  id: string;
  name: string;
  address?: string;
}

interface VendorOrder {
  _id: string;
  custom_order_id: string;
  vendor_client_name: string;
  is_vendor_order: boolean;
  name: string;
  phone?: string;
  service: string;
  services: string[];
  scheduled_date: string;
  scheduled_time: string;
  delivery_date?: string;
  delivery_time?: string;
  address?: string;
  status: string;
  total_price: number;
  final_amount: number;
  assignedVendor?: string;
  special_instructions?: string;
  item_prices?: Array<{ service_name?: string; quantity?: number; unit_price?: number; total_price?: number }>;
  created_at: string;
}


const ORDER_STATUSES = [
  { value: "created", label: "Order Created", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "vendor_assigned", label: "Vendor Assigned", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "pickup_completed", label: "Pickup Complete", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "in_progress", label: "Processing", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "ready_for_delivery", label: "Ready for Delivery", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "delivered", label: "Delivered", color: "bg-teal-100 text-teal-700 border-teal-300" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700 border-red-300" },
];

const getStatusInfo = (status: string) => {
  return ORDER_STATUSES.find(s => s.value === status) || { value: status, label: status, color: "bg-gray-100 text-gray-700 border-gray-300" };
};

const normalizeStatus = (status: string): string => {
  const map: Record<string, string> = {
    pending: "created", new: "created", new_order: "created", confirmed: "vendor_assigned",
    accepted: "vendor_assigned", assigned: "vendor_assigned", picked_up: "pickup_completed",
    processing: "in_progress", in_process: "in_progress", delivered_to_vendor: "ready_for_delivery",
    ready_for_pickup: "ready_for_delivery", out_for_delivery: "ready_for_delivery",
    delivery_assigned: "ready_for_delivery",
  };
  return map[status] || status;
};

const AdminVendorOrders: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"create" | "orders">("create");

  // Create form state
  const [vendorClientName, setVendorClientName] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("18:00");
  const [notes, setNotes] = useState("");
  const [assignedLaundryVendor, setAssignedLaundryVendor] = useState("");
  const [assignedLaundryVendorId, setAssignedLaundryVendorId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [laundryVendors, setLaundryVendors] = useState<VendorOption[]>([]);

  // Orders list state
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<VendorOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [viewingOrder, setViewingOrder] = useState<VendorOrder | null>(null);

  const calculateTotal = () =>
    cartItems.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);

  const addCartItem = () => {
    setCartItems(prev => [
      ...prev,
      { service_name: "", quantity: 1, unit_price: 0, total_price: 0, _key: `item-${Date.now()}-${Math.random()}` },
    ]);
  };

  const removeCartItem = (key: string) => {
    setCartItems(prev => prev.filter(it => it._key !== key));
  };

  const handleCartItemChange = (key: string, field: "service_name" | "quantity" | "unit_price", rawValue: string) => {
    setCartItems(prev => prev.map(it => {
      if (it._key !== key) return it;
      const next = { ...it };
      if (field === "service_name") {
        next.service_name = rawValue;
        const catalog = getSortedServices();
        const matched = catalog.find((s: any) => s.name === rawValue);
        if (matched) {
          next.unit_price = matched.price;
          if (!it.quantity || it.quantity === 0) next.quantity = 1;
        }
      } else if (field === "quantity") {
        const v = parseFloat(rawValue);
        next.quantity = Number.isFinite(v) && v >= 0 ? v : 1;
      } else if (field === "unit_price") {
        const v = parseFloat(rawValue);
        next.unit_price = Number.isFinite(v) && v >= 0 ? v : 0;
      }
      next.total_price = +(next.quantity * next.unit_price).toFixed(2);
      return next;
    }));
  };

  const fetchLaundryVendors = async () => {
    try {
      const res = await apiClient.adminRequest<{ vendors: any[] }>("/admin/vendors");
      if (res.data?.vendors) {
        setLaundryVendors(res.data.vendors.map((v: any) => ({ id: v._id || v.id, name: v.name, address: v.address })));
      }
    } catch {}
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await apiClient.adminRequest<{ vendorOrders?: any[] }>("/admin/bookings?limit=200");
      if (res.data?.vendorOrders) {
        const processed = res.data.vendorOrders.map((o: any) => ({
          ...o,
          status: normalizeStatus(o.status),
          item_prices: Array.isArray(o.item_prices) ? o.item_prices : [],
        }));
        setOrders(processed);
      }
    } catch {
      toast.error("Failed to load vendor orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchLaundryVendors();
    fetchOrders();
  }, []);

  useEffect(() => {
    let result = [...orders];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.custom_order_id?.toLowerCase().includes(q) ||
        o.vendor_client_name?.toLowerCase().includes(q) ||
        o.service?.toLowerCase().includes(q) ||
        o.assignedVendor?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter(o => normalizeStatus(o.status) === statusFilter);
    }
    setFilteredOrders(result);
  }, [orders, searchTerm, statusFilter]);

  const submitOrder = async () => {
    if (!vendorClientName.trim()) { toast.error("Enter vendor/client name"); return; }
    if (!scheduledDate) { toast.error("Select pickup date"); return; }
    const validItems = cartItems.filter(it => it.service_name.trim() && it.quantity > 0);
    if (validItems.length === 0) { toast.error("Add at least one service item"); return; }

    setSubmitting(true);
    try {
      const total = validItems.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
      const payload: any = {
        is_vendor_order: true,
        vendor_client_name: vendorClientName.trim(),
        name: vendorClientName.trim(),
        phone: "",
        service: validItems[0]?.service_name || "Laundry Service",
        service_type: "vendor_client",
        services: validItems.map(it => `${it.service_name} x${it.quantity} (₹${it.unit_price})`),
        item_prices: validItems.map(it => ({
          service_name: it.service_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
        })),
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        delivery_date: deliveryDate || scheduledDate,
        delivery_time: deliveryTime || scheduledTime,
        address: "",
        special_instructions: notes,
        total_price: total,
        final_amount: total,
        created_by_admin: true,
        status: assignedLaundryVendorId ? "vendor_assigned" : "created",
        assignedVendor: assignedLaundryVendor || "",
        assignedVendorId: assignedLaundryVendorId || "",
      };

      const res = await apiClient.adminRequest<{ booking: any }>("/admin/bookings", {
        method: "POST",
        body: payload,
      });

      if (res.data?.booking) {
        toast.success(`Vendor order created! ID: ${res.data.booking.custom_order_id}`);
        setVendorClientName("");
        setCartItems([]);
        setScheduledDate("");
        setScheduledTime("10:00");
        setDeliveryDate("");
        setDeliveryTime("18:00");
        setNotes("");
        setAssignedLaundryVendor("");
        setAssignedLaundryVendorId("");
        await fetchOrders();
        setActiveTab("orders");
      } else {
        toast.error(res.error || "Failed to create order");
      }
    } catch {
      toast.error("Error creating vendor order");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await apiClient.adminRequest<{ booking?: any }>(`/admin/bookings/${orderId}`, {
        method: "PUT",
        body: { status: newStatus },
      });
      if (res.data) {
        setOrders(prev => prev.map(o =>
          o._id === orderId ? { ...o, status: normalizeStatus(newStatus) } : o
        ));
        toast.success(`Status updated to ${getStatusInfo(newStatus).label}`);
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch {
      toast.error("Error updating status");
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [orderId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-amber-600" />
            Vendor / Corporate Orders
          </h2>
          <p className="text-gray-600 mt-1">
            Create and manage orders for bulk clients, hotels, and corporate vendors — no mobile number required
          </p>
        </div>
        {activeTab === "orders" && (
          <Button variant="outline" onClick={fetchOrders} disabled={ordersLoading}>
            <RefreshCw className={clsx("mr-2 h-4 w-4", ordersLoading && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        <button
          onClick={() => setActiveTab("create")}
          className={clsx(
            "px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "create"
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <Plus className="h-4 w-4 inline mr-1.5" />
          Create Order
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={clsx(
            "px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "orders"
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <Package className="h-4 w-4 inline mr-1.5" />
          All Vendor Orders
          {orders.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
              {orders.length}
            </span>
          )}
        </button>
      </div>

      {/* CREATE ORDER TAB */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Client info + vendor */}
          <div className="space-y-4">
            {/* Big Vendor Name */}
            <Card className="border-2 border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Building2 className="h-5 w-5" />
                  Vendor / Client Name
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="e.g. Hotel Sunshine, Sunrise Apartments, ABC Corp..."
                  value={vendorClientName}
                  onChange={e => setVendorClientName(e.target.value)}
                  className="text-lg font-semibold border-amber-300 focus:border-amber-500 bg-white"
                />
                <p className="text-xs text-amber-700 mt-2">
                  This name will appear as a prominent tag on the order throughout the system.
                </p>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pickup Date *</Label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Pickup Time</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Delivery Date</Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Delivery Time</Label>
                    <Input
                      type="time"
                      value={deliveryTime}
                      onChange={e => setDeliveryTime(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Laundry Vendor Assignment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4" />
                  Assign Laundry Vendor (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={assignedLaundryVendorId}
                  onValueChange={val => {
                    const v = laundryVendors.find(lv => lv.id === val);
                    setAssignedLaundryVendorId(val);
                    setAssignedLaundryVendor(v?.name || "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select laundry vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Unassigned</SelectItem>
                    {laundryVendors.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="pt-4">
                <Label>Notes / Special Instructions</Label>
                <Textarea
                  placeholder="Any special instructions for this vendor order..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right: Services cart */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Services / Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-0 pb-0">
                {cartItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 sticky top-0">
                          <th className="text-left py-3 px-3 font-semibold min-w-[200px]">Service Name</th>
                          <th className="text-center py-3 px-3 font-semibold min-w-[80px]">Qty</th>
                          <th className="text-right py-3 px-3 font-semibold min-w-[100px]">Unit Price</th>
                          <th className="text-right py-3 px-3 font-semibold min-w-[90px]">Total</th>
                          <th className="text-center py-3 px-3 font-semibold min-w-[60px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((item) => (
                          <tr key={item._key} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-3">
                              <Select
                                value={item.service_name || ""}
                                onValueChange={(val) =>
                                  handleCartItemChange(item._key, "service_name", val === "__none__" ? "" : val)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select item">
                                    {item.service_name ? (
                                      <>{item.service_name} — ₹{item.unit_price}</>
                                    ) : (
                                      "Select item"
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Select item</SelectItem>
                                  {getSortedServices().map((svc: any) => (
                                    <SelectItem key={svc.id || svc.name} value={svc.name}>
                                      {svc.name} — ₹{svc.price}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                value={String(item.quantity ?? 1)}
                                onChange={(e) => handleCartItemChange(item._key, "quantity", e.target.value)}
                                className="h-8 text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={String(item.unit_price ?? 0)}
                                onChange={(e) => handleCartItemChange(item._key, "unit_price", e.target.value)}
                                className="h-8 text-right text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-medium">
                              ₹{(Number(item.total_price) || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeCartItem(item._key)}
                                className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 px-4 py-6 border rounded border-dashed mx-4">
                    No items added yet. Click "Add Item" to start adding services.
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gray-50 border-t">
                  <Button
                    size="sm"
                    type="button"
                    onClick={addCartItem}
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Item
                  </Button>
                  <div className="text-base font-semibold whitespace-nowrap">
                    Subtotal:{" "}
                    <span className="text-green-600">₹{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary + Submit */}
            {vendorClientName && cartItems.filter(it => it.service_name && it.quantity > 0).length > 0 && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-green-700" />
                    <span className="font-bold text-green-900 text-lg">{vendorClientName}</span>
                  </div>
                  <div className="text-sm text-green-800 space-y-1">
                    {scheduledDate && <div>📅 Pickup: {scheduledDate} {scheduledTime}</div>}
                    {deliveryDate && <div>🚚 Delivery: {deliveryDate} {deliveryTime}</div>}
                    {assignedLaundryVendor && <div>🏪 Laundry Vendor: {assignedLaundryVendor}</div>}
                    <div>🧺 {cartItems.filter(it => it.service_name && it.quantity > 0).length} item(s) — ₹{calculateTotal().toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={submitOrder}
              disabled={
                submitting ||
                !vendorClientName.trim() ||
                !scheduledDate ||
                cartItems.filter(it => it.service_name.trim() && it.quantity > 0).length === 0
              }
              className="w-full bg-amber-600 hover:bg-amber-700 text-white h-12 text-base font-semibold"
            >
              {submitting ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating Order...</>
              ) : (
                <><Building2 className="mr-2 h-5 w-5" /> Create Vendor Order</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ORDERS LIST TAB */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order ID, vendor name, service..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="md:w-56">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {ORDER_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {ordersLoading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-amber-500" />
              Loading vendor orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-base font-medium">No vendor orders found</p>
              <p className="text-sm mt-1">Create your first vendor order using the form above</p>
              <Button
                className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => setActiveTab("create")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(order => {
                const statusInfo = getStatusInfo(normalizeStatus(order.status));
                const isUpdating = updatingStatus[order._id];
                return (
                  <Card key={order._id} className="border hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        {/* Left: identity */}
                        <div className="flex-1 space-y-2">
                          {/* Big vendor name badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-800 font-bold text-base px-3 py-1 rounded-full">
                              <Building2 className="h-4 w-4" />
                              {order.vendor_client_name || order.name}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">#{order.custom_order_id}</span>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            {order.scheduled_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                Pickup: {order.scheduled_date} {order.scheduled_time}
                              </span>
                            )}
                            {order.delivery_date && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                Delivery: {order.delivery_date}
                              </span>
                            )}
                            {order.assignedVendor && (
                              <span className="flex items-center gap-1">
                                <Store className="h-3.5 w-3.5 text-blue-500" />
                                <span className="text-blue-700 font-medium">{order.assignedVendor}</span>
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-gray-600">
                            {order.service}{" "}
                            {order.item_prices && order.item_prices.length > 0 && (
                              <span className="text-gray-400">({order.item_prices.length} item{order.item_prices.length !== 1 ? "s" : ""})</span>
                            )}
                          </div>
                        </div>

                        {/* Right: status + amount + actions */}
                        <div className="flex flex-col md:items-end gap-2">
                          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                            <span className="text-lg font-bold text-green-700">
                              ₹{(order.final_amount ?? order.total_price ?? 0).toLocaleString("en-IN")}
                            </span>
                          </div>

                          {/* Status badge */}
                          <Badge className={clsx("border text-xs px-2 py-0.5 font-medium", statusInfo.color)}>
                            {statusInfo.label}
                          </Badge>

                          {/* Status changer */}
                          <div className="flex items-center gap-2">
                            {isUpdating ? (
                              <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                            ) : (
                              <Select
                                value={normalizeStatus(order.status)}
                                onValueChange={val => updateStatus(order._id, val)}
                              >
                                <SelectTrigger className="h-8 text-xs w-44 bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ORDER_STATUSES.map(s => (
                                    <SelectItem key={s.value} value={s.value} className="text-xs">
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingOrder(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Item breakdown */}
                      {order.item_prices && order.item_prices.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex flex-wrap gap-2">
                            {order.item_prices.map((it, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                {it.service_name} × {it.quantity} = ₹{it.total_price}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View Order Dialog */}
      {viewingOrder && (
        <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-600" />
                Vendor Order Detail
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-lg font-bold text-amber-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {viewingOrder.vendor_client_name || viewingOrder.name}
                </div>
                <div className="text-sm text-amber-700 mt-1">Order #{viewingOrder.custom_order_id}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Status</span>
                  <div>
                    <Badge className={clsx("border text-xs", getStatusInfo(normalizeStatus(viewingOrder.status)).color)}>
                      {getStatusInfo(normalizeStatus(viewingOrder.status)).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Amount</span>
                  <div className="font-bold text-green-700 text-base">
                    ₹{(viewingOrder.final_amount ?? viewingOrder.total_price ?? 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Pickup</span>
                  <div>{viewingOrder.scheduled_date} {viewingOrder.scheduled_time}</div>
                </div>
                {viewingOrder.delivery_date && (
                  <div>
                    <span className="text-gray-500">Delivery</span>
                    <div>{viewingOrder.delivery_date} {viewingOrder.delivery_time}</div>
                  </div>
                )}
                {viewingOrder.assignedVendor && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Laundry Vendor</span>
                    <div className="text-blue-700 font-medium">{viewingOrder.assignedVendor}</div>
                  </div>
                )}
              </div>

              {viewingOrder.item_prices && viewingOrder.item_prices.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Items</div>
                  <div className="space-y-1.5">
                    {viewingOrder.item_prices.map((it, i) => (
                      <div key={i} className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                        <span>{it.service_name} × {it.quantity}</span>
                        <span className="font-medium">₹{it.total_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingOrder.special_instructions && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Notes</div>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{viewingOrder.special_instructions}</div>
                </div>
              )}

              {/* Status changer in dialog */}
              <div>
                <Label className="text-sm font-medium">Change Status</Label>
                <Select
                  value={normalizeStatus(viewingOrder.status)}
                  onValueChange={async val => {
                    await updateStatus(viewingOrder._id, val);
                    setViewingOrder(prev => prev ? { ...prev, status: val } : null);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AdminVendorOrders;
