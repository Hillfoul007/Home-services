import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  FileDown,
  Eye,
  CheckCircle,
  Trash2,
  List,
  Edit2,
  Upload,
  Truck,
  Camera,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Image as ImageIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { getApiUrl } from "@/config/env";

// ── Constants ─────────────────────────────────────────────────────────────────

const HOTEL_ITEMS = [
  "BEDSHEET DOUBLE",
  "BEDSHEET SINGLE",
  "TABLE TOP",
  "BATH TOWEL",
  "HAND TOWEL",
  "BATH MAT",
  "PILLOW COVERS (COLOUR)",
  "PILLOW COVERS (WHITE)",
  "DUVET COVER (SINGLE)",
  "DUVET COVER (DOUBLE)",
  "STAFF SHIRT",
  "STAFF PANT",
  "BLANKET",
  "RUNNER",
  "CUSHION COVER",
  "DOOR MAT",
  "NAPKIN",
  "CHEF COAT",
  "ROUND TABLE COVER",
  "CURTAIN",
  "CHAIR COVER",
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:          { label: "Pending",          color: "bg-gray-100 text-gray-700" },
  pickup_scheduled: { label: "Pickup Scheduled", color: "bg-blue-100 text-blue-700" },
  picked_up:        { label: "Picked Up",        color: "bg-indigo-100 text-indigo-700" },
  processing:       { label: "Processing",       color: "bg-yellow-100 text-yellow-700" },
  ready:            { label: "Ready",            color: "bg-purple-100 text-purple-700" },
  drop_scheduled:   { label: "Drop Scheduled",   color: "bg-orange-100 text-orange-700" },
  delivered:        { label: "Delivered",        color: "bg-green-100 text-green-700" },
  cancelled:        { label: "Cancelled",        color: "bg-red-100 text-red-700" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Hotel {
  _id: string;
  name: string;
  address: string;
  contact: string;
  phone: string;
}

interface OrderItem {
  name: string;
  qty: number;
  guest_qty: number;
  staff_qty: number;
  dc_qty: number;
  price: number;
  amount: number;
}

interface HotelOrder {
  _id: string;
  hotel_id: string;
  hotel_name: string;
  hotel_address: string;
  invoice_no: string;
  date: string;
  items: OrderItem[];
  total: number;
  status: string;
  pickup_date: string;
  pickup_time: string;
  pickup_slip_url: string;
  pickup_notes: string;
  drop_date: string;
  drop_time: string;
  drop_slip_url: string;
  drop_notes: string;
  assigned_rider_id: string | null;
  rider_name: string;
  rider_phone: string;
  is_paid: boolean;
  paid_date: string;
  paid_till: string;
  notes: string;
  created_at: string;
}

interface Rider {
  _id: string;
  name: string;
  phone: string;
}

type ItemInputs = { [item: string]: { guestQty: string; staffQty: string; dcQty: string; price: string } };
type SubTab = "hotels" | "new-entry" | "bills";

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

async function adminUpload(orderId: string, file: File, slipType: "pickup" | "drop"): Promise<{ url: string; status: string }> {
  const form = new FormData();
  form.append("slip", file);
  form.append("slip_type", slipType);
  const base = getApiUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/hotel-management/orders/${orderId}/upload-slip`, {
    method: "POST",
    headers: { "admin-token": import.meta.env.VITE_ADMIN_SECRET || "" },
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
  return { url: data.url, status: data.status };
}

// ── Main Component ────────────────────────────────────────────────────────────

const AdminHotelManagement: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>("hotels");
  const [loading, setLoading] = useState(false);

  // Data
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [orders, setOrders] = useState<HotelOrder[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);

  // Hotel form
  const [hotelForm, setHotelForm] = useState({ name: "", address: "", contact: "", phone: "" });
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null);

  // New entry form
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [entryDate, setEntryDate] = useState(todayStr());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [itemInputs, setItemInputs] = useState<ItemInputs>({});
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropDate, setDropDate] = useState("");
  const [dropTime, setDropTime] = useState("");
  const [entryNotes, setEntryNotes] = useState("");

  // Bills
  const [filterHotelId, setFilterHotelId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewOrder, setViewOrder] = useState<HotelOrder | null>(null);
  const [payDialog, setPayDialog] = useState<{ order: HotelOrder; paidDate: string; paidTill: string } | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState<{ order: HotelOrder; type: "pickup" | "drop" } | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleRiderId, setScheduleRiderId] = useState("");
  const [statusDialog, setStatusDialog] = useState<{ order: HotelOrder; newStatus: string } | null>(null);

  // Slip upload
  const pickupFileRef = useRef<HTMLInputElement>(null);
  const dropFileRef = useRef<HTMLInputElement>(null);
  const [uploadingSlip, setUploadingSlip] = useState<string | null>(null);

  // ── API calls ───────────────────────────────────────────────────────────────

  const fetchHotels = useCallback(async () => {
    try {
      const res = await apiClient.adminRequest<{ data: Hotel[] }>("/hotel-management/hotels");
      if (res.data?.data) setHotels(res.data.data);
    } catch { /* silent */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.adminRequest<{ data: HotelOrder[] }>("/hotel-management/orders");
      if (res.data?.data) setOrders(res.data.data);
    } catch { /* silent */ }
  }, []);

  const fetchRiders = useCallback(async () => {
    try {
      const res = await apiClient.adminRequest<{ data: Rider[] }>("/hotel-management/riders");
      if (res.data?.data) setRiders(res.data.data);
    } catch { /* silent */ }
  }, []);

  const fetchNextInvoice = useCallback(async () => {
    try {
      const res = await apiClient.adminRequest<{ invoice_no: string }>("/hotel-management/orders/next-invoice");
      if (res.data?.invoice_no) setInvoiceNo(res.data.invoice_no);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchHotels();
    fetchOrders();
    fetchRiders();
  }, []);

  useEffect(() => {
    if (subTab === "new-entry") {
      fetchNextInvoice();
      setEntryDate(todayStr());
      setItemInputs({});
      setSelectedHotelId("");
      setPickupDate("");
      setPickupTime("");
      setDropDate("");
      setDropTime("");
      setEntryNotes("");
    }
  }, [subTab]);

  // ── Hotels CRUD ─────────────────────────────────────────────────────────────

  const saveHotel = async () => {
    if (!hotelForm.name.trim()) { toast.error("Hotel name is required"); return; }
    setLoading(true);
    try {
      if (editingHotelId) {
        await apiClient.adminRequest(`/hotel-management/hotels/${editingHotelId}`, {
          method: "PUT", body: hotelForm,
        });
        toast.success("Hotel updated");
        setEditingHotelId(null);
      } else {
        await apiClient.adminRequest("/hotel-management/hotels", {
          method: "POST", body: hotelForm,
        });
        toast.success("Hotel added");
      }
      setHotelForm({ name: "", address: "", contact: "", phone: "" });
      fetchHotels();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save hotel");
    } finally {
      setLoading(false);
    }
  };

  const deleteHotel = async (id: string) => {
    try {
      await apiClient.adminRequest(`/hotel-management/hotels/${id}`, { method: "DELETE" });
      toast.success("Hotel deleted");
      fetchHotels();
    } catch { toast.error("Delete failed"); }
  };

  // ── Entry form ──────────────────────────────────────────────────────────────

  const updateItemField = (item: string, field: "guestQty" | "staffQty" | "dcQty" | "price", val: string) => {
    setItemInputs(prev => {
      const existing = prev[item] ?? { guestQty: "", staffQty: "", dcQty: "", price: "" };
      return { ...prev, [item]: { ...existing, [field]: val } };
    });
  };

  const computeTotal = () => {
    let total = 0;
    for (const item of HOTEL_ITEMS) {
      const inp = itemInputs[item];
      if (!inp) continue;
      const qty = (parseFloat(inp.guestQty) || 0) + (parseFloat(inp.staffQty) || 0);
      const price = parseFloat(inp.price) || 0;
      if (qty > 0 && price > 0) total += qty * price;
    }
    return total;
  };

  const saveEntry = async () => {
    if (!selectedHotelId) { toast.error("Please select a hotel"); return; }
    const hotel = hotels.find(h => h._id === selectedHotelId);
    if (!hotel) return;

    const items: OrderItem[] = HOTEL_ITEMS.flatMap(name => {
      const inp = itemInputs[name];
      if (!inp) return [];
      const guest_qty = parseFloat(inp.guestQty) || 0;
      const staff_qty = parseFloat(inp.staffQty) || 0;
      const dc_qty = parseFloat(inp.dcQty) || 0;
      const qty = guest_qty + staff_qty;
      if (qty <= 0 && dc_qty <= 0) return [];
      const price = parseFloat(inp.price) || 0;
      return [{ name, qty, guest_qty, staff_qty, dc_qty, price, amount: qty * price }];
    });

    if (items.length === 0) { toast.error("Enter at least one item quantity"); return; }

    setLoading(true);
    try {
      await apiClient.adminRequest("/hotel-management/orders", {
        method: "POST",
        body: {
          hotel_id: hotel._id,
          hotel_name: hotel.name,
          hotel_address: hotel.address,
          date: entryDate,
          items,
          total: items.reduce((s, i) => s + i.amount, 0),
          pickup_date: pickupDate,
          pickup_time: pickupTime,
          drop_date: dropDate,
          drop_time: dropTime,
          notes: entryNotes,
        },
      });
      toast.success("Entry saved!");
      fetchOrders();
      setSubTab("bills");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save entry");
    } finally {
      setLoading(false);
    }
  };

  // ── Order updates ───────────────────────────────────────────────────────────

  const patchOrder = async (id: string, update: Record<string, any>) => {
    const res = await apiClient.adminRequest<{ data: HotelOrder }>(`/hotel-management/orders/${id}`, {
      method: "PATCH", body: update,
    });
    if (res.data?.data) {
      setOrders(prev => prev.map(o => o._id === id ? res.data!.data! : o));
      if (viewOrder?._id === id) setViewOrder(res.data.data);
    }
  };

  const confirmMarkPaid = async () => {
    if (!payDialog) return;
    try {
      await patchOrder(payDialog.order._id, {
        is_paid: true,
        paid_date: payDialog.paidDate,
        paid_till: payDialog.paidTill,
      });
      toast.success("Marked as paid");
      setPayDialog(null);
    } catch { toast.error("Failed to update"); }
  };

  const confirmSchedule = async () => {
    if (!scheduleDialog) return;
    const { order, type } = scheduleDialog;
    const update: Record<string, any> = {};
    if (type === "pickup") {
      update.pickup_date = scheduleDate;
      update.pickup_time = scheduleTime;
      if (scheduleRiderId) {
        const rider = riders.find(r => r._id === scheduleRiderId);
        update.assigned_rider_id = scheduleRiderId;
        update.rider_name = rider?.name || "";
        update.rider_phone = rider?.phone || "";
      }
      update.status = "pickup_scheduled";
    } else {
      update.drop_date = scheduleDate;
      update.drop_time = scheduleTime;
      if (scheduleRiderId) {
        const rider = riders.find(r => r._id === scheduleRiderId);
        update.assigned_rider_id = scheduleRiderId;
        update.rider_name = rider?.name || "";
        update.rider_phone = rider?.phone || "";
      }
      update.status = "drop_scheduled";
    }
    try {
      await patchOrder(order._id, update);
      toast.success(`${type === "pickup" ? "Pickup" : "Drop"} scheduled`);
      setScheduleDialog(null);
      setScheduleDate("");
      setScheduleTime("");
      setScheduleRiderId("");
    } catch { toast.error("Failed to schedule"); }
  };

  const changeStatus = async () => {
    if (!statusDialog) return;
    try {
      await patchOrder(statusDialog.order._id, { status: statusDialog.newStatus });
      toast.success("Status updated");
      setStatusDialog(null);
    } catch { toast.error("Failed to update status"); }
  };

  const deleteOrder = async (id: string) => {
    try {
      await apiClient.adminRequest(`/hotel-management/orders/${id}`, { method: "DELETE" });
      setOrders(prev => prev.filter(o => o._id !== id));
      toast.success("Entry deleted");
    } catch { toast.error("Delete failed"); }
  };

  // ── Slip upload ─────────────────────────────────────────────────────────────

  const handleSlipUpload = async (orderId: string, file: File, slipType: "pickup" | "drop") => {
    setUploadingSlip(`${orderId}-${slipType}`);
    try {
      const { url, status } = await adminUpload(orderId, file, slipType);
      setOrders(prev => prev.map(o => {
        if (o._id !== orderId) return o;
        const updated = {
          ...o,
          status,
          [slipType === "pickup" ? "pickup_slip_url" : "drop_slip_url"]: url,
        };
        if (viewOrder?._id === orderId) setViewOrder(updated);
        return updated;
      }));
      toast.success(`${slipType === "pickup" ? "Pickup" : "Drop"} slip uploaded`);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingSlip(null);
    }
  };

  // ── Excel Export ─────────────────────────────────────────────────────────────

  const exportOrderToExcel = (order: HotelOrder) => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      ["Laundrify — Laundry & Dry Clean Services"],
      ["operationslaundrify@gmail.com", "", "www.laundrify.online"],
      [],
      ["Invoice No:", order.invoice_no, "", "Date:", order.date],
      ["Hotel:", order.hotel_name],
      ["Address:", order.hotel_address],
      [],
      ["No.", "Article", "Guest", "Staff", "DC Pcs", "Price (₹)", "Amount (₹)"],
      ...order.items.map((item, idx) => [
        idx + 1, item.name,
        item.guest_qty > 0 ? item.guest_qty : "",
        item.staff_qty > 0 ? item.staff_qty : "",
        item.dc_qty > 0 ? item.dc_qty : "",
        item.price > 0 ? item.price : "",
        item.amount > 0 ? item.amount : "",
      ]),
      [],
      ["", "", "", "", "", "TOTAL", order.total > 0 ? order.total : ""],
      [],
      ["Status:", order.status],
      ["Pickup Date:", order.pickup_date || ""],
      ["Drop Date:", order.drop_date || ""],
      ["Assigned Rider:", order.rider_name || ""],
      [],
      ["Payment:", order.is_paid ? "PAID" : "UNPAID"],
      ...(order.is_paid ? [["Paid Date:", order.paid_date], ["Paid Till:", order.paid_till]] : []),
      [],
      ["Missing Article, if any, should be reported on call on the same day."],
      ["THANK YOU FOR YOUR FAITH ON US."],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    XLSX.writeFile(wb, `Laundrify_${order.invoice_no}_${order.hotel_name.replace(/\s+/g, "_")}.xlsx`);
    toast.success("Excel downloaded");
  };

  const exportAllToExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      ["Invoice No", "Hotel", "Date", "Items", "Total (₹)", "Status", "Rider", "Payment", "Paid Date", "Paid Till"],
      ...filteredOrders.map(o => [
        o.invoice_no, o.hotel_name, o.date, o.items.length, o.total,
        STATUS_LABELS[o.status]?.label || o.status,
        o.rider_name || "",
        o.is_paid ? "PAID" : "UNPAID",
        o.paid_date || "",
        o.paid_till || "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
      { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "All Bills");
    XLSX.writeFile(wb, `Laundrify_Hotel_Bills_${todayStr()}.xlsx`);
    toast.success("All bills exported");
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const filteredOrders = orders.filter(o => {
    if (filterHotelId !== "all" && o.hotel_id !== filterHotelId) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    return true;
  });

  const entryTotal = computeTotal();

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["hotels", "new-entry", "bills"] as SubTab[]).map(tab => (
          <Button
            key={tab}
            variant={subTab === tab ? "default" : "outline"}
            onClick={() => setSubTab(tab)}
            disabled={tab === "new-entry" && hotels.length === 0}
            className="flex items-center gap-2"
          >
            {tab === "hotels" && <Building2 className="h-4 w-4" />}
            {tab === "new-entry" && <Plus className="h-4 w-4" />}
            {tab === "bills" && <List className="h-4 w-4" />}
            {tab === "hotels" ? "Manage Hotels" : tab === "new-entry" ? "New Entry" : "All Bills"}
            {tab === "bills" && orders.length > 0 && (
              <Badge variant="secondary" className="ml-1">{orders.length}</Badge>
            )}
          </Button>
        ))}
        {hotels.length === 0 && subTab !== "hotels" && (
          <span className="text-sm text-orange-600 self-center">Add a hotel first</span>
        )}
      </div>

      {/* ═══════════ HOTELS TAB ═══════════ */}
      {subTab === "hotels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{editingHotelId ? "Edit Hotel" : "Add New Hotel"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Hotel / Party Name *", key: "name", placeholder: "e.g. DM Hotel Sector 45" },
                { label: "Address", key: "address", placeholder: "Sector 45, Gurugram, Haryana" },
                { label: "Contact Person", key: "contact", placeholder: "Manager name" },
                { label: "Phone / Mobile", key: "phone", placeholder: "+91 XXXXX XXXXX" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    value={(hotelForm as any)[key]}
                    onChange={e => setHotelForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <Button onClick={saveHotel} disabled={loading} className="flex-1">
                  {editingHotelId ? "Update Hotel" : "Add Hotel"}
                </Button>
                {editingHotelId && (
                  <Button variant="outline" onClick={() => { setEditingHotelId(null); setHotelForm({ name: "", address: "", contact: "", phone: "" }); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {hotels.length === 0 && (
              <Card><CardContent className="py-10 text-center text-gray-500">No hotels yet. Add one above.</CardContent></Card>
            )}
            {hotels.map(h => (
              <Card key={h._id}>
                <CardContent className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{h.name}</div>
                    {h.address && <div className="text-sm text-gray-500">{h.address}</div>}
                    {h.contact && <div className="text-sm text-gray-500">Contact: {h.contact}</div>}
                    {h.phone && <div className="text-sm text-gray-500">{h.phone}</div>}
                    <div className="text-xs text-blue-600 mt-1">
                      {orders.filter(o => o.hotel_id === h._id).length} entries &bull;{" "}
                      {orders.filter(o => o.hotel_id === h._id && o.is_paid).length} paid
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => {
                      setHotelForm({ name: h.name, address: h.address, contact: h.contact, phone: h.phone });
                      setEditingHotelId(h._id);
                    }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => deleteHotel(h._id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ NEW ENTRY TAB ═══════════ */}
      {subTab === "new-entry" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>New Hotel Laundry Entry</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Select Hotel *</Label>
                  <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
                    <SelectTrigger><SelectValue placeholder="Choose hotel…" /></SelectTrigger>
                    <SelectContent>
                      {hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                </div>
                <div>
                  <Label>Invoice No</Label>
                  <Input value={invoiceNo} readOnly className="bg-gray-50" />
                </div>
              </div>

              {/* Pickup scheduling */}
              <div className="border rounded-lg p-3 bg-blue-50 space-y-2">
                <div className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Schedule Pickup (optional)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Pickup Date</Label>
                    <Input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Pickup Time</Label>
                    <Input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} className="h-8" />
                  </div>
                </div>
              </div>

              {/* Drop scheduling */}
              <div className="border rounded-lg p-3 bg-orange-50 space-y-2">
                <div className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Schedule Drop/Delivery (optional)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Drop Date</Label>
                    <Input type="date" value={dropDate} onChange={e => setDropDate(e.target.value)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Drop Time</Label>
                    <Input type="time" value={dropTime} onChange={e => setDropTime(e.target.value)} className="h-8" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes</Label>
                <Input value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Any special instructions…" />
              </div>

              {/* Items table */}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-3 py-2 text-left w-8 font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Article</th>
                      <th className="px-2 py-2 text-center w-24 font-medium bg-emerald-700">Guest</th>
                      <th className="px-2 py-2 text-center w-24 font-medium bg-amber-700">Staff</th>
                      <th className="px-2 py-2 text-center w-24 font-medium bg-violet-700">DC Pcs</th>
                      <th className="px-3 py-2 text-center w-32 font-medium">
                        Price (₹) <span className="text-xs font-normal opacity-70">optional</span>
                      </th>
                      <th className="px-3 py-2 text-right w-28 font-medium">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HOTEL_ITEMS.map((item, idx) => {
                      const inp = itemInputs[item] ?? { guestQty: "", staffQty: "", dcQty: "", price: "" };
                      const guestQty = parseFloat(inp.guestQty) || 0;
                      const staffQty = parseFloat(inp.staffQty) || 0;
                      const dcQty = parseFloat(inp.dcQty) || 0;
                      const qty = guestQty + staffQty;
                      const price = parseFloat(inp.price) || 0;
                      const amount = qty > 0 && price > 0 ? qty * price : null;
                      const hasAny = qty > 0 || dcQty > 0;
                      return (
                        <tr key={item} className={`border-b transition-colors ${hasAny ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                          <td className="px-3 py-1.5 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-800">{item}</td>
                          <td className="px-2 py-1.5 bg-emerald-50">
                            <Input type="number" min="0" value={inp.guestQty}
                              onChange={e => updateItemField(item, "guestQty", e.target.value)}
                              className="h-8 text-center border-emerald-300 focus:border-emerald-500" placeholder="0" />
                          </td>
                          <td className="px-2 py-1.5 bg-amber-50">
                            <Input type="number" min="0" value={inp.staffQty}
                              onChange={e => updateItemField(item, "staffQty", e.target.value)}
                              className="h-8 text-center border-amber-300 focus:border-amber-500" placeholder="0" />
                          </td>
                          <td className="px-2 py-1.5 bg-violet-50">
                            <Input type="number" min="0" value={inp.dcQty}
                              onChange={e => updateItemField(item, "dcQty", e.target.value)}
                              className="h-8 text-center border-violet-300 focus:border-violet-500" placeholder="0" />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input type="number" min="0" value={inp.price}
                              onChange={e => updateItemField(item, "price", e.target.value)}
                              className="h-8 text-center" placeholder="—" />
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold">
                            {amount !== null ? `₹${amount.toFixed(2)}` : qty > 0 ? <span className="text-gray-400 text-xs font-normal">no price</span> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-900 text-white">
                      <td colSpan={6} className="px-3 py-2 text-right font-bold">TOTAL</td>
                      <td className="px-3 py-2 text-right font-bold">
                        {entryTotal > 0 ? `₹${entryTotal.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setItemInputs({})}>Clear Items</Button>
                <Button onClick={saveEntry} disabled={loading} className="bg-green-600 hover:bg-green-700">
                  {loading ? "Saving…" : "Save Entry & Generate Bill"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════ BILLS TAB ═══════════ */}
      {subTab === "bills" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={filterHotelId} onValueChange={setFilterHotelId}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Hotels" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hotels</SelectItem>
                  {hotels.map(h => <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => { fetchOrders(); fetchHotels(); fetchRiders(); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500">{filteredOrders.length} entries</span>
            </div>
            {filteredOrders.length > 0 && (
              <Button variant="outline" onClick={exportAllToExcel} className="flex items-center gap-2">
                <FileDown className="h-4 w-4" /> Export All Excel
              </Button>
            )}
          </div>

          {filteredOrders.length === 0 && (
            <Card><CardContent className="py-12 text-center text-gray-500">No entries found.</CardContent></Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredOrders.map(order => {
              const st = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-700" };
              const isUploadingPickup = uploadingSlip === `${order._id}-pickup`;
              const isUploadingDrop = uploadingSlip === `${order._id}-drop`;
              return (
                <Card key={order._id} className={order.is_paid ? "border-green-300" : "border-gray-200"}>
                  <CardContent className="py-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-gray-900">{order.hotel_name}</div>
                        <div className="text-xs text-gray-500">
                          {order.invoice_no} &bull; {order.date}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        {order.is_paid && (
                          <Badge className="bg-green-600 text-white text-xs">PAID</Badge>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="text-sm text-gray-600">
                      {order.items.length} items
                      {order.total > 0 && <span className="font-semibold text-gray-900 ml-2">&bull; ₹{order.total.toFixed(2)}</span>}
                    </div>

                    {/* Rider */}
                    {order.rider_name && (
                      <div className="text-xs bg-indigo-50 border border-indigo-200 px-2 py-1 rounded flex items-center gap-1">
                        <User className="h-3 w-3 text-indigo-600" />
                        <span className="text-indigo-800 font-medium">{order.rider_name}</span>
                        {order.rider_phone && <span className="text-indigo-600">&bull; {order.rider_phone}</span>}
                      </div>
                    )}

                    {/* Pickup info */}
                    {order.pickup_date && (
                      <div className="text-xs bg-blue-50 border border-blue-200 px-2 py-1.5 rounded space-y-0.5">
                        <div className="flex items-center gap-1 text-blue-800 font-semibold">
                          <Calendar className="h-3 w-3" /> Pickup: {order.pickup_date} {order.pickup_time && `at ${order.pickup_time}`}
                        </div>
                        {order.pickup_slip_url && (
                          <a href={order.pickup_slip_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                            <ImageIcon className="h-3 w-3" /> View Pickup Slip
                          </a>
                        )}
                      </div>
                    )}

                    {/* Drop info */}
                    {order.drop_date && (
                      <div className="text-xs bg-orange-50 border border-orange-200 px-2 py-1.5 rounded space-y-0.5">
                        <div className="flex items-center gap-1 text-orange-800 font-semibold">
                          <Calendar className="h-3 w-3" /> Drop: {order.drop_date} {order.drop_time && `at ${order.drop_time}`}
                        </div>
                        {order.drop_slip_url && (
                          <a href={order.drop_slip_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-orange-600 hover:underline">
                            <ImageIcon className="h-3 w-3" /> View Drop Slip
                          </a>
                        )}
                      </div>
                    )}

                    {/* Payment */}
                    {order.is_paid && (
                      <div className="text-xs text-green-800 bg-green-50 border border-green-200 px-2 py-1 rounded">
                        Paid on {order.paid_date}{order.paid_till && ` · Till ${order.paid_till}`}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      <Button size="sm" variant="outline" onClick={() => setViewOrder(order)} className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => exportOrderToExcel(order)} className="flex items-center gap-1">
                        <FileDown className="h-3 w-3" /> Excel
                      </Button>

                      {/* Schedule Pickup */}
                      <Button size="sm" variant="outline" className="flex items-center gap-1 text-blue-700 border-blue-200"
                        onClick={() => { setScheduleDialog({ order, type: "pickup" }); setScheduleDate(order.pickup_date || ""); setScheduleTime(order.pickup_time || ""); setScheduleRiderId(order.assigned_rider_id || ""); }}>
                        <Truck className="h-3 w-3" /> Pickup
                      </Button>

                      {/* Schedule Drop */}
                      <Button size="sm" variant="outline" className="flex items-center gap-1 text-orange-700 border-orange-200"
                        onClick={() => { setScheduleDialog({ order, type: "drop" }); setScheduleDate(order.drop_date || ""); setScheduleTime(order.drop_time || ""); setScheduleRiderId(order.assigned_rider_id || ""); }}>
                        <Truck className="h-3 w-3" /> Drop
                      </Button>

                      {/* Upload pickup slip */}
                      <Button size="sm" variant="outline" className="flex items-center gap-1 text-indigo-700 border-indigo-200" disabled={isUploadingPickup}
                        onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleSlipUpload(order._id, f, "pickup"); }; inp.click(); }}>
                        {isUploadingPickup ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                        Pickup Slip
                      </Button>

                      {/* Upload drop slip */}
                      <Button size="sm" variant="outline" className="flex items-center gap-1 text-purple-700 border-purple-200" disabled={isUploadingDrop}
                        onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleSlipUpload(order._id, f, "drop"); }; inp.click(); }}>
                        {isUploadingDrop ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                        Drop Slip
                      </Button>

                      {/* Status update */}
                      <Select value={order.status} onValueChange={val => setStatusDialog({ order, newStatus: val })}>
                        <SelectTrigger className="h-7 text-xs w-36 border-gray-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                            <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Mark paid */}
                      {!order.is_paid && (
                        <Button size="sm" onClick={() => setPayDialog({ order, paidDate: todayStr(), paidTill: "" })}
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white">
                          <CheckCircle className="h-3 w-3" /> Mark Paid
                        </Button>
                      )}

                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => deleteOrder(order._id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ VIEW BILL DIALOG ═══════════ */}
      <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invoice / Bill</DialogTitle></DialogHeader>
          {viewOrder && (
            <div className="text-sm space-y-4">
              <div className="text-center border-b pb-3">
                <div className="text-2xl font-bold">Laundrify</div>
                <div className="text-xs text-gray-500">Laundry &amp; Dry Clean Services</div>
                <div className="text-xs text-gray-500">operationslaundrify@gmail.com &bull; www.laundrify.online</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="font-semibold">Invoice:</span> {viewOrder.invoice_no}</div>
                <div><span className="font-semibold">Date:</span> {viewOrder.date}</div>
                <div><span className="font-semibold">Hotel:</span> {viewOrder.hotel_name}</div>
                <div><span className="font-semibold">Address:</span> {viewOrder.hotel_address || "—"}</div>
                <div><span className="font-semibold">Status:</span> {STATUS_LABELS[viewOrder.status]?.label}</div>
                {viewOrder.rider_name && <div><span className="font-semibold">Rider:</span> {viewOrder.rider_name}</div>}
              </div>

              {/* Pickup/Drop info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-blue-50 rounded p-2">
                  <div className="font-semibold text-blue-800">Pickup</div>
                  <div>{viewOrder.pickup_date || "Not scheduled"} {viewOrder.pickup_time}</div>
                  {viewOrder.pickup_slip_url && (
                    <a href={viewOrder.pickup_slip_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-1">
                      <ImageIcon className="h-3 w-3" /> View Slip
                    </a>
                  )}
                </div>
                <div className="bg-orange-50 rounded p-2">
                  <div className="font-semibold text-orange-800">Drop</div>
                  <div>{viewOrder.drop_date || "Not scheduled"} {viewOrder.drop_time}</div>
                  {viewOrder.drop_slip_url && (
                    <a href={viewOrder.drop_slip_url} target="_blank" rel="noreferrer" className="text-orange-600 hover:underline flex items-center gap-1 mt-1">
                      <ImageIcon className="h-3 w-3" /> View Slip
                    </a>
                  )}
                </div>
              </div>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="border border-gray-600 px-2 py-1.5 text-left w-8">No.</th>
                    <th className="border border-gray-600 px-2 py-1.5 text-left">Article</th>
                    <th className="border border-gray-600 px-2 py-1.5 text-center w-12 bg-emerald-700">Guest</th>
                    <th className="border border-gray-600 px-2 py-1.5 text-center w-12 bg-amber-700">Staff</th>
                    <th className="border border-gray-600 px-2 py-1.5 text-center w-12 bg-violet-700">DC Pcs</th>
                    <th className="border border-gray-600 px-2 py-1.5 text-right w-20">Price</th>
                    <th className="border border-gray-600 px-2 py-1.5 text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {viewOrder.items.map((item, idx) => (
                    <tr key={item.name} className="border-b">
                      <td className="border border-gray-200 px-2 py-1 text-gray-400">{idx + 1}</td>
                      <td className="border border-gray-200 px-2 py-1 font-medium">{item.name}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center bg-emerald-50 text-emerald-800 font-medium">{item.guest_qty > 0 ? item.guest_qty : "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center bg-amber-50 text-amber-800 font-medium">{item.staff_qty > 0 ? item.staff_qty : "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center bg-violet-50 text-violet-800 font-medium">{item.dc_qty > 0 ? item.dc_qty : "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right">{item.price > 0 ? `₹${item.price}` : "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-semibold">{item.amount > 0 ? `₹${item.amount.toFixed(2)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={6} className="border border-gray-300 px-2 py-1.5 text-right">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">{viewOrder.total > 0 ? `₹${viewOrder.total.toFixed(2)}` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex justify-between items-center">
                <div className={`font-bold ${viewOrder.is_paid ? "text-green-700" : "text-red-600"}`}>
                  {viewOrder.is_paid ? `✓ PAID on ${viewOrder.paid_date}${viewOrder.paid_till ? ` (till ${viewOrder.paid_till})` : ""}` : "⏳ PAYMENT PENDING"}
                </div>
                <Button size="sm" onClick={() => exportOrderToExcel(viewOrder)} className="flex items-center gap-1">
                  <FileDown className="h-3 w-3" /> Export Excel
                </Button>
              </div>
              <div className="text-xs text-gray-400 border-t pt-2 text-center">
                Missing Article, if any, should be reported on call on the same day.<br />THANK YOU FOR YOUR FAITH ON US.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════ SCHEDULE DIALOG ═══════════ */}
      <Dialog open={!!scheduleDialog} onOpenChange={() => setScheduleDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {scheduleDialog?.type === "pickup" ? "Schedule Pickup" : "Schedule Drop / Delivery"}
            </DialogTitle>
          </DialogHeader>
          {scheduleDialog && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                <span className="font-semibold">{scheduleDialog.order.hotel_name}</span>
                <span className="mx-2 text-gray-400">&bull;</span>
                {scheduleDialog.order.invoice_no}
              </div>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
              </div>
              <div>
                <Label>Assign Rider</Label>
                <Select value={scheduleRiderId} onValueChange={setScheduleRiderId}>
                  <SelectTrigger><SelectValue placeholder="Select rider…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No rider</SelectItem>
                    {riders.map(r => (
                      <SelectItem key={r._id} value={r._id}>{r.name} &bull; {r.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {riders.length === 0 && <p className="text-xs text-orange-600 mt-1">No active riders found</p>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={confirmSchedule} disabled={!scheduleDate} className="flex-1">
                  Confirm Schedule
                </Button>
                <Button variant="outline" onClick={() => setScheduleDialog(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════ MARK PAID DIALOG ═══════════ */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark as Paid</DialogTitle></DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                <span className="font-semibold">{payDialog.order.hotel_name}</span>
                <span className="mx-2">&bull;</span>{payDialog.order.invoice_no}
                {payDialog.order.total > 0 && <span className="ml-2 font-bold">₹{payDialog.order.total.toFixed(2)}</span>}
              </div>
              <div>
                <Label>Payment Date *</Label>
                <Input type="date" value={payDialog.paidDate} onChange={e => setPayDialog(p => p ? { ...p, paidDate: e.target.value } : null)} />
              </div>
              <div>
                <Label>Paid Till <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input type="date" value={payDialog.paidTill} onChange={e => setPayDialog(p => p ? { ...p, paidTill: e.target.value } : null)} />
                <p className="text-xs text-gray-500 mt-1">The period this payment covers</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={confirmMarkPaid} className="flex-1 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" /> Confirm Paid
                </Button>
                <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════ STATUS CHANGE CONFIRM DIALOG ═══════════ */}
      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change Status</DialogTitle></DialogHeader>
          {statusDialog && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Change <span className="font-semibold">{statusDialog.order.invoice_no}</span> status to{" "}
                <span className="font-semibold text-gray-900">{STATUS_LABELS[statusDialog.newStatus]?.label}</span>?
              </p>
              <div className="flex gap-2">
                <Button onClick={changeStatus} className="flex-1">Confirm</Button>
                <Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminHotelManagement;
