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
  assigned:         "Assigned",
  accepted:         "Accepted",
  in_transit:       "In Transit",
  picked_up:        "Picked Up",
  delivered:        "Delivered",
  completed:        "Completed",
  rejected_by_rider:"Rejected",
};

const RIDER_STATUS_COLORS: Record<string, string> = {
  assigned:          "bg-yellow-100 text-yellow-800",
  accepted:          "bg-blue-100 text-blue-800",
  in_transit:        "bg-orange-100 text-orange-800",
  picked_up:         "bg-purple-100 text-purple-800",
  delivered:         "bg-green-100 text-green-800",
  completed:         "bg-gray-100 text-gray-600",
  rejected_by_rider: "bg-red-100 text-red-700",
};

// Progress steps for the workflow stepper
const WORKFLOW_STEPS = ["assigned", "accepted", "picked_up", "in_transit", "delivered"];

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
  rider_pickup_slips?: { file_id: string }[];
  rider_payment_slips?: { file_id: string }[];
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
  const [rejectModal, setRejectModal] = useState<string | null>(null); // orderId
  const [codModal, setCodModal] = useState<string | null>(null); // orderId
  const [codAmount, setCodAmount] = useState("");
  const prevIds = useRef<Set<string>>(new Set());

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

  // ── order action (accept / start / complete / reject) ──
  const doAction = async (orderId: string, action: "accept" | "start" | "complete" | "reject") => {
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
        accept: "Order accepted",
        start:  "Marked as picked up",
        complete: "Marked as delivered",
        reject: "Order rejected",
      };
      toast.success(labels[action] || "Updated");
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
      toast.success("Marked In Transit");
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
    const busy = actionLoading[order._id];
    const amount = (order.final_amount ?? order.total_price ?? 0);

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

        {expanded && (
          <div className="border-t border-gray-50 px-4 py-3 space-y-4">
            {/* ── workflow stepper ── */}
            {!isDone && (
              <div className="flex items-center gap-0 overflow-x-auto pb-1">
                {WORKFLOW_STEPS.map((step, idx) => {
                  const stepIdx = WORKFLOW_STEPS.indexOf(rs);
                  const isDone_ = idx < stepIdx || (idx === stepIdx && rs !== "assigned");
                  const isCurrent = step === rs;
                  return (
                    <React.Fragment key={step}>
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${isDone_ ? "bg-green-500 border-green-500 text-white" : isCurrent ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-gray-300 text-gray-400"}`}>
                          {isDone_ ? "✓" : idx + 1}
                        </div>
                        <span className={`text-xs mt-0.5 whitespace-nowrap ${isCurrent ? "text-blue-600 font-semibold" : isDone_ ? "text-green-600" : "text-gray-400"}`}>
                          {RIDER_STATUS_LABELS[step] || step}
                        </span>
                      </div>
                      {idx < WORKFLOW_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 min-w-4 mx-1 rounded ${idx < stepIdx ? "bg-green-400" : "bg-gray-200"}`} />
                      )}
                    </React.Fragment>
                  );
                })}
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
              {order.mapsLink && (
                <a href={order.mapsLink} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-white bg-blue-600 px-3 py-1.5 rounded-lg font-medium">
                  Open in Maps
                </a>
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

            {/* ── actions (only on active orders) ── */}
            {!isDone && (
              <div className="space-y-2">
                {/* Accept */}
                {rs === "assigned" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => doAction(order._id, "accept")}
                      disabled={busy}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm"
                    >
                      {busy ? "..." : "Accept Order"}
                    </button>
                    <button
                      onClick={() => setRejectModal(order._id)}
                      disabled={busy}
                      className="px-4 py-3 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 font-semibold rounded-xl text-sm border border-red-200"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {/* Mark In Transit (accepted state) */}
                {rs === "accepted" && (
                  <>
                    <button
                      onClick={() => markInTransit(order._id)}
                      disabled={!!actionLoading[order._id + "_transit"]}
                      className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl text-sm"
                    >
                      {actionLoading[order._id + "_transit"] ? "..." : "Mark In Transit (Heading to Customer)"}
                    </button>
                    <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border-2 border-dashed ${hasPickupSlip ? "border-green-400 bg-green-50 text-green-700" : "border-purple-300 bg-purple-50 text-purple-700"}`}>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(order._id, f, "pickup"); e.target.value = ""; }}
                        disabled={uploading[order._id + "_pickup"]}
                      />
                      {uploading[order._id + "_pickup"] ? "Uploading..." : hasPickupSlip ? "✓ Slip Uploaded — Mark Picked Up" : "📷 Upload Item Slip & Mark Picked Up"}
                    </label>
                  </>
                )}

                {/* In Transit — can upload pickup slip or mark delivered */}
                {rs === "in_transit" && (
                  <>
                    {/* COD collection */}
                    {!order.cod_collected && (
                      <button
                        onClick={() => { setCodModal(order._id); setCodAmount(String(amount)); }}
                        className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-xl text-sm"
                      >
                        💰 Collect COD Payment (₹{amount.toLocaleString()})
                      </button>
                    )}
                    {order.cod_collected && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                        <span>✓</span>
                        <span className="font-medium">COD Collected: ₹{(order.cod_amount || amount).toLocaleString()}</span>
                      </div>
                    )}
                    <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border-2 border-dashed ${hasPaymentSS ? "border-green-400 bg-green-50 text-green-700" : "border-orange-300 bg-orange-50 text-orange-700"}`}>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(order._id, f, "payment"); e.target.value = ""; }}
                        disabled={uploading[order._id + "_payment"]}
                      />
                      {uploading[order._id + "_payment"] ? "Uploading..." : hasPaymentSS ? "✓ Payment SS — Mark Delivered" : "💳 Upload Payment SS & Mark Delivered"}
                    </label>
                  </>
                )}

                {/* Picked up — collect COD + mark delivered */}
                {rs === "picked_up" && (
                  <>
                    {!order.cod_collected && (
                      <button
                        onClick={() => { setCodModal(order._id); setCodAmount(String(amount)); }}
                        className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-xl text-sm"
                      >
                        💰 Collect COD Payment (₹{amount.toLocaleString()})
                      </button>
                    )}
                    {order.cod_collected && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                        <span>✓</span>
                        <span className="font-medium">COD Collected: ₹{(order.cod_amount || amount).toLocaleString()}</span>
                      </div>
                    )}
                    <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border-2 border-dashed ${hasPaymentSS ? "border-green-400 bg-green-50 text-green-700" : "border-orange-300 bg-orange-50 text-orange-700"}`}>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(order._id, f, "payment"); e.target.value = ""; }}
                        disabled={uploading[order._id + "_payment"]}
                      />
                      {uploading[order._id + "_payment"] ? "Uploading..." : hasPaymentSS ? "✓ Payment SS — Mark Delivered" : "💳 Upload Payment SS & Mark Delivered"}
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
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
            {["assigned", "accepted", "in_transit", "picked_up"].map(s => {
              const cnt = activeOrders.filter(o => o.riderStatus === s).length;
              if (cnt === 0) return null;
              return (
                <div key={s} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${RIDER_STATUS_COLORS[s]}`}>
                  <span>{RIDER_STATUS_LABELS[s]}</span>
                  <span className="font-bold">{cnt}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Active orders */}
        <h2 className="font-semibold text-gray-700 mb-3">
          Active Orders{activeOrders.length > 0 && <span className="ml-1 text-green-600">({activeOrders.length})</span>}
        </h2>

        {activeOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">🛵</div>
            <p className="font-medium">No active orders</p>
            <p className="text-sm mt-1">New orders will appear here automatically</p>
          </div>
        ) : (
          activeOrders.map(o => renderOrder(o, false))
        )}

        {/* Done orders */}
        {doneOrders.length > 0 && (
          <>
            <h2 className="font-semibold text-gray-500 mt-6 mb-3">Completed ({doneOrders.length})</h2>
            {doneOrders.map(o => renderOrder(o, true))}
          </>
        )}
      </main>

      {/* ── Reject confirmation modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="font-bold text-gray-900 mb-2">Reject Order?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will unassign you from the order and notify the vendor. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => { doAction(rejectModal, "reject"); setRejectModal(null); }}
                disabled={actionLoading[rejectModal]}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm"
              >
                {actionLoading[rejectModal] ? "..." : "Reject Order"}
              </button>
            </div>
          </div>
        </div>
      )}

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
