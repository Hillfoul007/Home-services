import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getApiUrl } from "@/config/env";

const API = `${getApiUrl()}/vendor`;

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

interface Order {
  _id: string;
  custom_order_id?: string;
  name?: string;
  phone?: string;
  address?: string;
  status?: string;
  final_amount?: number;
  total_price?: number;
  no_of_items?: number;
  created_at?: string;
  readyAt?: string;
  _timeElapsed?: string;
}

export default function DeskReadyPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("desk_vendor_token") || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchProcessing = useCallback(async () => {
    try {
      const res = await fetch(`${API}/orders/dashboard`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) { navigate("/desk"); return; }
        toast.error(data.error || "Failed to load orders");
        return;
      }
      setOrders(data.sections?.processing || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) { navigate("/desk"); return; }
    fetchProcessing();
  }, [fetchProcessing, token, navigate]);

  const markReady = async (orderId: string) => {
    setMarkingId(orderId);
    try {
      const res = await fetch(`${API}/orders/${orderId}/ready`, {
        method: "PUT",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success("Marked ready for delivery!");
      setOrders(prev => prev.filter(o => o._id !== orderId));
    } catch {
      toast.error("Network error");
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => navigate("/desk/dashboard")}
          style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Processing Orders</h1>
        <span style={{
          marginLeft: "auto", background: "#f59e0b", color: "#fff",
          borderRadius: "12px", padding: "2px 10px", fontSize: "13px", fontWeight: 600,
        }}>
          {orders.length}
        </span>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Loading...</div>
      )}

      {!loading && orders.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
          <div style={{ fontSize: "16px" }}>No orders in processing</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {orders.map(order => (
          <div key={order._id} style={{
            background: "#fff", borderRadius: "12px", padding: "16px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontWeight: 700, fontSize: "15px" }}>
                {order.custom_order_id || order._id.slice(-6).toUpperCase()}
              </span>
              {order._timeElapsed && (
                <span style={{ fontSize: "12px", color: "#888" }}>{order._timeElapsed}</span>
              )}
            </div>

            <div style={{ fontSize: "14px", color: "#444", marginBottom: "2px" }}>
              {order.name || "—"}
            </div>
            {order.phone && (
              <div style={{ fontSize: "13px", color: "#888", marginBottom: "4px" }}>{order.phone}</div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
              <span style={{ fontSize: "14px", color: "#333" }}>
                ₹{order.final_amount ?? order.total_price ?? "—"}
                {order.no_of_items ? ` · ${order.no_of_items} items` : ""}
              </span>
              <button
                onClick={() => markReady(order._id)}
                disabled={markingId === order._id}
                style={{
                  background: markingId === order._id ? "#9ca3af" : "#10b981",
                  color: "#fff", border: "none", borderRadius: "8px",
                  padding: "8px 18px", fontSize: "14px", fontWeight: 600,
                  cursor: markingId === order._id ? "not-allowed" : "pointer",
                }}
              >
                {markingId === order._id ? "Marking..." : "Mark Ready"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
