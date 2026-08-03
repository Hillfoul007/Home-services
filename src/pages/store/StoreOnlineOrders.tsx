import { useState, useEffect, useCallback } from "react";
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
  Loader2, RefreshCw, Bike, Camera, Video, Receipt, Truck, PackageCheck,
  CheckCircle2, Clock, Phone, MapPin, Plus, KeyRound, AlertTriangle,
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

const SECTION_CONFIG: { key: SectionKey; label: string; icon: string; color: string }[] = [
  { key: "created", label: "New / Pickup", icon: "📥", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { key: "picked_up", label: "Picked Up", icon: "🧺", color: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  { key: "processing", label: "Processing", icon: "🧼", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { key: "ready_for_delivery", label: "Ready", icon: "✅", color: "bg-teal-100 text-teal-800 border-teal-300" },
  { key: "delivered", label: "Delivered", icon: "🚚", color: "bg-purple-100 text-purple-800 border-purple-300" },
  { key: "completed", label: "Completed", icon: "🏁", color: "bg-green-100 text-green-800 border-green-300" },
  { key: "cancelled", label: "Cancelled", icon: "🚫", color: "bg-red-100 text-red-800 border-red-300" },
];

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

  const [cartDraft, setCartDraft] = useState<ItemPrice[] | null>(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!token) return;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API()}/dashboard`, { headers: authHeaders(token) });
      const data = await res.json();
      if (data.success) {
        setSections(data.sections);
        setCounts(data.counts || {});
      } else {
        toast.error(data.error || "Failed to load online orders");
      }
    } catch {
      toast.error("Error loading online orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

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

  // Keep the open detail dialog's order data fresh after any mutation
  const refreshSelected = (updated: OnlineOrder) => {
    setSelectedOrder(updated);
    setCartDraft(updated.item_prices || null);
  };

  const openOrder = (order: OnlineOrder) => {
    setSelectedOrder(order);
    setCartDraft(order.item_prices || null);
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
      toast.success(`Rider ${data.rider.name} created`);
      setNewRiderCreds(data.credentials);
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

  return (
    <div className="space-y-4">
      {/* Sub-nav: Orders vs Riders */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <Button variant={view === "orders" ? "default" : "outline"} size="sm" onClick={() => setView("orders")}>
            📦 Orders
          </Button>
          <Button variant={view === "riders" ? "default" : "outline"} size="sm" onClick={() => setView("riders")}>
            <Bike className="w-4 h-4 mr-1" /> Riders ({riders.length})
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchDashboard(true)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {view === "orders" ? (
        <>
          {/* Kanban section tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SECTION_CONFIG.map(({ key, label, icon, color }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm whitespace-nowrap transition-colors ${
                  activeSection === key ? color + " font-semibold" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
                <Badge variant="secondary" className="ml-1">{counts[key] ?? 0}</Badge>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : currentList.length === 0 ? (
            <Card className="p-8 text-center text-gray-400">No orders in this section</Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentList.map(order => (
                <Card
                  key={order._id}
                  className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${order._breach ? "border-red-300 bg-red-50/40" : ""}`}
                  onClick={() => openOrder(order)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">{order.custom_order_id || order._id.slice(-6)}</span>
                    {order._breach && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="text-sm text-gray-700 flex items-center gap-1"><Phone className="w-3 h-3" />{customerName(order)} · {customerPhone(order)}</div>
                  {order.address && <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{order.address}</div>}
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>₹{order.final_amount ?? order.total_price ?? 0}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{order._timeElapsed || fmtTime(order.created_at)}</span>
                  </div>
                  {(riderName(order.pickupRider) || riderName(order.deliveryRider) || riderName(order.assignedRider)) && (
                    <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1">
                      <Bike className="w-3 h-3" /> {riderName(order.deliveryRider) || riderName(order.pickupRider) || riderName(order.assignedRider)}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <RidersPanel
          riders={riders}
          loading={loadingRiders}
          onAdd={() => { setNewRiderCreds(null); setCreateRiderOpen(true); }}
        />
      )}

      {/* ── Order detail dialog ── */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-w-xl p-4 sm:p-6">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedOrder.custom_order_id || selectedOrder._id.slice(-6)}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-gray-500">Customer:</span> {customerName(selectedOrder)}</div>
                  <div><span className="text-gray-500">Phone:</span> {customerPhone(selectedOrder)}</div>
                  {selectedOrder.address && <div className="col-span-2"><span className="text-gray-500">Address:</span> {selectedOrder.address}</div>}
                  <div><span className="text-gray-500">Status:</span> {selectedOrder.status}</div>
                  <div><span className="text-gray-500">Total:</span> ₹{selectedOrder.final_amount ?? selectedOrder.total_price ?? 0}</div>
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

                {/* Upload controls */}
                <div className="flex flex-wrap gap-2">
                  <UploadButton icon={<Camera className="w-4 h-4" />} label="Photo" disabled={busy}
                    onFile={(f) => uploadFile(selectedOrder._id, "items_image", f)} accept="image/*" />
                  <UploadButton icon={<Video className="w-4 h-4" />} label="Video" disabled={busy}
                    onFile={(f) => uploadFile(selectedOrder._id, "items_video", f)} accept="video/*" />
                  <UploadButton icon={<Receipt className="w-4 h-4" />} label="Payment Slip" disabled={busy}
                    onFile={(f) => uploadFile(selectedOrder._id, "payment_ss", f)} accept="image/*" />
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
          )}
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
      <Dialog open={createRiderOpen} onOpenChange={(open) => { setCreateRiderOpen(open); if (!open) setNewRiderCreds(null); }}>
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
          ) : (
            <div className="space-y-3">
              <Input placeholder="Rider name" value={newRiderName} onChange={(e) => setNewRiderName(e.target.value)} />
              <Input placeholder="Phone number" value={newRiderPhone} onChange={(e) => setNewRiderPhone(e.target.value)} />
              <Button className="w-full" disabled={creatingRider} onClick={createRider}>
                {creatingRider ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Rider"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadButton({ icon, label, onFile, accept, disabled }: { icon: React.ReactNode; label: string; onFile: (f: File) => void; accept: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer hover:bg-gray-50 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {icon}{label}
      <input
        type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </label>
  );
}

function RidersPanel({ riders, loading, onAdd }: { riders: RiderRef[]; loading: boolean; onAdd: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Your Riders</h3>
        <Button size="sm" onClick={onAdd}><Plus className="w-4 h-4 mr-1" /> Add Rider</Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : riders.length === 0 ? (
        <Card className="p-6 text-center text-gray-400 text-sm">No riders yet. Add one to assign pickups & deliveries.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {riders.map(r => (
            <Card key={r._id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-gray-500">{r.phone}</div>
              </div>
              <Badge variant={r.isActive === false ? "secondary" : "default"}>{r.isActive === false ? "Inactive" : "Active"}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
