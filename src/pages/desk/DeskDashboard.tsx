import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// ─── Config ───────────────────────────────────────────────────────────────────

const API = "/api/vendor";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorInfo {
  _id: string;
  vendor_id: string;
  name: string;
  phone?: string;
  address?: string;
  google_maps_link?: string;
}

interface RiderRef {
  _id: string;
  name: string;
  phone: string;
  live_location_link?: string;
  location?: { lat: number; lng: number };
  lastLocationUpdate?: string;
  isActive?: boolean;
}

interface Order {
  _id: string;
  custom_order_id?: string;
  name?: string;
  phone?: string;
  address?: string;
  mapsLink?: string;
  status?: string;
  riderStatus?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  delivery_date?: string;
  final_amount?: number;
  total_price?: number;
  item_prices?: { service_name: string; quantity: number; unit_price: number; total_price: number }[];
  items_images?: { file_id: string; filename: string }[];
  vendor_payment_slips?: { file_id: string; filename: string }[];
  isPGOrder?: boolean;
  pg_name?: string;
  no_of_items?: number;
  assignedRider?: RiderRef | string | null;
  assignedRiderPhone?: string;
  readyAt?: string;
  created_at?: string;
  _breach?: boolean;
  _timeElapsed?: string;
}

interface Metrics {
  total_orders: number;
  delivered: number;
  cancelled: number;
  on_time_pct: number;
  late_orders: number;
  breach_orders: number;
  avg_delivery_hrs: number;
  active_riders: number;
}

interface DashboardSections {
  ready_for_dispatch: Order[];
  in_process: Order[];
  in_transit: Order[];
  delivered: Order[];
  cancelled: Order[];
}

interface DashboardCounts {
  ready_for_dispatch: number;
  in_process: number;
  in_transit: number;
  delivered: number;
  cancelled: number;
  total: number;
  breach: number;
}

// ─── Status labels / colours ──────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  vendor_assigned: "Assigned",
  pickup_completed: "Picked Up",
  in_progress: "Processing",
  ready_for_delivery: "Ready",
  delivery_assigned: "Assigned (Delivery)",
  in_transit: "In Transit",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  vendor_assigned: "bg-yellow-100 text-yellow-800",
  pickup_completed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  ready_for_delivery: "bg-green-100 text-green-800",
  delivery_assigned: "bg-indigo-100 text-indigo-800",
  in_transit: "bg-orange-100 text-orange-800",
  delivered: "bg-teal-100 text-teal-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
};

function statusBadge(status?: string) {
  const s = status || "vendor_assigned";
  const cls = STATUS_COLORS[s] || "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {STATUS_LABELS[s] || s}
    </span>
  );
}

type SectionKey = "ready_for_dispatch" | "in_process" | "in_transit" | "delivered" | "cancelled";

const SECTION_CONFIG: { key: SectionKey; label: string; icon: string; color: string }[] = [
  { key: "ready_for_dispatch", label: "Ready", icon: "📦", color: "text-green-600" },
  { key: "in_process",         label: "In Process", icon: "⚙️", color: "text-purple-600" },
  { key: "in_transit",         label: "In Transit", icon: "🛵", color: "text-orange-600" },
  { key: "delivered",          label: "Delivered", icon: "✅", color: "text-teal-600" },
  { key: "cancelled",          label: "Cancelled", icon: "❌", color: "text-red-500" },
];

// ─── Main component ───────────────────────────────────────────────────────────

const DeskDashboard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("desk_vendor_token") || "";
  const vendorInfo: VendorInfo | null = (() => {
    try { return JSON.parse(localStorage.getItem("desk_vendor_info") || "null"); } catch { return null; }
  })();

  // Tabs
  const [tab, setTab] = useState<"orders" | "riders" | "profile">("orders");

  // Dashboard data
  const [sections, setSections] = useState<DashboardSections>({
    ready_for_dispatch: [], in_process: [], in_transit: [], delivered: [], cancelled: [],
  });
  const [counts, setCounts] = useState<DashboardCounts>({
    ready_for_dispatch: 0, in_process: 0, in_transit: 0, delivered: 0, cancelled: 0, total: 0, breach: 0,
  });
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsPeriod, setMetricsPeriod] = useState<"today" | "7d" | "30d">("7d");

  // Section view
  const [activeSection, setActiveSection] = useState<SectionKey>("in_process");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Legacy all-orders for riders tab usage
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<RiderRef[]>([]);
  const [availableRiders, setAvailableRiders] = useState<RiderRef[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Assignment modal
  const [assignModal, setAssignModal] = useState<{ orderId: string; orderLabel: string } | null>(null);
  const [assigningRiderId, setAssigningRiderId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  // Rider management
  const [riderForm, setRiderForm] = useState({ name: "", phone: "", live_location_link: "" });
  const [riderLoading, setRiderLoading] = useState(false);
  const [newCreds, setNewCreds] = useState<{ phone: string; password: string } | null>(null);

  const prevOrderIds = useRef<Set<string>>(new Set());

  // ── auth guard ──
  useEffect(() => {
    if (!token) navigate("/desk");
  }, [token, navigate]);

  // ── fetch dashboard ──
  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const [dashRes, metricsRes] = await Promise.all([
        fetch(`${API}/orders/dashboard`, { headers: authHeaders(token) }),
        fetch(`${API}/orders/metrics?period=${metricsPeriod}`, { headers: authHeaders(token) }),
      ]);

      if (dashRes.status === 401) { navigate("/desk"); return; }

      const dashData = await dashRes.json();
      if (dashData.success) {
        setSections(dashData.sections);
        setCounts(dashData.counts);

        // Collect all order ids to detect new arrivals
        const allIds = Object.values(dashData.sections as DashboardSections)
          .flat()
          .map((o: Order) => o._id);

        const incoming = allIds.filter(id => !prevOrderIds.current.has(id));
        if (prevOrderIds.current.size > 0 && incoming.length > 0) {
          toast.info(`${incoming.length} new order${incoming.length > 1 ? "s" : ""} arrived!`);
        }
        prevOrderIds.current = new Set(allIds);
      }

      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        if (mData.success) setMetrics(mData.metrics);
      }
    } catch { /* silent */ }
  }, [token, navigate, metricsPeriod]);

  // ── fetch riders ──
  const fetchRiders = useCallback(async () => {
    if (!token) return;
    try {
      const [ridersRes, availRes] = await Promise.all([
        fetch(`${API}/riders`, { headers: authHeaders(token) }),
        fetch(`${API}/orders/available-riders`, { headers: authHeaders(token) }),
      ]);
      const ridersData = await ridersRes.json();
      if (ridersData.success) setRiders(ridersData.riders || []);

      if (availRes.ok) {
        const availData = await availRes.json();
        if (availData.success) setAvailableRiders(availData.riders || []);
      }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchDashboard();
    fetchRiders();
    const id = setInterval(fetchDashboard, 15000);
    return () => clearInterval(id);
  }, [fetchDashboard, fetchRiders]);

  useEffect(() => {
    if (tab === "riders") fetchRiders();
  }, [tab, fetchRiders]);

  useEffect(() => {
    fetchDashboard();
  }, [metricsPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── current section orders ──
  const sectionOrders = sections[activeSection] || [];

  // ── update order status (simple) ──
  const updateStatus = async (orderId: string, status: string, isPG = false) => {
    setLoading(true);
    try {
      let url: string;
      let method = "PUT";
      if (isPG) {
        url = `/api/pg-orders/${orderId}/status`;
        method = "PATCH";
      } else {
        url = `${API}/orders/orders/${orderId}/status`;
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ status, changed_by: "vendor" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to update"); return; }
      toast.success("Status updated");
      fetchDashboard();
    } catch { toast.error("Network error"); }
    finally { setLoading(false); }
  };

  // ── mark ready for delivery ──
  const markReady = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders/orders/${orderId}/mark-ready`, {
        method: "PUT",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success("Order marked Ready for Delivery");
      fetchDashboard();
    } catch { toast.error("Network error"); }
    finally { setLoading(false); }
  };

  // ── assign rider ──
  const openAssignModal = (orderId: string, orderLabel: string) => {
    setAssignModal({ orderId, orderLabel });
    setAssigningRiderId("");
  };

  const submitAssignRider = async () => {
    if (!assignModal || !assigningRiderId) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`${API}/orders/orders/${assignModal.orderId}/assign-rider`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ riderId: assigningRiderId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to assign rider"); return; }
      toast.success("Rider assigned successfully");
      setAssignModal(null);
      fetchDashboard();
    } catch { toast.error("Network error"); }
    finally { setAssignLoading(false); }
  };

  // ── upload order SS ──
  const uploadItemsImage = async (orderId: string, file: File) => {
    setUploading(u => ({ ...u, [orderId + "_items"]: true }));
    try {
      const formData = new FormData();
      formData.append("items_image", file);
      const res = await fetch(`${API}/orders/orders/${orderId}/upload-items-image`, {
        method: "POST",
        headers: authHeaders(token),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Upload failed"); return; }
      toast.success("Order SS uploaded");
      await updateStatus(orderId, "pickup_completed");
    } catch { toast.error("Upload error"); }
    finally { setUploading(u => ({ ...u, [orderId + "_items"]: false })); }
  };

  // ── upload payment SS ──
  const uploadPaymentSS = async (orderId: string, file: File) => {
    setUploading(u => ({ ...u, [orderId + "_pay"]: true }));
    try {
      const formData = new FormData();
      formData.append("payment_ss", file);
      const res = await fetch(`${API}/orders/orders/${orderId}/upload-payment-ss`, {
        method: "POST",
        headers: authHeaders(token),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Upload failed"); return; }
      toast.success("Payment SS uploaded");
      fetchDashboard();
    } catch { toast.error("Upload error"); }
    finally { setUploading(u => ({ ...u, [orderId + "_pay"]: false })); }
  };

  // ── rider management ──
  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderForm.name || !riderForm.phone) { toast.error("Name and phone are required"); return; }
    setRiderLoading(true);
    try {
      const res = await fetch(`${API}/riders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(riderForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success(`Rider "${data.rider.name}" created!`);
      setNewCreds(data.credentials);
      setRiderForm({ name: "", phone: "", live_location_link: "" });
      fetchRiders();
    } catch { toast.error("Network error"); }
    finally { setRiderLoading(false); }
  };

  const resetPassword = async (riderId: string) => {
    try {
      const res = await fetch(`${API}/riders/${riderId}/reset-password`, {
        method: "PATCH",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      setNewCreds(data.credentials);
      toast.success("Password reset! Save credentials.");
    } catch { toast.error("Network error"); }
  };

  const logout = () => {
    localStorage.removeItem("desk_vendor_token");
    localStorage.removeItem("desk_vendor_info");
    navigate("/desk");
  };

  // ── helpers ──
  const getRiderName = (order: Order) => {
    if (!order.assignedRider) return null;
    if (typeof order.assignedRider === "object" && order.assignedRider.name) {
      return order.assignedRider.name;
    }
    return order.assignedRiderPhone || null;
  };

  const getRiderLocation = (order: Order): RiderRef | null => {
    if (order.assignedRider && typeof order.assignedRider === "object") {
      return order.assignedRider as RiderRef;
    }
    return null;
  };

  function timeSince(dateStr?: string) {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // ─── Render: order card ───────────────────────────────────────────────────

  const renderOrderCard = (order: Order) => {
    const expanded = expandedId === order._id;
    const hasItemsImg = (order.items_images?.length ?? 0) > 0;
    const hasPaySS = (order.vendor_payment_slips?.length ?? 0) > 0;
    const riderName = getRiderName(order);
    const riderLocation = getRiderLocation(order);
    const isBreach = order._breach;
    const orderLabel = order.custom_order_id || order._id.slice(-6).toUpperCase();
    const isInProcess = activeSection === "in_process";
    const isReady = activeSection === "ready_for_dispatch";
    const isInTransit = activeSection === "in_transit";

    return (
      <div key={order._id}
        className={`bg-white rounded-xl border shadow-sm mb-3 overflow-hidden ${isBreach ? "border-red-200" : "border-gray-100"}`}>
        {/* ── header ── */}
        <button
          className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
          onClick={() => setExpandedId(expanded ? null : order._id)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{orderLabel}</span>
              {order.isPGOrder && (
                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">PG</span>
              )}
              {statusBadge(order.status)}
              {isBreach && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">BREACH</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-gray-500 truncate">
                {order.isPGOrder ? order.pg_name : order.name}
                {" · "}
                {order.isPGOrder
                  ? `${order.no_of_items} items`
                  : `₹${(order.final_amount ?? order.total_price ?? 0).toLocaleString()}`}
              </p>
              {order._timeElapsed && (
                <span className="text-xs text-gray-400">{order._timeElapsed}</span>
              )}
              {riderName && (
                <span className="text-xs text-indigo-600 font-medium">🛵 {riderName}</span>
              )}
            </div>
          </div>
          <span className="text-gray-400 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
        </button>

        {/* ── expanded ── */}
        {expanded && (
          <div className="border-t border-gray-50 px-4 py-3 space-y-3">
            {/* customer info */}
            {!order.isPGOrder && (
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">👤</span>
                  <span className="font-medium">{order.name}</span>
                </div>
                {order.phone && (
                  <a href={`tel:${order.phone}`} className="flex items-center gap-2 text-blue-600">
                    <span>📞</span><span>{order.phone}</span>
                  </a>
                )}
                {order.address && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">📍</span>
                    <span className="text-gray-700 text-xs">{order.address}</span>
                  </div>
                )}
                {order.mapsLink && (
                  <a href={order.mapsLink} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 underline">
                    Open in Maps
                  </a>
                )}
              </div>
            )}

            {/* timing info */}
            {(order.scheduled_date || order.delivery_date) && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs space-y-1">
                {order.scheduled_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pickup</span>
                    <span className="font-medium">{order.scheduled_date}</span>
                  </div>
                )}
                {order.delivery_date && (
                  <div className="flex justify-between">
                    <span className={`${isBreach ? "text-red-500 font-semibold" : "text-gray-500"}`}>
                      {isBreach ? "⚠ Delivery (OVERDUE)" : "Delivery"}
                    </span>
                    <span className={`font-medium ${isBreach ? "text-red-600" : ""}`}>{order.delivery_date}</span>
                  </div>
                )}
                {order.readyAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ready at</span>
                    <span className="font-medium">{timeSince(order.readyAt)}</span>
                  </div>
                )}
              </div>
            )}

            {/* rider tracking (in-transit) */}
            {isInTransit && riderLocation?.live_location_link && (
              <a
                href={riderLocation.live_location_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 w-full py-2 px-3 bg-orange-50 border border-orange-200 rounded-xl text-sm font-medium text-orange-700"
              >
                <span>📡</span>
                <span>Track Rider Live</span>
                {riderLocation.lastLocationUpdate && (
                  <span className="text-xs text-orange-500 ml-auto">
                    Updated {timeSince(riderLocation.lastLocationUpdate)}
                  </span>
                )}
              </a>
            )}

            {/* items */}
            {order.item_prices && order.item_prices.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Cart Items</p>
                <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                  {order.item_prices.map((item, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5 text-xs">
                      <span className="text-gray-700">{item.service_name} × {item.quantity}</span>
                      <span className="font-medium">₹{item.total_price}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 text-xs font-bold bg-gray-100 rounded-b-lg">
                    <span>Total</span>
                    <span>₹{(order.final_amount ?? order.total_price ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* actions */}
            <div className="space-y-2">
              {/* Assign Rider button (in_process and ready_for_dispatch sections) */}
              {(isInProcess || isReady) && !order.isPGOrder && (
                <button
                  onClick={() => openAssignModal(order._id, orderLabel)}
                  className={`w-full py-2 rounded-xl text-sm font-medium border ${riderName
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-dashed border-blue-300 bg-blue-50 text-blue-700"
                    }`}
                >
                  {riderName ? `🛵 Reassign (${riderName})` : "🛵 Assign Rider"}
                </button>
              )}

              {/* Upload order SS + mark pickup */}
              {order.status === "vendor_assigned" && (
                <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-medium cursor-pointer border-2 border-dashed ${hasItemsImg ? "border-green-400 bg-green-50 text-green-700" : "border-blue-300 bg-blue-50 text-blue-700"}`}>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadItemsImage(order._id, f); e.target.value = ""; }}
                    disabled={uploading[order._id + "_items"]}
                  />
                  {uploading[order._id + "_items"] ? "Uploading..." : hasItemsImg ? "✓ Order SS (tap to replace)" : "📷 Upload Order SS & Mark Picked Up"}
                </label>
              )}

              {/* Mark ready for delivery */}
              {["in_progress", "pickup_completed"].includes(order.status || "") && (
                <button
                  onClick={() => markReady(order._id)}
                  disabled={loading}
                  className="w-full py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium"
                >
                  Mark Ready for Delivery
                </button>
              )}

              {/* Upload payment SS */}
              {["delivered", "ready_for_delivery", "completed"].includes(order.status || "") && !order.isPGOrder && (
                <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-medium cursor-pointer border-2 border-dashed ${hasPaySS ? "border-green-400 bg-green-50 text-green-700" : "border-purple-300 bg-purple-50 text-purple-700"}`}>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPaymentSS(order._id, f); e.target.value = ""; }}
                    disabled={uploading[order._id + "_pay"]}
                  />
                  {uploading[order._id + "_pay"] ? "Uploading..." : hasPaySS ? "✓ Payment SS (tap to replace)" : "💳 Upload Payment SS"}
                </label>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── top bar ── */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-gray-900 text-base">{vendorInfo?.name || "Vendor Desk"}</h1>
          <p className="text-xs text-gray-400">{vendorInfo?.vendor_id}</p>
        </div>
        <button onClick={logout} className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5">
          Logout
        </button>
      </header>

      {/* ── tab bar ── */}
      <nav className="bg-white border-b border-gray-100 flex">
        {(["orders", "riders", "profile"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
          >
            {t === "orders" ? `Orders (${counts.total})` : t}
          </button>
        ))}
      </nav>

      <main className="p-4 max-w-2xl mx-auto">

        {/* ══ ORDERS TAB ══ */}
        {tab === "orders" && (
          <>
            {/* ── metrics bar ── */}
            {metrics && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Performance</p>
                  <div className="flex gap-1">
                    {(["today", "7d", "30d"] as const).map(p => (
                      <button key={p}
                        onClick={() => setMetricsPeriod(p)}
                        className={`text-xs px-2 py-0.5 rounded-full ${metricsPeriod === p ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricCard label="Total Orders" value={metrics.total_orders} color="blue" />
                  <MetricCard label="On-Time %" value={`${metrics.on_time_pct}%`}
                    color={metrics.on_time_pct >= 80 ? "green" : metrics.on_time_pct >= 60 ? "yellow" : "red"} />
                  <MetricCard label="Breach Orders" value={counts.breach} color={counts.breach > 0 ? "red" : "green"} />
                  <MetricCard label="Avg Delivery" value={`${metrics.avg_delivery_hrs}h`} color="purple" />
                </div>
              </div>
            )}

            {/* ── section tabs ── */}
            <div className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-hide">
              {SECTION_CONFIG.map(({ key, label, icon, color }) => {
                const count = counts[key] || 0;
                const isActive = activeSection === key;
                const hasBreach = key === "ready_for_dispatch" && counts.breach > 0;

                return (
                  <button
                    key={key}
                    onClick={() => { setActiveSection(key); setExpandedId(null); }}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${isActive
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <span>{icon}</span>
                    <span className={isActive ? "text-white" : color}>{label}</span>
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0 rounded-full font-bold ${isActive ? "bg-white text-blue-600" : "bg-gray-100 text-gray-700"}`}>
                        {count}
                      </span>
                    )}
                    {hasBreach && !isActive && (
                      <span className="text-xs bg-red-500 text-white px-1 rounded-full">!</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── section header context ── */}
            <div className="mb-3">
              {activeSection === "ready_for_dispatch" && counts.breach > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-700 font-medium mb-2">
                  ⚠ {counts.breach} order{counts.breach > 1 ? "s" : ""} past delivery deadline
                </div>
              )}
              {activeSection === "in_transit" && sectionOrders.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-xs text-orange-700 font-medium mb-2">
                  🛵 {sectionOrders.length} order{sectionOrders.length > 1 ? "s" : ""} currently in transit
                </div>
              )}
            </div>

            {/* ── orders list ── */}
            {sectionOrders.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">
                  {SECTION_CONFIG.find(s => s.key === activeSection)?.icon || "📦"}
                </div>
                <p className="font-medium">No orders in this section</p>
                <p className="text-sm mt-1">
                  {activeSection === "in_process" && "Orders assigned to you will appear here"}
                  {activeSection === "ready_for_dispatch" && "Mark orders ready to see them here"}
                  {activeSection === "in_transit" && "Orders picked up by rider will appear here"}
                  {activeSection === "delivered" && "Completed deliveries will appear here"}
                  {activeSection === "cancelled" && "Cancelled orders will appear here"}
                </p>
              </div>
            ) : (
              sectionOrders.map(renderOrderCard)
            )}
          </>
        )}

        {/* ══ RIDERS TAB ══ */}
        {tab === "riders" && (
          <div className="space-y-5">
            {/* credentials popup */}
            {newCreds && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-green-800 text-sm">Rider Credentials (save now!)</p>
                  <button onClick={() => setNewCreds(null)} className="text-green-600 text-lg leading-none">&times;</button>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-mono font-bold">{newCreds.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Password:</span>
                    <span className="font-mono font-bold text-green-700">{newCreds.password}</span>
                  </div>
                </div>
                <p className="text-xs text-green-700 mt-2">This password is shown once. Share with your rider.</p>
              </div>
            )}

            {/* create rider form */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-3">Create New Rider</h2>
              <form onSubmit={handleCreateRider} className="space-y-3">
                <input type="text" placeholder="Rider Name *" value={riderForm.name}
                  onChange={e => setRiderForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <input type="tel" placeholder="Phone Number *" value={riderForm.phone}
                  onChange={e => setRiderForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <input type="url" placeholder="Live GPS Location Link (optional)" value={riderForm.live_location_link}
                  onChange={e => setRiderForm(f => ({ ...f, live_location_link: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="submit" disabled={riderLoading || !riderForm.name || !riderForm.phone}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold text-sm">
                  {riderLoading ? "Creating..." : "Create Rider & Get Credentials"}
                </button>
              </form>
            </div>

            {/* riders list */}
            {riders.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <h2 className="font-semibold text-gray-800 px-4 pt-4 pb-2">Your Riders ({riders.length})</h2>
                <div className="divide-y divide-gray-50">
                  {riders.map((r) => (
                    <div key={r._id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{r.name}</p>
                        <a href={`tel:${r.phone}`} className="text-xs text-blue-600">{r.phone}</a>
                        {r.live_location_link && (
                          <a href={r.live_location_link} target="_blank" rel="noreferrer"
                            className="block text-xs text-indigo-500 underline mt-0.5">Live Location</a>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {r.isActive ? "Active" : "Offline"}
                        </span>
                        <button onClick={() => resetPassword(r._id)} className="text-xs text-orange-600 underline">
                          Reset Password
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PROFILE TAB ══ */}
        {tab === "profile" && vendorInfo && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Vendor Profile</h2>
            <div className="space-y-3 text-sm">
              <Row label="Name" value={vendorInfo.name} />
              <Row label="Vendor ID" value={vendorInfo.vendor_id} mono />
              {vendorInfo.phone && <Row label="Phone" value={vendorInfo.phone} />}
              {vendorInfo.address && <Row label="Address" value={vendorInfo.address} />}
              {vendorInfo.google_maps_link && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-500 shrink-0">Maps</span>
                  <a href={vendorInfo.google_maps_link} target="_blank" rel="noreferrer"
                    className="text-blue-600 underline text-right">Open Location</a>
                </div>
              )}
            </div>
            <button onClick={logout}
              className="w-full mt-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50">
              Sign Out
            </button>
          </div>
        )}
      </main>

      {/* ── Rider Assignment Modal ── */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Assign Rider</h3>
              <button onClick={() => setAssignModal(null)} className="text-gray-400 text-2xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Order: <span className="font-semibold text-gray-800">{assignModal.orderLabel}</span></p>

            {availableRiders.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <p className="text-2xl mb-2">🛵</p>
                <p className="text-sm">No approved riders available</p>
                <p className="text-xs mt-1">Create riders in the Riders tab</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {availableRiders.map(r => (
                  <button
                    key={r._id}
                    onClick={() => setAssigningRiderId(r._id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${assigningRiderId === r._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.isActive ? "Active" : "Offline"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={submitAssignRider}
              disabled={!assigningRiderId || assignLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold text-sm"
            >
              {assignLoading ? "Assigning..." : "Assign Rider"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string | number; color: "blue" | "green" | "red" | "yellow" | "purple" }) {
  const colorMap = {
    blue:   "bg-blue-50 border-blue-100 text-blue-700",
    green:  "bg-green-50 border-green-100 text-green-700",
    red:    "bg-red-50 border-red-100 text-red-700",
    yellow: "bg-yellow-50 border-yellow-100 text-yellow-700",
    purple: "bg-purple-50 border-purple-100 text-purple-700",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${colorMap[color]}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-xs mt-1 opacity-80">{label}</p>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-900 text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default DeskDashboard;
