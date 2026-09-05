/**
 * Laundrify — Store Packages Sync (Google Apps Script)
 *
 * Pulls every customer package (KG & PC, across ALL stores) from the
 * Laundrify backend into a sheet named "Store Packages", formatted like
 * the reference report (S.No / Name / Package / Detail / Amount / dates /
 * Days Left / Consumed / Qty Left / Status) — plus a Store Name column.
 *
 * Backed by GET /api/store/admin/packages (backend/routes/store.js).
 *
 * ── ONE-TIME SETUP ──────────────────────────────────────────────────────
 *   1. Open your Google Sheet → Extensions → Apps Script.
 *   2. Delete the default Code.gs contents and paste this whole file in.
 *   3. Save (Ctrl+S), then reload the spreadsheet tab.
 *   4. A "🧺 Laundrify" menu appears at the top → click
 *      "Set Admin Token" and paste your backend's ADMIN_SECRET
 *      (same value as VITE_ADMIN_SECRET in your frontend .env, or the
 *      ADMIN_SECRET env var on your Render backend). It's stored in this
 *      script's private Script Properties — never written into the code.
 *   5. Menu → "Refresh Now" to pull data immediately.
 *   6. Menu → "Enable Auto-Refresh" to keep it updating automatically
 *      every REFRESH_MINUTES (change the number below if you want).
 */

const CONFIG = {
  API_BASE_URL: "https://home-services-5alb.onrender.com/api",
  SHEET_NAME: "Store Packages",
  REFRESH_MINUTES: 30,
};

const HEADERS = [
  "S.No", "Store Name", "Customer Name", "Phone", "Package Qty", "Unit",
  "Detail", "Amount", "Start Date", "End Date", "Days Left", "Consumed",
  "Qty Left", "Status",
];

// ─── Menu ────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🧺 Laundrify")
    .addItem("Refresh Now", "refreshPackages")
    .addSeparator()
    .addItem("Enable Auto-Refresh (" + CONFIG.REFRESH_MINUTES + " min)", "enableAutoRefresh")
    .addItem("Disable Auto-Refresh", "disableAutoRefresh")
    .addSeparator()
    .addItem("Set Admin Token", "setAdminToken")
    .addToUi();
}

function setAdminToken() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt("Admin Token", "Paste your backend's ADMIN_SECRET:", ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const token = resp.getResponseText().trim();
  if (!token) { ui.alert("No token entered — nothing saved."); return; }
  PropertiesService.getScriptProperties().setProperty("ADMIN_TOKEN", token);
  ui.alert('Saved. Run "Refresh Now" to test it.');
}

// ─── Auto-refresh triggers ───────────────────────────────────────────────

function enableAutoRefresh() {
  disableAutoRefresh(); // avoid stacking duplicate triggers
  ScriptApp.newTrigger("refreshPackages")
    .timeBased()
    .everyMinutes(CONFIG.REFRESH_MINUTES)
    .create();
  SpreadsheetApp.getUi().alert("Auto-refresh enabled — updating every " + CONFIG.REFRESH_MINUTES + " minutes.");
}

function disableAutoRefresh() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "refreshPackages") ScriptApp.deleteTrigger(t);
  });
}

// ─── Core sync ───────────────────────────────────────────────────────────

function refreshPackages() {
  const token = PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN");
  if (!token) {
    SpreadsheetApp.getUi().alert("Set your admin token first: 🧺 Laundrify > Set Admin Token");
    return;
  }

  const url = CONFIG.API_BASE_URL + "/store/admin/packages";
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { "admin-token": token },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    throw new Error("Request failed (" + res.getResponseCode() + "): " + res.getContentText());
  }

  const data = JSON.parse(res.getContentText());
  if (!data.success) throw new Error(data.error || "Unknown API error");

  writeToSheet(data.packages || []);
}

function writeToSheet(packages) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  // sheet.clear() wipes the grid but leaves a stale Filter object attached
  // (tied to the pre-clear dimensions), which is what blocks "Create a
  // filter" afterwards — remove it explicitly before clearing.
  const existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();

  sheet.clear();

  const rows = packages.map((p, i) => [
    i + 1,
    p.store_name,
    p.customer_name,
    p.customer_phone,
    p.total_quantity,
    p.unit_type, // "KG" or "PC"
    p.service_name,
    p.price,
    p.start_date ? new Date(p.start_date) : "",
    p.end_date ? new Date(p.end_date) : "",
    p.days_left,
    round1(p.consumed),
    round1(p.remaining_quantity),
    p.status, // completed | in-progress | expired | cancelled
  ]);

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }

  formatSheet(sheet, rows.length);
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

// ─── Formatting — mirrors the reference report's look ─────────────────────

function formatSheet(sheet, rowCount) {
  const lastCol = HEADERS.length;

  const header = sheet.getRange(1, 1, 1, lastCol);
  header.setFontWeight("bold").setBackground("#f1f3f4").setBorder(true, true, true, true, true, true);
  sheet.setFrozenRows(1);

  if (rowCount > 0) {
    const body = sheet.getRange(2, 1, rowCount, lastCol);
    body.setBorder(true, true, true, true, true, true);

    sheet.getRange(2, 9, rowCount, 1).setNumberFormat("dd/mm/yyyy");  // Start Date
    sheet.getRange(2, 10, rowCount, 1).setNumberFormat("dd/mm/yyyy"); // End Date

    // Color-code the Status column
    const statusRange = sheet.getRange(2, lastCol, rowCount, 1);
    const bgColors = statusRange.getValues().map(([s]) => {
      switch (s) {
        case "completed": return ["#d9ead3"];
        case "in-progress": return ["#fff2cc"];
        case "expired": return ["#f4cccc"];
        case "cancelled": return ["#e0e0e0"];
        default: return ["#ffffff"];
      }
    });
    statusRange.setBackgrounds(bgColors);
  }

  sheet.autoResizeColumns(1, lastCol);

  // Re-create the header filter fresh every refresh so filter dropdowns are
  // always present and working, instead of relying on the user re-adding one
  // (which broke — see the removal above).
  sheet.getRange(1, 1, rowCount + 1, lastCol).createFilter();
}
