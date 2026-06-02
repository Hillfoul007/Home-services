import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, ArrowLeft, ArrowRight, Eye, Download } from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface InvoiceSetup {
  invoiceNo: string;
  hotelName: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
}

interface Rates {
  hotel: number;
  dc: number;
  guest: number;
}

interface Entry {
  id: number;
  date: string;
  hotel: number | "";
  dc: number | "";
  guest: number | "";
}

type Step = "setup" | "rates" | "entries" | "preview";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 0 });

const sumField = (entries: Entry[], field: keyof Entry): number =>
  entries.reduce((a, e) => a + (Number(e[field]) || 0), 0);

// ── Invoice HTML generator ─────────────────────────────────────────────────────

function buildInvoiceHTML(
  setup: InvoiceSetup,
  rates: Rates,
  entries: Entry[]
): string {
  const hotelTotal = sumField(entries, "hotel");
  const dcTotal = sumField(entries, "dc");
  const guestTotal = sumField(entries, "guest");
  const hotelAmt = hotelTotal * rates.hotel;
  const dcAmt = dcTotal * rates.dc;
  const guestAmt = guestTotal * rates.guest;
  const grandTotal = hotelAmt + dcAmt + guestAmt;

  const rows = entries
    .map((e) => {
      const h = Number(e.hotel) || 0;
      const d = Number(e.dc) || 0;
      const g = Number(e.guest) || 0;
      const cell = (v: number) =>
        v > 0
          ? `<td>${v}</td>`
          : `<td style="color:#ccc;font-style:italic;">—</td>`;
      const amtCell = (v: number) =>
        v > 0
          ? `<td>₹ ${fmt(v)}</td>`
          : `<td style="color:#ccc;font-style:italic;">—</td>`;
      return `<tr>
        <td style="text-align:left;font-weight:600;color:#555;">${e.date}</td>
        ${cell(h)}${cell(d)}${cell(g)}
        ${amtCell(h * rates.hotel)}${amtCell(d * rates.dc)}${amtCell(g * rates.guest)}
      </tr>`;
    })
    .join("\n");

  const periodLabel = setup.periodStart === setup.periodEnd
    ? setup.periodStart
    : `${setup.periodStart} – ${setup.periodEnd}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Laundrify Invoice #${setup.invoiceNo} – ${setup.hotelName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;padding:40px 20px}
    .wrap{width:720px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(196,109,216,.18),0 2px 8px rgba(0,0,0,.08)}
    .hdr{background:linear-gradient(135deg,#C46DD8 0%,#F36BAF 50%,#C46DD8 100%);padding:32px 36px 28px;display:flex;align-items:center;justify-content:space-between;color:#fff}
    .logo-area{display:flex;align-items:center;gap:16px}
    .logo-box{width:64px;height:64px;background:rgba(255,255,255,.95);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15)}
    .logo-box svg{width:42px;height:42px}
    .brand{font-size:28px;font-weight:800;letter-spacing:-.5px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.15)}
    .tagline{font-size:12px;color:rgba(255,255,255,.85);margin-top:2px;letter-spacing:.5px;text-transform:uppercase}
    .inv-label{font-size:13px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.8)}
    .inv-num{font-size:36px;font-weight:800;line-height:1}
    .contact{background:linear-gradient(135deg,#b05ec5,#e05ca0);padding:8px 36px;display:flex;gap:28px;font-size:12px;color:rgba(255,255,255,.9)}
    .meta{padding:24px 36px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #eee;background:#fafafa}
    .bill-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#999;font-weight:600}
    .client{font-size:20px;font-weight:700;color:#2d2d2d;margin-top:4px}
    .client-type{font-size:13px;color:#888;margin-top:2px}
    .badge{display:inline-block;background:linear-gradient(135deg,#C46DD8,#F36BAF);color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;letter-spacing:.5px;margin-top:4px}
    .meta-r{text-align:right}
    .mrow{display:flex;justify-content:flex-end;gap:12px;margin-bottom:6px;font-size:13px}
    .mlabel{color:#999}
    .mval{font-weight:600;color:#2d2d2d;min-width:140px;text-align:right}
    .tbl-wrap{padding:0 36px 24px}
    .legend{display:flex;gap:16px;margin:18px 0 14px;font-size:12px;color:#777;flex-wrap:wrap}
    .legend span{background:#f3e8ff;color:#9333ea;padding:3px 10px;border-radius:20px;font-weight:600}
    table{width:100%;border-collapse:collapse;font-size:13.5px}
    thead tr{background:linear-gradient(135deg,#C46DD8,#F36BAF);color:#fff}
    thead th{padding:11px 14px;text-align:center;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.8px}
    thead th:first-child{text-align:left}
    tbody tr{border-bottom:1px solid #f0f0f0}
    tbody tr:hover{background:#fdf5ff}
    tbody tr:last-child{border-bottom:none}
    td{padding:10px 14px;text-align:center;color:#333}
    .totals-row td{background:#f3e8ff;font-weight:700;color:#6b21a8;border-top:2px solid #d8b4fe;padding:12px 14px}
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
      <div class="inv-label">Invoice</div>
      <div class="inv-num">#${setup.invoiceNo}</div>
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
      <div class="client">${setup.hotelName}</div>
      <div class="client-type">Hospitality – Commercial Account</div>
      <div class="badge">${periodLabel}</div>
    </div>
    <div class="meta-r">
      <div class="mrow"><span class="mlabel">Invoice No.</span><span class="mval">${setup.invoiceNo}</span></div>
      <div class="mrow"><span class="mlabel">Issue Date</span><span class="mval">${setup.issueDate}</span></div>
      <div class="mrow"><span class="mlabel">Service Period</span><span class="mval">${periodLabel}</span></div>
      <div class="mrow"><span class="mlabel">Status</span><span class="mval" style="color:#16a34a;font-weight:700;">● Issued</span></div>
    </div>
  </div>

  <div class="tbl-wrap">
    <div class="legend">
      Rates applied:
      ${rates.hotel > 0 ? `<span>Hotel Linen — ₹${rates.hotel}/pc</span>` : ""}
      ${rates.dc > 0 ? `<span>Dry Clean (DC) — ₹${rates.dc}/pc</span>` : ""}
      ${rates.guest > 0 ? `<span>Guest Items — ₹${rates.guest}/pc</span>` : ""}
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Date</th>
          <th>Hotel (pcs)</th>
          <th>DC (pcs)</th>
          <th>Guest (pcs)</th>
          <th>Hotel Amt</th>
          <th>DC Amt</th>
          <th>Guest Amt</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="totals-row">
          <td style="text-align:left">TOTALS</td>
          <td>${hotelTotal} pcs</td>
          <td>${dcTotal} pcs</td>
          <td>${guestTotal} pcs</td>
          <td>₹ ${fmt(hotelAmt)}</td>
          <td>₹ ${fmt(dcAmt)}</td>
          <td>₹ ${fmt(guestAmt)}</td>
        </tr>
      </tbody>
    </table>

    <div class="amt-wrap">
      <table class="amt-tbl">
        <tbody>
          ${rates.hotel > 0 && hotelTotal > 0 ? `<tr><td>Hotel Linen (${hotelTotal} × ₹${rates.hotel})</td><td>₹ ${fmt(hotelAmt)}</td></tr>` : ""}
          ${rates.dc > 0 && dcTotal > 0 ? `<tr><td>Dry Clean (${dcTotal} × ₹${rates.dc})</td><td>₹ ${fmt(dcAmt)}</td></tr>` : ""}
          ${rates.guest > 0 && guestTotal > 0 ? `<tr><td>Guest Items (${guestTotal} × ₹${rates.guest})</td><td>₹ ${fmt(guestAmt)}</td></tr>` : ""}
          <tr class="sub-row"><td>Sub-Total</td><td>₹ ${fmt(grandTotal)}</td></tr>
          <tr><td>Advance Received</td><td>₹ 0</td></tr>
          <tr class="grand-row"><td>GRAND TOTAL</td><td>₹ ${fmt(grandTotal)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <div>
      <div style="color:rgba(255,255,255,.85);font-weight:600;margin-bottom:4px;">Thank you for your business!</div>
      <div style="font-size:11px;color:rgba(255,255,255,.45);">E. &amp; O.E. · Payment due upon receipt</div>
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

const AdminHotelInvoice: React.FC = () => {
  const [step, setStep] = useState<Step>("setup");

  const [setup, setSetup] = useState<InvoiceSetup>({
    invoiceNo: "",
    hotelName: "",
    issueDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
    periodStart: "",
    periodEnd: "",
  });

  const [rates, setRates] = useState<Rates>({ hotel: 12, dc: 30, guest: 15 });

  const [entries, setEntries] = useState<Entry[]>([
    { id: 1, date: "", hotel: "", dc: "", guest: "" },
  ]);

  // ── Navigation guards ────────────────────────────────────────────────────────

  const goToRates = () => {
    if (!setup.invoiceNo.trim()) return toast.error("Enter an invoice number");
    if (!setup.hotelName.trim()) return toast.error("Enter hotel name");
    if (!setup.periodStart.trim()) return toast.error("Enter period start date");
    if (!setup.periodEnd.trim()) return toast.error("Enter period end date");
    setStep("rates");
  };

  const goToEntries = () => {
    if (rates.hotel <= 0 && rates.dc <= 0 && rates.guest <= 0)
      return toast.error("At least one rate must be greater than 0");
    setStep("entries");
  };

  const goToPreview = () => {
    const valid = entries.filter(
      (e) => e.date.trim() && (Number(e.hotel) > 0 || Number(e.dc) > 0 || Number(e.guest) > 0)
    );
    if (valid.length === 0) return toast.error("Add at least one entry with a date and quantities");
    setStep("preview");
  };

  // ── Entry helpers ────────────────────────────────────────────────────────────

  const addRow = () =>
    setEntries((prev) => [
      ...prev,
      { id: Date.now(), date: "", hotel: "", dc: "", guest: "" },
    ]);

  const removeRow = (id: number) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const updateEntry = (id: number, field: keyof Entry, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, [field]: field === "date" ? value : value === "" ? "" : Number(value) }
          : e
      )
    );
  };

  // ── Invoice actions ──────────────────────────────────────────────────────────

  const openInvoice = () => {
    const html = buildInvoiceHTML(setup, rates, entries.filter((e) => e.date.trim()));
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const downloadInvoice = () => {
    const html = buildInvoiceHTML(setup, rates, entries.filter((e) => e.date.trim()));
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laundrify-Invoice-${setup.invoiceNo}-${setup.hotelName.replace(/\s+/g, "-")}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success("Invoice downloaded");
  };

  const resetForm = () => {
    setStep("setup");
    setSetup({ invoiceNo: "", hotelName: "", issueDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), periodStart: "", periodEnd: "" });
    setRates({ hotel: 12, dc: 30, guest: 15 });
    setEntries([{ id: 1, date: "", hotel: "", dc: "", guest: "" }]);
  };

  // ── Summary numbers ──────────────────────────────────────────────────────────

  const hotelTotal = sumField(entries, "hotel");
  const dcTotal = sumField(entries, "dc");
  const guestTotal = sumField(entries, "guest");
  const grandTotal = hotelTotal * rates.hotel + dcTotal * rates.dc + guestTotal * rates.guest;

  // ── Step indicators ──────────────────────────────────────────────────────────

  const steps: { key: Step; label: string }[] = [
    { key: "setup", label: "1. Details" },
    { key: "rates", label: "2. Prices" },
    { key: "entries", label: "3. Entries" },
    { key: "preview", label: "4. Preview" },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Step bar */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                i === stepIndex
                  ? "bg-purple-600 text-white shadow"
                  : i < stepIndex
                  ? "bg-purple-100 text-purple-700 cursor-pointer"
                  : "bg-gray-100 text-gray-400"
              }`}
              onClick={() => i < stepIndex && setStep(s.key)}
            >
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 ${i < stepIndex ? "bg-purple-400" : "bg-gray-200"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 1: Setup ─────────────────────────────────────────────────────── */}
      {step === "setup" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Invoice Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Invoice Number *</Label>
                <Input
                  placeholder="e.g. 829"
                  value={setup.invoiceNo}
                  onChange={(e) => setSetup({ ...setup, invoiceNo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Issue Date *</Label>
                <Input
                  placeholder="e.g. 8 May 2026"
                  value={setup.issueDate}
                  onChange={(e) => setSetup({ ...setup, issueDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Hotel / Client Name *</Label>
              <Input
                placeholder="e.g. Hotel Grand Manor"
                value={setup.hotelName}
                onChange={(e) => setSetup({ ...setup, hotelName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Period Start *</Label>
                <Input
                  placeholder="e.g. 1 May 2026"
                  value={setup.periodStart}
                  onChange={(e) => setSetup({ ...setup, periodStart: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Period End *</Label>
                <Input
                  placeholder="e.g. 8 May 2026"
                  value={setup.periodEnd}
                  onChange={(e) => setSetup({ ...setup, periodEnd: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={goToRates} className="bg-purple-600 hover:bg-purple-700">
                Next: Set Prices
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Rates ─────────────────────────────────────────────────────── */}
      {step === "rates" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-purple-600 text-lg">₹</span>
              Price Per Piece
              <Badge variant="secondary" className="ml-2 text-xs">{setup.hotelName}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-gray-500">
              Set the rate per piece for this hotel. These can differ per client.
            </p>

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-400 inline-block" />
                  Hotel Linen (₹/pc)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="12"
                  value={rates.hotel}
                  onChange={(e) => setRates({ ...rates, hotel: Number(e.target.value) })}
                  className="text-lg font-semibold"
                />
                <p className="text-xs text-gray-400">Bedsheets, towels, etc.</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-pink-400 inline-block" />
                  Dry Clean / DC (₹/pc)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="30"
                  value={rates.dc}
                  onChange={(e) => setRates({ ...rates, dc: Number(e.target.value) })}
                  className="text-lg font-semibold"
                />
                <p className="text-xs text-gray-400">Dry-clean items</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-400 inline-block" />
                  Guest Items (₹/pc)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="15"
                  value={rates.guest}
                  onChange={(e) => setRates({ ...rates, guest: Number(e.target.value) })}
                  className="text-lg font-semibold"
                />
                <p className="text-xs text-gray-400">Guest laundry pieces</p>
              </div>
            </div>

            {/* Live rate preview */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800 flex gap-6 flex-wrap">
              <span>Hotel: <strong>₹{rates.hotel}/pc</strong></span>
              <span>DC: <strong>₹{rates.dc}/pc</strong></span>
              <span>Guest: <strong>₹{rates.guest}/pc</strong></span>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("setup")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={goToEntries} className="bg-purple-600 hover:bg-purple-700">
                Next: Add Entries
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Entries ───────────────────────────────────────────────────── */}
      {step === "entries" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>📅</span>
                Day-by-Day Entries
                <Badge variant="secondary" className="text-xs">{setup.hotelName} · #{setup.invoiceNo}</Badge>
              </span>
              <div className="text-sm font-normal text-gray-500 flex gap-3">
                <span className="text-purple-600">Hotel ₹{rates.hotel}</span>
                <span className="text-pink-600">DC ₹{rates.dc}</span>
                <span className="text-indigo-600">Guest ₹{rates.guest}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Table header */}
            <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_auto] gap-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Date</span>
              <span className="text-center">Hotel (pcs)</span>
              <span className="text-center">DC (pcs)</span>
              <span className="text-center">Guest (pcs)</span>
              <span />
            </div>

            {entries.map((e, idx) => (
              <div key={e.id} className="grid grid-cols-[1.8fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <Input
                  placeholder={`e.g. ${idx + 1} May`}
                  value={e.date}
                  onChange={(v) => updateEntry(e.id, "date", v.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={e.hotel}
                  onChange={(v) => updateEntry(e.id, "hotel", v.target.value)}
                  className="text-center"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={e.dc}
                  onChange={(v) => updateEntry(e.id, "dc", v.target.value)}
                  className="text-center"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={e.guest}
                  onChange={(v) => updateEntry(e.id, "guest", v.target.value)}
                  className="text-center"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(e.id)}
                  disabled={entries.length === 1}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" onClick={addRow} className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50">
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>

            {/* Running total */}
            {(hotelTotal > 0 || dcTotal > 0 || guestTotal > 0) && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Live Summary</div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-purple-700">{hotelTotal} pcs</div>
                    <div className="text-gray-500">Hotel → ₹{fmt(hotelTotal * rates.hotel)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-pink-700">{dcTotal} pcs</div>
                    <div className="text-gray-500">DC → ₹{fmt(dcTotal * rates.dc)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-indigo-700">{guestTotal} pcs</div>
                    <div className="text-gray-500">Guest → ₹{fmt(guestTotal * rates.guest)}</div>
                  </div>
                </div>
                <div className="border-t border-purple-200 pt-2 text-center font-bold text-lg text-purple-800">
                  Grand Total: ₹{fmt(grandTotal)}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("rates")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={goToPreview} className="bg-purple-600 hover:bg-purple-700">
                Preview Invoice
                <Eye className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Preview ───────────────────────────────────────────────────── */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-600" />
              Invoice Ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary card */}
            <div className="rounded-xl border border-purple-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-4 text-white flex justify-between items-center">
                <div>
                  <div className="text-sm opacity-80">Invoice #{setup.invoiceNo}</div>
                  <div className="text-xl font-bold">{setup.hotelName}</div>
                  <div className="text-sm opacity-80 mt-0.5">{setup.periodStart} – {setup.periodEnd}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-80">Grand Total</div>
                  <div className="text-3xl font-black">₹{fmt(grandTotal)}</div>
                </div>
              </div>

              <div className="p-4 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide border-b">
                      <th className="text-left pb-2">Date</th>
                      <th className="text-center pb-2">Hotel</th>
                      <th className="text-center pb-2">DC</th>
                      <th className="text-center pb-2">Guest</th>
                      <th className="text-right pb-2">Day Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries
                      .filter((e) => e.date.trim())
                      .map((e) => {
                        const h = Number(e.hotel) || 0;
                        const d = Number(e.dc) || 0;
                        const g = Number(e.guest) || 0;
                        const dayTotal = h * rates.hotel + d * rates.dc + g * rates.guest;
                        return (
                          <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 font-medium text-gray-700">{e.date}</td>
                            <td className="text-center text-gray-600">{h || "—"}</td>
                            <td className="text-center text-gray-600">{d || "—"}</td>
                            <td className="text-center text-gray-600">{g || "—"}</td>
                            <td className="text-right font-semibold text-gray-800">₹{fmt(dayTotal)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50">
                      <td className="py-2 font-bold text-purple-800">Totals</td>
                      <td className="text-center font-bold text-purple-700">{hotelTotal}</td>
                      <td className="text-center font-bold text-purple-700">{dcTotal}</td>
                      <td className="text-center font-bold text-purple-700">{guestTotal}</td>
                      <td className="text-right font-black text-purple-800">₹{fmt(grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="px-4 pb-4 grid grid-cols-3 gap-3 text-xs text-gray-500">
                <div className="bg-purple-50 rounded p-2 text-center">
                  <div className="font-bold text-purple-700">Hotel: {hotelTotal} pcs</div>
                  <div>@ ₹{rates.hotel}/pc = ₹{fmt(hotelTotal * rates.hotel)}</div>
                </div>
                <div className="bg-pink-50 rounded p-2 text-center">
                  <div className="font-bold text-pink-700">DC: {dcTotal} pcs</div>
                  <div>@ ₹{rates.dc}/pc = ₹{fmt(dcTotal * rates.dc)}</div>
                </div>
                <div className="bg-indigo-50 rounded p-2 text-center">
                  <div className="font-bold text-indigo-700">Guest: {guestTotal} pcs</div>
                  <div>@ ₹{rates.guest}/pc = ₹{fmt(guestTotal * rates.guest)}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => setStep("entries")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Edit Entries
              </Button>
              <Button
                onClick={openInvoice}
                className="bg-purple-600 hover:bg-purple-700 flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                Open & Print Invoice
              </Button>
              <Button
                onClick={downloadInvoice}
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </Button>
            </div>

            <Button variant="ghost" onClick={resetForm} className="w-full text-gray-400 hover:text-gray-600">
              + Create Another Invoice
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminHotelInvoice;
