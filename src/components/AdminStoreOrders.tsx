import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Eye, RefreshCw, Search, Package, User, Phone, Calendar, Clock,
  Plus, Trash2, ShoppingCart, Store, ChevronDown, ChevronUp, Banknote, Download,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { getSortedServices } from "@/data/laundryServices";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StoreRecord {
  _id: string;
  store_id: string;
  store_code: string;
  store_name: string;
}

interface CartItem {
  service_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  _key: string;
}

interface FileRef {
  file_id: string;
  filename?: string;
  uploaded_at?: string;
}

interface Order {
  _id: string;
  custom_order_id: string;
  name?: string;
  phone?: string;
  customer_name: string;
  customer_phone: string;
  services: string[];
  item_prices: { service_name?: string; quantity?: number; unit_price?: number; total_price?: number }[];
  total_price: number;
  final_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  riderStatus: string;
  is_store_order?: boolean;
  store_code?: string;
  assigned_store_id?: string;
  assigned_store_name?: string;
  payment_status?: string;
  // Store-created orders use `payment_slips`; admin-assigned Bookings use
  // `vendor_payment_slips`/`rider_payment_slips` — read whichever is present.
  payment_slips?: FileRef[];
  vendor_payment_slips?: FileRef[];
  rider_payment_slips?: FileRef[];
  cod_collected?: boolean;
  cod_amount?: number;
  cod_collected_at?: string | null;
}

function allPaymentSlips(order: Order): FileRef[] {
  return [
    ...(order.payment_slips || []),
    ...(order.vendor_payment_slips || []),
    ...(order.rider_payment_slips || []),
  ];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  created:         "bg-blue-100 text-blue-800",
  pending:         "bg-yellow-100 text-yellow-800",
  confirmed:       "bg-green-100 text-green-800",
  processing:      "bg-orange-100 text-orange-800",
  ready:           "bg-teal-100 text-teal-800",
  completed:       "bg-green-200 text-green-900",
  cancelled:       "bg-red-100 text-red-800",
  delivered:       "bg-green-100 text-green-800",
  vendor_assigned: "bg-purple-100 text-purple-800",
};

const ALL_STATUSES = ["created","pending","confirmed","processing","ready","completed","delivered","cancelled"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function newCartItem(): CartItem {
  return { service_name: "", quantity: 1, unit_price: 0, total_price: 0, _key: `ci-${Date.now()}-${Math.random()}` };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminStoreOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterType, setFilterType] = useState<"all" | "store" | "assigned">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Create order dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newStoreId, setNewStoreId] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([newCartItem()]);
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountValue, setDiscountValue] = useState(0);

  // Mobile: collapsed filters
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── API ────────────────────────────────────────────────────────────────────

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy });
      if (filterStatus) params.set("filterStatus", filterStatus);
      if (filterStore) params.set("storeId", filterStore);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiClient.adminRequest<any>(`/store/admin/orders?${params}`);
      if (res.data?.success) setOrders(res.data.orders || []);
    } catch {
      toast.error("Failed to fetch store orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await apiClient.adminRequest<any>("/store/admin/stores");
      if (res.data?.success) setStores(res.data.stores || []);
    } catch {}
  };

  useEffect(() => { fetchOrders(); fetchStores(); }, [sortBy, filterStatus, filterStore, dateFrom, dateTo]);

  const handleStatusUpdate = async (orderId: string, status: string) => {
    setUpdatingStatus(true);
    try {
      const res = await apiClient.adminRequest<any>(`/store/admin/orders/${orderId}/status`, {
        method: "PUT",
        body: { status },
      });
      if (res.data?.success) {
        toast.success("Status updated");
        if (selectedOrder?._id === orderId) setSelectedOrder(res.data.order);
        fetchOrders();
      } else {
        toast.error(res.data?.error || "Failed to update status");
      }
    } catch {
      toast.error("Error updating status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Cart helpers ───────────────────────────────────────────────────────────

  const updateCartItem = (key: string, field: keyof CartItem, value: string) => {
    setCartItems(prev => prev.map(item => {
      if (item._key !== key) return item;
      const updated = { ...item };
      if (field === "service_name") {
        updated.service_name = value;
        const match = getSortedServices().find(s => s.name === value);
        if (match) {
          updated.unit_price = match.price;
          updated.total_price = item.quantity * match.price;
        }
      } else if (field === "quantity") {
        updated.quantity = Math.max(0, parseFloat(value) || 0);
        updated.total_price = updated.quantity * updated.unit_price;
      } else if (field === "unit_price") {
        updated.unit_price = Math.max(0, parseFloat(value) || 0);
        updated.total_price = item.quantity * updated.unit_price;
      }
      return updated;
    }));
  };

  const removeCartItem = (key: string) => {
    setCartItems(prev => prev.length > 1 ? prev.filter(i => i._key !== key) : prev);
  };

  const subtotal = cartItems.reduce((s, i) => s + i.total_price, 0);
  const discountAmt = discountType === "percent" ? (subtotal * discountValue) / 100 : discountValue;
  const finalAmt = Math.max(0, subtotal - discountAmt);

  const resetCreateForm = () => {
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewAddress("");
    setNewStoreId("");
    setCartItems([newCartItem()]);
    setDiscountType("flat");
    setDiscountValue(0);
  };

  const handleCreateOrder = async () => {
    if (!newCustomerName.trim()) return toast.error("Customer name is required");
    if (!newCustomerPhone.trim()) return toast.error("Customer phone is required");
    const validItems = cartItems.filter(i => i.service_name && i.quantity > 0);
    if (validItems.length === 0) return toast.error("Add at least one item with quantity");

    setCreateLoading(true);
    try {
      const res = await apiClient.adminRequest<any>("/store/admin/orders/create", {
        method: "POST",
        body: {
          customer_name: newCustomerName.trim(),
          customer_phone: newCustomerPhone.trim(),
          address: newAddress.trim(),
          store_id: newStoreId || undefined,
          services: validItems,
          total_price: subtotal,
          discount_amount: discountAmt,
          final_amount: finalAmt,
        },
      });
      if (res.data?.success) {
        toast.success(`Order ${res.data.order?.custom_order_id || ""} created!`);
        setCreateOpen(false);
        resetCreateForm();
        fetchOrders();
      } else {
        toast.error(res.data?.error || "Failed to create order");
      }
    } catch {
      toast.error("Error creating order");
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = orders.filter(o => {
    if (filterType === "store" && !o.is_store_order) return false;
    if (filterType === "assigned" && o.is_store_order) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      o.custom_order_id?.toLowerCase().includes(s) ||
      (o.customer_name || o.name || "").toLowerCase().includes(s) ||
      (o.customer_phone || o.phone || "").includes(searchTerm)
    );
  });

  // Exports exactly what's on screen — same store/type/status/date filters
  // and search already applied to `filtered` — so the store assignment (and
  // every other field) always matches what's live in the DB, not whatever a
  // stale external export happens to include.
  const exportToCSV = () => {
    const headers = [
      "Order ID", "Type", "Store", "Customer Name", "Phone", "Items",
      "Amount", "Status", "Payment Status", "Created Date", "Created Time",
    ];
    const rows = filtered.map(o => [
      o.custom_order_id,
      o.is_store_order ? "Store Created" : "Admin Assigned",
      o.assigned_store_name || o.store_code || "",
      o.customer_name || o.name || "",
      o.customer_phone || o.phone || "",
      o.item_prices?.length > 0
        ? o.item_prices.map(i => `${i.service_name} x${i.quantity}`).join(", ")
        : (o.services || []).join(", "),
      o.final_amount || o.total_price || 0,
      o.status,
      o.payment_status || (o.cod_collected ? "paid" : "pending"),
      fmtDate(o.created_at),
      fmtTime(o.created_at),
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `store-orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const statsStoreOrders = orders.filter(o => o.is_store_order).length;
  const statsAssigned = orders.filter(o => !o.is_store_order).length;
  const statsRevenue = orders.reduce((sum, o) => sum + (o.final_amount || o.total_price || 0), 0);
  const statusBreakdown = ALL_STATUSES
    .map(s => ({ status: s, count: orders.filter(o => o.status === s).length }))
    .filter(s => s.count > 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Store Orders</h2>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Orders created by stores or assigned by admin</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-2">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Export CSV</span>
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => { resetCreateForm(); setCreateOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Order
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: orders.length, color: "text-gray-900" },
          { label: "Store Created", value: statsStoreOrders, color: "text-blue-600" },
          { label: "Admin Assigned", value: statsAssigned, color: "text-purple-600" },
          { label: "Active", value: orders.filter(o => !["completed","cancelled","delivered"].includes(o.status)).length, color: "text-orange-600" },
          { label: "Revenue", value: `₹${statsRevenue.toLocaleString("en-IN")}`, color: "text-green-600" },
        ].map(s => (
          <Card key={s.label} className="p-3 text-center">
            <p className="text-xs text-gray-500 truncate">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* ── Status breakdown (respects all active filters above) ── */}
      {statusBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statusBreakdown.map(({ status, count }) => (
            <Badge key={status} className={`border-0 ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}>
              {status} · {count}
            </Badge>
          ))}
        </div>
      )}

      {/* ── Filters (collapsible on mobile) ── */}
      <Card className="p-3">
        <button
          className="flex items-center justify-between w-full sm:hidden mb-2 text-sm font-medium text-gray-700"
          onClick={() => setFiltersOpen(f => !f)}
        >
          <span className="flex items-center gap-1"><Search className="w-4 h-4" /> Filters & Search</span>
          {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <div className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap ${filtersOpen ? "flex" : "hidden sm:flex"}`}>
          {/* Search */}
          <div className="flex-1 min-w-0 sm:min-w-[200px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search order ID, name, phone…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">All Types</option>
            <option value="store">Store Created</option>
            <option value="assigned">Admin Assigned</option>
          </select>

          <select
            value={filterStore}
            onChange={e => setFilterStore(e.target.value)}
            className="h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">All Stores</option>
            {stores.map(s => <option key={s._id} value={s._id}>{s.store_name} ({s.store_code})</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">All Status</option>
            {ALL_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="recent">Recent First</option>
            <option value="oldest">Oldest First</option>
          </select>

          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="h-9 text-sm w-[140px]"
              aria-label="From date"
            />
            <span className="text-gray-400 text-xs">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="h-9 text-sm w-[140px]"
              aria-label="To date"
            />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-9 px-2 text-gray-500" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Orders list ── */}
      {loading ? (
        <Card className="p-12 text-center"><p className="text-gray-500">Loading orders…</p></Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No store orders found</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Order ID","Type","Customer","Phone","Items","Amount","Status","Date",""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(order => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold text-blue-600">{order.custom_order_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      {order.is_store_order
                        ? <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Store</Badge>
                        : <Badge className="bg-purple-100 text-purple-800 border-0 text-xs">Assigned</Badge>}
                      {order.store_code && <p className="text-xs text-gray-400 mt-0.5">{order.store_code}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm">{order.customer_name || order.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.customer_phone || order.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px]">
                      <p className="truncate">
                        {order.item_prices?.length > 0
                          ? order.item_prices.map(i => `${i.service_name} ×${i.quantity}`).join(", ")
                          : (order.services || []).join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-bold text-sm">
                      ₹{order.final_amount || order.total_price}
                      {(order.payment_status === "paid" || order.cod_collected) && (
                        <Banknote className="w-3.5 h-3.5 text-green-600 inline-block ml-1 align-text-bottom" aria-label="Paid" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        onChange={e => handleStatusUpdate(order._id, e.target.value)}
                        disabled={updatingStatus}
                        className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      <p>{fmtDate(order.created_at)}</p>
                      <p className="text-gray-400">{fmtTime(order.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
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
            {filtered.map(order => (
              <Card key={order._id} className="p-4">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <p className="font-mono font-bold text-blue-600 text-sm">{order.custom_order_id}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {order.is_store_order
                        ? <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Store</Badge>
                        : <Badge className="bg-purple-100 text-purple-800 border-0 text-xs">Assigned</Badge>}
                      {order.store_code && <Badge variant="outline" className="text-xs">{order.store_code}</Badge>}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}>
                    {order.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm mb-1">
                  <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="font-medium truncate">{order.customer_name || order.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mb-1 text-gray-500">
                  <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span>{order.customer_phone || order.phone}</span>
                </div>

                {order.item_prices?.length > 0 && (
                  <div className="text-xs text-gray-500 mb-2 truncate">
                    {order.item_prices.map(i => `${i.service_name} ×${i.quantity}`).join(" · ")}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <span className="font-bold text-gray-900 flex items-center gap-1">
                    ₹{order.final_amount || order.total_price}
                    {(order.payment_status === "paid" || order.cod_collected) && (
                      <Banknote className="w-3.5 h-3.5 text-green-600" aria-label="Paid" />
                    )}
                  </span>
                  <div className="flex gap-2 items-center">
                    <select
                      value={order.status}
                      onChange={e => handleStatusUpdate(order._id, e.target.value)}
                      className="text-xs border rounded px-2 py-1 focus:outline-none h-8"
                    >
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedOrder(order)}>
                      <Eye className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ══════════ CREATE ORDER DIALOG ══════════ */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) setCreateOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              Create Store Order
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">

            {/* Customer details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Customer Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Full name"
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Phone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="+91 XXXXX XXXXX"
                    value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Address <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  placeholder="Pickup / drop address"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Assign to Store <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Select value={newStoreId} onValueChange={setNewStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No specific store</SelectItem>
                    {stores.map(s => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.store_name} ({s.store_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Cart ── */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Package className="w-4 h-4" />
                Cart Items ({cartItems.length})
              </h4>

              <div className="space-y-2">
                {/* Header row — desktop only */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_100px_80px_36px] gap-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span>Service</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Unit Price</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>

                {cartItems.map(item => (
                  <div key={item._key} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_100px_80px_36px] gap-2 items-center p-3 sm:p-0 bg-gray-50 sm:bg-transparent rounded-lg sm:rounded-none border sm:border-0">
                    {/* Service name */}
                    <Select
                      value={item.service_name || "__none__"}
                      onValueChange={val => updateCartItem(item._key, "service_name", val === "__none__" ? "" : val)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select service…">
                          {item.service_name
                            ? <span>{item.service_name} — ₹{item.unit_price}</span>
                            : "Select service…"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="__none__">Select service…</SelectItem>
                        {getSortedServices().map(svc => (
                          <SelectItem key={svc.id || svc.name} value={svc.name}>
                            {svc.name} — ₹{svc.price}/{svc.unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Qty */}
                    <div className="flex sm:block items-center gap-2">
                      <span className="sm:hidden text-xs text-gray-500 w-16 flex-shrink-0">Qty</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={item.quantity}
                        onChange={e => updateCartItem(item._key, "quantity", e.target.value)}
                        className="h-9 text-center text-sm flex-1 sm:flex-none"
                      />
                    </div>

                    {/* Unit price */}
                    <div className="flex sm:block items-center gap-2">
                      <span className="sm:hidden text-xs text-gray-500 w-16 flex-shrink-0">Price</span>
                      <div className="relative flex-1 sm:flex-none">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price}
                          onChange={e => updateCartItem(item._key, "unit_price", e.target.value)}
                          className="h-9 pl-6 text-right text-sm"
                        />
                      </div>
                    </div>

                    {/* Row total */}
                    <div className="flex sm:block items-center gap-2 justify-between sm:justify-end">
                      <span className="sm:hidden text-xs text-gray-500">Total</span>
                      <span className="font-semibold text-sm text-right">₹{item.total_price.toFixed(0)}</span>
                    </div>

                    {/* Remove */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCartItem(item._key)}
                      disabled={cartItems.length === 1}
                      className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 mx-auto sm:mx-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCartItems(prev => [...prev, newCartItem()])}
                className="mt-3 w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>

            {/* ── Discount ── */}
            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
              <h4 className="font-semibold text-sm">Discount <span className="text-gray-400 font-normal">(optional)</span></h4>
              <div className="flex gap-2">
                <Button
                  variant={discountType === "flat" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDiscountType("flat")}
                  className="flex-1"
                >
                  Flat ₹
                </Button>
                <Button
                  variant={discountType === "percent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDiscountType("percent")}
                  className="flex-1"
                >
                  Percent %
                </Button>
              </div>
              <Input
                type="number"
                min={0}
                placeholder={discountType === "flat" ? "e.g. 50" : "e.g. 10"}
                value={discountValue || ""}
                onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>

            {/* ── Order summary ── */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount ({discountType === "percent" ? `${discountValue}%` : "flat"})</span>
                  <span>− ₹{discountAmt.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-blue-200 pt-1.5 mt-1">
                <span>Final Amount</span>
                <span className="text-blue-700">₹{finalAmt.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleCreateOrder}
                disabled={createLoading}
              >
                {createLoading ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
                ) : (
                  <><ShoppingCart className="w-4 h-4 mr-2" /> Create Order</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════ ORDER DETAIL DIALOG ══════════ */}
      <Dialog open={!!selectedOrder} onOpenChange={open => { if (!open) setSelectedOrder(null); }}>
        {selectedOrder && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-mono text-blue-600">{selectedOrder.custom_order_id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">

              <div className="flex gap-2 flex-wrap">
                {selectedOrder.is_store_order
                  ? <Badge className="bg-blue-100 text-blue-800 border-0">Store Created</Badge>
                  : <Badge className="bg-purple-100 text-purple-800 border-0">Admin Assigned</Badge>}
                {selectedOrder.store_code && <Badge variant="outline">Store: {selectedOrder.store_code}</Badge>}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-sm">Customer</h3>
                <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" />{selectedOrder.customer_name || selectedOrder.name}</div>
                <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" />{selectedOrder.customer_phone || selectedOrder.phone}</div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-sm mb-3">Items</h3>
                {selectedOrder.item_prices?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrder.item_prices.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.service_name} × {item.quantity}</span>
                        <span className="font-semibold">₹{item.total_price}</span>
                      </div>
                    ))}
                  </div>
                ) : selectedOrder.services?.length > 0 ? (
                  <p className="text-sm">{selectedOrder.services.join(", ")}</p>
                ) : (
                  <p className="text-sm text-gray-500">No items listed</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500">Final Amount</p>
                  <p className="text-2xl font-bold text-blue-700">₹{selectedOrder.final_amount || selectedOrder.total_price}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">Update Status</p>
                  <select
                    value={selectedOrder.status}
                    onChange={e => handleStatusUpdate(selectedOrder._id, e.target.value)}
                    disabled={updatingStatus}
                    className="w-full border rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Payment */}
              <div className={`p-4 rounded-lg border ${selectedOrder.payment_status === "paid" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <Banknote className="w-4 h-4" /> Payment
                  </h3>
                  <Badge className={selectedOrder.payment_status === "paid" ? "bg-green-100 text-green-800 border-0" : "bg-amber-100 text-amber-800 border-0"}>
                    {selectedOrder.payment_status === "paid" ? "Paid" : "Pending"}
                  </Badge>
                </div>

                {selectedOrder.cod_collected ? (
                  <p className="text-sm text-green-700 font-medium">
                    💵 Cash collected: ₹{selectedOrder.cod_amount ?? 0}
                    {selectedOrder.cod_collected_at && (
                      <span className="text-xs text-green-600 font-normal ml-1">· {fmtDate(selectedOrder.cod_collected_at)} {fmtTime(selectedOrder.cod_collected_at)}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">No cash collection recorded for this order.</p>
                )}

                {allPaymentSlips(selectedOrder).length > 0 ? (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {allPaymentSlips(selectedOrder).map((slip) => (
                      <a key={slip.file_id} href={slip.file_id} target="_blank" rel="noreferrer">
                        <img src={slip.file_id} alt="payment slip" className="w-16 h-16 object-cover rounded-lg border" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">No payment screenshot uploaded.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4" />{fmtDate(selectedOrder.created_at)}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{fmtTime(selectedOrder.created_at)}</div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
