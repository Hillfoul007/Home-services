import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit, RefreshCw, Search, CheckCircle, AlertCircle, UserPlus, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

// ─── Types ───────────────────────────────────────────────────────────────────

interface School {
  _id: string;
  name: string;
  school_code: string;
  pricing: { wash_and_iron: number; wash_and_fold: number };
}

interface SchoolMember {
  _id: string;
  name: string;
  member_id: string;
  class_section: string;
}

interface SchoolOrder {
  _id: string;
  custom_order_id: string;
  school_name: string;
  school_code: string;
  member_id: string;
  member_name: string;
  service: string;
  items_count: number;
  price_per_item: number;
  total_amount: number;
  status: string;
  payment_status: string;
  pickup_date: string | null;
  delivery_date: string | null;
  notes: string;
  created_at: string;
}

// Each row in the bulk booking table
interface OrderRow {
  rowId: string;
  // member fields
  memberSearch: string;       // what user is typing
  member_id: string;          // resolved / typed ID
  member_name: string;        // resolved / typed name
  isNewMember: boolean;       // user is creating a brand-new member
  showDropdown: boolean;
  matchedMembers: SchoolMember[];
  // order fields
  service: "wash_and_iron" | "wash_and_fold";
  items_count: string;
  price_per_item: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SVC_LABELS: Record<string, string> = {
  wash_and_iron: "Wash & Iron",
  wash_and_fold: "Wash & Fold",
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  picked_up:  "bg-blue-100 text-blue-700",
  processing: "bg-purple-100 text-purple-700",
  ready:      "bg-teal-100 text-teal-700",
  delivered:  "bg-green-100 text-green-700",
  cancelled:  "bg-red-100 text-red-700",
};

const MEMBER_ID_RE = /^[A-Za-z]{2}[0-9]{4}$/;

let rowCounter = 0;
const newRowId = () => `row_${++rowCounter}`;

const emptyRow = (service: "wash_and_iron" | "wash_and_fold", price: string): OrderRow => ({
  rowId: newRowId(),
  memberSearch: "",
  member_id: "",
  member_name: "",
  isNewMember: false,
  showDropdown: false,
  matchedMembers: [],
  service,
  items_count: "",
  price_per_item: price,
});

// ─── Component ───────────────────────────────────────────────────────────────

const AdminSchoolBooking: React.FC = () => {
  // ── School & members ──
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [allMembers, setAllMembers] = useState<SchoolMember[]>([]);

  // ── Shared batch settings ──
  const [defaultService, setDefaultService] = useState<"wash_and_iron" | "wash_and_fold">("wash_and_iron");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  // ── Order rows ──
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ created: number; errors: number } | null>(null);

  // ── Orders list ──
  const [orders, setOrders] = useState<SchoolOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSchoolFilter, setOrderSchoolFilter] = useState("all");
  const [orderMemberFilter, setOrderMemberFilter] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  // ── Ref to track active dropdown close ──
  const dropdownTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => { fetchSchools(); }, []); // eslint-disable-line

  const fetchSchools = async () => {
    try {
      const res = await apiClient.adminRequest<any>("/school-management");
      if (res.data?.success) setSchools(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchMembers = async (schoolId: string) => {
    try {
      const res = await apiClient.adminRequest<any>(`/school-management/${schoolId}/members`);
      if (res.data?.success) setAllMembers(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams();
      if (orderSchoolFilter !== "all") params.set("school_id", orderSchoolFilter);
      if (orderMemberFilter.trim()) params.set("member_id", orderMemberFilter.trim());
      if (orderStatusFilter !== "all") params.set("status", orderStatusFilter);
      params.set("limit", "100");
      const res = await apiClient.adminRequest<any>(`/school-orders?${params.toString()}`);
      if (res.data?.success) setOrders(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingOrders(false); }
  }, [orderSchoolFilter, orderMemberFilter, orderStatusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ─── Excel Export ──────────────────────────────────────────────────────────

  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Fetch all matching orders (no pagination cap)
      const params = new URLSearchParams();
      if (orderSchoolFilter !== "all") params.set("school_id", orderSchoolFilter);
      if (orderMemberFilter.trim()) params.set("member_id", orderMemberFilter.trim());
      if (orderStatusFilter !== "all") params.set("status", orderStatusFilter);
      params.set("limit", "10000");
      const res = await apiClient.adminRequest<any>(`/school-orders?${params.toString()}`);
      const allOrders: SchoolOrder[] = res.data?.data || [];

      if (allOrders.length === 0) { toast.error("No orders to export"); return; }

      const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN") : "-";
      const dateKey = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

      // ── Sheet 1: All Orders ──
      const allRows = allOrders.map(o => ({
        "Order ID":       o.custom_order_id,
        "School":         o.school_name,
        "Member ID":      o.member_id,
        "Student Name":   o.member_name,
        "Service":        SVC_LABELS[o.service] || o.service,
        "Items":          o.items_count,
        "Price/Item (₹)": o.price_per_item,
        "Total (₹)":      o.total_amount,
        "Status":         o.status,
        "Payment":        o.payment_status,
        "Pickup Date":    fmt(o.pickup_date),
        "Delivery Date":  fmt(o.delivery_date),
        "Created":        fmt(o.created_at),
      }));

      // ── Sheet 2: Student-wise summary ──
      const studentMap = new Map<string, { name: string; school: string; orders: number; items: number; total: number }>();
      for (const o of allOrders) {
        const key = o.member_id;
        const existing = studentMap.get(key) || { name: o.member_name, school: o.school_name, orders: 0, items: 0, total: 0 };
        existing.orders += 1;
        existing.items  += o.items_count;
        existing.total  += o.total_amount;
        studentMap.set(key, existing);
      }
      const studentRows = [...studentMap.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id, v]) => ({
          "Member ID":    id,
          "Student Name": v.name,
          "School":       v.school,
          "Total Orders": v.orders,
          "Total Items":  v.items,
          "Total (₹)":    v.total,
        }));

      // ── Sheet 3: Date-wise summary ──
      const dateMap = new Map<string, { orders: number; items: number; total: number }>();
      for (const o of allOrders) {
        const key = dateKey(o.created_at);
        const existing = dateMap.get(key) || { orders: 0, items: 0, total: 0 };
        existing.orders += 1;
        existing.items  += o.items_count;
        existing.total  += o.total_amount;
        dateMap.set(key, existing);
      }
      const dateRows = [...dateMap.entries()]
        .sort((a, b) => new Date(a[0].split("/").reverse().join("-")).getTime() - new Date(b[0].split("/").reverse().join("-")).getTime())
        .map(([date, v]) => ({
          "Date":         date,
          "Total Orders": v.orders,
          "Total Items":  v.items,
          "Total (₹)":    v.total,
        }));

      // ── Build workbook ──
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows),     "All Orders");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), "Student-wise");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dateRows),    "Date-wise");

      const schoolLabel = orderSchoolFilter !== "all"
        ? (schools.find(s => s._id === orderSchoolFilter)?.school_code || "SCH")
        : "ALL";
      const filename = `school_orders_${schoolLabel}_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${allOrders.length} orders to ${filename}`);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // ─── School change ─────────────────────────────────────────────────────────

  const handleSchoolChange = (schoolId: string) => {
    const s = schools.find((sc) => sc._id === schoolId) || null;
    setSelectedSchool(s);
    setAllMembers([]);
    const price = s ? String(s.pricing[defaultService]) : "";
    setDefaultPrice(price);
    setRows([emptyRow(defaultService, price)]);
    setLastResult(null);
    if (s) fetchMembers(schoolId);
  };

  const handleDefaultServiceChange = (val: "wash_and_iron" | "wash_and_fold") => {
    setDefaultService(val);
    const price = selectedSchool ? String(selectedSchool.pricing[val]) : defaultPrice;
    setDefaultPrice(price);
    // Update all rows that still have the old default service
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        service: val,
        price_per_item: price,
      }))
    );
  };

  // ─── Row management ───────────────────────────────────────────────────────

  const addRow = () =>
    setRows((prev) => [...prev, emptyRow(defaultService, defaultPrice)]);

  const removeRow = (rowId: string) =>
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));

  const updateRow = (rowId: string, patch: Partial<OrderRow>) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));

  // ─── Member search per row ────────────────────────────────────────────────

  const searchMembers = (query: string): SchoolMember[] => {
    if (!query.trim()) return allMembers.slice(0, 8);
    const lower = query.toLowerCase();
    return allMembers
      .filter(
        (m) =>
          m.name.toLowerCase().includes(lower) ||
          m.member_id.toLowerCase().includes(lower)
      )
      .slice(0, 8);
  };

  const handleMemberSearchInput = (rowId: string, val: string) => {
    const matched = searchMembers(val);
    // Check if typed value looks like a new member ID
    const looksLikeId = MEMBER_ID_RE.test(val.trim());
    const exactMatch = allMembers.find(
      (m) => m.member_id.toLowerCase() === val.trim().toLowerCase()
    );
    updateRow(rowId, {
      memberSearch: val,
      member_id: looksLikeId ? val.toUpperCase() : "",
      member_name: exactMatch ? exactMatch.name : "",
      isNewMember: false,
      matchedMembers: matched,
      showDropdown: true,
    });
  };

  const selectExistingMember = (rowId: string, m: SchoolMember) => {
    updateRow(rowId, {
      memberSearch: `${m.member_id} — ${m.name}`,
      member_id: m.member_id,
      member_name: m.name,
      isNewMember: false,
      showDropdown: false,
      matchedMembers: [],
    });
  };

  const markNewMember = (rowId: string, row: OrderRow) => {
    // Try to parse "ID — Name" or just ID or just name from the search text
    const text = row.memberSearch.trim();
    const sepIdx = text.indexOf("—");
    let id = "";
    let name = text;
    if (sepIdx > -1) {
      id = text.slice(0, sepIdx).trim().toUpperCase();
      name = text.slice(sepIdx + 1).trim();
    } else if (MEMBER_ID_RE.test(text)) {
      id = text.toUpperCase();
      name = "";
    }
    updateRow(rowId, {
      member_id: id,
      member_name: name,
      isNewMember: true,
      showDropdown: false,
      matchedMembers: [],
    });
  };

  const openDropdown = (rowId: string) => {
    clearTimeout(dropdownTimers.current[rowId]);
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    updateRow(rowId, {
      showDropdown: true,
      matchedMembers: searchMembers(row.memberSearch),
    });
  };

  const scheduleCloseDropdown = (rowId: string) => {
    dropdownTimers.current[rowId] = setTimeout(() => {
      updateRow(rowId, { showDropdown: false });
    }, 200);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedSchool) { toast.error("Select a school first"); return; }
    if (rows.length === 0) { toast.error("Add at least one order row"); return; }

    // Validate rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const label = `Row ${i + 1}`;
      if (!r.member_id.trim()) { toast.error(`${label}: member ID is required`); return; }
      if (!MEMBER_ID_RE.test(r.member_id.trim())) {
        toast.error(`${label}: member ID "${r.member_id}" must be 2 letters + 4 digits (e.g. AA1234)`);
        return;
      }
      if (r.isNewMember && !r.member_name.trim()) {
        toast.error(`${label}: name is required for new member ${r.member_id}`);
        return;
      }
      if (!r.items_count || parseInt(r.items_count) < 1) {
        toast.error(`${label}: items count must be ≥ 1`);
        return;
      }
      if (!r.price_per_item || parseFloat(r.price_per_item) <= 0) {
        toast.error(`${label}: price per item must be > 0`);
        return;
      }
    }

    setSubmitting(true);
    setLastResult(null);
    try {
      const res = await apiClient.adminRequest<any>("/school-orders/bulk", {
        method: "POST",
        body: {
          school_id: selectedSchool._id,
          pickup_date: pickupDate || null,
          delivery_date: deliveryDate || null,
          orders: rows.map((r) => ({
            member_id: r.member_id.toUpperCase(),
            member_name: r.member_name.trim(),
            is_new_member: r.isNewMember,
            service: r.service,
            items_count: parseInt(r.items_count),
            price_per_item: parseFloat(r.price_per_item),
          })),
        },
      });

      if (res.data?.success) {
        const { created, errors, error_details } = res.data;
        setLastResult({ created, errors });
        if (created > 0) {
          toast.success(`${created} order${created > 1 ? "s" : ""} created successfully`);
          // Keep rows that failed, clear rows that succeeded
          if (errors > 0 && error_details?.length) {
            const failedIds = new Set(error_details.map((e: any) => e.member_id?.toUpperCase()));
            setRows((prev) => prev.filter((r) => failedIds.has(r.member_id.toUpperCase())));
          } else {
            setRows([emptyRow(defaultService, defaultPrice)]);
          }
          fetchOrders();
          // Refresh member list in case new members were created
          fetchMembers(selectedSchool._id);
        }
        if (errors > 0) {
          error_details?.forEach((e: any) => toast.error(`${e.member_id}: ${e.error}`));
        }
      } else {
        toast.error(res.data?.error || "Failed to create orders");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create orders");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Orders management ────────────────────────────────────────────────────

  const updateOrder = async (orderId: string) => {
    try {
      const res = await apiClient.adminRequest<any>(`/school-orders/${orderId}`, {
        method: "PUT",
        body: { status: editStatus, payment_status: editPaymentStatus },
      });
      if (res.data?.success) {
        toast.success("Order updated");
        setEditingOrderId(null);
        fetchOrders();
      } else toast.error(res.data?.error || "Failed to update");
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteOrder = async (orderId: string, code: string) => {
    if (!confirm(`Delete order ${code}?`)) return;
    try {
      const res = await apiClient.adminRequest<any>(`/school-orders/${orderId}`, { method: "DELETE" });
      if (res.data?.success) { toast.success("Deleted"); fetchOrders(); }
    } catch (err: any) { toast.error(err.message); }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const grandTotal = rows.reduce(
    (sum, r) => sum + (parseInt(r.items_count) || 0) * (parseFloat(r.price_per_item) || 0),
    0
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Booking Card ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Bulk School Laundry Booking
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Result banner */}
          {lastResult && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm border ${lastResult.errors === 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-orange-50 border-orange-200 text-orange-800"}`}>
              {lastResult.errors === 0
                ? <CheckCircle className="w-4 h-4 shrink-0" />
                : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>
                <strong>{lastResult.created}</strong> order{lastResult.created !== 1 ? "s" : ""} created
                {lastResult.errors > 0 && <>, <strong>{lastResult.errors}</strong> failed (see errors below)</>}
              </span>
            </div>
          )}

          {/* ── Step 1: School + shared settings ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">School *</label>
              <Select onValueChange={handleSchoolChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select school..." />
                </SelectTrigger>
                <SelectContent>
                  {schools.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400">No schools — add in Schools tab</div>
                  )}
                  {schools.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      [{s.school_code}] {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Default Service</label>
              <Select value={defaultService} onValueChange={(v) => handleDefaultServiceChange(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wash_and_iron">Wash & Iron</SelectItem>
                  <SelectItem value="wash_and_fold">Wash & Fold</SelectItem>
                </SelectContent>
              </Select>
              {selectedSchool && (
                <p className="text-xs text-gray-400 mt-1">
                  School rate: ₹{selectedSchool.pricing[defaultService]}/item
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Pickup Date</label>
              <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Delivery Date</label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
          </div>

          {/* ── Step 2: Order rows table ── */}
          {selectedSchool && (
            <>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[2fr_1.4fr_1fr_1fr_1fr_auto] gap-0 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <div className="px-3 py-2.5">Member (search or type new)</div>
                  <div className="px-3 py-2.5">Name</div>
                  <div className="px-3 py-2.5">Service</div>
                  <div className="px-3 py-2.5">Pieces</div>
                  <div className="px-3 py-2.5">₹/item</div>
                  <div className="px-3 py-2.5 w-10"></div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-gray-100">
                  {rows.map((row, idx) => {
                    const rowTotal = (parseInt(row.items_count) || 0) * (parseFloat(row.price_per_item) || 0);
                    return (
                      <div key={row.rowId} className="relative">
                        {/* Mobile label */}
                        <div className="md:hidden flex items-center justify-between px-3 pt-3 pb-1">
                          <span className="text-xs font-semibold text-gray-500">Row {idx + 1}</span>
                          {rows.length > 1 && (
                            <button type="button" onClick={() => removeRow(row.rowId)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1fr_1fr_1fr_auto] gap-2 md:gap-0 px-3 md:px-0 pb-3 md:pb-0 items-start">

                          {/* Member ID search */}
                          <div className="relative md:px-2 md:py-2">
                            <div className="relative">
                              {row.isNewMember ? (
                                <div className="flex items-center gap-1.5">
                                  <UserPlus className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <input
                                    type="text"
                                    placeholder="Member ID (AA1234) *"
                                    value={row.member_id}
                                    onChange={(e) => updateRow(row.rowId, { member_id: e.target.value.toUpperCase() })}
                                    maxLength={6}
                                    className={`w-full px-2.5 py-1.5 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 ${MEMBER_ID_RE.test(row.member_id) ? "border-green-400 bg-green-50" : "border-amber-300 bg-amber-50"}`}
                                  />
                                  <button
                                    type="button"
                                    className="text-amber-400 hover:text-red-500 shrink-0 text-lg leading-none"
                                    onClick={() => updateRow(row.rowId, { isNewMember: false, member_id: "", member_name: "", memberSearch: "" })}
                                  >×</button>
                                </div>
                              ) : (
                                <>
                                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                  <input
                                    type="text"
                                    placeholder="ID or name..."
                                    value={row.memberSearch}
                                    onChange={(e) => handleMemberSearchInput(row.rowId, e.target.value)}
                                    onFocus={() => openDropdown(row.rowId)}
                                    onBlur={() => scheduleCloseDropdown(row.rowId)}
                                    className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </>
                              )}
                            </div>

                            {/* Dropdown */}
                            {row.showDropdown && !row.isNewMember && (
                              <div
                                className="absolute top-full left-0 right-0 z-30 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto"
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                {row.matchedMembers.length > 0 ? (
                                  <>
                                    {row.matchedMembers.map((m) => (
                                      <button
                                        key={m._id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center justify-between gap-2"
                                        onClick={() => selectExistingMember(row.rowId, m)}
                                      >
                                        <span className="text-sm">{m.name}
                                          {m.class_section && <span className="text-gray-400 text-xs ml-1">({m.class_section})</span>}
                                        </span>
                                        <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">{m.member_id}</span>
                                      </button>
                                    ))}
                                    <div className="border-t border-gray-100">
                                      <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 text-amber-700 text-sm"
                                        onClick={() => markNewMember(row.rowId, row)}
                                      >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Create new member
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="px-3 py-2">
                                    <p className="text-xs text-gray-400 mb-1">No match found</p>
                                    <button
                                      type="button"
                                      className="w-full text-left flex items-center gap-2 text-amber-700 text-sm py-1 hover:text-amber-900"
                                      onClick={() => markNewMember(row.rowId, row)}
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                      Create new member
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Name — editable if new member, or shows resolved name */}
                          <div className="md:px-2 md:py-2">
                            {row.isNewMember ? (
                              <input
                                type="text"
                                placeholder="Student name *"
                                value={row.member_name}
                                onChange={(e) => updateRow(row.rowId, { member_name: e.target.value })}
                                className="w-full px-2.5 py-1.5 border border-amber-300 bg-amber-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            ) : (
                              <div className="h-9 flex items-center">
                                {row.member_name ? (
                                  <span className="text-sm text-gray-800 font-medium truncate">{row.member_name}</span>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">auto-filled on select</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Service */}
                          <div className="md:px-2 md:py-2">
                            <select
                              value={row.service}
                              onChange={(e) => updateRow(row.rowId, { service: e.target.value as any })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                              <option value="wash_and_iron">Wash & Iron</option>
                              <option value="wash_and_fold">Wash & Fold</option>
                            </select>
                          </div>

                          {/* Pieces */}
                          <div className="md:px-2 md:py-2">
                            <input
                              type="number"
                              min="1"
                              placeholder="Pcs"
                              value={row.items_count}
                              onChange={(e) => updateRow(row.rowId, { items_count: e.target.value })}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                          </div>

                          {/* Price per item */}
                          <div className="md:px-2 md:py-2">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="Price"
                                value={row.price_per_item}
                                onChange={(e) => updateRow(row.rowId, { price_per_item: e.target.value })}
                                className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                            </div>
                            {rowTotal > 0 && (
                              <p className="text-xs text-indigo-600 font-semibold mt-0.5 text-right">= ₹{rowTotal}</p>
                            )}
                          </div>

                          {/* Remove button — desktop */}
                          <div className="hidden md:flex items-center justify-center px-2 py-2">
                            {rows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(row.rowId)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add row footer */}
                <div className="border-t border-gray-100 px-3 py-2.5 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add another member
                  </button>
                  {grandTotal > 0 && (
                    <span className="text-sm font-bold text-gray-800">
                      Grand total: ₹{grandTotal.toFixed(2)} &nbsp;·&nbsp; {rows.length} order{rows.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6"
                >
                  {submitting
                    ? `Creating ${rows.length} order${rows.length !== 1 ? "s" : ""}...`
                    : `Submit ${rows.length} Order${rows.length !== 1 ? "s" : ""}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRows([emptyRow(defaultService, defaultPrice)])}
                >
                  Clear All
                </Button>
                {grandTotal > 0 && (
                  <span className="text-sm text-gray-500">Total: <strong className="text-gray-900">₹{grandTotal.toFixed(2)}</strong></span>
                )}
              </div>
            </>
          )}

          {!selectedSchool && (
            <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <p className="text-sm">Select a school above to start booking</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Orders List ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">All School Orders</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fetchOrders} className="flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={exportToExcel} disabled={exporting}
                className="flex items-center gap-1 border-green-400 text-green-700 hover:bg-green-50">
                <Download className="w-3.5 h-3.5" />
                {exporting ? "Exporting…" : "Export Excel"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <Select value={orderSchoolFilter} onValueChange={setOrderSchoolFilter}>
              <SelectTrigger><SelectValue placeholder="All schools..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s._id} value={s._id}>[{s.school_code}] {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter by member ID..."
              value={orderMemberFilter}
              onChange={(e) => setOrderMemberFilter(e.target.value.toUpperCase())}
              className="font-mono text-sm"
            />
            <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
              <SelectTrigger><SelectValue placeholder="All statuses..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="picked_up">Picked Up</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingOrders ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              <span className="text-sm text-gray-500">Loading...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No school orders found.</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Order ID</th>
                      <th className="px-4 py-3 text-left">School</th>
                      <th className="px-4 py-3 text-left">Member</th>
                      <th className="px-4 py-3 text-left">Service</th>
                      <th className="px-4 py-3 text-right">Pcs</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Payment</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{order.custom_order_id}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{order.school_code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded block w-fit">{order.member_id}</span>
                          <span className="text-xs text-gray-700 font-medium">{order.member_name}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{SVC_LABELS[order.service] || order.service}</td>
                        <td className="px-4 py-3 text-right">{order.items_count}</td>
                        <td className="px-4 py-3 text-right font-semibold">₹{order.total_amount}</td>
                        <td className="px-4 py-3">
                          {editingOrderId === order._id ? (
                            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="text-xs border rounded px-1.5 py-1 bg-white">
                              {["pending","picked_up","processing","ready","delivered","cancelled"].map(s => (
                                <option key={s} value={s}>{s.replace("_"," ")}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>{order.status.replace("_"," ")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingOrderId === order._id ? (
                            <select value={editPaymentStatus} onChange={(e) => setEditPaymentStatus(e.target.value)} className="text-xs border rounded px-1.5 py-1 bg-white">
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${order.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{order.payment_status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(order.pickup_date || order.created_at)}</td>
                        <td className="px-4 py-3">
                          {editingOrderId === order._id ? (
                            <div className="flex gap-1">
                              <Button size="sm" className="h-6 px-2 text-xs" onClick={() => updateOrder(order._id)}>Save</Button>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setEditingOrderId(null)}>×</Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { setEditingOrderId(order._id); setEditStatus(order.status); setEditPaymentStatus(order.payment_status); }}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-red-500 hover:text-red-700" onClick={() => deleteOrder(order._id, order.custom_order_id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {orders.map((order) => (
                  <div key={order._id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{order.custom_order_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || ""}`}>{order.status.replace("_"," ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{order.member_id}</span>
                      <span className="text-sm font-medium">{order.member_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{SVC_LABELS[order.service]} × {order.items_count}</span>
                      <span className="font-bold">₹{order.total_amount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{fmtDate(order.pickup_date || order.created_at)}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { setEditingOrderId(order._id); setEditStatus(order.status); setEditPaymentStatus(order.payment_status); }}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-red-500" onClick={() => deleteOrder(order._id, order.custom_order_id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSchoolBooking;
