import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getApiUrl } from "@/config/env";
import { LogOut, Search, RefreshCw, Filter, X } from "lucide-react";

interface SchoolInfo {
  _id: string;
  name: string;
  school_code: string;
  manager_username: string;
  pricing: { wash_and_iron: number; wash_and_fold: number };
}

interface SchoolOrder {
  _id: string;
  custom_order_id: string;
  member_id: string;
  member_name: string;
  service: "wash_and_iron" | "wash_and_fold";
  items_count: number;
  price_per_item: number;
  total_amount: number;
  status: string;
  payment_status: string;
  pickup_date: string | null;
  delivery_date: string | null;
  delivered_at: string | null;
  notes: string;
  created_at: string;
}

const SERVICE_LABELS: Record<string, string> = {
  wash_and_iron: "Wash & Iron",
  wash_and_fold: "Wash & Fold",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  picked_up: "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-purple-100 text-purple-800 border-purple-200",
  ready: "bg-teal-100 text-teal-800 border-teal-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const SchoolManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [orders, setOrders] = useState<SchoolOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  // Filters
  const [studentName, setStudentName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const getToken = () => localStorage.getItem("school_manager_token") || "";

  const apiBase = getApiUrl();

  const fetchOrders = useCallback(
    async (showLoader = true) => {
      const token = getToken();
      if (!token) {
        navigate("/school-manager");
        return;
      }
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      try {
        const params = new URLSearchParams();
        if (studentName.trim()) params.set("student_name", studentName.trim());
        if (memberId.trim()) params.set("member_id", memberId.trim());
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
        params.set("limit", "100");

        const res = await fetch(`${apiBase}/school-orders/my-orders?${params.toString()}`, {
          headers: {
            "school-token": token,
          },
        });

        if (res.status === 401) {
          localStorage.removeItem("school_manager_token");
          localStorage.removeItem("school_manager_info");
          navigate("/school-manager");
          return;
        }

        const data = await res.json();
        if (data.success) {
          setOrders(data.data || []);
          setTotal(data.pagination?.total || 0);
        } else {
          toast.error(data.error || "Failed to load orders");
        }
      } catch (err) {
        toast.error("Failed to load orders");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studentName, memberId, dateFrom, dateTo, apiBase]
  );

  useEffect(() => {
    // Load school info from localStorage
    const token = getToken();
    if (!token) {
      navigate("/school-manager");
      return;
    }
    const info = localStorage.getItem("school_manager_info");
    if (info) {
      try {
        setSchool(JSON.parse(info));
      } catch {}
    }
    fetchOrders();
  }, [navigate, fetchOrders]);

  const handleLogout = () => {
    localStorage.removeItem("school_manager_token");
    localStorage.removeItem("school_manager_info");
    navigate("/school-manager");
  };

  const clearFilters = () => {
    setStudentName("");
    setMemberId("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = studentName || memberId || dateFrom || dateTo;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">🏫</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none">
                {school?.name || "School Manager"}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Code: <span className="font-mono text-indigo-600">{school?.school_code}</span>
                {school?.pricing && (
                  <span className="ml-2">
                    · Iron: ₹{school.pricing.wash_and_iron} · Fold: ₹{school.pricing.wash_and_fold}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Orders", value: total, color: "text-gray-900" },
            {
              label: "Pending",
              value: orders.filter((o) => o.status === "pending").length,
              color: "text-yellow-700",
            },
            {
              label: "Processing",
              value: orders.filter((o) => ["picked_up", "processing", "ready"].includes(o.status)).length,
              color: "text-blue-700",
            },
            {
              label: "Delivered",
              value: orders.filter((o) => o.status === "delivered").length,
              color: "text-green-700",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter Orders</span>
              {hasActiveFilters && (
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                onClick={() => fetchOrders(false)}
                disabled={refreshing}
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Student name..."
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Member ID (e.g. AA1234)..."
                value={memberId}
                onChange={(e) => setMemberId(e.target.value.toUpperCase())}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button
              onClick={() => fetchOrders()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Orders{" "}
              <span className="text-gray-400 font-normal ml-1">({orders.length} shown)</span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
              <span className="text-gray-500 text-sm">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📦</p>
              <p className="text-sm">No orders found</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-2 text-sm text-indigo-500 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Order ID</th>
                      <th className="px-4 py-3 text-left">Member ID</th>
                      <th className="px-4 py-3 text-left">Student Name</th>
                      <th className="px-4 py-3 text-left">Service</th>
                      <th className="px-4 py-3 text-right">Items</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {order.custom_order_id}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {order.member_id}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{order.member_name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {SERVICE_LABELS[order.service] || order.service}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{order.items_count}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          ₹{order.total_amount}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(order.created_at)}</td>
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {order.member_id}
                      </span>
                      <span className="font-medium text-gray-900 text-sm">{order.member_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{SERVICE_LABELS[order.service]} × {order.items_count}</span>
                      <span className="font-semibold text-gray-900">₹{order.total_amount}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Ordered: {formatDate(order.created_at)}
                    </div>
                    {order.notes && (
                      <p className="text-xs text-gray-500 italic">{order.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchoolManagerDashboard;
