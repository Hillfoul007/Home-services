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
  no_of_items?: number;
  pickup_pieces?: number;
  item_prices?: { service_name: string; quantity: number; unit_price: number; total_price: number }[];
  scheduled_date?: string;
  scheduled_time?: string;
  delivery_date?: string;
  created_at?: string;
  readyAt?: string;
  _timeElapsed?: string;
}

function fmtDate(d?: string) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(t?: string) {
  if (!t) return null;
  // Already a time string like "14:30" or "2:30 PM"
  if (!t.includes("T")) return t;
  const date = new Date(t);
  if (isNaN(date.getTime())) return t;
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
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
    localStorage.setItem("desk_last_route", "#/desk/ready");
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
    <div style={{
      minHeight: "100vh", background: "#f0f0f0",
      padding: "0", maxWidth: "480px", margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fff", borderBottom: "1px solid #e5e5e5",
        display: "flex", alignItems: "center", gap: "14px",
        padding: "16px 18px",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, lineHeight: 1.1 }}>Processing</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>Mark orders ready for delivery</p>
        </div>
        <div style={{
          marginLeft: "auto", background: "#f59e0b", color: "#fff",
          borderRadius: "20px", padding: "4px 14px", fontSize: "16px", fontWeight: 700,
          minWidth: "36px", textAlign: "center",
        }}>
          {orders.length}
        </div>
      </div>

      <div style={{ padding: "14px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px", color: "#888", fontSize: "18px" }}>
            Loading...
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#888" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>✅</div>
            <div style={{ fontSize: "20px", fontWeight: 600 }}>All clear!</div>
            <div style={{ fontSize: "16px", marginTop: "6px" }}>No orders in processing</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {orders.map(order => (
            <div key={order._id} style={{
              background: "#fff", borderRadius: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden",
            }}>
              {/* Order header bar */}
              <div style={{
                background: "#7c3aed", padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: "18px", letterSpacing: "0.5px" }}>
                  {order.custom_order_id || order._id.slice(-6).toUpperCase()}
                </span>
                {order._timeElapsed && (
                  <span style={{
                    background: "rgba(255,255,255,0.2)", color: "#fff",
                    borderRadius: "8px", padding: "2px 10px", fontSize: "13px", fontWeight: 600,
                  }}>
                    {order._timeElapsed}
                  </span>
                )}
              </div>

              <div style={{ padding: "14px 16px" }}>
                {/* Customer info */}
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#111", marginBottom: "2px" }}>
                  {order.name || "—"}
                </div>
                {order.phone && (
                  <div style={{ fontSize: "16px", color: "#555", marginBottom: "12px" }}>{order.phone}</div>
                )}

                {/* Dates row */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
                  {(order.scheduled_date || order.scheduled_time) && (
                    <div style={{
                      flex: 1, minWidth: "120px",
                      background: "#eff6ff", borderRadius: "10px", padding: "10px 12px",
                    }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                        📦 Pickup
                      </div>
                      {order.scheduled_date && (
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e40af" }}>
                          {fmtDate(order.scheduled_date)}
                        </div>
                      )}
                      {order.scheduled_time && (
                        <div style={{ fontSize: "15px", color: "#3b82f6", fontWeight: 600 }}>
                          {fmtTime(order.scheduled_time)}
                        </div>
                      )}
                    </div>
                  )}
                  {order.delivery_date && (
                    <div style={{
                      flex: 1, minWidth: "120px",
                      background: "#f0fdf4", borderRadius: "10px", padding: "10px 12px",
                    }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                        🚚 Delivery
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#15803d" }}>
                        {fmtDate(order.delivery_date)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pieces count */}
                {order.pickup_pieces != null && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "8px",
                    background: "#ede9fe", borderRadius: "10px", padding: "8px 14px",
                    marginBottom: "12px",
                  }}>
                    <span style={{ fontSize: "20px" }}>🧺</span>
                    <span style={{ fontSize: "17px", fontWeight: 800, color: "#6d28d9" }}>
                      {order.pickup_pieces} pieces
                    </span>
                  </div>
                )}

                {/* Cart items */}
                {order.item_prices && order.item_prices.length > 0 && (
                  <div style={{
                    borderTop: "1px solid #f0f0f0", paddingTop: "12px",
                    display: "flex", flexDirection: "column", gap: "8px",
                    marginBottom: "12px",
                  }}>
                    {order.item_prices.map((item, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span style={{ fontSize: "16px", color: "#333", fontWeight: 500 }}>
                          {item.service_name}
                        </span>
                        <span style={{
                          background: "#f3f4f6", borderRadius: "8px",
                          padding: "3px 10px", fontSize: "15px", fontWeight: 700, color: "#444",
                        }}>
                          × {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mark Ready button */}
                <button
                  onClick={() => markReady(order._id)}
                  disabled={markingId === order._id}
                  style={{
                    width: "100%",
                    background: markingId === order._id ? "#9ca3af" : "#10b981",
                    color: "#fff", border: "none", borderRadius: "12px",
                    padding: "16px", fontSize: "18px", fontWeight: 800,
                    cursor: markingId === order._id ? "not-allowed" : "pointer",
                    letterSpacing: "0.3px",
                  }}
                >
                  {markingId === order._id ? "Marking..." : "✅ Mark Ready for Delivery"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
