import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, FileText, ArrowLeft, ArrowRight, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface School {
  _id: string;
  name: string;
  school_code: string;
}

interface InvoiceSetup {
  schoolId: string;
  invoiceNo: string;
  schoolName: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
}

interface Entry {
  id: number;
  date: string;
  pieces: number | "";
  pricePerPiece: number | "";
}

interface SchoolOrderLite {
  pickup_date: string | null;
  created_at: string;
  items_count: number;
  price_per_item: number;
  total_amount: number;
}

type Step = "setup" | "entries" | "preview";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 0 });

const fmtDateDisplay = (s: string): string => {
  if (!s) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

// ── Invoice HTML generator ─────────────────────────────────────────────────────

function buildSchoolInvoiceHTML(setup: InvoiceSetup, entries: Entry[]): string {
  const validEntries = entries.filter((e) => e.date && Number(e.pieces) > 0);

  const totalPieces = validEntries.reduce((s, e) => s + (Number(e.pieces) || 0), 0);
  const grandTotal = validEntries.reduce(
    (s, e) => s + (Number(e.pieces) || 0) * (Number(e.pricePerPiece) || 0),
    0
  );

  const periodStartDisplay = fmtDateDisplay(setup.periodStart) || setup.periodStart;
  const periodEndDisplay = fmtDateDisplay(setup.periodEnd) || setup.periodEnd;
  const periodLabel =
    !setup.periodStart && !setup.periodEnd
      ? "—"
      : periodStartDisplay === periodEndDisplay
      ? periodStartDisplay
      : `${periodStartDisplay} – ${periodEndDisplay}`;

  const rows = validEntries
    .map((e) => {
      const pcs = Number(e.pieces) || 0;
      const rate = Number(e.pricePerPiece) || 0;
      const amt = pcs * rate;
      return `<tr>
        <td style="text-align:left;font-weight:600;color:#555;">${e.date}</td>
        <td>${fmt(pcs)}</td>
        <td>₹ ${fmt(rate)}</td>
        <td style="font-weight:700;color:#6b21a8;">₹ ${fmt(amt)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Laundrify Invoice #${setup.invoiceNo} – ${setup.schoolName}</title>
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
    table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:18px}
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
    @media print{body{background:#fff;padding:0}.wrap{box-shadow:none;border-radius:0;width:100%}}
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
      <div class="inv-num">#${setup.invoiceNo || "—"}</div>
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
      <div class="client">${setup.schoolName}</div>
      <div class="client-type">Educational Institution – Commercial Account</div>
      <div class="badge">${periodLabel}</div>
    </div>
    <div class="meta-r">
      <div class="mrow"><span class="mlabel">Invoice No.</span><span class="mval">${setup.invoiceNo || "—"}</span></div>
      <div class="mrow"><span class="mlabel">Issue Date</span><span class="mval">${setup.issueDate}</span></div>
      <div class="mrow"><span class="mlabel">Service Period</span><span class="mval">${periodLabel}</span></div>
      <div class="mrow"><span class="mlabel">Status</span><span class="mval" style="color:#16a34a;font-weight:700;">● Issued</span></div>
    </div>
  </div>

  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Created Date</th>
          <th>Total Pieces</th>
          <th>Price Per Item (₹)</th>
          <th>Total Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="totals-row">
          <td style="text-align:left">TOTALS</td>
          <td>${fmt(totalPieces)} pcs</td>
          <td>—</td>
          <td>₹ ${fmt(grandTotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="amt-wrap">
      <table class="amt-tbl">
        <tbody>
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

const emptySetup = (): InvoiceSetup => ({
  schoolId: "",
  invoiceNo: "",
  schoolName: "",
  issueDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
  periodStart: "",
  periodEnd: "",
});

const AdminSchoolInvoice: React.FC = () => {
  const [step, setStep] = useState<Step>("setup");

  const [schools, setSchools] = useState<School[]>([]);
  const [setup, setSetup] = useState<InvoiceSetup>(emptySetup());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fetchingEntries, setFetchingEntries] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.adminRequest<any>("/school-management");
        if (res.data?.success) setSchools(res.data.data || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // ── Fetch real orders for the selected school + period, grouped by pickup date ──

  const fetchPeriodEntries = async (): Promise<Entry[]> => {
    const params = new URLSearchParams();
    params.set("school_id", setup.schoolId);
    params.set("pickup_date_from", setup.periodStart);
    params.set("pickup_date_to", setup.periodEnd);
    params.set("limit", "10000");
    const res = await apiClient.adminRequest<any>(`/school-orders?${params.toString()}`);
    const orders: SchoolOrderLite[] = res.data?.data || [];

    const dateMap = new Map<string, { pieces: number; amount: number }>();
    for (const o of orders) {
      const raw = o.pickup_date || o.created_at;
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const key = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
      const existing = dateMap.get(key) || { pieces: 0, amount: 0 };
      existing.pieces += o.items_count || 0;
      existing.amount += o.total_amount || 0;
      dateMap.set(key, existing);
    }

    return [...dateMap.entries()]
      .sort((a, b) => {
        const toIso = (s: string) => s.split("-").reverse().join("-");
        return new Date(toIso(a[0])).getTime() - new Date(toIso(b[0])).getTime();
      })
      .map(([date, v], idx) => ({
        id: Date.now() + idx,
        date,
        pieces: v.pieces,
        pricePerPiece: v.pieces > 0 ? Math.round((v.amount / v.pieces) * 100) / 100 : 0,
      }));
  };

  const goToEntries = async () => {
    if (!canProceedSetup) return;
    setFetchingEntries(true);
    try {
      const fetched = await fetchPeriodEntries();
      if (fetched.length === 0) {
        toast.error("No orders found for this school in the selected period — add entries manually.");
      } else {
        toast.success(`Loaded ${fetched.length} date${fetched.length > 1 ? "s" : ""} of orders for this period.`);
      }
      setEntries(fetched);
      setStep("entries");
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch orders for this period");
    } finally {
      setFetchingEntries(false);
    }
  };

  // ── Entry helpers ──────────────────────────────────────────────────────────

  const addEntry = () =>
    setEntries((prev) => [
      ...prev,
      { id: Date.now(), date: "", pieces: "", pricePerPiece: 25 },
    ]);

  const removeEntry = (id: number) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const updateEntry = (id: number, field: keyof Entry, value: string) =>
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        if (field === "date") return { ...e, date: value };
        const num = value === "" ? "" : (parseFloat(value) as number);
        return { ...e, [field]: num };
      })
    );

  // ── Summary values ─────────────────────────────────────────────────────────

  const totalPieces = entries.reduce((s, e) => s + (Number(e.pieces) || 0), 0);
  const grandTotal = entries.reduce(
    (s, e) => s + (Number(e.pieces) || 0) * (Number(e.pricePerPiece) || 0),
    0
  );

  // ── Invoice open ──────────────────────────────────────────────────────────

  const openInvoice = () => {
    const html = buildSchoolInvoiceHTML(setup, entries);
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Pop-up blocked — please allow pop-ups and try again.");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  // ── Step validation ───────────────────────────────────────────────────────

  const canProceedSetup =
    setup.schoolId.trim() !== "" &&
    setup.issueDate.trim() !== "" &&
    setup.periodStart.trim() !== "" &&
    setup.periodEnd.trim() !== "";

  const canProceedEntries =
    entries.some((e) => e.date && Number(e.pieces) > 0);

  // ── Step indicators ───────────────────────────────────────────────────────

  const STEPS: { key: Step; label: string }[] = [
    { key: "setup",   label: "1. Invoice Setup" },
    { key: "entries", label: "2. Date Entries"  },
    { key: "preview", label: "3. Preview"       },
  ];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex gap-2 flex-wrap">
        {STEPS.map((s) => (
          <div
            key={s.key}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              step === s.key
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-gray-100 text-gray-500 border-gray-200"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {/* ── Step 1: Setup ── */}
      {step === "setup" && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h3 className="font-bold text-lg">Invoice Setup</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>School</Label>
                <Select
                  value={setup.schoolId}
                  onValueChange={(id) => {
                    const s = schools.find((sc) => sc._id === id);
                    setSetup({ ...setup, schoolId: id, schoolName: s ? s.name : "" });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        [{s.school_code}] {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input
                  value={setup.invoiceNo}
                  onChange={(e) => setSetup({ ...setup, invoiceNo: e.target.value })}
                  placeholder="e.g. SCH-001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Issue Date</Label>
                <Input
                  value={setup.issueDate}
                  onChange={(e) => setSetup({ ...setup, issueDate: e.target.value })}
                  placeholder="e.g. 6 June 2026"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={setup.periodStart}
                  onChange={(e) => setSetup({ ...setup, periodStart: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={setup.periodEnd}
                  onChange={(e) => setSetup({ ...setup, periodEnd: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={goToEntries}
                disabled={!canProceedSetup || fetchingEntries}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {fetchingEntries ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading orders…
                  </>
                ) : (
                  <>
                    Next <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Entries ── */}
      {step === "entries" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Date-wise Entries</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={addEntry}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Row
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-purple-50 border-b">
                      <th className="text-left py-3 px-3 font-semibold min-w-[140px]">Date</th>
                      <th className="text-center py-3 px-3 font-semibold min-w-[110px]">Total Pieces</th>
                      <th className="text-center py-3 px-3 font-semibold min-w-[130px]">Price / Piece (₹)</th>
                      <th className="text-right py-3 px-3 font-semibold min-w-[110px]">Amount (₹)</th>
                      <th className="py-3 px-3 min-w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => {
                      const pcs = Number(e.pieces) || 0;
                      const rate = Number(e.pricePerPiece) || 0;
                      return (
                        <tr key={e.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <Input
                              value={e.date}
                              onChange={(ev) => updateEntry(e.id, "date", ev.target.value)}
                              placeholder="DD-MM-YYYY"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              min="0"
                              value={e.pieces === "" ? "" : String(e.pieces)}
                              onChange={(ev) => updateEntry(e.id, "pieces", ev.target.value)}
                              className="h-8 text-center text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={e.pricePerPiece === "" ? "" : String(e.pricePerPiece)}
                              onChange={(ev) => updateEntry(e.id, "pricePerPiece", ev.target.value)}
                              className="h-8 text-center text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-purple-700">
                            ₹{fmt(pcs * rate)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeEntry(e.id)}
                              className="h-8 text-xs text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50 border-t-2 border-purple-200">
                      <td className="py-3 px-3 font-bold text-purple-800">TOTALS</td>
                      <td className="py-3 px-3 text-center font-bold text-purple-800">{fmt(totalPieces)} pcs</td>
                      <td></td>
                      <td className="py-3 px-3 text-right font-bold text-xl text-purple-800">₹{fmt(grandTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("setup")} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!canProceedEntries}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
              >
                Preview <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Preview ── */}
      {step === "preview" && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <h3 className="font-bold text-lg">Invoice Summary</h3>

            {/* Summary card */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 uppercase text-xs font-semibold tracking-wide">Billed To</span>
                  <p className="font-bold text-purple-900 mt-0.5">{setup.schoolName}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase text-xs font-semibold tracking-wide">Invoice No.</span>
                  <p className="font-bold text-purple-900 mt-0.5">{setup.invoiceNo || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase text-xs font-semibold tracking-wide">Issue Date</span>
                  <p className="font-semibold mt-0.5">{setup.issueDate}</p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase text-xs font-semibold tracking-wide">Service Period</span>
                  <p className="font-semibold mt-0.5">
                    {fmtDateDisplay(setup.periodStart) || "—"} – {fmtDateDisplay(setup.periodEnd) || "—"}
                  </p>
                </div>
              </div>

              <div className="border-t border-purple-200 mt-4 pt-4 flex justify-between items-center">
                <div>
                  <span className="text-gray-500 uppercase text-xs font-semibold tracking-wide">Total Pieces</span>
                  <p className="text-2xl font-bold text-purple-800 mt-0.5">{fmt(totalPieces)} pcs</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 uppercase text-xs font-semibold tracking-wide">Grand Total</span>
                  <p className="text-3xl font-bold text-purple-700 mt-0.5">₹ {fmt(grandTotal)}</p>
                </div>
              </div>
            </div>

            {/* Compact table preview */}
            <div className="border rounded-lg overflow-hidden text-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    <th className="text-left py-2.5 px-4 font-semibold">Date</th>
                    <th className="text-center py-2.5 px-4 font-semibold">Pieces</th>
                    <th className="text-center py-2.5 px-4 font-semibold">Rate (₹)</th>
                    <th className="text-right py-2.5 px-4 font-semibold">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {entries
                    .filter((e) => e.date && Number(e.pieces) > 0)
                    .map((e) => {
                      const pcs = Number(e.pieces) || 0;
                      const rate = Number(e.pricePerPiece) || 0;
                      return (
                        <tr key={e.id} className="border-b hover:bg-purple-50">
                          <td className="py-2 px-4 font-medium">{e.date}</td>
                          <td className="py-2 px-4 text-center">{fmt(pcs)}</td>
                          <td className="py-2 px-4 text-center">₹{fmt(rate)}</td>
                          <td className="py-2 px-4 text-right font-semibold text-purple-700">₹{fmt(pcs * rate)}</td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="bg-purple-50 border-t-2 border-purple-300 font-bold text-purple-800">
                    <td className="py-3 px-4">GRAND TOTAL</td>
                    <td className="py-3 px-4 text-center">{fmt(totalPieces)} pcs</td>
                    <td></td>
                    <td className="py-3 px-4 text-right text-lg">₹{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-between flex-wrap gap-3">
              <Button variant="outline" onClick={() => setStep("entries")} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <div className="flex gap-3">
                <Button
                  onClick={openInvoice}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  <Eye className="w-4 h-4" />
                  Open Invoice
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("setup");
                    setSetup(emptySetup());
                    setEntries([]);
                  }}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> New Invoice
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminSchoolInvoice;
