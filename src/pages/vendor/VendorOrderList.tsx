import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, TrendingUp, Package, CheckCircle, Clock } from "lucide-react";

interface Order {
  _id: string;
  custom_order_id?: string;
  name?: string;
  phone?: string;
  service?: string;
  status?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  delivery_date?: string;
  final_amount?: number;
  total_price?: number;
  isPGOrder?: boolean;
  pg_name?: string;
  no_of_items?: number;
  created_at?: string;
}

interface Props {
  orders: Order[];
  onRefresh: () => void;
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  vendor_assigned:     "bg-blue-100 text-blue-700",
  pickup_completed:    "bg-yellow-100 text-yellow-700",
  in_progress:         "bg-purple-100 text-purple-700",
  ready_for_delivery:  "bg-orange-100 text-orange-700",
  delivered:           "bg-teal-100 text-teal-700",
  completed:           "bg-green-100 text-green-700",
  cancelled:           "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  vendor_assigned:    "Assigned",
  pickup_completed:   "Picked Up",
  in_progress:        "Processing",
  ready_for_delivery: "Ready",
  delivered:          "Delivered",
  completed:          "Completed",
  cancelled:          "Cancelled",
};

const ALL_STATUSES = ["vendor_assigned","pickup_completed","in_progress","ready_for_delivery","delivered","completed","cancelled"];

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function VendorOrderList({ orders, onRefresh, loading }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      // search
      if (search) {
        const q = search.toLowerCase();
        const id = (o.custom_order_id || o._id || "").toLowerCase();
        const name = (o.name || "").toLowerCase();
        const phone = (o.phone || "");
        if (!id.includes(q) && !name.includes(q) && !phone.includes(search)) return false;
      }
      // status
      if (filterStatus && o.status !== filterStatus) return false;
      // date range (use scheduled_date or created_at)
      const refDate = o.scheduled_date || o.created_at?.split("T")[0] || "";
      if (dateFrom && refDate && refDate < dateFrom) return false;
      if (dateTo   && refDate && refDate > dateTo)   return false;
      return true;
    });
  }, [orders, search, filterStatus, dateFrom, dateTo]);

  // Summary stats
  const totalEarnings = filtered.reduce((s, o) => s + (o.final_amount ?? o.total_price ?? 0), 0);
  const completed  = filtered.filter(o => o.status === "completed" || o.status === "delivered").length;
  const active     = filtered.filter(o => o.status !== "completed" && o.status !== "delivered" && o.status !== "cancelled").length;

  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <Package className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{filtered.length}</p>
          <p className="text-xs text-gray-500">Total Orders</p>
        </Card>
        <Card className="p-3 text-center">
          <Clock className="w-5 h-5 text-orange-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-orange-600">{active}</p>
          <p className="text-xs text-gray-500">Active</p>
        </Card>
        <Card className="p-3 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-purple-700">₹{fmt(totalEarnings)}</p>
          <p className="text-xs text-gray-500">Total Amount</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by Order ID, name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">All Status</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="h-10" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
        {(search || filterStatus || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(""); setFilterStatus(""); setDateFrom(""); setDateTo(""); }}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </Card>

      {/* Order list */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p>No orders found</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["#", "Order ID", "Customer", "Phone", "Service", "Date", "Amount", "Status"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((o, idx) => (
                  <tr key={o._id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono font-semibold text-blue-600 text-xs">
                        {o.custom_order_id || o._id?.slice(-8)}
                      </span>
                      {o.isPGOrder && <span className="ml-1 text-xs bg-purple-100 text-purple-600 px-1 rounded">PG</span>}
                    </td>
                    <td className="px-3 py-3 font-medium">{o.name || "—"}</td>
                    <td className="px-3 py-3 text-gray-500">{o.phone || "—"}</td>
                    <td className="px-3 py-3 text-gray-600 max-w-[140px] truncate">
                      {o.isPGOrder ? `🏠 ${o.pg_name || "PG"}` : (o.service || "—")}
                    </td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                      {fmtDate(o.scheduled_date || o.created_at?.split("T")[0])}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      ₹{fmt(o.final_amount ?? o.total_price ?? 0)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status || ""] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[o.status || ""] || o.status || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={6} className="px-3 py-3 font-semibold text-gray-700">Total ({filtered.length} orders)</td>
                  <td className="px-3 py-3 font-bold text-purple-700">₹{fmt(totalEarnings)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((o, idx) => (
              <Card key={o._id} className="p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                      <span className="font-mono text-xs font-semibold text-blue-600">
                        {o.custom_order_id || o._id?.slice(-8)}
                      </span>
                      {o.isPGOrder && <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded">PG</span>}
                    </div>
                    <p className="font-semibold text-sm">{o.name || "—"}</p>
                    <p className="text-xs text-gray-500">{o.phone || "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {o.isPGOrder ? `🏠 ${o.pg_name || "PG"}` : o.service || "—"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDate(o.scheduled_date || o.created_at?.split("T")[0])}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-bold text-sm">₹{fmt(o.final_amount ?? o.total_price ?? 0)}</p>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status || ""] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[o.status || ""] || o.status || "—"}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
            {/* Mobile total */}
            <Card className="p-3 bg-purple-50 border-purple-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-purple-800">{filtered.length} orders total</span>
                <span className="text-lg font-bold text-purple-700">₹{fmt(totalEarnings)}</span>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
