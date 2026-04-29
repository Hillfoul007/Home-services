"""
Factory Operations - Active Orders Export
Run:  python export_factory_orders.py
Opens the CSV in Excel automatically after saving.
"""

import csv, os, subprocess, sys
from datetime import datetime
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://sunflower110001:fV4LhLpWlKj5Vx87@cluster0.ic8p792.mongodb.net/cleancare_pro?retryWrites=true&w=majority"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "factory_ops_orders.csv")

def fmt_date(val):
    if not val:
        return ""
    if isinstance(val, datetime):
        return val.strftime("%d %b %Y")
    s = str(val)
    return s[:10] if len(s) >= 10 else s

def main():
    print("Connecting to MongoDB...")
    client = MongoClient(MONGO_URI)
    db = client["cleancare_pro"]

    filt = {
        "assignedVendor": "Factory Operations",
        "status": {"$nin": ["delivered", "completed", "cancelled"]},
    }

    print("Fetching orders...")
    docs = list(db["bookings"].find(filter=filt, sort=[("created_at", -1)]))
    print(f"Found {len(docs)} active orders")

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Order ID", "Customer", "Phone", "Address",
            "Status", "Rider Status",
            "Pickup Date", "Pickup Time",
            "Delivery Date", "Delivery Time",
            "Total (Rs)", "Payment Status",
            "Maps Link",
        ])
        for d in docs:
            coords = d.get("coordinates") or {}
            maps_link = d.get("mapsLink") or (
                f"https://maps.google.com/?q={coords.get('lat')},{coords.get('lng')}"
                if coords.get("lat") and coords.get("lng") else ""
            )
            writer.writerow([
                d.get("custom_order_id") or str(d["_id"])[-6:].upper(),
                d.get("name") or d.get("pg_name") or "",
                d.get("phone") or "",
                d.get("address") or "",
                d.get("status") or "",
                d.get("riderStatus") or "",
                fmt_date(d.get("scheduled_date")),
                d.get("scheduled_time") or "",
                fmt_date(d.get("delivery_date")),
                d.get("delivery_time") or "",
                d.get("final_amount") or d.get("total_price") or 0,
                d.get("payment_status") or "",
                maps_link,
            ])

    print(f"Saved: {OUTPUT_FILE}")

    # Open in Excel (Windows)
    try:
        os.startfile(OUTPUT_FILE)
        print("Opening in Excel...")
    except Exception:
        try:
            subprocess.Popen(["start", OUTPUT_FILE], shell=True)
        except Exception as e:
            print(f"Could not open automatically: {e}")
            print(f"Open manually: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
