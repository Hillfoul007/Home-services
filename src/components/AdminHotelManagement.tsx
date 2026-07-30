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
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  TrendingUp,
  IndianRupee,
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
  guest_laundry_pcs: number;
  staff_laundry_pcs: number;
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

type ItemInputs = { [item: string]: { qty: string; dcQty: string; price: string } };
type SubTab = "hotels" | "new-entry" | "bills";

// ── Calendar helpers ──────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function calendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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
  const [guestLaundryPcs, setGuestLaundryPcs] = useState("");
  const [staffLaundryPcs, setStaffLaundryPcs] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

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

  // Hotel detail / calendar view
  const [hotelDetailId, setHotelDetailId] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Detailed (piece-wise) report export — month or custom date range
  const [reportMode, setReportMode] = useState<"month" | "range">("month");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

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
    if (subTab === "new-entry" && !editingOrderId) {
      fetchNextInvoice();
      setEntryDate(todayStr());
      setItemInputs({});
      setSelectedHotelId("");
      setPickupDate("");
      setPickupTime("");
      setDropDate("");
      setDropTime("");
      setEntryNotes("");
      setGuestLaundryPcs("");
      setStaffLaundryPcs("");
    }
  }, [subTab]);

  const openEditOrder = (order: HotelOrder) => {
    setEditingOrderId(order._id);
    setInvoiceNo(order.invoice_no);
    setSelectedHotelId(order.hotel_id);
    setEntryDate(order.date);
    setPickupDate(order.pickup_date || "");
    setPickupTime(order.pickup_time || "");
    setDropDate(order.drop_date || "");
    setDropTime(order.drop_time || "");
    setEntryNotes(order.notes || "");
    setGuestLaundryPcs(String(order.guest_laundry_pcs || ""));
    setStaffLaundryPcs(String(order.staff_laundry_pcs || ""));
    // Pre-fill item inputs from saved items
    const inputs: ItemInputs = {};
    for (const item of order.items) {
      inputs[item.name] = {
        qty: item.qty > 0 ? String(item.qty) : "",
        dcQty: item.dc_qty > 0 ? String(item.dc_qty) : "",
        price: item.price > 0 ? String(item.price) : "",
      };
    }
    setItemInputs(inputs);
    setViewOrder(null);
    setSubTab("new-entry");
  };

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

  const updateItemField = (item: string, field: "qty" | "dcQty" | "price", val: string) => {
    setItemInputs(prev => {
      const existing = prev[item] ?? { qty: "", dcQty: "", price: "" };
      return { ...prev, [item]: { ...existing, [field]: val } };
    });
  };

  const computeTotal = () => {
    let total = 0;
    for (const item of HOTEL_ITEMS) {
      const inp = itemInputs[item];
      if (!inp) continue;
      const qty = parseFloat(inp.qty) || 0;
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
      const qty = parseFloat(inp.qty) || 0;
      const dc_qty = parseFloat(inp.dcQty) || 0;
      if (qty <= 0 && dc_qty <= 0) return [];
      const price = parseFloat(inp.price) || 0;
      return [{ name, qty, dc_qty, price, amount: qty * price }];
    });

    if (items.length === 0) { toast.error("Enter at least one item quantity"); return; }

    const total = items.reduce((s, i) => s + i.amount, 0);
    setLoading(true);
    try {
      if (editingOrderId) {
        await apiClient.adminRequest(`/hotel-management/orders/${editingOrderId}`, {
          method: "PATCH",
          body: {
            items,
            total,
            pickup_date: pickupDate,
            pickup_time: pickupTime,
            drop_date: dropDate,
            drop_time: dropTime,
            notes: entryNotes,
            guest_laundry_pcs: parseInt(guestLaundryPcs) || 0,
            staff_laundry_pcs: parseInt(staffLaundryPcs) || 0,
          },
        });
        toast.success("Entry updated!");
        setEditingOrderId(null);
      } else {
        await apiClient.adminRequest("/hotel-management/orders", {
          method: "POST",
          body: {
            hotel_id: hotel._id,
            hotel_name: hotel.name,
            hotel_address: hotel.address,
            date: entryDate,
            items,
            total,
            pickup_date: pickupDate,
            pickup_time: pickupTime,
            drop_date: dropDate,
            drop_time: dropTime,
            notes: entryNotes,
            guest_laundry_pcs: parseInt(guestLaundryPcs) || 0,
            staff_laundry_pcs: parseInt(staffLaundryPcs) || 0,
          },
        });
        toast.success("Entry saved!");
      }
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
      ["No.", "Article", "QTY", "DC Pcs", "Price (₹)", "Amount (₹)"],
      ...order.items.map((item, idx) => [
        idx + 1, item.name, item.qty || "",
        item.dc_qty > 0 ? item.dc_qty : "",
        item.price > 0 ? item.price : "",
        item.amount > 0 ? item.amount : "",
      ]),
      [],
      ["", "", "", "", "TOTAL", order.total > 0 ? order.total : ""],
      [],
      ["Guest & Staff Laundry"],
      ["Guest Laundry:", `${order.guest_laundry_pcs || 0} pcs`],
      ["Staff Laundry:", `${order.staff_laundry_pcs || 0} pcs`],
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
    ws["!cols"] = [{ wch: 5 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    XLSX.writeFile(wb, `Laundrify_${order.invoice_no}_${order.hotel_name.replace(/\s+/g, "_")}.xlsx`);
    toast.success("Excel downloaded");
  };

  const exportAllToExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      ["Invoice No", "Hotel", "Date", "Items", "Total (₹)", "Guest Laundry (pcs)", "Staff Laundry (pcs)", "Status", "Rider", "Payment", "Paid Date", "Paid Till"],
      ...filteredOrders.map(o => [
        o.invoice_no, o.hotel_name, o.date, o.items.length, o.total,
        o.guest_laundry_pcs || 0,
        o.staff_laundry_pcs || 0,
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
      { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "All Bills");
    XLSX.writeFile(wb, `Laundrify_Hotel_Bills_${todayStr()}.xlsx`);
    toast.success("All bills exported");
  };

  // Detailed, piece-wise export — one row per article across the given
  // orders, so quantities can be summed/pivoted per day or per article in
  // Excel rather than just seeing an order-level total.
  const exportDetailedReport = (ordersToExport: HotelOrder[], label: string) => {
    if (ordersToExport.length === 0) {
      toast.error("No entries in this period");
      return;
    }
    const sorted = [...ordersToExport].sort((a, b) => a.date.localeCompare(b.date));
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      ["Date", "Invoice No", "Hotel", "Article", "Qty", "DC Pcs", "Price (₹)", "Amount (₹)", "Guest Laundry (pcs)", "Staff Laundry (pcs)", "Order Total (₹)", "Status", "Payment"],
    ];
    let totalQty = 0;
    let totalAmount = 0;
    for (const o of sorted) {
      const paymentLabel = o.is_paid ? "PAID" : "UNPAID";
      const statusLabel = STATUS_LABELS[o.status]?.label || o.status;
      if (o.items.length === 0) {
        rows.push([o.date, o.invoice_no, o.hotel_name, "", "", "", "", "", o.guest_laundry_pcs || 0, o.staff_laundry_pcs || 0, o.total || 0, statusLabel, paymentLabel]);
      } else {
        for (const item of o.items) {
          rows.push([
            o.date, o.invoice_no, o.hotel_name, item.name,
            item.qty || 0, item.dc_qty || 0, item.price || 0, item.amount || 0,
            o.guest_laundry_pcs || 0, o.staff_laundry_pcs || 0, o.total || 0, statusLabel, paymentLabel,
          ]);
          totalQty += item.qty || 0;
        }
      }
      totalAmount += o.total || 0;
    }
    rows.push([]);
    rows.push(["", "", "", "TOTAL", totalQty, "", "", "", "", "", totalAmount, "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 8 }, { wch: 8 },
      { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Detailed Report");
    XLSX.writeFile(wb, `Laundrify_Detailed_${label}_${todayStr()}.xlsx`);
    toast.success(`Detailed report downloaded (${sorted.length} entries)`);
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const filteredOrders = orders.filter(o => {
    if (filterHotelId !== "all" && o.hotel_id !== filterHotelId) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (reportFrom && o.date && o.date < reportFrom) return false;
    if (reportTo && o.date && o.date > reportTo) return false;
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
      {subTab === "hotels" && !hotelDetailId && (
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
            {hotels.map(h => {
              const hOrders = orders.filter(o => o.hotel_id === h._id);
              const paidCount = hOrders.filter(o => o.is_paid).length;
              const totalRev = hOrders.reduce((s, o) => s + (o.total || 0), 0);
              return (
                <Card
                  key={h._id}
                  className="cursor-pointer border-2 hover:border-purple-300 hover:shadow-md transition-all group"
                  onClick={() => {
                    setHotelDetailId(h._id);
                    setSelectedDay(null);
                    const n = new Date();
                    setCalMonth({ year: n.getFullYear(), month: n.getMonth() });
                  }}
                >
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-900 group-hover:text-purple-700 transition-colors flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                          {h.name}
                        </div>
                        {h.address && (
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{h.address}
                          </div>
                        )}
                        {h.phone && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" />{h.phone}
                          </div>
                        )}
                        <div className="flex gap-3 mt-2 text-xs">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{hOrders.length} entries</span>
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{paidCount} paid</span>
                          {totalRev > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">₹{totalRev.toLocaleString("en-IN")}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50 h-7 text-xs" onClick={() => {
                          setSelectedHotelId(h._id);
                          setEditingOrderId(null);
                          setSubTab("new-entry");
                        }}>
                          <Plus className="h-3 w-3 mr-1" /> New Entry
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                          setHotelForm({ name: h.name, address: h.address, contact: h.contact, phone: h.phone });
                          setEditingHotelId(h._id);
                        }}>
                          <Edit2 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs" onClick={() => deleteHotel(h._id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-purple-600 font-medium flex items-center gap-1 group-hover:text-purple-700">
                      <Calendar className="h-3 w-3" /> Click to view calendar →
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ HOTEL DETAIL + CALENDAR VIEW ═══════════ */}
      {subTab === "hotels" && hotelDetailId && (() => {
        const hotel = hotels.find(h => h._id === hotelDetailId);
        if (!hotel) return null;

        const hOrders = orders.filter(o => o.hotel_id === hotelDetailId);
        const paidCount = hOrders.filter(o => o.is_paid).length;
        const unpaidCount = hOrders.length - paidCount;
        const totalRev = hOrders.reduce((s, o) => s + (o.total || 0), 0);
        const paidRev = hOrders.filter(o => o.is_paid).reduce((s, o) => s + (o.total || 0), 0);

        // Build a set of dates that have entries for this hotel (YYYY-MM-DD)
        const entryDateSet = new Set<string>();
        const entryDateMap = new Map<string, HotelOrder[]>();
        for (const o of hOrders) {
          if (!o.date) continue;
          // Normalise — order.date might be "YYYY-MM-DD" already
          const key = o.date.substring(0, 10);
          entryDateSet.add(key);
          if (!entryDateMap.has(key)) entryDateMap.set(key, []);
          entryDateMap.get(key)!.push(o);
        }

        const { year, month } = calMonth;
        const cells = calendarDays(year, month);
        const today = new Date();
        const todayStr2 = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

        const dayOrders = selectedDay ? (entryDateMap.get(selectedDay) ?? []) : [];

        return (
          <div className="space-y-4">
            {/* Back button + header */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setHotelDetailId(null); setSelectedDay(null); }}
                className="flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> All Hotels
              </Button>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                <span className="text-lg font-bold text-gray-900">{hotel.name}</span>
                {hotel.address && <span className="text-sm text-gray-500 hidden sm:inline">— {hotel.address}</span>}
              </div>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    setSelectedHotelId(hotel._id);
                    setEditingOrderId(null);
                    setSubTab("new-entry");
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> New Entry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setFilterHotelId(hotel._id); setSubTab("bills"); }}
                >
                  <List className="h-4 w-4 mr-1" /> All Bills
                </Button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Entries", value: hOrders.length, icon: <List className="h-4 w-4" />, color: "blue" },
                { label: "Paid", value: paidCount, icon: <CheckCircle className="h-4 w-4" />, color: "green" },
                { label: "Unpaid", value: unpaidCount, icon: <Clock className="h-4 w-4" />, color: "orange" },
                { label: "Revenue", value: `₹${totalRev.toLocaleString("en-IN")}`, icon: <IndianRupee className="h-4 w-4" />, color: "purple" },
              ].map(s => (
                <Card key={s.label} className={`border-${s.color}-200`}>
                  <CardContent className="py-3 px-4">
                    <div className={`flex items-center gap-2 text-${s.color}-600 mb-1`}>
                      {s.icon}
                      <span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
                    </div>
                    <div className={`text-2xl font-black text-${s.color}-700`}>{s.value}</div>
                    {s.label === "Revenue" && paidRev > 0 && paidRev < totalRev && (
                      <div className="text-xs text-green-600 mt-0.5">₹{paidRev.toLocaleString("en-IN")} received</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* ── Calendar ── */}
              <Card className="lg:col-span-3">
                <CardContent className="p-4">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCalMonth(p => {
                        const d = new Date(p.year, p.month - 1);
                        return { year: d.getFullYear(), month: d.getMonth() };
                      })}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="text-center">
                      <div className="text-base font-bold text-gray-900">{MONTHS[month]} {year}</div>
                      <div className="text-xs text-gray-400">
                        {entryDateSet.size > 0
                          ? `${Array.from(entryDateSet).filter(d => d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length} entries this month`
                          : "No entries this month"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCalMonth(p => {
                        const d = new Date(p.year, p.month + 1);
                        return { year: d.getFullYear(), month: d.getMonth() };
                      })}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {WEEKDAYS.map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                      if (!day) return <div key={`empty-${i}`} />;
                      const dateStr = toDateStr(year, month, day);
                      const hasEntry = entryDateSet.has(dateStr);
                      const isToday = dateStr === todayStr2;
                      const isSelected = dateStr === selectedDay;
                      const dayEntries = entryDateMap.get(dateStr) ?? [];
                      const allPaid = dayEntries.length > 0 && dayEntries.every(o => o.is_paid);
                      const somePaid = dayEntries.some(o => o.is_paid) && !allPaid;

                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                          className={[
                            "relative flex flex-col items-center justify-center rounded-xl py-1.5 text-sm font-semibold transition-all",
                            hasEntry
                              ? isSelected
                                ? "bg-green-600 text-white shadow-lg scale-105"
                                : "bg-green-100 text-green-800 hover:bg-green-200 hover:scale-105 cursor-pointer"
                              : isToday
                              ? "bg-purple-100 text-purple-700 ring-2 ring-purple-400"
                              : "text-gray-400 hover:bg-gray-50 cursor-default",
                          ].join(" ")}
                        >
                          <span>{day}</span>
                          {hasEntry && (
                            <span className={[
                              "flex gap-0.5 mt-0.5",
                            ].join(" ")}>
                              {dayEntries.slice(0, 3).map((_, di) => (
                                <span
                                  key={di}
                                  className={[
                                    "w-1 h-1 rounded-full",
                                    isSelected
                                      ? "bg-white"
                                      : allPaid
                                      ? "bg-green-500"
                                      : somePaid
                                      ? "bg-yellow-500"
                                      : "bg-orange-400",
                                  ].join(" ")}
                                />
                              ))}
                              {dayEntries.length > 3 && (
                                <span className={`text-[8px] leading-none ${isSelected ? "text-white" : "text-green-700"}`}>
                                  +{dayEntries.length - 3}
                                </span>
                              )}
                            </span>
                          )}
                          {isToday && !hasEntry && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 border border-green-400 inline-block" /> Has entry</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Fully paid</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Unpaid</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 ring-1 ring-purple-400 inline-block" /> Today</span>
                  </div>
                </CardContent>
              </Card>

              {/* ── Selected day panel ── */}
              <div className="lg:col-span-2 space-y-3">
                {!selectedDay && (
                  <Card className="h-full">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                      <Calendar className="h-12 w-12 mb-3 text-gray-200" />
                      <div className="font-medium">Select a date</div>
                      <div className="text-xs mt-1">Green dates have laundry entries</div>
                    </CardContent>
                  </Card>
                )}
                {selectedDay && dayOrders.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-gray-400 text-sm">
                      No entries on {selectedDay}
                    </CardContent>
                  </Card>
                )}
                {selectedDay && dayOrders.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-800 text-sm">
                        {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </div>
                      <Badge className="bg-green-100 text-green-700 text-xs">{dayOrders.length} {dayOrders.length === 1 ? "entry" : "entries"}</Badge>
                    </div>
                    {dayOrders.map(order => {
                      const st = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-700" };
                      return (
                        <Card key={order._id} className={`border-l-4 ${order.is_paid ? "border-l-green-500" : "border-l-orange-400"}`}>
                          <CardContent className="py-3 px-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-gray-900 text-sm">{order.invoice_no}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {order.items.length} items
                              {order.total > 0 && <span className="font-bold text-gray-800 ml-2">₹{order.total.toFixed(0)}</span>}
                            </div>
                            {(order.guest_laundry_pcs > 0 || order.staff_laundry_pcs > 0) && (
                              <div className="flex gap-2 text-xs">
                                {order.guest_laundry_pcs > 0 && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Guest: {order.guest_laundry_pcs} pcs</span>}
                                {order.staff_laundry_pcs > 0 && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Staff: {order.staff_laundry_pcs} pcs</span>}
                              </div>
                            )}
                            {order.is_paid ? (
                              <div className="text-xs text-green-700 font-semibold flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Paid {order.paid_date ? `on ${order.paid_date}` : ""}
                              </div>
                            ) : (
                              <div className="text-xs text-orange-600 font-semibold">⏳ Payment pending</div>
                            )}
                            <div className="flex gap-1.5 pt-1">
                              <Button size="sm" variant="outline" className="h-6 text-xs flex-1" onClick={() => setViewOrder(order)}>
                                <Eye className="h-3 w-3 mr-1" /> View
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 text-xs flex-1 text-violet-700 border-violet-200" onClick={() => openEditOrder(order)}>
                                <Edit2 className="h-3 w-3 mr-1" /> Edit
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => exportOrderToExcel(order)}>
                                <FileDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* ── Detailed (piece-wise) report download ── */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-purple-600" /> Download Detailed Report
                  </div>
                  <div className="flex gap-2">
                    {(["month", "range"] as const).map(m => (
                      <Button
                        key={m}
                        size="sm"
                        variant={reportMode === m ? "default" : "outline"}
                        onClick={() => setReportMode(m)}
                      >
                        {m === "month" ? "Full Month" : "Custom Range"}
                      </Button>
                    ))}
                  </div>
                </div>

                {reportMode === "month" ? (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-gray-500">
                      Every article/piece for <span className="font-semibold text-gray-700">{MONTHS[month]} {year}</span> (the month shown in the calendar above), one row per item.
                    </p>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                      onClick={() => {
                        const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
                        const monthOrders = hOrders.filter(o => o.date?.startsWith(prefix));
                        exportDetailedReport(monthOrders, `${hotel.name.replace(/\s+/g, "_")}_${prefix}`);
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1.5" /> Download {MONTHS[month]}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 flex-wrap">
                    <div>
                      <Label className="text-xs">From</Label>
                      <Input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <Input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="h-9" />
                    </div>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 h-9"
                      disabled={!reportFrom || !reportTo}
                      onClick={() => {
                        const rangeOrders = hOrders.filter(o => o.date && o.date >= reportFrom && o.date <= reportTo);
                        exportDetailedReport(rangeOrders, `${hotel.name.replace(/\s+/g, "_")}_${reportFrom}_to_${reportTo}`);
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1.5" /> Download Range
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* ═══════════ NEW ENTRY TAB ═══════════ */}
      {subTab === "new-entry" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {editingOrderId ? `Edit Entry — ${invoiceNo}` : "New Hotel Laundry Entry"}
              {editingOrderId && (
                <Button size="sm" variant="outline" onClick={() => { setEditingOrderId(null); setSubTab("bills"); }}>
                  Cancel Edit
                </Button>
              )}
            </CardTitle>
          </CardHeader>
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
                      <th className="px-3 py-2 text-center w-24 font-medium">QTY</th>
                      <th className="px-2 py-2 text-center w-24 font-medium bg-violet-700">DC Pcs</th>
                      <th className="px-3 py-2 text-center w-32 font-medium">
                        Price (₹) <span className="text-xs font-normal opacity-70">optional</span>
                      </th>
                      <th className="px-3 py-2 text-right w-28 font-medium">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HOTEL_ITEMS.map((item, idx) => {
                      const inp = itemInputs[item] ?? { qty: "", dcQty: "", price: "" };
                      const qty = parseFloat(inp.qty) || 0;
                      const dcQty = parseFloat(inp.dcQty) || 0;
                      const price = parseFloat(inp.price) || 0;
                      const amount = qty > 0 && price > 0 ? qty * price : null;
                      const hasAny = qty > 0 || dcQty > 0;
                      return (
                        <tr key={item} className={`border-b transition-colors ${hasAny ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                          <td className="px-3 py-1.5 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-800">{item}</td>
                          <td className="px-3 py-1.5">
                            <Input type="number" min="0" value={inp.qty}
                              onChange={e => updateItemField(item, "qty", e.target.value)}
                              className="h-8 text-center" placeholder="0" />
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
                      <td colSpan={5} className="px-3 py-2 text-right font-bold">TOTAL</td>
                      <td className="px-3 py-2 text-right font-bold">
                        {entryTotal > 0 ? `₹${entryTotal.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Guest / Staff laundry totals */}
              <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                <div className="text-sm font-semibold text-gray-700">Guest &amp; Staff Laundry (total pieces)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-emerald-700 font-semibold">Guest Laundry Pcs</Label>
                    <Input type="number" min="0" value={guestLaundryPcs}
                      onChange={e => setGuestLaundryPcs(e.target.value)}
                      className="h-8 text-center border-emerald-300" placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs text-amber-700 font-semibold">Staff Laundry Pcs</Label>
                    <Input type="number" min="0" value={staffLaundryPcs}
                      onChange={e => setStaffLaundryPcs(e.target.value)}
                      className="h-8 text-center border-amber-300" placeholder="0" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setItemInputs({})}>Clear Items</Button>
                <Button onClick={saveEntry} disabled={loading} className="bg-green-600 hover:bg-green-700">
                  {loading ? "Saving…" : editingOrderId ? "Update Entry" : "Save Entry & Generate Bill"}
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
              <Input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="h-9 w-36" title="From date" />
              <Input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="h-9 w-36" title="To date" />
              {(reportFrom || reportTo) && (
                <Button size="sm" variant="ghost" onClick={() => { setReportFrom(""); setReportTo(""); }}>Clear dates</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { fetchOrders(); fetchHotels(); fetchRiders(); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500">{filteredOrders.length} entries</span>
            </div>
            {filteredOrders.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => exportDetailedReport(filteredOrders, reportFrom || reportTo ? `${reportFrom || "start"}_to_${reportTo || "end"}` : "AllBills")}
                  className="flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" /> Detailed (piece-wise)
                </Button>
                <Button variant="outline" onClick={exportAllToExcel} className="flex items-center gap-2">
                  <FileDown className="h-4 w-4" /> Export All Excel
                </Button>
              </div>
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
                      <Button size="sm" variant="outline" onClick={() => openEditOrder(order)} className="flex items-center gap-1 text-violet-700 border-violet-200">
                        <Edit2 className="h-3 w-3" /> Edit
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
                    <th className="border border-gray-600 px-2 py-1.5 text-center w-12">QTY</th>
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
                      <td className="border border-gray-200 px-2 py-1 text-center">{item.qty || "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center bg-violet-50 text-violet-800 font-medium">{item.dc_qty > 0 ? item.dc_qty : "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right">{item.price > 0 ? `₹${item.price}` : "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-semibold">{item.amount > 0 ? `₹${item.amount.toFixed(2)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">{viewOrder.total > 0 ? `₹${viewOrder.total.toFixed(2)}` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-center">
                  <div className="text-emerald-600 font-semibold">Guest Laundry</div>
                  <div className="text-xl font-bold text-emerald-800">
                    {viewOrder.guest_laundry_pcs || 0} <span className="text-sm font-normal">pcs</span>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-center">
                  <div className="text-amber-600 font-semibold">Staff Laundry</div>
                  <div className="text-xl font-bold text-amber-800">
                    {viewOrder.staff_laundry_pcs || 0} <span className="text-sm font-normal">pcs</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center gap-2 flex-wrap">
                <div className={`font-bold ${viewOrder.is_paid ? "text-green-700" : "text-red-600"}`}>
                  {viewOrder.is_paid ? `✓ PAID on ${viewOrder.paid_date}${viewOrder.paid_till ? ` (till ${viewOrder.paid_till})` : ""}` : "⏳ PAYMENT PENDING"}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditOrder(viewOrder)} className="flex items-center gap-1 text-violet-700 border-violet-200">
                    <Edit2 className="h-3 w-3" /> Edit Entry
                  </Button>
                  <Button size="sm" onClick={() => exportOrderToExcel(viewOrder)} className="flex items-center gap-1">
                    <FileDown className="h-3 w-3" /> Export Excel
                  </Button>
                </div>
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
