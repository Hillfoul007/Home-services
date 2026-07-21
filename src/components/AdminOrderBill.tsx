import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Eye, Download, RefreshCw, Receipt } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ItemPrice {
  service_name?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  price?: number;
  total_price?: number;
}

interface ChargesBreakdown {
  base_price?: number;
  tax_amount?: number;
  service_fee?: number;
  delivery_fee?: number;
}

interface OrderRecord {
  _id: string;
  custom_order_id: string;
  name: string;
  phone: string;
  service?: string;
  services?: string[];
  scheduled_date?: string;
  scheduled_time?: string;
  delivery_date?: string;
  address?: string;
  status: string;
  total_price?: number;
  final_amount?: number;
  created_at?: string;
  completed_at?: string;
  payment_status?: string;
  item_prices?: ItemPrice[];
  charges_breakdown?: ChargesBreakdown;
  discount_amount?: number;
  discount_percent?: number;
  cashback_amount?: number;
  cashback?: number;
  wallet_applied?: number;
  coupon_code?: string;
  is_vendor_order?: boolean;
  vendor_client_name?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtDate = (s?: string) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

// ── Bill HTML generator ────────────────────────────────────────────────────────

function buildOrderBillHTML(order: OrderRecord): string {
  const items = order.item_prices || [];

  const itemRows = items.length
    ? items
        .map((it) => {
          const name = it.service_name || it.name || "Item";
          const qty = Number(it.quantity) || 0;
          const unit = Number(it.unit_price ?? it.price) || 0;
          const total = Number(it.total_price) || (qty && unit ? qty * unit : unit) || 0;
          return `<tr>
            <td style="text-align:left;font-weight:600;color:#444;">${name}</td>
            <td>${qty || "—"}</td>
            <td>${unit ? "₹ " + fmt(unit) : "—"}</td>
            <td style="font-weight:700;color:#7c3aed;">₹ ${fmt(total)}</td>
          </tr>`;
        })
        .join("\n")
    : `<tr><td colspan="4" style="text-align:center;color:#aaa;font-style:italic;padding:16px;">${
        order.service || (order.services || []).join(", ") || "Laundry Service"
      }</td></tr>`;

  const charges = order.charges_breakdown || {};
  const baseTotal =
    Number(charges.base_price) ||
    items.reduce((s, it) => s + (Number(it.total_price) || (Number(it.quantity) || 0) * (Number(it.unit_price ?? it.price) || 0)), 0) ||
    Number(order.total_price) ||
    0;

  const discountAmt = Number(order.discount_amount) || 0;
  const cashbackAmt = Number(order.cashback_amount) || Number(order.cashback) || 0;
  const walletApplied = Number(order.wallet_applied) || 0;
  const finalAmount = Number(order.final_amount) || Number(order.total_price) || baseTotal;

  const statusColor =
    order.payment_status === "paid" || order.status === "completed" || order.status === "delivered"
      ? "#16a34a"
      : "#d97706";
  const statusLabel = order.payment_status
    ? order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)
    : order.status;

  const billDate = fmtDate(order.completed_at || order.created_at);
  const clientLabel = order.is_vendor_order && order.vendor_client_name ? order.vendor_client_name : order.name;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Laundrify Bill – #${order.custom_order_id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;padding:40px 20px}
  .wrap{width:680px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(196,109,216,.18),0 2px 8px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#C46DD8 0%,#F36BAF 50%,#C46DD8 100%);padding:32px 36px 28px;display:flex;align-items:center;justify-content:space-between;color:#fff}
  .logo-area{display:flex;align-items:center;gap:16px}
  .logo-box{width:64px;height:64px;background:rgba(255,255,255,.95);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15)}
  .logo-box svg{width:42px;height:42px}
  .brand{font-size:28px;font-weight:800;letter-spacing:-.5px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.15)}
  .tagline{font-size:12px;color:rgba(255,255,255,.85);margin-top:2px;letter-spacing:.5px;text-transform:uppercase}
  .inv-label{font-size:13px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.8)}
  .inv-num{font-size:30px;font-weight:800;line-height:1}
  .contact{background:linear-gradient(135deg,#b05ec5,#e05ca0);padding:8px 36px;display:flex;gap:28px;font-size:12px;color:rgba(255,255,255,.9)}
  .meta{padding:24px 36px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #eee;background:#fafafa}
  .bill-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#999;font-weight:600}
  .client{font-size:20px;font-weight:700;color:#2d2d2d;margin-top:4px}
  .client-type{font-size:13px;color:#888;margin-top:2px}
  .meta-r{text-align:right}
  .mrow{display:flex;justify-content:flex-end;gap:12px;margin-bottom:6px;font-size:13px}
  .mlabel{color:#999}
  .mval{font-weight:600;color:#2d2d2d;min-width:140px;text-align:right}
  .tbl-wrap{padding:0 36px 24px}
  table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:18px}
  thead tr{background:linear-gradient(135deg,#C46DD8,#F36BAF);color:#fff}
  thead th{padding:11px 14px;text-align:center;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.8px}
  thead th:first-child{text-align:left}
  tbody tr{border-bottom:1px solid #f0f0f0}
  tbody tr:last-child{border-bottom:none}
  td{padding:10px 14px;text-align:center;color:#333}
  .amt-wrap{display:flex;justify-content:flex-end;padding:20px 0 0}
  .amt-tbl{min-width:280px;font-size:13.5px}
  .amt-tbl td{padding:6px 10px;color:#555;text-align:right}
  .amt-tbl td:first-child{text-align:left;color:#888}
  .sub-row td{border-top:1px solid #eee}
  .grand-row td{font-size:17px;font-weight:800;color:#fff;background:linear-gradient(135deg,#C46DD8,#F36BAF);padding:10px 14px}
  .grand-row td:first-child{border-radius:8px 0 0 8px}
  .grand-row td:last-child{border-radius:0 8px 8px 0}
  .footer{background:#1a1a2e;padding:20px 36px;display:flex;justify-content:space-between;align-items:center;color:rgba(255,255,255,.7);font-size:12px}
  .auth-line{width:140px;border-bottom:1px solid rgba(255,255,255,.3);margin-bottom:5px;height:28px}
  .wm{text-align:center;padding:10px;font-size:10px;color:#ccc;background:#f9f9f9;letter-spacing:1px;text-transform:uppercase}
  @media print{body{background:#fff;padding:0}.wrap{box-shadow:none;border-radius:0}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="logo-area">
      <div class="logo-box">
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="g1" x1="0" y1="0" x2="80" y2="80"><stop offset="0%" stop-color="#C46DD8"/><stop offset="100%" stop-color="#F36BAF"/></linearGradient></defs>
          <rect width="80" height="80" rx="16" fill="url(#g1)"/>
          <rect x="10" y="14" width="60" height="52" rx="8" fill="none" stroke="white" stroke-width="2.5"/>
          <rect x="12" y="18" width="56" height="10" rx="4" fill="white" opacity="0.3"/>
          <circle cx="22" cy="23" r="3" fill="white" opacity="0.9"/>
          <circle cx="32" cy="23" r="3" fill="white" opacity="0.6"/>
          <circle cx="40" cy="44" r="20" fill="none" stroke="white" stroke-width="3.5"/>
          <circle cx="40" cy="44" r="12" fill="none" stroke="white" stroke-width="2"/>
        </svg>
      </div>
      <div>
        <div class="brand">Laundrify</div>
        <div class="tagline">Laundry &amp; Dry Clean Services</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="inv-label">Bill</div>
      <div class="inv-num">#${order.custom_order_id}</div>
    </div>
  </div>

  <div class="contact">
    <span>📞 +91 70115 85587</span>
    <span>✉ operationslaundrify@gmail.com</span>
    <span>🌐 www.laundrify.online</span>
  </div>

  <div class="meta">
    <div>
      <div class="bill-label">Billed To</div>
      <div class="client">${clientLabel || "Customer"}</div>
      <div class="client-type">${order.phone || ""}</div>
      <div class="client-type" style="max-width:280px">${order.address || ""}</div>
    </div>
    <div class="meta-r">
      <div class="mrow"><span class="mlabel">Order ID</span><span class="mval">${order.custom_order_id}</span></div>
      <div class="mrow"><span class="mlabel">Bill Date</span><span class="mval">${billDate}</span></div>
      <div class="mrow"><span class="mlabel">Payment</span><span class="mval" style="color:${statusColor};font-weight:700;">● ${statusLabel}</span></div>
    </div>
  </div>

  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Item / Service</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="amt-wrap">
      <table class="amt-tbl">
        <tbody>
          <tr class="sub-row"><td>Sub-Total</td><td>₹ ${fmt(baseTotal)}</td></tr>
          ${Number(charges.tax_amount) > 0 ? `<tr><td>Tax</td><td>₹ ${fmt(Number(charges.tax_amount))}</td></tr>` : ""}
          ${Number(charges.service_fee) > 0 ? `<tr><td>Service Fee</td><td>₹ ${fmt(Number(charges.service_fee))}</td></tr>` : ""}
          ${Number(charges.delivery_fee) > 0 ? `<tr><td>Delivery Fee</td><td>₹ ${fmt(Number(charges.delivery_fee))}</td></tr>` : ""}
          ${discountAmt > 0 ? `<tr><td>Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}</td><td>− ₹ ${fmt(discountAmt)}</td></tr>` : ""}
          ${cashbackAmt > 0 ? `<tr><td>Cashback</td><td>− ₹ ${fmt(cashbackAmt)}</td></tr>` : ""}
          ${walletApplied > 0 ? `<tr><td>Wallet Applied</td><td>− ₹ ${fmt(walletApplied)}</td></tr>` : ""}
          <tr class="grand-row"><td>GRAND TOTAL</td><td>₹ ${fmt(finalAmount)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <div>
      <div style="color:rgba(255,255,255,.85);font-weight:600;margin-bottom:4px;">Thank you for your business!</div>
      <div style="font-size:11px;color:rgba(255,255,255,.45);">E. &amp; O.E. · Computer generated bill</div>
    </div>
    <div style="text-align:right">
      <div class="auth-line"></div>
      <span style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px">Authorised Signatory</span>
    </div>
  </div>

  <div class="wm">Laundrify · Laundry &amp; Dry Clean Services · +91 70115 85587</div>
</div>
</body>
</html>`;
}

// ── Component ──────────────────────────────────────────────────────────────────

const AdminOrderBill: React.FC = () => {
  const [orderIdInput, setOrderIdInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<OrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [searched, setSearched] = useState(false);

  const searchOrder = async () => {
    const term = orderIdInput.trim();
    if (!term) {
      toast.error("Enter an order ID to search");
      return;
    }
    setSearching(true);
    setSelectedOrder(null);
    setResults([]);
    setSearched(true);
    try {
      const res = await apiClient.adminRequest<{ orders: OrderRecord[] }>(
        `/admin/bookings/search?q=${encodeURIComponent(term)}&limit=20`
      );
      const orders = res.data?.orders || [];
      if (orders.length === 0) {
        toast.warning("No order found matching that ID");
        return;
      }
      const exact = orders.find(
        (o) => o.custom_order_id?.toLowerCase() === term.toLowerCase()
      );
      if (exact) {
        setSelectedOrder(exact);
        setResults([]);
      } else {
        setResults(orders);
      }
    } catch (e: any) {
      toast.error(`Search failed: ${e?.message || "Unknown error"}`);
    } finally {
      setSearching(false);
    }
  };

  const pickOrder = (order: OrderRecord) => {
    setSelectedOrder(order);
    setResults([]);
  };

  const openBill = () => {
    if (!selectedOrder) return;
    const html = buildOrderBillHTML(selectedOrder);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const downloadBill = () => {
    if (!selectedOrder) return;
    const html = buildOrderBillHTML(selectedOrder);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laundrify-Bill-${selectedOrder.custom_order_id}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success("Bill downloaded");
  };

  const finalAmount = selectedOrder
    ? Number(selectedOrder.final_amount) || Number(selectedOrder.total_price) || 0
    : 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-purple-600" />
            Generate Digital Bill by Order ID
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Order ID e.g. A20250800100"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchOrder()}
              className="flex-1"
            />
            <Button
              onClick={searchOrder}
              disabled={searching}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {searching ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-1.5" />
              )}
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>

          {searched && !searching && results.length === 0 && !selectedOrder && (
            <p className="text-sm text-orange-600">No order found matching that ID. Check the spelling and try again.</p>
          )}

          {results.length > 0 && (
            <div className="border rounded-lg divide-y">
              <p className="text-xs text-gray-500 px-3 py-2 bg-gray-50">
                Multiple matches found — select the correct order:
              </p>
              {results.map((o) => (
                <button
                  key={o._id}
                  onClick={() => pickOrder(o)}
                  className="w-full text-left px-3 py-2 hover:bg-purple-50 flex items-center justify-between text-sm"
                >
                  <span>
                    <span className="font-semibold">#{o.custom_order_id}</span> — {o.name} ({o.phone})
                  </span>
                  <span className="text-gray-400">₹{fmt(Number(o.final_amount) || Number(o.total_price) || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedOrder && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <FileText className="h-5 w-5 text-purple-600" />
              Bill Preview
              <Badge variant="secondary" className="text-xs">#{selectedOrder.custom_order_id}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Customer</p>
                <p className="font-medium">{selectedOrder.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="font-medium">{selectedOrder.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-medium capitalize">{selectedOrder.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment</p>
                <p className="font-medium capitalize">{selectedOrder.payment_status || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Address</p>
                <p className="font-medium">{selectedOrder.address || "—"}</p>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
              <span className="text-sm text-purple-800 font-medium">Grand Total</span>
              <span className="text-xl font-bold text-purple-700">₹ {fmt(finalAmount)}</span>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={openBill}>
                <Eye className="h-4 w-4 mr-1.5" />
                Open Bill
              </Button>
              <Button onClick={downloadBill} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Download className="h-4 w-4 mr-1.5" />
                Download Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminOrderBill;
