import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
  const [codModal, setCodModal] = useState<string | null>(null); // orderId
  const [codAmount, setCodAmount] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const prevIds = useRef<Set<string>>(new Set());

  // Get current location for navigation
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {} // silent if denied
    );
  }, []);

  useEffect(() => {
    if (!token) navigate("/rider-desk");
  }, [token, navigate]);

  // ── fetch orders via desk-orders endpoint ──
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/riders/desk-orders", { headers: authHeaders(token) });
      if (res.status === 401) { navigate("/rider-desk"); return; }
      const data = await res.json();

      if (data.success) {
        const active: AssignedOrder[] = data.active || [];
        const done: AssignedOrder[] = data.done || [];

        const incoming = active.filter(o => !prevIds.current.has(o._id));
        if (prevIds.current.size > 0 && incoming.length > 0) {
          toast.info(`${incoming.length} new order${incoming.length > 1 ? "s" : ""} assigned!`);
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
      const res = await fetch("/api/riders/order-action", {
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
      // After starting (picked up), open maps for next destination
      if (action === "start") {
        const order = activeOrders.find(o => o._id === orderId);
        if (order?.address) setTimeout(() => openMapsToAddress(order.address!, order.mapsLink), 500);
      }
      fetchOrders();
    } catch { toast.error("Network error"); }
    finally { setActionLoading(a => ({ ...a, [orderId]: false })); }
  };

  // ── mark in-transit ──
  const markInTransit = async (orderId: string) => {
    setActionLoading(a => ({ ...a, [orderId + "_transit"]: true }));
    try {
      const res = await fetch(`/api/riders/orders/${orderId}/in-transit`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed"); return; }
      toast.success("Marked In Transit — opening maps");
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
      const res = await fetch(`/api/riders/orders/${orderId}/cod-collected`, {
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

  // ── upload image (base64) ──
  const uploadImage = (orderId: string, file: File, type: "pickup" | "payment") => {
    const key = orderId + "_" + type;
    setUploading(u => ({ ...u, [key]: true }));

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const endpoint = type === "pickup"
          ? `/api/riders/orders/${orderId}/upload-pickup-slip`
          : `/api/riders/orders/${orderId}/upload-payment-ss`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ image_base64: base64 }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.message || "Upload failed"); return; }

        toast.success(type === "pickup" ? "Item slip uploaded!" : "Payment SS uploaded!");
        if (type === "pickup") await doAction(orderId, "start");
        if (type === "payment") await doAction(orderId, "complete");
        fetchOrders();
      } catch { toast.error("Upload error"); }
      finally { setUploading(u => ({ ...u, [key]: false })); }
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setUploading(u => ({ ...u, [key]: false }));
    };
  };

  const logout = () => {
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
    const busy = actionLoading[order._id];
    const amount = (order.final_amount ?? order.total_price ?? 0);

    // Determine assignment type from order status
    const isPickupOrder = order.status === "pickup_assigned";
    const isDeliveryOrder = ["delivery_assigned", "in_transit"].includes(order.status || "");
    const assignmentLabel = isPickupOrder ? "🧺 Pickup" : isDeliveryOrder ? "🚚 Delivery" : "";

    return (
      <div key={order._id} className="bg-white rounded-xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
        {/* ── header ── */}
        <button
          className="w-full text-left px-4 py-3 flex items-center justify-between"
          onClick={() => setExpandedId(expanded ? null : order._id)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {order.custom_order_id || order._id.slice(-6).toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RIDER_STATUS_COLORS[rs] || "bg-gray-100 text-gray-600"}`}>
                {RIDER_STATUS_LABELS[rs] || rs}
              </span>
              {assignmentLabel && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">{assignmentLabel}</span>
              )}
              {order.cod_collected && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">COD ✓</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {order.name} · ₹{amount.toLocaleString()}
            </p>
          </div>
          <span className="text-gray-400 text-xs ml-2">{expanded ? "▲" : "▼"}</span>
        </button>

        {/* ── Quick Navigate bar (always visible for active orders) ── */}
        {!isDone && order.address && (
          <div className="px-4 pb-3">
            <button
              onClick={() => openMapsToAddress(order.address!, order.mapsLink)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>🗺️</span> Navigate to {isPickupOrder ? "Customer" : isDeliveryOrder ? "Customer" : "Address"}
            </button>
          </div>
        )}

        {expanded && (
          <div className="border-t border-gray-50 px-4 py-3 space-y-4">
            {/* ── assignment type banner ── */}
            {!isDone && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${isPickupOrder ? "bg-purple-50 text-purple-700" : "bg-orange-50 text-orange-700"}`}>
                <span>{isPickupOrder ? "🧺" : "🚚"}</span>
                <span>{isPickupOrder ? "Pickup — Upload slip & mark picked up" : "Delivery — Collect payment, upload SS & mark delivered"}</span>
              </div>
            )}

            {/* ── customer info ── */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">👤</span>
                <span className="font-medium">{order.name}</span>
              </div>
              {order.phone && (
                <a href={`tel:${order.phone}`} className="flex items-center gap-2 text-blue-600 text-sm">
                  <span>📞</span>
                  <span className="font-semibold">{order.phone}</span>
                </a>
              )}
              {order.address && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-gray-400 mt-0.5">📍</span>
                  <span className="text-gray-700 text-xs leading-relaxed">{order.address}</span>
                </div>
              )}
            </div>

            {/* ── timing ── */}
            {(order.delivery_date || order.assignedAt) && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs space-y-1">
                {order.assignedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Assigned</span>
                    <span>{timeSince(order.assignedAt)}</span>
                  </div>
                )}
                {order.delivery_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expected delivery</span>
                    <span className="font-medium">{order.delivery_date}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── cart summary ── */}
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
                    <span>Total</span>
                    <span>₹{amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── uploaded slips & images — visible to rider ── */}
            {(hasItemsImg || hasPickupSlip || hasPaymentSS || hasVendorSlip) && (
              <div className="space-y-2">
                {hasItemsImg && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">📷 Order Photos (Desk)</p>
                    <div className="flex gap-2 flex-wrap">
                      {(order.items_images || []).map(img => (
                        <a key={img.file_id} href={`/api/riders/public/orders/${order._id}/slip/${img.file_id}`} target="_blank" rel="noreferrer">
                          <img src={`/api/riders/public/orders/${order._id}/slip/${img.file_id}`} alt="item"
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {hasPickupSlip && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">🧺 Pickup Slips</p>
                    <div className="flex gap-2 flex-wrap">
                      {(order.rider_pickup_slips || []).map(s => (
                        <a key={s.file_id} href={`/api/riders/public/orders/${order._id}/slip/${s.file_id}`} target="_blank" rel="noreferrer">
                          <img src={`/api/riders/public/orders/${order._id}/slip/${s.file_id}`} alt="slip"
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(hasPaymentSS || hasVendorSlip) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">💳 Payment Slips</p>
                    <div className="flex gap-2 flex-wrap">
                      {[...(order.rider_payment_slips || []), ...(order.vendor_payment_slips || [])].map(s => (
                        <a key={s.file_id} href={`/api/riders/public/orders/${order._id}/slip/${s.file_id}`} target="_blank" rel="noreferrer">
                          <img src={`/api/riders/public/orders/${order._id}/slip/${s.file_id}`} alt="payment"
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── actions (only on active orders) ── */}
            {!isDone && (
              <div className="space-y-2">
                {/* PICKUP: just upload slip → auto-marks picked up */}
                {isPickupOrder && (
                  <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border-2 border-dashed ${hasPickupSlip ? "border-green-400 bg-green-50 text-green-700" : "border-purple-300 bg-purple-50 text-purple-700"}`}>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(order._id, f, "pickup"); e.target.value = ""; }}
                      disabled={uploading[order._id + "_pickup"]}
                    />
                    {uploading[order._id + "_pickup"] ? "Uploading..." : hasPickupSlip ? "✓ Slip Uploaded — Picked Up!" : "📷 Upload Slip & Mark Picked Up"}
                  </label>
                )}

                {/* DELIVERY: collect payment + upload SS → auto-marks delivered */}
                {isDeliveryOrder && (
                  <>
                    {!order.cod_collected && (
                      <button
                        onClick={() => { setCodModal(order._id); setCodAmount(String(amount)); }}
                        className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-xl text-sm"
                      >
                        💰 Collect Payment (₹{amount.toLocaleString()})
                      </button>
                    )}
                    {order.cod_collected && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                        <span>✓</span>
                        <span className="font-medium">Payment Collected: ₹{(order.cod_amount || amount).toLocaleString()}</span>
                      </div>
                    )}
                    <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border-2 border-dashed ${hasPaymentSS ? "border-green-400 bg-green-50 text-green-700" : "border-orange-300 bg-orange-50 text-orange-700"}`}>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(order._id, f, "payment"); e.target.value = ""; }}
                        disabled={uploading[order._id + "_payment"]}
                      />
                      {uploading[order._id + "_payment"] ? "Uploading..." : hasPaymentSS ? "✓ SS Uploaded — Marked Delivered!" : "💳 Upload Payment SS & Mark Delivered"}
                    </label>
                  </>
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
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-gray-900">{riderInfo?.name || "Rider"}</h1>
          <p className="text-xs text-gray-400">{riderInfo?.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          {riderInfo?.live_location_link && (
            <a href={riderInfo.live_location_link} target="_blank" rel="noreferrer"
              className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">
              Live GPS
            </a>
          )}
          <button onClick={logout} className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5">
            Logout
          </button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
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
