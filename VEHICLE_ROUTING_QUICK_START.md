# 🚀 Vehicle Routing System - Quick Start

## Step-by-Step Integration (15 minutes)

### 1️⃣ Register Backend Routes
**File**: `backend/server-laundry.js` (around where other routes are imported)

```javascript
// Add this line with other route imports:
const vehicleRoutes = require('./routes/vehicles');

// Add this line with other route registrations:
app.use('/api', vehicleRoutes);
```

---

### 2️⃣ Add Admin Vehicle Management to App
**File**: `src/App.tsx`

```tsx
import AdminVehicleManagement from "@/components/AdminVehicleManagement";

// In your routes (add to admin routes section):
<Route path="/admin/vehicles" element={<AdminVehicleManagement />} />
```

Then add a menu item linking to `/admin/vehicles` in your admin dashboard.

---

### 3️⃣ Add Driver/Vehicle Dashboard
**File**: `src/App.tsx`

```tsx
import VehicleDashboard from "@/components/VehicleDashboard";

// Add these routes:
<Route path="/driver" element={<VehicleDashboard />} />
<Route path="/driver/route/:vehicleId" element={<VehicleDashboard />} />
```

---

### 4️⃣ (Optional) Add Vehicle Slot Selector to Booking
**File**: `src/components/AdminUserBooking.tsx` or your booking component

```tsx
import VehicleSlotSelector from "@/components/VehicleSlotSelector";

// Add this to your booking form:
<div className="border-t pt-4">
  <h4 className="mb-4 font-semibold">Vehicle Routing</h4>
  <VehicleSlotSelector 
    timeSlot={bookingData.scheduled_time}
    onSelect={(vehicle) => {
      setBookingData(prev => ({
        ...prev,
        assigned_vehicle_id: vehicle.vehicleId,
        vehicle_time_slot: vehicle.slot
      }));
    }}
  />
</div>

// When submitting booking, include:
const bookingPayload = {
  // ... existing fields
  assigned_vehicle_id: bookingData.assigned_vehicle_id,
  vehicle_time_slot: bookingData.vehicle_time_slot,
};
```

---

## ✨ Testing the System

### 1. Create a Vehicle
1. Go to `/admin/vehicles`
2. Click "Add Vehicle"
3. Fill in: Name, Number Plate, Type
4. Click Create

### 2. Assign Vendor to Vehicle
1. Click "Assign Vendor" on the vehicle
2. Select a vendor from dropdown
3. Click Assign

### 3. Book Order with Vehicle
1. Go to Admin Booking Management
2. Create/edit booking
3. Select time slot in Vehicle Slot Selector
4. Select available vehicle
5. Complete booking

### 4. View Vehicle Route
1. Go to `/admin/vehicles`
2. Click "View Route" on any vehicle
3. See all orders for that vehicle

### 5. Driver Dashboard
1. Go to `/driver`
2. Enter vehicle ID (from admin vehicles page)
3. Allow location access
4. View optimized route with all orders
5. Click "Pickup Complete" → "Delivery Complete"

---

## 📋 Checklist

- [ ] Backend routes registered in server file
- [ ] AdminVehicleManagement component added to routes
- [ ] VehicleDashboard component added to routes
- [ ] (Optional) VehicleSlotSelector integrated into booking
- [ ] Created at least one vehicle in admin
- [ ] Assigned vendor to vehicle
- [ ] Booked an order with vehicle slot
- [ ] Tested driver dashboard with live location
- [ ] Verified pickup/delivery status updates

---

## 🔧 Configuration

### Time Slots
Slots are **automatically generated** from:
- **Start**: 9:00 AM
- **End**: 8:00 PM  
- **Interval**: 30 minutes
- **Total Slots**: 22 per vehicle

### Capacity Per Vehicle
Default: 10 orders max per vehicle
Edit in `backend/models/Vehicle.js`:
```javascript
max_orders_per_trip: {
  type: Number,
  default: 10,  // Change this value
}
```

### Location Update Frequency
Default: Every 30 seconds
Edit in `src/components/VehicleDashboard.tsx`:
```javascript
watchPosition(..., {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 5000,  // Change this value (milliseconds)
})
```

### Nearby Order Distance
Default: 1 km
Edit in `backend/routes/vehicles.js`:
```javascript
if (distance < 1) {  // Change this value
  suggestionPairs.push({...})
}
```

---

## 🎨 UI Customization

### Colors
Edit component files to change colors:
- Primary blue: `text-blue-600`, `bg-blue-50`
- Success green: `text-green-600`, `bg-green-50`
- Warning orange: `text-orange-600`, `bg-orange-50`

### Button Styles
Modify Button className attributes:
```tsx
<Button className="gap-2 bg-blue-600 hover:bg-blue-700">
  // Change bg-blue-600 to other colors
</Button>
```

---

## 🔍 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| No vehicles showing | Restart backend, check MongoDB |
| Location not updating | Allow geolocation permission, use HTTPS |
| Slots not appearing | Recreate vehicle or check backend logs |
| Orders not in route | Assign order to vehicle via admin |
| API not working | Verify routes are registered in server |

---

## 📞 Key API Endpoints

```
GET    /api/admin/vehicles                     - List all vehicles
POST   /api/admin/vehicles                     - Create vehicle
PUT    /api/admin/vehicles/{id}                - Update vehicle
POST   /api/admin/vehicles/{id}/assign-vendor  - Assign vendor
GET    /api/vehicle/route/{id}                 - Get optimized route
POST   /api/vehicle/update-location/{id}       - Update location
POST   /api/vehicle/order-status/{bookingId}   - Mark complete
```

---

## 🚀 You're All Set!

Your vehicle routing system is now ready to use. Start by:

1. Creating vehicles in Admin
2. Assigning vendors
3. Creating orders with vehicle slots
4. Testing the driver dashboard

**Estimated Setup Time**: 10-15 minutes  
**Difficulty Level**: ⭐⭐⭐ (Moderate)

---

**Need Help?** Check `VEHICLE_ROUTING_SYSTEM.md` for detailed documentation.
