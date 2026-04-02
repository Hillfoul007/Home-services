# Laundrify — Vendor + Rider Delivery System Guide

> Complete reference for the end-to-end laundry logistics platform: order lifecycle, vendor operations, rider workflow, dashboard analytics, and API surface.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles](#2-user-roles)
3. [Order Lifecycle — Full Pipeline](#3-order-lifecycle--full-pipeline)
4. [Vendor Dashboard Features](#4-vendor-dashboard-features)
5. [Rider Desk Features](#5-rider-desk-features)
6. [Status Reference Tables](#6-status-reference-tables)
7. [Payment Handling (COD)](#7-payment-handling-cod)
8. [SLA & Breach Detection](#8-sla--breach-detection)
9. [Performance Metrics](#9-performance-metrics)
10. [Notifications](#10-notifications)
11. [API Reference](#11-api-reference)
12. [Authentication](#12-authentication)
13. [Data Models](#13-data-models)
14. [Frontend Routes](#14-frontend-routes)

---

## 1. System Overview

Laundrify is a multi-tenant laundry logistics platform with three distinct operational roles:

```
Customer (Mobile App)
    │  Places order
    ▼
Vendor (Laundry)          Rider (Delivery)
    │  Processes items         │  Delivers items
    │◄─────────────────────────┤
    │  assigns, tracks riders  │
    └──────────────────────────┘
```

- **Customers** book laundry/dry-cleaning via the mobile app.
- **Vendors** receive orders, process clothes, and manage riders.
- **Riders** pick up from customers, deliver to vendor, then deliver finished items back to customers.

---

## 2. User Roles

### Customer
- Books orders via mobile app
- Tracks order status in real time
- Receives push notifications on every status change
- Pays via Wallet, Razorpay, or Cash on Delivery (COD)

### Vendor (Laundry)
- Logs in at `/desk` (web dashboard)
- Sees all orders assigned to their laundry
- Marks orders through processing stages
- Assigns riders manually from their roster
- Views performance metrics and breach alerts

### Rider
- Logs in at `/rider-desk` (mobile-optimised web)
- Accepts or rejects assigned orders
- Marks pickup, in-transit, and delivery statuses
- Collects COD payment and records it
- Uploads photo proof (item slip, payment screenshot)

---

## 3. Order Lifecycle — Full Pipeline

### Visual Pipeline

```
CREATED
    │
    ▼
VENDOR_ASSIGNED          ← Admin assigns order to a vendor
    │
    ▼  (rider picks up from customer)
PICKUP_COMPLETED         ← Vendor uploads item SS + rider picks up
    │
    ▼  (auto-transition)
IN_PROGRESS              ← Vendor is washing/processing
    │
    ▼  (vendor marks ready)
READY_FOR_DELIVERY       ← Items clean, waiting for delivery rider
    │
    ▼  (vendor assigns rider)
DELIVERY_ASSIGNED        ← Rider assigned to deliver
    │
    ▼  (rider accepts)
[riderStatus: accepted]
    │
    ▼  (rider leaves vendor shop)
IN_TRANSIT               ← Rider heading to customer
    │
    ▼  (rider arrives, collects COD, uploads proof)
DELIVERED                ← Customer received items
    │
    ▼
COMPLETED                ← Final state

At any point → CANCELLED
```

### Detailed Step-by-Step

| Step | Who Acts | Action | System Result |
|------|----------|--------|---------------|
| 1 | Customer | Places order in app | `status: created` |
| 2 | Admin | Assigns to vendor | `status: vendor_assigned` |
| 3 | Rider | Picks up from customer | Vendor uploads item screenshot → `pickup_completed` → auto `in_progress` |
| 4 | Vendor | Processes laundry | Status stays `in_progress` |
| 5 | Vendor | Marks "Ready for Delivery" | `status: ready_for_delivery`, `readyAt` timestamp recorded |
| 6 | Vendor | Assigns delivery rider | `status: delivery_assigned`, `riderStatus: assigned`, `assignedAt` recorded |
| 7 | Rider | Accepts order | `riderStatus: accepted`, `acceptedAt` recorded |
| 8 | Rider | Marks "In Transit" | `status: in_transit`, `riderStatus: in_transit` |
| 9 | Rider | Collects COD (if applicable) | `cod_collected: true`, `cod_amount`, `cod_collected_at` recorded |
| 10 | Rider | Uploads payment SS | `riderStatus: picked_up` (delivery pickup) |
| 11 | Rider | Marks Delivered | `status: delivered`, `riderStatus: delivered`, `deliveredAt` recorded |
| 12 | System | Completes order | `status: completed`, `completedAt` recorded |

### Time Tracking Fields

Every order stores these timestamps for SLA and analytics:

| Field | Set When |
|-------|----------|
| `created_at` | Order placed by customer |
| `assignedAt` | Rider assigned to order |
| `acceptedAt` | Rider accepts the order |
| `readyAt` | Vendor marks order ready for delivery |
| `pickedUpAt` | Rider confirms pickup |
| `deliveredAt` | Rider marks delivered |
| `completedAt` | Order fully completed |

---

## 4. Vendor Dashboard Features

**URL:** `/desk/dashboard`  
**Login:** `/desk`

### Dashboard Sections

The orders tab shows 5 live sections with real-time order counts:

#### Ready for Dispatch (📦)
- Orders where vendor has finished processing
- Status = `ready_for_delivery`
- Shows breach alert if past delivery deadline
- Action: **Assign Rider** button opens modal with available rider list
- Red "BREACH" badge on orders past their expected delivery date

#### In Process (⚙️)
- Orders currently being washed/ironed
- Status = `vendor_assigned`, `pickup_completed`, `in_progress`
- Actions: Upload order screenshot, mark picked up, mark ready
- **Assign Rider** available here too for pre-assignment

#### In Transit (🛵)
- Rider has accepted and is heading to customer
- Status = `delivery_assigned`, `in_transit`
- Shows **Track Rider Live** button if rider has shared GPS link
- Shows last location update timestamp

#### Delivered (✅)
- Successfully delivered orders
- Status = `delivered`, `completed`
- Upload payment screenshot if not already done

#### Cancelled (❌)
- All cancelled orders with reason

### Performance Metrics Bar

Displayed at the top of the Orders tab with period toggle (Today / 7 Days / 30 Days):

| Metric | Description |
|--------|-------------|
| Total Orders | All orders in selected period |
| On-Time % | % of deliveries before delivery_date deadline |
| Breach Orders | Orders currently past their deadline |
| Avg Delivery | Average hours from order created → delivered |

### Rider Assignment Modal

Vendor can manually assign any approved rider to an order:
1. Click "Assign Rider" on any in-process or ready order
2. Modal shows list of approved riders with Active/Offline status
3. Select rider → click "Assign Rider"
4. System sets `riderStatus: assigned`, sends order to rider's dashboard

### Other Vendor Actions

| Action | When Available | Effect |
|--------|---------------|--------|
| Upload Order Screenshot | `vendor_assigned` status | Marks pickup complete |
| Mark Ready for Delivery | `in_progress` or `pickup_completed` | Sets `ready_for_delivery` + `readyAt` |
| Upload Payment Screenshot | `delivered` or `completed` | Records vendor payment proof |

### Riders Management Tab

- Create new rider accounts (name, phone, optional GPS link)
- Auto-generates secure password — shown once, share with rider
- List all your riders with Active/Offline status
- Reset rider password with new auto-generated credentials

---

## 5. Rider Desk Features

**URL:** `/rider-desk/dashboard`  
**Login:** `/rider-desk`

### Workflow Stepper

Each order card shows a visual progress bar through 5 stages:

```
[1: Assigned] → [2: Accepted] → [3: Picked Up] → [4: In Transit] → [5: Delivered]
```

Green = completed stage, Blue = current stage, Grey = upcoming stage.

### Active Orders

Orders with `riderStatus` in `assigned`, `accepted`, `in_transit`, `picked_up`.

#### Stage: Assigned
- **Accept Order** button — confirms rider will take the delivery
- **Reject** button — opens confirmation modal, unassigns rider from order

#### Stage: Accepted
- **Mark In Transit** — rider leaves vendor, heading to customer
- **Upload Item Slip & Mark Picked Up** — photo upload triggers `picked_up` status

#### Stage: In Transit
- **Collect COD Payment** button — opens amount modal, records collection
  - Defaults to order's `final_amount`
  - Rider can edit amount actually collected
  - Shows green "COD ✓" badge once collected
- **Upload Payment SS & Mark Delivered** — final step, marks order delivered

#### Stage: Picked Up (alternate flow)
- Same COD + delivery upload as In Transit

### Reject Order Flow
1. Rider taps Reject on any `assigned` order
2. Confirmation modal explains the action
3. On confirm → `riderStatus: rejected_by_rider`, rider unassigned
4. Order returns to vendor for reassignment

### COD Collection Flow
1. Rider taps "Collect COD Payment"
2. Modal shows default amount (order total)
3. Rider adjusts if needed, taps "Confirm Collection"
4. `cod_collected: true`, `cod_amount`, `cod_collected_at` stored
5. Green badge appears on order card

### Completed Orders
Orders with `riderStatus` = `delivered` or `completed` shown in a separate "Completed" section below active orders (last 20 shown).

### Auto-refresh
Both Vendor Dashboard and Rider Desk auto-refresh every 10–15 seconds. Toast notifications appear when new orders are assigned.

---

## 6. Status Reference Tables

### Order Status (`status` field)

| Value | Meaning | Set By |
|-------|---------|--------|
| `created` | Customer placed order | Customer (app) |
| `vendor_assigned` | Assigned to a vendor | Admin |
| `assigned` | Rider assigned for pickup | System |
| `pending` | Awaiting vendor confirmation | System |
| `confirmed` | Vendor confirmed | Vendor |
| `pickup_assigned` | Rider assigned for pickup | System |
| `pickup_completed` | Rider picked up from customer | Vendor upload |
| `in_progress` | Vendor processing | Auto (after pickup) |
| `ready_for_delivery` | Items ready, waiting rider | Vendor |
| `delivery_assigned` | Delivery rider assigned | Vendor |
| `in_transit` | Rider heading to customer | Rider |
| `delivered` | Delivered to customer | Rider |
| `delivered_to_vendor` | Items at vendor (intermediate) | System |
| `completed` | Fully complete | Rider / System |
| `cancelled` | Cancelled | Any actor |

### Rider Status (`riderStatus` field)

| Value | Meaning |
|-------|---------|
| `unassigned` | No rider assigned |
| `assigned` | Rider assigned, awaiting acceptance |
| `accepted` | Rider accepted the order |
| `in_transit` | Rider on the way to customer |
| `picked_up` | Rider has picked up / confirmed pickup |
| `delivered` | Rider has delivered |
| `completed` | Order fully wrapped up |
| `rejected_by_rider` | Rider rejected, needs reassignment |

### Payment Status (`payment_status` field)

| Value | Meaning |
|-------|---------|
| `pending` | Payment not yet received |
| `paid` | Payment received |
| `failed` | Payment attempt failed |
| `refunded` | Payment refunded to customer |

---

## 7. Payment Handling (COD)

### Cash on Delivery Flow

1. Order is placed with `payment_status: pending`
2. When rider is in transit, they tap "Collect COD"
3. Rider enters actual collected amount
4. System stores:
   - `cod_collected: true`
   - `cod_amount: <entered_amount>`
   - `cod_collected_at: <timestamp>`
5. Vendor can view COD status in order details
6. Payment screenshot uploaded as proof

### Other Payment Methods

| Method | How It Works |
|--------|-------------|
| Wallet | Deducted from user wallet balance at order creation |
| Package Balance | Deducted from prepaid package balance |
| Razorpay | Online payment via Razorpay gateway (signature verified) |
| Cashback | Credited to wallet after order completes |

---

## 8. SLA & Breach Detection

### How SLA Works

Each order has a `delivery_date` set at booking time. The system flags an order as **BREACH** if:

```
current_time > delivery_date (23:59:59)
AND
status NOT IN [delivered, completed, cancelled]
```

### Breach Indicators

- **Vendor Dashboard:** Red "BREACH" badge on order card header
- **Section tab:** Red "!" dot on "Ready for Dispatch" tab if any breach orders
- **Info bar:** "X orders past delivery deadline" alert above section
- **Metrics:** "Breach Orders" metric card shows count

### Time Elapsed Display

Each order card shows how long ago a key event happened:
- In `ready_for_dispatch` section: time since `readyAt`
- In `in_process` section: time since `created_at`
- Format: `5m`, `2h 30m`, `1d`

---

## 9. Performance Metrics

### Endpoint: `GET /api/vendor/orders/metrics?period=<7d|today|30d>`

Returns:

```json
{
  "metrics": {
    "total_orders": 42,
    "delivered": 38,
    "cancelled": 2,
    "on_time_pct": 89,
    "late_orders": 4,
    "breach_orders": 1,
    "avg_delivery_hrs": 28.5,
    "active_riders": 3
  }
}
```

### Calculations

| Metric | Formula |
|--------|---------|
| On-Time % | `(orders delivered on or before delivery_date) / total_delivered × 100` |
| Late Orders | `delivered.length - on_time_count` |
| Avg Delivery | `avg(deliveredAt - created_at)` in hours |
| Active Riders | Count of unique `assignedRider` IDs in period |

---

## 10. Notifications

Notifications fire automatically at key status transitions.

### Customer Notifications (Firebase Push)

| Trigger | Title |
|---------|-------|
| Rider assigned | "Rider assigned to your order" |
| Order picked up | "Your items have been picked up" |
| Order ready | "Your laundry is ready!" |
| Out for delivery | "Your order is out for delivery" |
| Delivered | "Order delivered!" |
| Item/price changes | "Your order has been updated" |

### Rider Notifications (App + SMS)

| Trigger | Message |
|---------|---------|
| New order assigned | "New order assigned: #ORDER_ID" |
| Order updated | "Order #ID has been updated" |
| Order cancelled | "Order #ID has been cancelled" |

### Auto-refresh Polling

The dashboards poll every 10–15 seconds and show a toast when new orders appear:
- Vendor: "X new orders arrived!"
- Rider: "X new orders assigned!"

---

## 11. API Reference

### Vendor API (`/api/vendor`)

#### Authentication
```
POST /api/vendor/auth/login
Body: { vendor_id, password }
Returns: { token, vendor }
```

#### Dashboard
```
GET /api/vendor/orders/dashboard
Headers: Authorization: Bearer <token>
Returns: {
  sections: {
    ready_for_dispatch: [orders],
    in_process: [orders],
    in_transit: [orders],
    delivered: [orders],
    cancelled: [orders]
  },
  counts: { ready_for_dispatch, in_process, in_transit, delivered, cancelled, total, breach }
}
```

#### Metrics
```
GET /api/vendor/orders/metrics?period=7d
Returns: { metrics: { total_orders, delivered, on_time_pct, late_orders, breach_orders, avg_delivery_hrs, active_riders } }
```

#### All Orders (legacy)
```
GET /api/vendor/orders/assigned-orders?status=<optional_filter>
Returns: { orders: [...], total, bookingOrders, pgOrders }
```

#### Single Order
```
GET /api/vendor/orders/orders/:orderId
Returns: { order }
```

#### Update Order Status
```
PUT /api/vendor/orders/orders/:orderId/status
Body: { status }
Valid transitions:
  vendor_assigned → pickup_completed (auto → in_progress)
  in_progress → ready_for_delivery
  ready_for_delivery → delivered
```

#### Mark Ready for Delivery
```
PUT /api/vendor/orders/orders/:orderId/mark-ready
(No body required — marks ready_for_delivery, sets readyAt)
```

#### Assign Rider
```
PUT /api/vendor/orders/orders/:orderId/assign-rider
Body: { riderId }
Returns: { order } with updated assignment
```

#### Available Riders (for assignment modal)
```
GET /api/vendor/orders/available-riders
Returns: { riders: [{ _id, name, phone, isActive, live_location_link, location }] }
```

#### Upload Images
```
POST /api/vendor/orders/orders/:orderId/upload-items-image
  Body: multipart/form-data, field: items_image

POST /api/vendor/orders/orders/:orderId/upload-payment-ss
  Body: multipart/form-data, field: payment_ss
```

#### Rider Management
```
POST /api/vendor/riders/create
  Body: { name, phone, live_location_link? }
  Returns: { rider, credentials: { phone, password } }

GET /api/vendor/riders
  Returns: { riders }

PATCH /api/vendor/riders/:riderId/reset-password
  Returns: { credentials: { phone, password } }
```

---

### Rider API (`/api/riders`)

#### Authentication
```
POST /api/riders/desk-login
  Body: { phone, password }
  Returns: { token, rider: { _id, name, phone, live_location_link } }

POST /api/riders/request-otp
POST /api/riders/verify-otp
  (OTP-based login for independently registered riders)
```

#### Desk Orders (for Rider Desk UI)
```
GET /api/riders/desk-orders
Returns: {
  active: [booking documents with riderStatus in assigned/accepted/in_transit/picked_up],
  done:   [last 20 delivered/completed orders]
}
```

#### Order Action (state machine)
```
POST /api/riders/order-action
Body: { orderId, action }

Actions:
  accept   → riderStatus: accepted,   acceptedAt set
  start    → riderStatus: picked_up,  pickedUpAt set
  complete → riderStatus: completed,  completedAt set
  reject   → riderStatus: rejected_by_rider, rider unassigned
```

#### Mark In Transit
```
POST /api/riders/orders/:orderId/in-transit
(Sets riderStatus: in_transit, status: in_transit)
```

#### COD Collection
```
POST /api/riders/orders/:orderId/cod-collected
Body: { amount, notes? }
Returns: { order } with cod_collected: true
```

#### Upload Photos
```
POST /api/riders/orders/:orderId/upload-pickup-slip
  Body: { image_base64 }

POST /api/riders/orders/:orderId/upload-payment-ss
  Body: { image_base64 }
```

#### Location
```
POST /api/riders/location
Body: { location: { lat, lng } }
```

#### Earnings
```
GET /api/riders/earnings/summary        → { daily, weekly }
GET /api/riders/earnings/export?start=YYYY-MM-DD&end=YYYY-MM-DD  → CSV download
```

---

## 12. Authentication

### Vendor Desk Auth

- Login at `/desk` with Vendor ID + Password
- JWT token stored in `localStorage.desk_vendor_token`
- Vendor profile stored in `localStorage.desk_vendor_info`
- Token expires in 7 days
- All vendor API calls require `Authorization: Bearer <token>` header

### Rider Desk Auth

- Login at `/rider-desk` with Phone + Password (vendor-created riders)
- JWT token stored in `localStorage.rider_desk_token`
- Rider profile stored in `localStorage.rider_desk_info`
- Token expires in 7 days

### Token Contents

**Vendor JWT:**
```json
{ "vendor_id": "<mongodb_id>", "vendor_id_str": "V1234...", "name": "Shop Name" }
```

**Rider JWT:**
```json
{ "riderId": "<mongodb_id>", "phone": "9876543210" }
```

---

## 13. Data Models

### Booking (Order)

```
_id                   MongoDB ObjectId
custom_order_id       "A202604XXXXX" (auto-generated)
customer_id           ref: User
name, phone           Customer contact
address, mapsLink     Delivery address
coordinates           { lat, lng }

service, services[]   What was ordered
item_prices[]         { service_name, quantity, unit_price, total_price }
total_price           Sum before discount
discount_amount       Coupon/discount
final_amount          Amount to collect

status                Order pipeline stage (see Status Reference)
riderStatus           Rider's stage (see Status Reference)

assignedVendor        Vendor name (string)
assignedRider         ref: Rider (ObjectId)
assignedRiderPhone    Rider's phone (for quick lookup)

── Timestamps ─────────────────────────────
created_at            Order created
assignedAt            Rider assigned
acceptedAt            Rider accepted
readyAt               Vendor marked ready
pickedUpAt            Rider picked up
deliveredAt           Rider delivered
completedAt           Order completed
rejectedAt            Rider rejected (if applicable)

── COD ────────────────────────────────────
cod_collected         boolean
cod_amount            Amount collected
cod_collected_at      When collected

── SLA ────────────────────────────────────
sla_breach            boolean (flagged in future automation)
sla_deadline          Date object

── Media ──────────────────────────────────
items_images[]        { file_id, filename, uploaded_at }  — vendor uploads
vendor_payment_slips[] { file_id, filename, uploaded_at }
rider_pickup_slips[]  { file_id, filename, uploaded_at }  — rider uploads
rider_payment_slips[] { file_id, filename, uploaded_at }

── History ─────────────────────────────────
status_history[]      { status, changed_at, changed_by, vendor_id }
payment_status        pending | paid | failed | refunded
```

### Rider

```
_id                   MongoDB ObjectId
name, phone           Identity (phone is unique)
password              bcrypt hash (vendor-created riders only)
created_by_vendor     ref: Vendor
status                pending | approved | rejected
isActive              boolean (online/offline)
location              { lat, lng }
live_location_link    Shareable GPS URL
lastLocationUpdate    Date
assignedOrders[]      ref: Booking[]
rating                0–5
completedOrders       integer
totalEarnings         number
```

### Vendor

```
_id                   MongoDB ObjectId
vendor_id             "V<timestamp><random>" (auto-generated)
name, email, phone    Identity
password_hash         bcrypt
address               Physical address
coordinates           { lat, lng }
google_maps_link      Shop location
services[]            Offered services
is_active             boolean
```

---

## 14. Frontend Routes

| Path | Component | Access |
|------|-----------|--------|
| `/` | Customer home | Public |
| `/desk` | Vendor login | Public |
| `/desk/dashboard` | Vendor dashboard | Vendor JWT |
| `/rider-desk` | Rider login | Public |
| `/rider-desk/dashboard` | Rider dashboard | Rider JWT |
| `/vendor/login` | Legacy vendor login | Public |
| `/vendor/dashboard` | Legacy vendor dashboard | Vendor JWT |
| `/admin` | Admin portal | Admin |
| `/rider` | Independent rider auth | Public |

---

## Development Notes

### Environment Variables Required

```env
MONGODB_URI=               MongoDB connection string
JWT_SECRET=                Token signing secret (keep secret!)
FIREBASE_PROJECT_ID=       Firebase admin SDK
FIREBASE_PRIVATE_KEY=      Firebase admin SDK
FIREBASE_CLIENT_EMAIL=     Firebase admin SDK
RAZORPAY_KEY_ID=           Payment gateway
RAZORPAY_KEY_SECRET=       Payment gateway
DVHOSTING_API_KEY=         SMS OTP service
PORT=3001                  Server port
```

### Key Design Decisions

1. **Vendor name as string identifier** — `assignedVendor` stores vendor name (not ObjectId). This allows existing orders to remain valid even if vendor MongoDB ID changes. New rider-assignment uses the actual ObjectId for lookups.

2. **Dual order types** — `Booking` (regular) and `PGOrder` (hostel/PG) share the same workflow but are stored separately. Dashboard currently shows regular Booking orders only; legacy `assigned-orders` endpoint returns both.

3. **Demo mode** — Many rider endpoints fall back to demo data when MongoDB is disconnected. This allows frontend development without a live database.

4. **GridFS for images** — All photos (item slips, payment screenshots) are stored in MongoDB GridFS, not the filesystem. This avoids disk space issues on stateless deployments.

5. **riderStatus vs status** — Two separate state machines run in parallel:
   - `status` = overall order lifecycle (vendor-facing)
   - `riderStatus` = rider's personal assignment status

6. **COD is optional** — Orders without `payment_status: pending` can skip COD collection. The COD modal is only shown when the order has an amount due.

---

*Last updated: 2026-04-02 — covers the Advanced Workflow Control release*
