import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getApiUrl } from "@/config/env";
import { showLocalNotification } from "@/utils/nativeNotification";
import { getRiderApiUrl } from "@/lib/riderApi";
import { io, Socket } from "socket.io-client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function timeSince(dateStr?: string | null) {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ${mins % 60}m ago` : `${Math.floor(hrs / 24)}d ago`;
}

// ─── Status display ───────────────────────────────────────────────────────────

const RIDER_STATUS_LABELS: Record<string, string> = {
  assigned:   "Assigned",
  accepted:   "Ready",
  in_transit: "In Transit",
  picked_up:  "Picked Up",
  delivered:  "Delivered",
  completed:  "Completed",
};

const RIDER_STATUS_COLORS: Record<string, string> = {
  assigned:   "bg-yellow-100 text-yellow-800",
  accepted:   "bg-blue-100 text-blue-800",
  in_transit: "bg-orange-100 text-orange-800",
  picked_up:  "bg-purple-100 text-purple-800",
  delivered:  "bg-green-100 text-green-800",
  completed:  "bg-gray-100 text-gray-600",
};


// ─── Types ────────────────────────────────────────────────────────────────────

interface RiderInfo {
  _id: string;
  name: string;
  phone: string;
  live_location_link?: string;
}

interface AssignedOrder {
  _id: string;
  custom_order_id?: string;
  name?: string;
  phone?: string;
  address?: string;
  mapsLink?: string;
  status?: string;
  riderStatus?: string;
  final_amount?: number;
  total_price?: number;
  scheduled_date?: string;
  delivery_date?: string;
  item_prices?: { service_name: string; quantity: number; unit_price: number; total_price: number }[];
  rider_pickup_slips?: { file_id: string; filename?: string }[];
  rider_payment_slips?: { file_id: string; filename?: string }[];
  items_images?: { file_id: string; filename?: string }[];
  vendor_payment_slips?: { file_id: string; filename?: string }[];
  cod_collected?: boolean;
  cod_amount?: number;
  assignedAt?: string;
  acceptedAt?: string;
  pickedUpAt?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RiderDeskDashboard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("rider_desk_token") || "";
  const riderInfo: RiderInfo | null = (() => {
    try { return JSON.parse(localStorage.getItem("rider_desk_info") || "null"); } catch { return null; }
  })();

  const [activeOrders, setActiveOrders] = useState<AssignedOrder[]>([]);
  const [doneOrders, setDoneOrders] = useState<AssignedOrder[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [codModal, setCodModal] = useState<string | null>(null);
  const [codAmount, setCodAmount] = useState("");
  // item photos staged per order before upload
  const [stagedItemPhotos, setStagedItemPhotos] = useState<Record<string, { preview: string; file: File }[]>>({});
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"requesting" | "active" | "denied" | "unavailable">("requesting");
  const prevIds = useRef<Set<string>>(new Set());
  const watchIdRef = useRef<number | null>(null);
  const currentLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const activeOrdersRef = useRef<AssignedOrder[]>([]);  // always up-to-date for status calc

  // keep activeOrdersRef in sync with state
  useEffect(() => { activeOrdersRef.current = activeOrders; }, [activeOrders]);
  // keep currentLocationRef in sync
  useEffect(() => { currentLocationRef.current = currentLocation; }, [currentLocation]);

  // ── Socket.io refs ─────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const socketAuthRef = useRef<boolean>(false);
  const lastSocketSentRef = useRef<number>(0);
  const lastSentLocRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastHttpSentRef = useRef<number>(0);
  const offlineQueueRef = useRef<{ lat: number; lng: number; status: string; order_id: string | null; ts: string }[]>([]);

  /** Haversine distance in metres */
  const distMetres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000;
    const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  /** Derive real rider status from active orders */
  const getRiderStatus = (): { status: string; order_id: string | null } => {
    const orders = activeOrdersRef.current;
    const inTransit = orders.find(o => o.status === "in_transit" || o.riderStatus === "in_transit");
    if (inTransit) return { status: "delivering", order_id: inTransit._id };
    const assigned = orders.find(o => ["pickup_assigned", "delivery_assigned", "assigned"].includes(o.status || ""));
    if (assigned) return { status: "assigned", order_id: assigned._id };
    return { status: "idle", order_id: null };
  };

  // ── Connect Socket.io on mount ──────────────────────────────────────────────
  useEffect(() => {
    const t = localStorage.getItem("rider_desk_token");
    const info = localStorage.getItem("rider_desk_info");
    if (!t || !info) return;

    const rider = JSON.parse(info);
    const apiUrl = getApiUrl();
    const socketUrl = apiUrl.startsWith("http")
      ? apiUrl.replace(/\/api$/, "")
      : window.location.origin;

    const socket = io(`${socketUrl}/rider`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
      socket.emit("rider:connect", { rider_id: rider._id, token: t });
    });

    socket.on("rider:connected", () => {
      socketAuthRef.current = true;
      setSocketConnected(true);
      // Flush offline queue with real status
      offlineQueueRef.current.forEach(({ lat, lng, status, order_id, ts }) => {
        socket.emit("rider:location", { rider_id: rider._id, lat, lng, status, order_id, timestamp: ts });
      });
      offlineQueueRef.current = [];
      // Send current status to desk immediately
      const { status, order_id } = getRiderStatus();
      socket.emit("rider:status", { rider_id: rider._id, status, order_id });
    });

    socket.on("disconnect", () => { socketAuthRef.current = false; setSocketConnected(false); });

    socketRef.current = socket;
    return () => { socket.disconnect(); socketRef.current = null; socketAuthRef.current = false; setSocketConnected(false); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Emit a status-only update (called after order actions) */
  const emitStatusUpdate = (status: string, order_id: string | null) => {
    const info = localStorage.getItem("rider_desk_info");
    if (!info || !socketRef.current?.connected || !socketAuthRef.current) return;
    const rider = JSON.parse(info);
    socketRef.current.emit("rider:status", { rider_id: rider._id, status, order_id });
  };

  // ── GPS watch + send via socket (2.5 s, 10 m filter) ───────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    const sendLocation = async (loc: { lat: number; lng: number }, force = false) => {
      const now = Date.now();
      const info = localStorage.getItem("rider_desk_info");
      if (!info) return;
      const rider = JSON.parse(info);
      const { status, order_id } = getRiderStatus();

      // ── Socket path (2.5 s throttle + 10 m movement filter) ──
      if (socketRef.current?.connected && socketAuthRef.current) {
        if (!force && now - lastSocketSentRef.current < 2500) return;
        if (!force && lastSentLocRef.current && distMetres(lastSentLocRef.current, loc) < 10) return;

        lastSocketSentRef.current = now;
        lastSentLocRef.current = loc;
        socketRef.current.emit("rider:location", {
          rider_id: rider._id,
          lat: loc.lat,
          lng: loc.lng,
          status,
          order_id,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // ── HTTP fallback (15 s throttle) ──
      if (!navigator.onLine) {
        if (offlineQueueRef.current.length < 20)
          offlineQueueRef.current.push({ ...loc, status, order_id, ts: new Date().toISOString() });
        return;
      }
      if (!force && now - lastHttpSentRef.current < 15000) return;
      lastHttpSentRef.current = now;
      lastSentLocRef.current = loc;

      try {
        const t = localStorage.getItem("rider_desk_token");
        if (!t) return;
        const apiUrl = getRiderApiUrl("/location");
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ riderId: rider._id, location: loc, timestamp: new Date().toISOString() }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
      } catch { /* silent */ }
    };

    // Request permission explicitly first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        setLocationStatus("active");
        sendLocation(loc, true);
      },
      (err) => {
        setLocationStatus(err.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        setLocationStatus("active");
        sendLocation(loc);
      },
      (err) => {
        if (err.code === 1) setLocationStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    watchIdRef.current = wid;

    // Periodic force-push every 8 s even when not moving
    const interval = setInterval(() => {
      const loc = currentLocationRef.current;
      if (loc) sendLocation(loc, true);
    }, 8000);

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) navigate("/rider-desk");
  }, [token, navigate]);

  // ── fetch orders via desk-orders endpoint ──
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/riders/desk-orders`, { headers: authHeaders(token) });
      if (res.status === 401) { navigate("/rider-desk"); return; }
      const data = await res.json();

      if (data.success) {
        const active: AssignedOrder[] = data.active || [];
        const done: AssignedOrder[] = data.done || [];

        const incoming = active.filter(o => !prevIds.current.has(o._id));
        if (prevIds.current.size > 0 && incoming.length > 0) {
          toast.info(`🆕 ${incoming.length} new order${incoming.length > 1 ? "s" : ""} assigned!`, { duration: 6000 });
          // Play notification sound
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
          } catch { /* audio not supported */ }
          try {
            showLocalNotification(
              `🆕 ${incoming.length} new order${incoming.length > 1 ? "s" : ""} assigned!`,
              incoming.map(o => o.custom_order_id || o._id.slice(-6).toUpperCase()).join(', ')
            );
          } catch { /* silent */ }
        }
        prevIds.current = new Set(active.map(o => o._id));
        setActiveOrders(active);
        setDoneOrders(done);
      }
    } catch { /* silent */ }
  }, [token, navigate]);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 10000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // Register FCM push token for desk so new-order push notifications are delivered
  useEffect(() => {
    if (!riderInfo?._id) return;
    import('@/services/MobilePushService').then((mod) => {
      mod.MobilePushService.getInstance().initialize(undefined, { riderId: riderInfo._id });
    }).catch(() => {});
  }, [riderInfo?._id]);

  // ── navigation helpers ──
  const openMapsToAddress = (address: string, mapsLink?: string) => {
    if (mapsLink) { window.open(mapsLink, "_blank"); return; }
    const dest = encodeURIComponent(address);
    const origin = currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : "";
    const url = origin
      ? `https://www.google.com/maps/dir/${origin}/${dest}`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    window.open(url, "_blank");
  };

  const openOptimizedRoute = (orders: AssignedOrder[]) => {
    const valid = orders.filter(o => o.address);
    if (valid.length < 2) { toast.error("Need at least 2 orders with addresses"); return; }
    const origin = currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : "";
    const waypoints = valid.slice(0, -1).map(o => encodeURIComponent(o.address!)).join("|");
    const destination = encodeURIComponent(valid[valid.length - 1].address!);
    const url = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ""}&destination=${destination}&travelmode=driving${waypoints ? `&waypoints=${waypoints}` : ""}`;
    window.open(url, "_blank");
    toast.success("Optimized route opened");
  };

  // ── order action (start / complete only — no accept/reject) ──
  const doAction = async (orderId: string, action: "start" | "complete") => {
    setActionLoading(a => ({ ...a, [orderId]: true }));
    try {
      const res = await fetch(`${getApiUrl()}/riders/order-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ orderId, action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed"); return; }
      const labels: Record<string, string> = {
        start: "Marked as picked up",
        complete: "Marked as delivered",
      };
      toast.success(labels[action] || "Updated");
      // After starting (picked up), open maps and emit "delivering" status
      if (action === "start") {
        emitStatusUpdate("delivering", orderId);
        const order = activeOrders.find(o => o._id === orderId);
        if (order?.address) setTimeout(() => openMapsToAddress(order.address!, order.mapsLink), 500);
      }
      // After complete (delivered), recalculate status
      if (action === "complete") {
        const remaining = activeOrders.filter(o => o._id !== orderId);
        const hasMore = remaining.length > 0;
        emitStatusUpdate(hasMore ? "assigned" : "idle", hasMore ? remaining[0]._id : null);
      }
      fetchOrders();
    } catch { toast.error("Network error"); }
    finally { setActionLoading(a => ({ ...a, [orderId]: false })); }
  };

  // ── mark in-transit ──
  const markInTransit = async (orderId: string) => {
    setActionLoading(a => ({ ...a, [orderId + "_transit"]: true }));
    try {
      const res = await fetch(`${getApiUrl()}/riders/orders/${orderId}/in-transit`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed"); return; }
      toast.success("Marked In Transit — opening maps");
      emitStatusUpdate("delivering", orderId);
      const order = activeOrders.find(o => o._id === orderId);
      if (order?.address) setTimeout(() => openMapsToAddress(order.address!, order.mapsLink), 600);
      fetchOrders();
    } catch { toast.error("Network error"); }
    finally { setActionLoading(a => ({ ...a, [orderId + "_transit"]: false })); }
  };

  // ── submit COD collection ──
  const submitCOD = async (orderId: string) => {
    const amount = parseFloat(codAmount);
    if (!codAmount || isNaN(amount)) { toast.error("Enter a valid amount"); return; }

    setActionLoading(a => ({ ...a, [orderId + "_cod"]: true }));
    try {
      const res = await fetch(`${getApiUrl()}/riders/orders/${orderId}/cod-collected`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed"); return; }
      toast.success(`COD ₹${amount} collected!`);
      setCodModal(null);
      setCodAmount("");
      fetchOrders();
    } catch { toast.error("Network error"); }
    finally { setActionLoading(a => ({ ...a, [orderId + "_cod"]: false })); }
  };

  // ── Generic base64 upload helper ──
  const uploadBase64 = async (orderId: string, file: File, endpoint: string, uploadKey: string) => {
    setUploading(u => ({ ...u, [uploadKey]: true }));
    return new Promise<{ file_id: string } | null>((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders(token) },
            body: JSON.stringify({ image_base64: base64 }),
          });
          const data = await res.json();
          if (!res.ok) { toast.error(data.message || "Upload failed"); resolve(null); return; }
          resolve(data);
        } catch { toast.error("Upload error"); resolve(null); }
        finally { setUploading(u => ({ ...u, [uploadKey]: false })); }
      };
      reader.onerror = () => { toast.error("Failed to read file"); setUploading(u => ({ ...u, [uploadKey]: false })); resolve(null); };
    });
  };

  // ── Stage item photos (shown inline, uploaded in batch) ──
  const stageItemPhoto = (orderId: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setStagedItemPhotos(p => ({ ...p, [orderId]: [...(p[orderId] || []), { preview, file }] }));
  };

  const removeStagedPhoto = (orderId: string, idx: number) => {
    setStagedItemPhotos(p => {
      const copy = [...(p[orderId] || [])];
      URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return { ...p, [orderId]: copy };
    });
  };

  // ── Upload all staged item photos ──
  const uploadItemPhotos = async (orderId: string) => {
    const photos = stagedItemPhotos[orderId] || [];
    if (photos.length === 0) return true; // none staged = OK (optional)
    setUploading(u => ({ ...u, [orderId + "_items"]: true }));
    let allOk = true;
    for (const { file } of photos) {
      const result = await uploadBase64(
        orderId, file,
        `${getApiUrl()}/riders/orders/${orderId}/upload-item-photo`,
        orderId + "_item_single"
      );
      if (!result) { allOk = false; }
    }
    setUploading(u => ({ ...u, [orderId + "_items"]: false }));
    if (allOk) setStagedItemPhotos(p => { const n = { ...p }; delete n[orderId]; return n; });
    return allOk;
  };

  // ── Upload pickup slip (mandatory) ──
  const uploadPickupSlip = async (orderId: string, file: File) => {
    const result = await uploadBase64(
      orderId, file,
      `${getApiUrl()}/riders/orders/${orderId}/upload-pickup-slip`,
      orderId + "_slip"
    );
    if (result) { toast.success("Slip uploaded!"); fetchOrders(); }
  };

  // ── Mark pickup complete (slip must exist) ──
  const markPickupComplete = async (orderId: string) => {
    const order = activeOrders.find(o => o._id === orderId);
    if (!order) return;

    // Upload staged item photos first (optional — don't block if 0)
    const itemsOk = await uploadItemPhotos(orderId);
    if (!itemsOk) { toast.error("Some item photos failed. Retry or skip."); return; }

    if (!(order.rider_pickup_slips?.length)) {
      toast.error("Please upload the pickup slip first");
      return;
    }
    await doAction(orderId, "start");
    emitStatusUpdate("assigned", orderId);
  };

  // ── Upload payment photo ──
  const uploadPaymentPhoto = async (orderId: string, file: File) => {
    const result = await uploadBase64(
      orderId, file,
      `${getApiUrl()}/riders/orders/${orderId}/upload-payment-ss`,
      orderId + "_payment"
    );
    if (result) { toast.success("Payment photo uploaded!"); fetchOrders(); }
  };

  // ── Mark delivered ──
  const markDelivered = async (orderId: string) => {
    const order = activeOrders.find(o => o._id === orderId);
    if (!order) return;
    if (!(order.rider_payment_slips?.length)) {
      toast.error("Please upload the payment photo first");
      return;
    }
    await doAction(orderId, "complete");
    const remaining = activeOrders.filter(o => o._id !== orderId);
    emitStatusUpdate(remaining.length > 0 ? "assigned" : "idle", remaining[0]?._id || null);
  };

  // ── Factory navigation ──
  const FACTORY_LAT = 28.4486339;
  const FACTORY_LNG = 77.0438923;
  const goToFactory = () => {
    const origin = currentLocation
      ? `&origin=${currentLocation.lat},${currentLocation.lng}`
      : "";
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${FACTORY_LAT},${FACTORY_LNG}&travelmode=driving`;
    window.open(url, "_blank");
  };

  const logout = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    localStorage.removeItem("rider_desk_token");
    localStorage.removeItem("rider_desk_info");
    navigate("/rider-desk");
  };

  // ─── Render order card ─────────────────────────────────────────────────────

  const renderOrder = (order: AssignedOrder, isDone = false) => {
    const expanded = expandedId === order._id;
    const rs = order.riderStatus || "assigned";
    const hasPickupSlip = (order.rider_pickup_slips?.length ?? 0) > 0;
    const hasPaymentSS = (order.rider_payment_slips?.length ?? 0) > 0;
    const hasItemsImg = (order.items_images?.length ?? 0) > 0;
    const hasVendorSlip = (order.vendor_payment_slips?.length ?? 0) > 0;
    const amount = (order.final_amount ?? order.total_price ?? 0);
    const isPickupOrder = order.status === "pickup_assigned";
    const isDeliveryOrder = ["delivery_assigned", "in_transit"].includes(order.status || "");
    const staged = stagedItemPhotos[order._id] || [];
    const slipUploading = uploading[order._id + "_slip"];
    const paymentUploading = uploading[order._id + "_payment"];
    const itemsUploading = uploading[order._id + "_items"];
    const completeBusy = actionLoading[order._id];
    const imgUrl = (fileId: string) => `${getApiUrl()}/riders/public/orders/${order._id}/slip/${fileId}`;

    return (
      <div key={order._id} className="bg-white rounded-xl border border-gray-100 shadow-sm mb-3 overflow-hidden">

        {/* ── Header ── */}
        <button className="w-full text-left px-4 py-3 flex items-center justify-between"
          onClick={() => setExpandedId(expanded ? null : order._id)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{order.custom_order_id || order._id.slice(-6).toUpperCase()}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RIDER_STATUS_COLORS[rs] || "bg-gray-100 text-gray-600"}`}>
                {RIDER_STATUS_LABELS[rs] || rs}
              </span>
              {isPickupOrder && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">🧺 Pickup</span>}
              {isDeliveryOrder && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">🚚 Delivery</span>}
              {order.cod_collected && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">COD ✓</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{order.name} · ₹{amount.toLocaleString()}</p>
          </div>
          <span className="text-gray-400 text-xs ml-2">{expanded ? "▲" : "▼"}</span>
        </button>

        {/* ── Quick Navigate (always visible for active) ── */}
        {!isDone && order.address && (
          <div className="px-4 pb-3">
            <button onClick={() => openMapsToAddress(order.address!, order.mapsLink)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
              🗺️ Navigate to Customer
            </button>
          </div>
        )}

        {expanded && (
          <div className="border-t border-gray-50 px-4 py-3 space-y-4">

            {/* Customer info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm"><span className="text-gray-400">👤</span><span className="font-medium">{order.name}</span></div>
              {order.phone && (
                <a href={`tel:${order.phone}`} className="flex items-center gap-2 text-blue-600 text-sm">
                  <span>📞</span><span className="font-semibold">{order.phone}</span>
                </a>
              )}
              {order.address && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-gray-400 mt-0.5">📍</span>
                  <span className="text-gray-700 text-xs leading-relaxed">{order.address}</span>
                </div>
              )}
            </div>

            {/* Cart summary */}
            {order.item_prices && order.item_prices.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Items</p>
                <div className="bg-gray-50 rounded-lg divide-y divide-gray-100 text-xs">
                  {order.item_prices.map((item, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5">
                      <span>{item.service_name} × {item.quantity}</span>
                      <span className="font-medium">₹{item.total_price}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 font-bold bg-gray-100 rounded-b-lg">
                    <span>Total</span><span>₹{amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ════════ PICKUP TASK ════════ */}
            {!isDone && isPickupOrder && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-semibold">
                  🧺 Pickup Task — follow steps below
                </div>

                {/* STEP 1 – Item photos (optional, any number) */}
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 space-y-2">
                  <p className="text-xs font-bold text-gray-700">
                    📷 Step 1 — Item Photos <span className="text-gray-400 font-normal">(optional, any number)</span>
                  </p>

                  {/* Staged previews */}
                  {staged.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {staged.map((p, idx) => (
                        <div key={idx} className="relative">
                          <img src={p.preview} alt="item" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                          <button
                            onClick={() => removeStagedPhoto(order._id, idx)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Already uploaded */}
                  {hasItemsImg && (
                    <div className="flex gap-2 flex-wrap">
                      {(order.items_images || []).map(img => (
                        <a key={img.file_id} href={imgUrl(img.file_id)} target="_blank" rel="noreferrer">
                          <img src={imgUrl(img.file_id)} alt="uploaded"
                            className="w-16 h-16 object-cover rounded-lg border border-green-200 ring-1 ring-green-400" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 text-xs font-semibold cursor-pointer">
                      <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                        onChange={e => { Array.from(e.target.files || []).forEach(f => stageItemPhoto(order._id, f)); e.target.value = ""; }} />
                      📸 Camera
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold cursor-pointer">
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={e => { Array.from(e.target.files || []).forEach(f => stageItemPhoto(order._id, f)); e.target.value = ""; }} />
                      🖼️ Gallery
                    </label>
                  </div>

                  {staged.length > 0 && (
                    <p className="text-[11px] text-purple-600">{staged.length} photo{staged.length > 1 ? "s" : ""} staged — will be uploaded when you mark pickup complete</p>
                  )}
                </div>

                {/* STEP 2 – Pickup slip (mandatory) */}
                <div className="rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-3 space-y-2">
                  <p className="text-xs font-bold text-purple-800">
                    🧾 Step 2 — Upload Pickup Slip <span className="text-red-500">*required</span>
                  </p>
                  {hasPickupSlip && (
                    <div className="flex gap-2 flex-wrap">
                      {(order.rider_pickup_slips || []).map(s => (
                        <a key={s.file_id} href={imgUrl(s.file_id)} target="_blank" rel="noreferrer">
                          <img src={imgUrl(s.file_id)} alt="slip"
                            className="w-16 h-16 object-cover rounded-lg border border-green-300 ring-2 ring-green-400" />
                        </a>
                      ))}
                      <span className="self-center text-xs text-green-700 font-semibold">✓ Uploaded</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg border-2 text-xs font-semibold cursor-pointer ${hasPickupSlip ? "border-green-400 bg-green-50 text-green-700" : "border-purple-400 bg-white text-purple-700"}`}>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPickupSlip(order._id, f); e.target.value = ""; }}
                        disabled={slipUploading} />
                      {slipUploading ? "Uploading…" : hasPickupSlip ? "📸 Re-take Slip" : "📸 Take Slip Photo"}
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold cursor-pointer">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPickupSlip(order._id, f); e.target.value = ""; }}
                        disabled={slipUploading} />
                      🖼️ Gallery
                    </label>
                  </div>
                </div>

                {/* STEP 3 – Mark pickup complete */}
                <button
                  onClick={() => markPickupComplete(order._id)}
                  disabled={!hasPickupSlip || completeBusy || itemsUploading}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                >
                  {completeBusy || itemsUploading
                    ? "Processing…"
                    : hasPickupSlip
                    ? "✅ Mark Pickup Complete"
                    : "⬆️ Upload slip to continue"}
                </button>
              </div>
            )}

            {/* ════════ DELIVERY TASK ════════ */}
            {!isDone && isDeliveryOrder && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 text-orange-700 text-sm font-semibold">
                  🚚 Delivery Task — follow steps below
                </div>

                {/* COD collection */}
                {!order.cod_collected ? (
                  <button
                    onClick={() => { setCodModal(order._id); setCodAmount(String(amount)); }}
                    className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-xl text-sm"
                  >
                    💰 Collect Payment (₹{amount.toLocaleString()})
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                    ✓ <span className="font-medium">Payment Collected: ₹{(order.cod_amount || amount).toLocaleString()}</span>
                  </div>
                )}

                {/* Payment photo (mandatory) */}
                <div className="rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 p-3 space-y-2">
                  <p className="text-xs font-bold text-orange-800">
                    💳 Upload Payment Photo <span className="text-red-500">*required</span>
                  </p>
                  {hasPaymentSS && (
                    <div className="flex gap-2 flex-wrap">
                      {[...(order.rider_payment_slips || []), ...(order.vendor_payment_slips || [])].map(s => (
                        <a key={s.file_id} href={imgUrl(s.file_id)} target="_blank" rel="noreferrer">
                          <img src={imgUrl(s.file_id)} alt="payment"
                            className="w-16 h-16 object-cover rounded-lg border border-green-300 ring-2 ring-green-400" />
                        </a>
                      ))}
                      <span className="self-center text-xs text-green-700 font-semibold">✓ Uploaded</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg border-2 text-xs font-semibold cursor-pointer ${hasPaymentSS ? "border-green-400 bg-green-50 text-green-700" : "border-orange-400 bg-white text-orange-700"}`}>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPaymentPhoto(order._id, f); e.target.value = ""; }}
                        disabled={paymentUploading} />
                      {paymentUploading ? "Uploading…" : hasPaymentSS ? "📸 Re-take" : "📸 Take Payment Photo"}
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold cursor-pointer">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPaymentPhoto(order._id, f); e.target.value = ""; }}
                        disabled={paymentUploading} />
                      🖼️ Gallery
                    </label>
                  </div>
                </div>

                {/* Mark delivered */}
                <button
                  onClick={() => markDelivered(order._id)}
                  disabled={!hasPaymentSS || completeBusy}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  {completeBusy ? "Processing…" : hasPaymentSS ? "✅ Mark Delivered" : "⬆️ Upload payment photo first"}
                </button>
              </div>
            )}

            {/* Uploaded files (done orders) */}
            {isDone && (hasItemsImg || hasPickupSlip || hasPaymentSS || hasVendorSlip) && (
              <div className="space-y-2">
                {hasItemsImg && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">📷 Item Photos</p>
                    <div className="flex gap-2 flex-wrap">
                      {(order.items_images || []).map(img => (
                        <a key={img.file_id} href={imgUrl(img.file_id)} target="_blank" rel="noreferrer">
                          <img src={imgUrl(img.file_id)} alt="item" className="w-14 h-14 object-cover rounded-lg border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {hasPickupSlip && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">🧾 Pickup Slip</p>
                    <div className="flex gap-2 flex-wrap">
                      {(order.rider_pickup_slips || []).map(s => (
                        <a key={s.file_id} href={imgUrl(s.file_id)} target="_blank" rel="noreferrer">
                          <img src={imgUrl(s.file_id)} alt="slip" className="w-14 h-14 object-cover rounded-lg border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(hasPaymentSS || hasVendorSlip) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">💳 Payment Photo</p>
                    <div className="flex gap-2 flex-wrap">
                      {[...(order.rider_payment_slips || []), ...(order.vendor_payment_slips || [])].map(s => (
                        <a key={s.file_id} href={imgUrl(s.file_id)} target="_blank" rel="noreferrer">
                          <img src={imgUrl(s.file_id)} alt="payment" className="w-14 h-14 object-cover rounded-lg border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── top bar ── */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">{riderInfo?.name || "Rider"}</h1>
            <p className="text-xs text-gray-400">{riderInfo?.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToFactory}
              className="text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 font-semibold flex items-center gap-1"
            >
              🏭 Factory
            </button>
            <button onClick={logout} className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5">
              Logout
            </button>
          </div>
        </div>

        {/* ── Live tracking status bar ── */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* GPS status */}
          {locationStatus === "active" && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              GPS Active
            </span>
          )}
          {locationStatus === "requesting" && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
              Requesting GPS…
            </span>
          )}
          {locationStatus === "denied" && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"
              onClick={() => toast.error("Enable Location in your browser/phone settings and refresh")}>
              ⚠️ GPS Denied — tap to fix
            </span>
          )}
          {locationStatus === "unavailable" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              GPS unavailable
            </span>
          )}

          {/* Socket status */}
          {socketConnected ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
              Live Tracking ON
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              Connecting…
            </span>
          )}

          {/* Current rider status */}
          {(() => {
            const { status } = getRiderStatus();
            if (status === "delivering") return (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">🛵 Delivering</span>
            );
            if (status === "assigned") return (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">📦 Assigned</span>
            );
            return (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">🟢 Idle</span>
            );
          })()}
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* Return to factory */}
        <button
          onClick={goToFactory}
          className="w-full mb-4 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md"
        >
          🏭 Get Back to Factory
        </button>

        {/* summary bar */}
        {activeOrders.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex gap-2 flex-wrap">
              {activeOrders.filter(o => o.status === "pickup_assigned").length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  <span>🧺 Pickup</span>
                  <span className="font-bold">{activeOrders.filter(o => o.status === "pickup_assigned").length}</span>
                </div>
              )}
              {activeOrders.filter(o => o.status !== "pickup_assigned").length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  <span>🚚 Delivery</span>
                  <span className="font-bold">{activeOrders.filter(o => o.status !== "pickup_assigned").length}</span>
                </div>
              )}
            </div>
            {activeOrders.length >= 2 && (
              <button
                onClick={() => openOptimizedRoute(activeOrders)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                🗺️ Optimize Route for All {activeOrders.length} Orders
              </button>
            )}
          </div>
        )}

        {/* Active orders split by type */}
        {activeOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">🛵</div>
            <p className="font-medium">No active orders</p>
            <p className="text-sm mt-1">New orders will appear here automatically</p>
          </div>
        ) : (
          <>
            {/* TO PICKUP */}
            {activeOrders.filter(o => o.status === "pickup_assigned").length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base font-bold text-purple-700">🧺 To Pickup</span>
                  <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {activeOrders.filter(o => o.status === "pickup_assigned").length}
                  </span>
                </div>
                {activeOrders.filter(o => o.status === "pickup_assigned").map(o => renderOrder(o, false))}
              </>
            )}

            {/* TO DELIVER */}
            {activeOrders.filter(o => o.status !== "pickup_assigned").length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-4 mb-2">
                  <span className="text-base font-bold text-orange-700">🚚 To Deliver</span>
                  <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {activeOrders.filter(o => o.status !== "pickup_assigned").length}
                  </span>
                </div>
                {activeOrders.filter(o => o.status !== "pickup_assigned").map(o => renderOrder(o, false))}
              </>
            )}
          </>
        )}

        {/* Done orders */}
        {doneOrders.length > 0 && (
          <>
            <h2 className="font-semibold text-gray-500 mt-6 mb-3">Completed ({doneOrders.length})</h2>
            {doneOrders.map(o => renderOrder(o, true))}
          </>
        )}
      </main>

      {/* ── COD Collection modal ── */}
      {codModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="font-bold text-gray-900 mb-2">Collect COD Payment</h3>
            <p className="text-sm text-gray-500 mb-4">Enter the amount collected from the customer.</p>
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
              <input
                type="number"
                value={codAmount}
                onChange={e => setCodAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setCodModal(null); setCodAmount(""); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => submitCOD(codModal)}
                disabled={!codAmount || actionLoading[codModal + "_cod"]}
                className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 text-white rounded-xl font-semibold text-sm"
              >
                {actionLoading[codModal + "_cod"] ? "..." : "Confirm Collection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderDeskDashboard;
