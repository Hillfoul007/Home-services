import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, CheckCircle, Trash2, Edit, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

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

const SERVICE_LABELS: Record<string, string> = {
  wash_and_iron: "Wash & Iron",
  wash_and_fold: "Wash & Fold",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  picked_up: "bg-blue-100 text-blue-700",
  processing: "bg-purple-100 text-purple-700",
  ready: "bg-teal-100 text-teal-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const AdminSchoolBooking: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [filteredMembers, setFilteredMembers] = useState<SchoolMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<SchoolMember | null>(null);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  // Order form
  const [service, setService] = useState<"wash_and_iron" | "wash_and_fold">("wash_and_iron");
  const [itemsCount, setItemsCount] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<SchoolOrder | null>(null);

  // Orders list
  const [orders, setOrders] = useState<SchoolOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSchoolFilter, setOrderSchoolFilter] = useState("all");
  const [orderMemberFilter, setOrderMemberFilter] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");

  useEffect(() => {
    fetchSchools();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSchools = async () => {
    try {
      const res = await apiClient.adminRequest<any>("/school-management");
      if (res.data?.success) setSchools(res.data.data || []);
    } catch (err) {
      console.error("Error fetching schools:", err);
    }
  };

  const fetchMembers = async (schoolId: string) => {
    try {
      const res = await apiClient.adminRequest<any>(`/school-management/${schoolId}/members`);
      if (res.data?.success) setMembers(res.data.data || []);
    } catch (err) {
      console.error("Error fetching members:", err);
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams();
      if (orderSchoolFilter && orderSchoolFilter !== "all") params.set("school_id", orderSchoolFilter);
      if (orderMemberFilter.trim()) params.set("member_id", orderMemberFilter.trim());
      if (orderStatusFilter && orderStatusFilter !== "all") params.set("status", orderStatusFilter);
      params.set("limit", "100");

      const res = await apiClient.adminRequest<any>(`/school-orders?${params.toString()}`);
      if (res.data?.success) setOrders(res.data.data || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  }, [orderSchoolFilter, orderMemberFilter, orderStatusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSchoolChange = (schoolId: string) => {
    const s = schools.find((sc) => sc._id === schoolId) || null;
    setSelectedSchool(s);
    setSelectedMember(null);
    setMemberSearch("");
    setMembers([]);
    setFilteredMembers([]);
    if (s) {
      fetchMembers(schoolId);
      setCustomPrice(String(s.pricing[service]));
    }
  };

  const handleServiceChange = (val: "wash_and_iron" | "wash_and_fold") => {
    setService(val);
    if (selectedSchool) {
      setCustomPrice(String(selectedSchool.pricing[val]));
    }
  };

  const handleMemberSearch = (val: string) => {
    setMemberSearch(val);
    setShowMemberDropdown(true);
    if (!val.trim()) {
      setFilteredMembers(members.slice(0, 10));
    } else {
      const lower = val.toLowerCase();
      setFilteredMembers(
        members.filter(
          (m) =>
            m.name.toLowerCase().includes(lower) ||
            m.member_id.toLowerCase().includes(lower)
        ).slice(0, 10)
      );
    }
  };

  const selectMember = (m: SchoolMember) => {
    setSelectedMember(m);
    setMemberSearch(`${m.member_id} — ${m.name}`);
    setShowMemberDropdown(false);
  };

  const handleMemberInputFocus = () => {
    setShowMemberDropdown(true);
    setFilteredMembers(members.slice(0, 10));
  };

  const pricePerItem = parseFloat(customPrice) || 0;
  const totalAmount = (parseInt(itemsCount) || 0) * pricePerItem;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSchool) { toast.error("Please select a school"); return; }
    if (!selectedMember) { toast.error("Please select a member"); return; }
    if (!itemsCount || parseInt(itemsCount) < 1) { toast.error("Please enter items count"); return; }
    if (pricePerItem <= 0) { toast.error("Price per item must be greater than 0"); return; }

    setSubmitting(true);
    try {
      const res = await apiClient.adminRequest<any>("/school-orders", {
        method: "POST",
        body: {
          school_id: selectedSchool._id,
          member_id: selectedMember.member_id,
          service,
          items_count: parseInt(itemsCount),
          price_per_item: pricePerItem,
          pickup_date: pickupDate || null,
          delivery_date: deliveryDate || null,
          notes: notes.trim(),
          payment_method: "monthly_bill",
        },
      });

      if (res.data?.success) {
        setSuccessOrder(res.data.data);
        toast.success(`Order created: ${res.data.data.custom_order_id}`);
        // Reset form
        setSelectedMember(null);
        setMemberSearch("");
        setItemsCount("");
        setNotes("");
        setPickupDate("");
        setDeliveryDate("");
        fetchOrders();
      } else {
        toast.error(res.data?.error || "Failed to create order");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

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
      } else {
        toast.error(res.data?.error || "Failed to update");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const deleteOrder = async (orderId: string, orderCode: string) => {
    if (!confirm(`Delete order ${orderCode}?`)) return;
    try {
      const res = await apiClient.adminRequest<any>(`/school-orders/${orderId}`, { method: "DELETE" });
      if (res.data?.success) {
        toast.success("Order deleted");
        fetchOrders();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      {/* Booking Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Book School Laundry Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          {successOrder && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Order <span className="font-mono font-bold">{successOrder.custom_order_id}</span> created for{" "}
                <strong>{successOrder.member_name}</strong> ({successOrder.member_id}) — ₹{successOrder.total_amount}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* School & Service row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">School *</label>
                <Select onValueChange={handleSchoolChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select school..." />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        [{s.school_code}] {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {schools.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No schools found. Add schools in the Schools tab first.</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Service *</label>
                <Select value={service} onValueChange={(v) => handleServiceChange(v as any)}>
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
                    School price: ₹{selectedSchool.pricing[service]}/item
                  </p>
                )}
              </div>
            </div>

            {/* Member search */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Member (Name or ID) *
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder={selectedSchool ? "Search by name or member ID..." : "Select a school first"}
                  value={memberSearch}
                  onChange={(e) => handleMemberSearch(e.target.value)}
                  onFocus={handleMemberInputFocus}
                  onBlur={() => setTimeout(() => setShowMemberDropdown(false), 200)}
                  disabled={!selectedSchool}
                  className="pl-8"
                />
                {showMemberDropdown && filteredMembers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                    {filteredMembers.map((m) => (
                      <button
                        key={m._id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-2"
                        onClick={() => selectMember(m)}
                      >
                        <div>
                          <span className="font-medium text-sm">{m.name}</span>
                          {m.class_section && (
                            <span className="text-xs text-gray-400 ml-1">({m.class_section})</span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                          {m.member_id}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedMember && (
                <div className="mt-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                  <span className="font-mono text-xs text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                    {selectedMember.member_id}
                  </span>
                  <span className="text-sm font-medium text-indigo-900">{selectedMember.name}</span>
                  {selectedMember.class_section && (
                    <span className="text-xs text-gray-500">({selectedMember.class_section})</span>
                  )}
                  <button
                    type="button"
                    className="ml-auto text-gray-400 hover:text-red-500"
                    onClick={() => { setSelectedMember(null); setMemberSearch(""); }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Items & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Items Count *</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 10"
                  value={itemsCount}
                  onChange={(e) => setItemsCount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Price per Item (₹) *
                  <span className="text-xs font-normal text-gray-400 ml-1">(editable)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Custom price"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Total Amount</label>
                <div className="h-10 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-900">
                  {totalAmount > 0 ? `₹${totalAmount.toFixed(2)}` : "—"}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Pickup Date</label>
                <Input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Delivery Date</label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <Input
                placeholder="Any special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Summary & Submit */}
            {selectedSchool && selectedMember && itemsCount && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-700">
                <span>🏫 <strong>{selectedSchool.name}</strong></span>
                <span>👤 <span className="font-mono text-indigo-700">{selectedMember.member_id}</span> {selectedMember.name}</span>
                <span>🧺 {SERVICE_LABELS[service]}</span>
                <span>📦 {itemsCount} items × ₹{customPrice} = <strong>₹{totalAmount.toFixed(2)}</strong></span>
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Creating Order..." : "Create School Order"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">School Orders</CardTitle>
            <Button size="sm" variant="outline" onClick={fetchOrders} className="flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <Select value={orderSchoolFilter} onValueChange={setOrderSchoolFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All schools..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    [{s.school_code}] {s.name}
                  </SelectItem>
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
              <SelectTrigger>
                <SelectValue placeholder="All statuses..." />
              </SelectTrigger>
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
              <span className="text-sm text-gray-500">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No school orders found.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Order ID</th>
                      <th className="px-4 py-3 text-left">School</th>
                      <th className="px-4 py-3 text-left">Member</th>
                      <th className="px-4 py-3 text-left">Service</th>
                      <th className="px-4 py-3 text-right">Items</th>
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
                          <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {order.custom_order_id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{order.school_code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-block w-fit">
                              {order.member_id}
                            </span>
                            <span className="text-gray-900 text-xs font-medium">{order.member_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {SERVICE_LABELS[order.service] || order.service}
                        </td>
                        <td className="px-4 py-3 text-right">{order.items_count}</td>
                        <td className="px-4 py-3 text-right font-semibold">₹{order.total_amount}</td>
                        <td className="px-4 py-3">
                          {editingOrderId === order._id ? (
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="text-xs border rounded px-1.5 py-1 bg-white"
                            >
                              {["pending","picked_up","processing","ready","delivered","cancelled"].map(s => (
                                <option key={s} value={s}>{s.replace("_"," ")}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
                              {order.status.replace("_"," ")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingOrderId === order._id ? (
                            <select
                              value={editPaymentStatus}
                              onChange={(e) => setEditPaymentStatus(e.target.value)}
                              className="text-xs border rounded px-1.5 py-1 bg-white"
                            >
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${order.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                              {order.payment_status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{formatDate(order.created_at)}</td>
                        <td className="px-4 py-3">
                          {editingOrderId === order._id ? (
                            <div className="flex gap-1">
                              <Button size="sm" className="h-6 px-2 text-xs" onClick={() => updateOrder(order._id)}>Save</Button>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setEditingOrderId(null)}>×</Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={() => {
                                  setEditingOrderId(order._id);
                                  setEditStatus(order.status);
                                  setEditPaymentStatus(order.payment_status);
                                }}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-red-500 hover:text-red-700"
                                onClick={() => deleteOrder(order._id, order.custom_order_id)}
                              >
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

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {orders.map((order) => (
                  <div key={order._id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {order.custom_order_id}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || ""}`}>
                        {order.status.replace("_"," ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{order.member_id}</span>
                      <span className="text-sm font-medium">{order.member_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{SERVICE_LABELS[order.service]} × {order.items_count}</span>
                      <span className="font-bold">₹{order.total_amount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{formatDate(order.created_at)}</span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => {
                            setEditingOrderId(order._id);
                            setEditStatus(order.status);
                            setEditPaymentStatus(order.payment_status);
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-red-500"
                          onClick={() => deleteOrder(order._id, order.custom_order_id)}
                        >
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
