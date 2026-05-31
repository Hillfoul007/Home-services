import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye, RefreshCw, Search, Package, User, Phone, Calendar, Clock, Store,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface StoreRecord {
  _id: string;
  store_id: string;
  store_code: string;
  store_name: string;
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminStoreOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterType, setFilterType] = useState<"all" | "store" | "assigned">("all");
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy });
      if (filterStatus) params.set("filterStatus", filterStatus);
      if (filterStore) params.set("storeId", filterStore);

      const res = await apiClient.adminRequest<any>(`/store/admin/orders?${params}`);
      if (res.data?.success) {
        setOrders(res.data.orders || []);
      }
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

  useEffect(() => {
    fetchOrders();
    fetchStores();
  }, [sortBy, filterStatus, filterStore]);

  const filtered = orders.filter((o) => {
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

  const handleStatusUpdate = async (orderId: string, status: string) => {
    setUpdatingStatus(true);
    try {
      const res = await apiClient.adminRequest<any>(`/store/admin/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
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

  const statsStoreOrders = orders.filter((o) => o.is_store_order).length;
  const statsAssigned = orders.filter((o) => !o.is_store_order).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Store Orders</h2>
          <p className="text-sm text-gray-500 mt-1">All orders created by stores or assigned to stores by admin</p>
        </div>
        <Button variant="outline" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-3xl font-bold">{orders.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">Store Created</p>
          <p className="text-3xl font-bold text-blue-600">{statsStoreOrders}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">Admin Assigned</p>
          <p className="text-3xl font-bold text-purple-600">{statsAssigned}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-3xl font-bold text-orange-600">
            {orders.filter((o) => !["completed", "cancelled", "delivered"].includes(o.status)).length}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by order ID, name, phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">All Types</option>
            <option value="store">Store Created</option>
            <option value="assigned">Admin Assigned</option>
          </select>

          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>{s.store_name} ({s.store_code})</option>
            ))}
          </select>

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

      {/* Orders table */}
      {loading ? (
        <Card className="p-12 text-center"><p className="text-gray-500">Loading orders...</p></Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No store orders found</p>
        </Card>
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Order ID", "Type", "Customer", "Phone", "Items", "Amount", "Status", "Date", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold text-blue-600">{order.custom_order_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      {order.is_store_order ? (
                        <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Store</Badge>
                      ) : (
                        <Badge className="bg-purple-100 text-purple-800 border-0 text-xs">Assigned</Badge>
                      )}
                      {order.store_code && (
                        <p className="text-xs text-gray-400 mt-0.5">{order.store_code}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm">{order.customer_name || order.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.customer_phone || order.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                      <p className="truncate">
                        {order.item_prices?.length > 0
                          ? order.item_prices.map((i) => `${i.service_name} ×${i.quantity}`).join(", ")
                          : (order.services || []).join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-bold text-sm">₹{order.final_amount || order.total_price}</td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                        disabled={updatingStatus}
                        className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
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
            {filtered.map((order) => (
              <Card key={order._id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-mono font-bold text-blue-600 text-sm">{order.custom_order_id}</p>
                    <div className="flex gap-1 mt-1">
                      {order.is_store_order ? (
                        <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Store</Badge>
                      ) : (
                        <Badge className="bg-purple-100 text-purple-800 border-0 text-xs">Assigned</Badge>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}>
                    {order.status}
                  </span>
                </div>
                <p className="font-medium text-sm">{order.customer_name || order.name}</p>
                <p className="text-sm text-gray-500">{order.customer_phone || order.phone}</p>
                <div className="flex justify-between items-center mt-3">
                  <span className="font-bold">₹{order.final_amount || order.total_price}</span>
                  <div className="flex gap-2">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                      className="text-xs border rounded px-2 py-1 focus:outline-none"
                    >
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>View</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        {selectedOrder && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-mono text-blue-600">{selectedOrder.custom_order_id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Type badge */}
              <div className="flex gap-2">
                {selectedOrder.is_store_order ? (
                  <Badge className="bg-blue-100 text-blue-800 border-0">Store Created Order</Badge>
                ) : (
                  <Badge className="bg-purple-100 text-purple-800 border-0">Admin Assigned Order</Badge>
                )}
                {selectedOrder.store_code && (
                  <Badge variant="outline">Store: {selectedOrder.store_code}</Badge>
                )}
              </div>

              {/* Customer */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">Customer</h3>
                <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" />{selectedOrder.customer_name || selectedOrder.name}</div>
                <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" />{selectedOrder.customer_phone || selectedOrder.phone}</div>
              </div>

              {/* Items */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Items</h3>
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

              {/* Amount & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500">Final Amount</p>
                  <p className="text-2xl font-bold text-blue-700">₹{selectedOrder.final_amount || selectedOrder.total_price}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">Update Status</p>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleStatusUpdate(selectedOrder._id, e.target.value)}
                    disabled={updatingStatus}
                    className="w-full border rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates */}
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
