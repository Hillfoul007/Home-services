import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, RefreshCw, Bike, Camera, Truck, PackageCheck,
  CheckCircle2, Clock, Phone, MapPin, Plus, KeyRound, AlertTriangle, Upload,
  CalendarClock, Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/config/env";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RiderRef {
  _id: string;
  name: string;
  phone: string;
  isActive?: boolean;
  status?: string;
}

interface FileRef {
  file_id: string;
  filename?: string;
  uploaded_at?: string;
}

interface ItemPrice {
  service_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface StatusHistoryEntry {
  status: string;
  changed_at: string;
  changed_by: string;
}

interface OnlineOrder {
  _id: string;
  custom_order_id?: string;
  name?: string;
  customer_name?: string;
  phone?: string;
  customer_phone?: string;
  address?: string;
  status: string;
  riderStatus?: string;
  item_prices?: ItemPrice[];
  total_price?: number;
  discount_amount?: number;
  final_amount?: number;
  scheduled_date?: string;
  scheduled_time?: string;
  delivery_date?: string;
  delivery_time?: string;
  cod_collected?: boolean;
  cod_amount?: number;
  cod_collected_at?: string | null;
  assignedRider?: RiderRef | string | null;
  pickupRider?: RiderRef | string | null;
  deliveryRider?: RiderRef | string | null;
  items_images?: FileRef[];
  items_video?: FileRef | null;
  vendor_payment_slips?: FileRef[];
  rider_pickup_slips?: FileRef[];
  created_at: string;
  updated_at?: string;
  readyAt?: string;
  deliveredAt?: string;
  _breach?: boolean;
  _timeElapsed?: string | null;
  status_history?: StatusHistoryEntry[];
}

type SectionKey = "created" | "picked_up" | "processing" | "ready_for_delivery" | "delivered" | "completed" | "cancelled";

interface Sections {
  created: OnlineOrder[];
  picked_up: OnlineOrder[];
  processing: OnlineOrder[];
  ready_for_delivery: OnlineOrder[];
  delivered: OnlineOrder[];
  completed: OnlineOrder[];
  cancelled: OnlineOrder[];
}

const EMPTY_SECTIONS: Sections = {
  created: [], picked_up: [], processing: [], ready_for_delivery: [], delivered: [], completed: [], cancelled: [],
};

const SECTION_CONFIG: {
  key: SectionKey; label: string; icon: string; color: string;
  gradient: string; ring: string; border: string; badge: string; dot: string; solid: string;
}[] = [
  { key: "created", label: "New / Pickup", icon: "📥", color: "bg-blue-100 text-blue-800 border-blue-300",
    gradient: "from-blue-500 to-blue-600", ring: "ring-blue-200", border: "border-l-blue-500", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", solid: "bg-blue-500" },
  { key: "picked_up", label: "Picked Up", icon: "🧺", color: "bg-indigo-100 text-indigo-800 border-indigo-300",
    gradient: "from-indigo-500 to-indigo-600", ring: "ring-indigo-200", border: "border-l-indigo-500", badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500", solid: "bg-indigo-500" },
  { key: "processing", label: "Processing", icon: "🧼", color: "bg-orange-100 text-orange-800 border-orange-300",
    gradient: "from-orange-500 to-amber-500", ring: "ring-orange-200", border: "border-l-orange-500", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500", solid: "bg-orange-500" },
  { key: "ready_for_delivery", label: "Ready", icon: "✅", color: "bg-teal-100 text-teal-800 border-teal-300",
    gradient: "from-teal-500 to-emerald-500", ring: "ring-teal-200", border: "border-l-teal-500", badge: "bg-teal-100 text-teal-700", dot: "bg-teal-500", solid: "bg-teal-500" },
  { key: "delivered", label: "Delivered", icon: "🚚", color: "bg-purple-100 text-purple-800 border-purple-300",
    gradient: "from-purple-500 to-fuchsia-500", ring: "ring-purple-200", border: "border-l-purple-500", badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500", solid: "bg-purple-500" },
  { key: "completed", label: "Completed", icon: "🏁", color: "bg-green-100 text-green-800 border-green-300",
    gradient: "from-green-500 to-emerald-600", ring: "ring-green-200", border: "border-l-green-500", badge: "bg-green-100 text-green-700", dot: "bg-green-500", solid: "bg-green-500" },
  { key: "cancelled", label: "Cancelled", icon: "🚫", color: "bg-red-100 text-red-800 border-red-300",
    gradient: "from-red-500 to-rose-600", ring: "ring-red-200", border: "border-l-red-500", badge: "bg-red-100 text-red-700", dot: "bg-red-500", solid: "bg-red-500" },
];

function sectionMeta(key: string) {
  return SECTION_CONFIG.find((s) => s.key === key) || SECTION_CONFIG[0];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

const AVATAR_PALETTE = [
  "from-blue-500 to-indigo-500", "from-emerald-500 to-teal-500", "from-orange-500 to-amber-500",
  "from-purple-500 to-fuchsia-500", "from-rose-500 to-pink-500", "from-cyan-500 to-sky-500",
];
function avatarGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function customerName(o: OnlineOrder) { return o.customer_name || o.name || "Customer"; }
function customerPhone(o: OnlineOrder) { return o.customer_phone || o.phone || ""; }
function riderName(r: RiderRef | string | null | undefined) {
  if (!r) return null;
  if (typeof r === "string") return null;
  return r.name;
}
function fmtTime(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
// scheduled_date/delivery_date are plain "YYYY-MM-DD" strings paired with a
// separate *_time string — format them together without going through Date
// parsing (which would misinterpret the bare date as midnight UTC).
function fmtDateTime(date?: string | null, time?: string | null) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  const dateLabel = isNaN(d.getTime()) ? date : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return time ? `${dateLabel}, ${time}` : dateLabel;
}

const API = () => `${getApiUrl()}/store/online-orders`;
const RIDERS_API = () => `${getApiUrl()}/store/riders`;

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}
function itemsImageUrl(orderId: string, fileId: string) {
  return `${API()}/public/orders/${orderId}/items-image/${encodeURIComponent(fileId)}`;
}
function itemsVideoUrl(orderId: string, fileId: string) {
  return `${API()}/public/orders/${orderId}/items-video/${encodeURIComponent(fileId)}`;
}
function paymentSlipUrl(orderId: string, fileId: string) {
  return `${API()}/public/orders/${orderId}/payment-slip/${encodeURIComponent(fileId)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StoreOnlineOrders() {
  const token = localStorage.getItem("store_token") || "";

  const [view, setView] = useState<"orders" | "riders">("orders");
  const [sections, setSections] = useState<Sections>(EMPTY_SECTIONS);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<SectionKey>("created");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [busy, setBusy] = useState(false);

  const [riders, setRiders] = useState<RiderRef[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [assignModal, setAssignModal] = useState<{ orderId: string; type: "pickup" | "delivery" } | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");

  const [createRiderOpen, setCreateRiderOpen] = useState(false);
  const [newRiderName, setNewRiderName] = useState("");
  const [newRiderPhone, setNewRiderPhone] = useState("");
  const [creatingRider, setCreatingRider] = useState(false);
  const [newRiderCreds, setNewRiderCreds] = useState<{ phone: string; password: string } | null>(null);
  const [linkedExistingRider, setLinkedExistingRider] = useState<{ name: string; phone: string } | null>(null);

  const [cartDraft, setCartDraft] = useState<ItemPrice[] | null>(null);
  const [codAmount, setCodAmount] = useState<number>(0);

  // Tracks every order id seen so far so we can tell a genuinely new online
  // order apart from one just moving between kanban sections. Null until the
  // first load completes, so we never "notify" about the store's existing
  // backlog on initial mount.
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  const notifyNewOrders = useCallback((newOrders: OnlineOrder[]) => {
    if (newOrders.length === 0) return;
    const title = newOrders.length === 1 ? "New online order" : `${newOrders.length} new online orders`;
    const body = newOrders.length === 1
      ? `${newOrders[0].custom_order_id || "Order"} — ${customerName(newOrders[0])} · ₹${newOrders[0].final_amount ?? newOrders[0].total_price ?? 0}`
      : newOrders.map(o => o.custom_order_id || o._id.slice(-6)).join(", ");
    toast.success(title, { description: body });
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(title, { body, tag: "laundrify-store-new-order" });
        n.onclick = () => { window.focus(); n.close(); };
      } catch {
        // Some embedded webviews restrict the Notification constructor — the toast above still covers it.
      }
    }
  }, []);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!token) return;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API()}/dashboard`, { headers: authHeaders(token) });
      const data = await res.json();
      if (data.success) {
        setSections(data.sections);
        setCounts(data.counts || {});

        const allOrders: OnlineOrder[] = [];
        const allIds = new Set<string>();
        Object.values(data.sections as Sections).forEach((list) => (list as OnlineOrder[]).forEach((o) => { allIds.add(o._id); allOrders.push(o); }));

        if (knownOrderIdsRef.current) {
          const freshlySeen = allOrders.filter((o) => !knownOrderIdsRef.current!.has(o._id));
          notifyNewOrders(freshlySeen);
        }
        knownOrderIdsRef.current = allIds;
      } else {
        toast.error(data.error || "Failed to load online orders");
      }
    } catch {
      toast.error("Error loading online orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, notifyNewOrders]);

  const fetchRiders = useCallback(async () => {
    if (!token) return;
    setLoadingRiders(true);
    try {
      const res = await fetch(`${RIDERS_API()}/`, { headers: authHeaders(token) });
      const data = await res.json();
      if (data.success) setRiders(data.riders || []);
    } catch {
      // silent — riders tab will just show empty state
    } finally {
      setLoadingRiders(false);
    }
  }, [token]);

  useEffect(() => { fetchDashboard(); fetchRiders(); }, [fetchDashboard, fetchRiders]);

  // Ask once for permission to show a phone/desktop notification when a new
  // online order comes in while this tab is open.
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Poll for new online orders so the board updates itself instead of
  // requiring a manual tap on Refresh.
  useEffect(() => {
    const id = setInterval(() => { fetchDashboard(true); }, 25000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  // Keep the open detail dialog's order data fresh after any mutation
  const refreshSelected = (updated: OnlineOrder) => {
    setSelectedOrder(updated);
    setCartDraft(updated.item_prices || null);
    setCodAmount(updated.cod_amount || updated.final_amount || updated.total_price || 0);
  };

  const openOrder = (order: OnlineOrder) => {
    setSelectedOrder(order);
    setCartDraft(order.item_prices || null);
    setCodAmount(order.cod_amount || order.final_amount || order.total_price || 0);
  };

  async function callAction(url: string, options: RequestInit, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...authHeaders(token), ...(options.headers || {}) },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Action failed");
        return null;
      }
      toast.success(successMsg);
      await fetchDashboard(true);
      return data;
    } catch {
      toast.error("Network error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const assignRider = async () => {
    if (!assignModal || !selectedRiderId) return;
    const data = await callAction(
      `${API()}/orders/${assignModal.orderId}/assign-rider`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ riderId: selectedRiderId, assignmentType: assignModal.type }) },
      `Rider assigned for ${assignModal.type}`
    );
    if (data?.order) refreshSelected(data.order);
    setAssignModal(null);
    setSelectedRiderId("");
  };

  const uploadFile = async (orderId: string, field: "items_image" | "items_video" | "payment_ss", file: File) => {
    const endpoint = field === "items_image" ? "upload-items-image" : field === "items_video" ? "upload-items-video" : "upload-payment-ss";
    const form = new FormData();
    form.append(field, file);
    setBusy(true);
    try {
      const res = await fetch(`${API()}/orders/${orderId}/${endpoint}`, {
        method: "POST",
        headers: authHeaders(token),
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Upload failed");
        return;
      }
      toast.success("Uploaded");
      // Refetch the single order to get the updated file arrays
      const detail = await fetch(`${API()}/orders/${orderId}`, { headers: authHeaders(token) }).then(r => r.json());
      if (detail.success) refreshSelected(detail.order);
      await fetchDashboard(true);
    } catch {
      toast.error("Upload error");
    } finally {
      setBusy(false);
    }
  };

  const markPickedUp = (orderId: string) =>
    callAction(`${API()}/orders/${orderId}/mark-picked-up`, { method: "POST" }, "Marked picked up").then(d => d?.order && refreshSelected(d.order));

  const markReady = (orderId: string) =>
    callAction(`${API()}/orders/${orderId}/mark-ready`, { method: "PUT" }, "Marked ready for delivery").then(d => d?.order && refreshSelected(d.order));

  const markInTransit = (orderId: string) =>
    callAction(`${API()}/orders/${orderId}/mark-in-transit`, { method: "POST" }, "Marked in transit").then(d => d?.order && refreshSelected(d.order));

  const markDelivered = (orderId: string) =>
    callAction(`${API()}/orders/${orderId}/mark-delivered`, { method: "POST" }, "Marked delivered").then(d => d?.order && refreshSelected(d.order));

  const markCompleted = (orderId: string) =>
    callAction(`${API()}/orders/${orderId}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) }, "Order completed").then(d => d?.order && refreshSelected(d.order));

  const markCodCollected = (orderId: string) =>
    callAction(
      `${API()}/orders/${orderId}/cod-collected`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: codAmount }) },
      "Cash marked as collected"
    ).then(d => d?.order && refreshSelected(d.order));

  const saveCart = (orderId: string) => {
    if (!cartDraft) return;
    return callAction(
      `${API()}/orders/${orderId}/save-cart`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_prices: cartDraft }) },
      "Cart saved — moved to Processing"
    ).then(d => d?.order && refreshSelected(d.order));
  };

  const updateCartLine = (idx: number, field: "quantity" | "unit_price", value: number) => {
    setCartDraft(prev => {
      if (!prev) return prev;
      const next = [...prev];
      const line = { ...next[idx], [field]: value };
      line.total_price = (line.quantity || 0) * (line.unit_price || 0);
      next[idx] = line;
      return next;
    });
  };

  const createRider = async () => {
    if (!newRiderName.trim() || !newRiderPhone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setCreatingRider(true);
    try {
      const res = await fetch(`${RIDERS_API()}/create`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRiderName.trim(), phone: newRiderPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to create rider");
        return;
      }
      if (data.linked_existing) {
        toast.success(data.message || `${data.rider.name} added to your rider list`);
        setLinkedExistingRider({ name: data.rider.name, phone: data.rider.phone });
        setNewRiderCreds(null);
      } else {
        toast.success(`Rider ${data.rider.name} created`);
        setNewRiderCreds(data.credentials);
        setLinkedExistingRider(null);
      }
      setNewRiderName("");
      setNewRiderPhone("");
      fetchRiders();
    } catch {
      toast.error("Error creating rider");
    } finally {
      setCreatingRider(false);
    }
  };

  const currentList = sections[activeSection] || [];

  const activeMeta = sectionMeta(activeSection);
  const totalOrders = Object.values(counts).reduce((sum, n) => sum + (n || 0), 0);

  return (
    <div className="space-y-5">
      {/* Sub-nav: Orders vs Riders, wrapped in a colorful header band */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-4 sm:p-5 shadow-lg shadow-indigo-200/50">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-6 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex gap-1.5 bg-white/15 backdrop-blur-sm p-1 rounded-xl">
              <button
                onClick={() => setView("orders")}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
                  view === "orders" ? "bg-white text-indigo-700 shadow-sm" : "text-white/80 hover:text-white"
                }`}
              >
                📦 Orders <Badge className="ml-0.5 bg-white/25 text-inherit border-0">{totalOrders}</Badge>
              </button>
              <button
                onClick={() => setView("riders")}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
                  view === "riders" ? "bg-white text-indigo-700 shadow-sm" : "text-white/80 hover:text-white"
                }`}
              >
                <Bike className="w-4 h-4" /> Riders <Badge className="ml-0.5 bg-white/25 text-inherit border-0">{riders.length}</Badge>
              </button>
            </div>
          </div>
          <div className="text-white/90 hidden sm:block text-sm font-medium">
            {view === "orders" ? "Live order board — updates automatically" : "Manage your delivery fleet"}
          </div>
          <Button
            size="sm"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {view === "orders" ? (
        <>
          {/* Kanban section tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {SECTION_CONFIG.map(({ key, label, icon, gradient }) => {
              const isActive = activeSection === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`flex flex-shrink-0 items-center gap-2 px-3.5 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${gradient} text-white font-semibold shadow-md scale-[1.03]`
                      : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span>{label}</span>
                  <Badge
                    variant="secondary"
                    className={`ml-0.5 ${isActive ? "bg-white/25 text-white border-0" : "bg-gray-100 text-gray-600"}`}
                  >
                    {counts[key] ?? 0}
                  </Badge>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : currentList.length === 0 ? (
            <Card className={`p-10 text-center border-2 border-dashed ${activeMeta.ring} bg-gradient-to-br from-white to-gray-50`}>
              <div className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center text-2xl bg-gradient-to-br ${activeMeta.gradient} text-white shadow-md`}>
                {activeMeta.icon}
              </div>
              <p className="text-gray-500 font-medium">No orders in "{activeMeta.label}"</p>
              <p className="text-gray-400 text-xs mt-1">New orders will appear here automatically</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentList.map(order => {
                const meta = sectionMeta(activeSection);
                const cName = customerName(order);
                return (
                  <Card
                    key={order._id}
                    className={`relative overflow-hidden p-4 pl-4 cursor-pointer border-l-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 ${
                      order._breach ? "border-l-red-500 bg-red-50/40" : meta.border
                    }`}
                    onClick={() => openOrder(order)}
                  >
                    <div className="flex justify-between items-start mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br ${avatarGradient(cName)} text-white text-xs font-bold flex items-center justify-center shadow-sm`}>
                          {initials(cName)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono font-semibold text-xs text-gray-800 block truncate">{order.custom_order_id || order._id.slice(-6)}</span>
                          <span className="text-sm font-medium text-gray-900 truncate block">{cName}</span>
                        </div>
                      </div>
                      {order._breach ? (
                        <Badge className="bg-red-100 text-red-700 border border-red-300 flex items-center gap-1 flex-shrink-0">
                          <AlertTriangle className="w-3 h-3" /> SLA
                        </Badge>
                      ) : (
                        <Badge className={`${meta.badge} border-0 flex-shrink-0`}>{meta.icon}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{customerPhone(order)}</div>
                    {order.address && <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3 text-gray-400" /><span className="truncate">{order.address}</span></div>}
                    {(order.scheduled_date || order.delivery_date) && (
                      <div className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                        {order.scheduled_date && <div className="flex items-center gap-1"><CalendarClock className="w-3 h-3 text-gray-400" /> Pickup: {fmtDateTime(order.scheduled_date, order.scheduled_time)}</div>}
                        {order.delivery_date && <div className="flex items-center gap-1"><CalendarClock className="w-3 h-3 text-gray-400" /> Delivery: {fmtDateTime(order.delivery_date, order.delivery_time)}</div>}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
                      <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">₹{order.final_amount ?? order.total_price ?? 0}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{order._timeElapsed || fmtTime(order.created_at)}</span>
                    </div>
                    {(riderName(order.pickupRider) || riderName(order.deliveryRider) || riderName(order.assignedRider)) && (
                      <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-2 py-1 flex items-center gap-1 w-fit">
                        <Bike className="w-3 h-3" /> {riderName(order.deliveryRider) || riderName(order.pickupRider) || riderName(order.assignedRider)}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <RidersPanel
          riders={riders}
          loading={loadingRiders}
          onAdd={() => { setNewRiderCreds(null); setLinkedExistingRider(null); setCreateRiderOpen(true); }}
        />
      )}

      {/* ── Order detail dialog ── */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-w-xl p-0 overflow-y-auto rounded-2xl">
          {selectedOrder && (() => {
            const meta = sectionMeta(
              selectedOrder.status === "completed" ? "completed"
              : selectedOrder.status === "cancelled" ? "cancelled"
              : selectedOrder.status === "delivered" ? "delivered"
              : ["ready_for_delivery", "delivery_assigned", "in_transit"].includes(selectedOrder.status) ? "ready_for_delivery"
              : selectedOrder.status === "in_progress" ? "processing"
              : selectedOrder.status === "picked_up" ? "picked_up"
              : "created"
            );
            const cName = customerName(selectedOrder);
            return (
            <>
              <div className={`relative overflow-hidden rounded-t-2xl bg-gradient-to-br ${meta.gradient} p-4 sm:p-5`}>
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <span className="font-mono">{selectedOrder.custom_order_id || selectedOrder._id.slice(-6)}</span>
                    <Badge className="bg-white/20 text-white border-0">{meta.icon} {selectedOrder.status.replace(/_/g, " ")}</Badge>
                  </DialogTitle>
                </DialogHeader>
                <div className="relative flex items-center gap-2.5 mt-2">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(cName)} text-white text-xs font-bold flex items-center justify-center ring-2 ring-white/40`}>
                    {initials(cName)}
                  </div>
                  <div className="text-white/95 text-sm leading-tight">
                    <div className="font-semibold">{cName}</div>
                    <div className="text-white/75 text-xs">{customerPhone(selectedOrder)}</div>
                  </div>
                  <div className="ml-auto text-right text-white">
                    <div className="text-xs text-white/75">Total</div>
                    <div className="text-lg font-bold">₹{selectedOrder.final_amount ?? selectedOrder.total_price ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-sm p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {selectedOrder.address && <div className="col-span-2 flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" /><span className="text-gray-500">Address:</span> {selectedOrder.address}</div>}
                  {selectedOrder.scheduled_date && <div className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-blue-500" /><span className="text-gray-500">Pickup:</span> {fmtDateTime(selectedOrder.scheduled_date, selectedOrder.scheduled_time)}</div>}
                  {selectedOrder.delivery_date && <div className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-purple-500" /><span className="text-gray-500">Delivery:</span> {fmtDateTime(selectedOrder.delivery_date, selectedOrder.delivery_time)}</div>}
                </div>

                {/* Cash on delivery */}
                <div className={`p-3 rounded-xl border ${selectedOrder.cod_collected ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                  {selectedOrder.cod_collected ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                      <Banknote className="w-4 h-4" />
                      Cash collected: ₹{selectedOrder.cod_amount ?? 0}
                      {selectedOrder.cod_collected_at && <span className="text-xs text-green-600 font-normal">· {fmtTime(selectedOrder.cod_collected_at)}</span>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-amber-800 uppercase flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5" /> Cash on Delivery
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="number" inputMode="decimal" className="h-9 flex-1"
                          value={codAmount}
                          onChange={(e) => setCodAmount(Number(e.target.value) || 0)}
                        />
                        <Button size="sm" disabled={busy} onClick={() => markCodCollected(selectedOrder._id)}>
                          Mark Collected
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cart */}
                {cartDraft && cartDraft.length > 0 && (
                  <div className="border rounded-md p-3 space-y-2">
                    <div className="font-medium text-xs text-gray-500 uppercase">Items</div>
                    {cartDraft.map((line, idx) => {
                      const editable = selectedOrder.status === "picked_up" || ["created", "vendor_assigned", "pickup_assigned", "pickup_completed", "in_progress"].includes(selectedOrder.status);
                      return (
                        <div key={idx} className="bg-gray-50 rounded-lg border p-2 space-y-2">
                          <div className="text-sm font-medium truncate">{line.service_name}</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] text-gray-400 mb-0.5">Qty</label>
                              <Input
                                type="number" inputMode="decimal" className="h-9 text-center text-sm"
                                value={line.quantity}
                                disabled={!editable}
                                onChange={(e) => updateCartLine(idx, "quantity", Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-400 mb-0.5">Rate ₹</label>
                              <Input
                                type="number" inputMode="decimal" className="h-9 text-center text-sm"
                                value={line.unit_price}
                                disabled={!editable}
                                onChange={(e) => updateCartLine(idx, "unit_price", Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-400 mb-0.5">Total</label>
                              <div className="h-9 flex items-center justify-center bg-blue-50 border border-blue-200 rounded text-sm font-semibold text-blue-700">
                                ₹{line.total_price}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {["pickup_assigned", "pickup_completed", "in_progress", "created", "vendor_assigned"].includes(selectedOrder.status) && (
                      <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => saveCart(selectedOrder._id)}>
                        Save Cart & Move to Processing
                      </Button>
                    )}
                  </div>
                )}

                {/* Proof media */}
                <div className="grid grid-cols-3 gap-2">
                  {(selectedOrder.items_images || []).map(img => (
                    <a key={img.file_id} href={itemsImageUrl(selectedOrder._id, img.file_id)} target="_blank" rel="noreferrer">
                      <img src={itemsImageUrl(selectedOrder._id, img.file_id)} className="rounded border h-16 w-full object-cover" alt="item" />
                    </a>
                  ))}
                  {selectedOrder.items_video && (
                    <video src={itemsVideoUrl(selectedOrder._id, selectedOrder.items_video.file_id)} className="rounded border h-16 w-full object-cover" controls />
                  )}
                  {(selectedOrder.vendor_payment_slips || []).map(s => (
                    <a key={s.file_id} href={paymentSlipUrl(selectedOrder._id, s.file_id)} target="_blank" rel="noreferrer">
                      <img src={paymentSlipUrl(selectedOrder._id, s.file_id)} className="rounded border h-16 w-full object-cover" alt="payment slip" />
                    </a>
                  ))}
                </div>

                {/* Upload controls — camera capture and choose-from-device side by side */}
                <div className="space-y-2">
                  <CaptureOrChoosePair
                    mediaLabel="Item Photo" accept="image/*" disabled={busy}
                    onFile={(f) => uploadFile(selectedOrder._id, "items_image", f)}
                    cameraLabel="Take Photo" chooseLabel="Choose Photo"
                  />
                  <CaptureOrChoosePair
                    mediaLabel="Item Video" accept="video/*" disabled={busy}
                    onFile={(f) => uploadFile(selectedOrder._id, "items_video", f)}
                    cameraLabel="Record Video" chooseLabel="Choose Video"
                  />
                  <CaptureOrChoosePair
                    mediaLabel="Payment Slip" accept="image/*" disabled={busy}
                    onFile={(f) => uploadFile(selectedOrder._id, "payment_ss", f)}
                    cameraLabel="Take Photo" chooseLabel="Choose Slip"
                  />
                </div>

                {/* Section actions — full-width stacked buttons on mobile, wrap into a row from sm up */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2 border-t">
                  {["created", "vendor_assigned", "pickup_assigned"].includes(selectedOrder.status) && (
                    <>
                      <Button size="sm" className="sm:w-auto" disabled={busy} onClick={() => setAssignModal({ orderId: selectedOrder._id, type: "pickup" })}>
                        <Bike className="w-4 h-4 mr-1" /> Assign Pickup Rider
                      </Button>
                      <Button size="sm" variant="secondary" className="sm:w-auto" disabled={busy || !selectedOrder.items_images?.length} onClick={() => markPickedUp(selectedOrder._id)}>
                        <PackageCheck className="w-4 h-4 mr-1" /> Mark Picked Up (staff)
                      </Button>
                    </>
                  )}
                  {selectedOrder.status === "in_progress" && (
                    <Button size="sm" className="sm:w-auto" disabled={busy} onClick={() => markReady(selectedOrder._id)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Ready for Delivery
                    </Button>
                  )}
                  {["ready_for_delivery", "delivery_assigned"].includes(selectedOrder.status) && (
                    <>
                      <Button size="sm" className="sm:w-auto" disabled={busy} onClick={() => setAssignModal({ orderId: selectedOrder._id, type: "delivery" })}>
                        <Bike className="w-4 h-4 mr-1" /> Assign Delivery Rider
                      </Button>
                      <Button size="sm" variant="secondary" className="sm:w-auto" disabled={busy} onClick={() => markInTransit(selectedOrder._id)}>
                        <Truck className="w-4 h-4 mr-1" /> Mark In Transit (staff)
                      </Button>
                      <Button size="sm" variant="secondary" className="sm:w-auto" disabled={busy} onClick={() => markDelivered(selectedOrder._id)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Delivered (staff)
                      </Button>
                    </>
                  )}
                  {selectedOrder.status === "in_transit" && (
                    <Button size="sm" className="sm:w-auto" disabled={busy} onClick={() => markDelivered(selectedOrder._id)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Delivered
                    </Button>
                  )}
                  {selectedOrder.status === "delivered" && (
                    <Button size="sm" className="sm:w-auto" disabled={busy} onClick={() => markCompleted(selectedOrder._id)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Completed
                    </Button>
                  )}
                </div>

                {/* Status history */}
                {selectedOrder.status_history && selectedOrder.status_history.length > 0 && (
                  <div className="pt-2 border-t text-xs text-gray-500 space-y-1">
                    {selectedOrder.status_history.slice().reverse().map((h, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{h.status} <span className="text-gray-400">({h.changed_by})</span></span>
                        <span>{fmtTime(h.changed_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Assign rider dialog ── */}
      <Dialog open={!!assignModal} onOpenChange={(open) => { if (!open) setAssignModal(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign {assignModal?.type} rider</DialogTitle></DialogHeader>
          {riders.length === 0 ? (
            <p className="text-sm text-gray-500">No riders yet — add one from the Riders tab first.</p>
          ) : (
            <Select value={selectedRiderId} onValueChange={setSelectedRiderId}>
              <SelectTrigger><SelectValue placeholder="Select a rider" /></SelectTrigger>
              <SelectContent>
                {riders.map(r => <SelectItem key={r._id} value={r._id}>{r.name} — {r.phone}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModal(null)}>Cancel</Button>
            <Button disabled={!selectedRiderId || busy} onClick={assignRider}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create rider dialog ── */}
      <Dialog open={createRiderOpen} onOpenChange={(open) => { setCreateRiderOpen(open); if (!open) { setNewRiderCreds(null); setLinkedExistingRider(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Rider</DialogTitle></DialogHeader>
          {newRiderCreds ? (
            <div className="space-y-2 text-sm">
              <p className="text-green-700 flex items-center gap-1"><KeyRound className="w-4 h-4" /> Save these credentials — shown only once.</p>
              <div className="bg-gray-50 border rounded p-3">
                <div>Phone: <span className="font-mono">{newRiderCreds.phone}</span></div>
                <div>Password: <span className="font-mono">{newRiderCreds.password}</span></div>
              </div>
              <Button className="w-full" onClick={() => setCreateRiderOpen(false)}>Done</Button>
            </div>
          ) : linkedExistingRider ? (
            <div className="space-y-2 text-sm">
              <p className="text-green-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {linkedExistingRider.name} already has a Laundrify rider account.</p>
              <div className="bg-gray-50 border rounded p-3 text-gray-600">
                Added to your rider list — they keep logging in with their existing phone number and password: <span className="font-mono">{linkedExistingRider.phone}</span>
              </div>
              <Button className="w-full" onClick={() => setCreateRiderOpen(false)}>Done</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input placeholder="Rider name" value={newRiderName} onChange={(e) => setNewRiderName(e.target.value)} />
              <Input placeholder="Phone number" value={newRiderPhone} onChange={(e) => setNewRiderPhone(e.target.value)} />
              <p className="text-xs text-gray-500">If this phone is already registered (e.g. by admin), we'll just add that rider to your list instead of creating a duplicate.</p>
              <Button className="w-full" disabled={creatingRider} onClick={createRider}>
                {creatingRider ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Rider"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadButton({ icon, label, onFile, accept, disabled, capture, className }: { icon: React.ReactNode; label: string; onFile: (f: File) => void; accept: string; disabled?: boolean; capture?: "environment"; className?: string }) {
  return (
    <label className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer hover:bg-gray-50 ${disabled ? "opacity-50 pointer-events-none" : ""} ${className || ""}`}>
      {icon}{label}
      <input
        type="file" accept={accept} capture={capture} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </label>
  );
}

// A camera-capture button paired with a choose-from-device button, sharing the
// same upload target. Mirrors the Camera/Gallery pattern already used in
// RiderDeskDashboard.tsx so the two apps feel consistent.
function CaptureOrChoosePair({ mediaLabel, accept, disabled, onFile, cameraLabel = "Take Photo", chooseLabel = "Choose File" }: {
  mediaLabel: string; accept: string; disabled?: boolean; onFile: (f: File) => void; cameraLabel?: string; chooseLabel?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{mediaLabel}</p>
      <div className="flex gap-2">
        <UploadButton className="flex-1" icon={<Camera className="w-4 h-4" />} label={cameraLabel} capture="environment" disabled={disabled} onFile={onFile} accept={accept} />
        <UploadButton className="flex-1" icon={<Upload className="w-4 h-4" />} label={chooseLabel} disabled={disabled} onFile={onFile} accept={accept} />
      </div>
    </div>
  );
}

function RidersPanel({ riders, loading, onAdd }: { riders: RiderRef[]; loading: boolean; onAdd: () => void }) {
  const activeCount = riders.filter(r => r.isActive !== false).length;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-800">Your Riders</h3>
          <p className="text-xs text-gray-500">{activeCount} active · {riders.length} total</p>
        </div>
        <Button size="sm" onClick={onAdd} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
          <Plus className="w-4 h-4 mr-1" /> Add Rider
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : riders.length === 0 ? (
        <Card className="p-8 text-center border-2 border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-md">
            <Bike className="w-6 h-6" />
          </div>
          <p className="text-gray-600 font-medium text-sm">No riders yet</p>
          <p className="text-gray-400 text-xs mt-1">Add one to assign pickups & deliveries</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {riders.map(r => {
            const active = r.isActive !== false;
            return (
              <Card key={r._id} className={`p-3 flex items-center gap-3 border-l-4 ${active ? "border-l-emerald-500" : "border-l-gray-300"} hover:shadow-md transition-shadow`}>
                <div className={`w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br ${avatarGradient(r.name)} text-white text-xs font-bold flex items-center justify-center shadow-sm`}>
                  {initials(r.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-gray-800 truncate">{r.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</div>
                </div>
                <Badge className={active ? "bg-emerald-100 text-emerald-700 border-0 flex items-center gap-1" : "bg-gray-100 text-gray-500 border-0"}>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {active ? "Active" : "Inactive"}
                </Badge>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
