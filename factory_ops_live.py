'''
Factory Operations -- Live Excel Dashboard
==========================================
Run:  python factory_ops_live.py

First run:  creates factory_ops_live.xlsx (no VBA yet).
            Follow the one-time manual step below to add the Refresh button.

Subsequent runs / button clicks:  updates data in existing .xlsm preserving
                                  the Refresh button and all VBA.

ONE-TIME MANUAL SETUP (do this once after the first run):
  1. Open the .xlsx in Excel
  2. Alt+F11  ->  Insert  ->  Module  ->  paste this VBA:
       Sub RefreshOrders()
           If MsgBox("Refresh data?", vbYesNo+vbQuestion, "Refresh") <> vbYes Then Exit Sub
           Shell "cmd /c python " & Chr(34) & ThisWorkbook.Path & "\factory_ops_live.py" & Chr(34), vbMinimizedNoFocus
           Application.Wait Now + TimeValue("00:00:02")
           ThisWorkbook.Close False
       End Sub
  3. Close VBA editor (Alt+F4)
  4. Insert -> Shapes -> Rectangle -> draw it on the spreadsheet
     Type "Refresh Data" in it
  5. Right-click the shape -> Assign Macro -> RefreshOrders -> OK
  6. File -> Save As -> Excel Macro-Enabled Workbook (.xlsm)
     Filename: factory_ops_live.xlsm  (same folder as this script)

After that, clicking the button refreshes data automatically. No add-ons needed.
'''

import os, sys, time, zipfile
from datetime import datetime
from pymongo import MongoClient

# ─── Config ───────────────────────────────────────────────────────────────────

# Works whether run as .py or bundled .exe (PyInstaller sets sys.frozen)
if getattr(sys, "frozen", False):
    SCRIPT_DIR = os.path.dirname(sys.executable)
else:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

MONGO_URI = (
    "mongodb+srv://sunflower110001:fV4LhLpWlKj5Vx87"
    "@cluster0.ic8p792.mongodb.net/cleancare_pro"
    "?retryWrites=true&w=majority"
)
XLSM_PATH   = os.path.join(SCRIPT_DIR, "factory_ops_live.xlsm")
XLSX_PATH   = os.path.join(SCRIPT_DIR, "factory_ops_live.xlsx")

STATUS_LABEL = {
    "created":            "New",
    "vendor_assigned":    "Assigned",
    "pickup_assigned":    "Pickup Assigned",
    "pickup_completed":   "Picked Up",
    "in_progress":        "At Laundry",
    "ready_for_delivery": "Ready",
    "delivery_assigned":  "Out for Delivery",
    "in_transit":         "In Transit",
    "delivered":          "Delivered",
}

STATUS_HEX = {
    "created":            "FFF9C4",
    "vendor_assigned":    "E3F2FD",
    "pickup_assigned":    "BBDEFB",
    "pickup_completed":   "B3E5FC",
    "in_progress":        "E8F5E9",
    "ready_for_delivery": "C8E6C9",
    "delivery_assigned":  "F3E5F5",
    "in_transit":         "E8EAF6",
    "delivered":          "DCEDC8",
}

HEADERS = [
    "#", "Order ID", "Customer", "Phone", "Address", "Status",
    "Pickup Date", "Pickup Time", "Delivery Date", "Delivery Time",
    "Total (Rs)", "Payment", "Items", "Maps",
]
COL_WIDTHS = [4, 16, 22, 14, 36, 20, 13, 11, 13, 11, 11, 13, 6, 9]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def fmt_date(val):
    if not val: return ""
    if isinstance(val, datetime): return val.strftime("%d %b %Y")
    s = str(val)
    return s[:10] if len(s) >= 10 else s

def has_vba(path):
    """Return True if the file is an xlsm with a vbaProject inside."""
    try:
        with zipfile.ZipFile(path, "r") as zf:
            return "xl/vbaProject.bin" in zf.namelist()
    except Exception:
        return False

# ─── Fetch ────────────────────────────────────────────────────────────────────

def fetch_orders():
    print("Connecting to MongoDB...")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=20000)
    db = client["cleancare_pro"]
    docs = list(db["bookings"].find(
        {"assignedVendor": "Factory Operations",
         "status": {"$nin": ["completed", "cancelled"]}},
        sort=[("created_at", -1)],
    ))
    client.close()
    print(f"Fetched {len(docs)} active orders")
    return docs

# ─── Write data with openpyxl ─────────────────────────────────────────────────
# Used both for fresh .xlsx creation and for updating existing .xlsm.

def write_data_openpyxl(docs, path, keep_vba=False):
    from openpyxl import load_workbook, Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    if keep_vba and os.path.exists(path):
        wb = load_workbook(path, keep_vba=True)
        ws = wb["Orders"] if "Orders" in wb.sheetnames else wb.active
        # Clear data rows (keep row 1 title, row 2 header)
        for row_idx in range(ws.max_row, 2, -1):
            ws.delete_rows(row_idx)
    else:
        wb = Workbook()
        ws = wb.active
        ws.title = "Orders"

    refreshed = datetime.now().strftime("%d %b %Y  %I:%M %p")
    N = len(HEADERS)

    # Styles
    hdr_fill  = PatternFill("solid", fgColor="1E3A5F")
    hdr_font  = Font(bold=True, color="FFFFFF", size=10)
    hdr_align = Alignment(horizontal="center", vertical="center")
    title_fill = PatternFill("solid", fgColor="E8F0FE")
    row_border = Border(bottom=Side(style="thin", color="E0E0E0"))
    alt_fill   = PatternFill("solid", fgColor="F0F4FA")
    white_fill = PatternFill("solid", fgColor="FFFFFF")

    # ── Row 1: Title ──────────────────────────────────────────────────────────
    ws.row_dimensions[1].height = 30
    ws.merge_cells(f"A1:{get_column_letter(N)}1")
    tc = ws["A1"]
    tc.value = (
        f"  Factory Operations - Active Orders  ({len(docs)})   "
        f"Last refreshed: {refreshed}"
    )
    tc.font = Font(bold=True, size=11, color="1E3A5F")
    tc.fill = title_fill
    tc.alignment = Alignment(horizontal="left", vertical="center")

    # ── Row 2: Headers ────────────────────────────────────────────────────────
    ws.row_dimensions[2].height = 26
    for c, h in enumerate(HEADERS, 1):
        cell = ws.cell(row=2, column=c, value=h)
        cell.fill = hdr_fill
        cell.font = hdr_font
        cell.alignment = hdr_align

    # ── Data rows ─────────────────────────────────────────────────────────────
    for i, d in enumerate(docs, 1):
        row = i + 2
        status   = d.get("status") or ""
        coords   = d.get("coordinates") or {}
        maps_url = d.get("mapsLink") or (
            f"https://maps.google.com/?q={coords.get('lat')},{coords.get('lng')}"
            if coords.get("lat") and coords.get("lng") else ""
        )
        vals = [
            i,
            d.get("custom_order_id") or str(d["_id"])[-6:].upper(),
            d.get("name") or d.get("pg_name") or "",
            str(d.get("phone") or ""),
            d.get("address") or "",
            STATUS_LABEL.get(status, status),
            fmt_date(d.get("scheduled_date")),
            d.get("scheduled_time") or "",
            fmt_date(d.get("delivery_date")),
            d.get("delivery_time") or "",
            float(d.get("final_amount") or d.get("total_price") or 0),
            d.get("payment_status") or "",
            d.get("no_of_items") or "",
            "Open Map" if maps_url else "",
        ]
        ws.row_dimensions[row].height = 18
        bg_fill = alt_fill if i % 2 == 0 else white_fill
        status_fill = PatternFill("solid", fgColor=STATUS_HEX.get(status, "FFFFFF"))

        for c, val in enumerate(vals, 1):
            cell = ws.cell(row=row, column=c, value=val)
            cell.border = row_border
            cell.alignment = Alignment(vertical="center",
                                       wrap_text=(c == 5))
            if c == 6:
                cell.fill = status_fill
                cell.font = Font(bold=True, size=9)
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif c == 11:
                cell.fill = bg_fill
                cell.number_format = "#,##0.00"
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif c == 14 and maps_url:
                cell.fill = bg_fill
                cell.hyperlink = maps_url
                cell.font = Font(color="0563C1", underline="single")
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.fill = bg_fill

    # ── Column widths & freeze ─────────────────────────────────────────────────
    for c, w in enumerate(COL_WIDTHS, 1):
        ws.column_dimensions[get_column_letter(c)].width = w
    ws.freeze_panes = "A3"
    ws.auto_filter.ref = f"A2:{get_column_letter(N)}2"

    wb.save(path)
    print(f"Saved: {path}")

# ─── Close file if open in Excel (no VBProject access needed) ─────────────────

def close_if_open(path):
    try:
        import win32com.client as win32
        try:
            xl = win32.GetActiveObject("Excel.Application")
        except Exception:
            return
        for wb in xl.Workbooks:
            try:
                if wb.FullName.lower() == path.lower():
                    wb.Close(False)
                    time.sleep(1)
                    print("Closed workbook in Excel")
                    break
            except Exception:
                pass
    except Exception:
        pass

# ─── Open in Excel ────────────────────────────────────────────────────────────

def open_in_excel(path):
    try:
        os.startfile(path)
    except Exception:
        import subprocess
        subprocess.Popen(["start", "", path], shell=True)

# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    docs = fetch_orders()

    if has_vba(XLSM_PATH):
        # xlsm exists with VBA button intact -- update data only, preserve VBA
        print("Updating existing xlsm (preserving Refresh button)...")
        close_if_open(XLSM_PATH)
        write_data_openpyxl(docs, XLSM_PATH, keep_vba=True)
        open_in_excel(XLSM_PATH)
    else:
        # First run or xlsm not set up yet -- create a clean xlsx
        print("Creating fresh xlsx (VBA button not set up yet)...")
        close_if_open(XLSM_PATH)
        close_if_open(XLSX_PATH)
        write_data_openpyxl(docs, XLSX_PATH, keep_vba=False)
        open_in_excel(XLSX_PATH)
        print()
        print("=" * 60)
        print("ONE-TIME SETUP: Add the Refresh button (2 minutes)")
        print("=" * 60)
        print("1. Press Alt+F11  ->  Insert  ->  Module")
        print("2. Paste this code:")
        print()
        print("   Sub RefreshOrders()")
        print('       If MsgBox("Pull latest data?", vbYesNo + vbQuestion, "Refresh") <> vbYes Then Exit Sub')
        print('       Shell Chr(34) & ThisWorkbook.Path & "\\factory_ops_live.exe" & Chr(34), vbMinimizedNoFocus')
        print('       Application.Wait Now + TimeValue("00:00:02")')
        print("       ThisWorkbook.Close False")
        print("   End Sub")
        print()
        print("3. Close VBA editor (Alt+F4)")
        print("4. Insert -> Shapes -> Rectangle -> draw on row 1 top-right")
        print("   Type 'Refresh Data' in the shape")
        print("5. Right-click shape -> Assign Macro -> RefreshOrders -> OK")
        print("6. File -> Save As -> Excel Macro-Enabled Workbook (.xlsm)")
        print("   Filename: factory_ops_live.xlsm  (same folder)")
        print()
        print("After that, clicking the button refreshes data automatically.")
        print("=" * 60)

    print("Done.")
