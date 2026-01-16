# Admin Distance Calculation & Cashback Implementation

## Overview
This implementation adds:
1. **Distance Calculation**: Calculates distance from user to vendor using geocoding and Haversine formula
2. **Cashback Field**: Admin can add cashback amount to reduce total before discount
3. **Proper Discount Calculation**: Discount percentage is applied AFTER cashback is deducted

## Implementation Details

### 1. Distance Calculation (Backend)

#### File: `backend/routes/admin.js`

**Distance Helper Function** (Lines 12-35):
```javascript
const calculateDistance = (coord1, coord2) => {
  // Uses Haversine formula to calculate distance between two coordinates
  // Returns distance in kilometers, rounded to 2 decimal places
  // Returns null if coordinates are missing
}
```

**Features**:
- Uses Haversine formula (spherical distance calculation)
- Returns distance in kilometers
- Handles missing coordinates gracefully
- Rounds to 2 decimal places

#### Updated Vendor Assignment Endpoint: `/api/admin/orders/assign-vendor`

**What Changed**:
- Now accepts `bookingCoordinates` in request body
- Automatically calculates distance using the helper function
- Estimates time based on distance (~2 minutes per km)

**Request Example**:
```json
{
  "orderId": "booking123",
  "vendorData": {
    "vendorId": "vendor1",
    "distance": 0,
    "estimatedTime": 0
  },
  "orderType": "Regular",
  "bookingCoordinates": {
    "lat": 28.4595,
    "lng": 77.0266
  }
}
```

**Response Includes**:
- Calculated distance in km
- Estimated time to vendor
- Vendor details with distance information

### 2. Cashback Field (Frontend)

#### File: `src/components/AdminBookingManagement.tsx`

**UI Component** (Lines 1529-1548):
- Input field for cashback amount
- Located in the edit booking dialog
- Shows helper text: "Deducted from total before discount"

**Data Structure**:
```typescript
interface Booking {
  cashback_amount?: number;
  discount_percent?: number;
  distance_to_vendor?: number;
  coordinates?: { lat: number; lng: number };
}
```

### 3. Calculation Logic

#### File: `src/components/AdminBookingManagement.tsx` - `computeEditingTotals` Function

**Calculation Order** (Lines 940-969):

1. **Calculate Subtotal**
   ```
   Subtotal = Sum of (Item Quantity × Unit Price)
   ```

2. **Apply Cashback**
   ```
   After Cashback = Subtotal - Cashback Amount
   ```

3. **Apply Discount Percentage**
   ```
   Discount Amount = (After Cashback × Discount Percent) / 100
   ```

4. **Calculate Final Amount**
   ```
   Final Amount = After Cashback - Discount Amount
   ```

**Example Calculation**:
```
Items Total:         ₹1000
Cashback Amount:     -₹100
---
After Cashback:      ₹900
Discount (10%):      -₹90
---
Final Amount:        ₹810
```

### 4. Distance Display in Admin UI

#### Location: Edit Booking Dialog (Lines 1651-1693)

**Distance Display**:
- Shows when a vendor is assigned
- Displayed in a blue information box
- Format: "X.XX km"
- Shows estimated time to vendor in parentheses

### 5. Pricing Summary Display

#### File: `src/components/AdminBookingManagement.tsx` (Lines 1786-1821)

**Shows in Real-time**:
```
Subtotal:              ₹1000
├─ Cashback:          -₹100
├─ After Cashback:     ₹900
├─ Discount (10%):     -₹90
│
Final Amount:          ₹810
```

## Data Flow

### Admin Booking Edit Flow:
1. Admin opens booking edit dialog
2. Admin enters/modifies cashback amount and discount percentage
3. Real-time calculation updates pricing summary
4. Admin clicks "Save Changes"
5. Frontend sends updated booking with calculations to backend
6. Backend validates and saves

### Vendor Assignment Flow:
1. Admin selects vendor from dropdown
2. Frontend passes booking coordinates to API
3. Backend calculates distance using Haversine formula
4. Distance is saved with booking
5. Admin can see distance in the UI

## Key Features

### ✅ Distance Calculation
- Accurate Haversine formula implementation
- Handles edge cases (missing coordinates)
- Returns null-safe values
- Automatically estimates delivery time

### ✅ Cashback Processing
- Deducted from total BEFORE discount percentage
- Prevents discount stacking issues
- Flexible admin input
- Shows in pricing breakdown

### ✅ Discount Logic
- Applied AFTER cashback deduction
- Percentage-based calculation
- Shows actual discount amount in rupees
- Real-time calculation in UI

### ✅ Price Transparency
- Shows all calculation steps
- Separate rows for cashback and discount
- Shows intermediate amounts (after cashback)
- Final amount clearly displayed

## API Integration

### Backend Endpoints Updated:
1. **PUT `/api/admin/bookings/:bookingId`**
   - Now accepts `cashback_amount`, `discount_percent`, `coordinates`, `distance_to_vendor`

2. **POST `/api/admin/orders/assign-vendor`**
   - Now accepts `bookingCoordinates`
   - Automatically calculates and returns distance

## Testing

### To Test Distance Calculation:
1. Open admin booking edit dialog
2. Assign a vendor to a booking
3. Verify distance is shown in the vendor section
4. Check that estimated time is calculated correctly

### To Test Cashback & Discount:
1. Edit a booking's items to get a subtotal
2. Enter a cashback amount (e.g., ₹100)
3. Enter a discount percentage (e.g., 10%)
4. Verify:
   - Subtotal is calculated correctly
   - Cashback is deducted from subtotal
   - Discount is applied to the amount AFTER cashback
   - Final amount is correct

**Example**:
- Items: ₹1000
- Cashback: ₹100
- Discount: 10%
- Expected Final: ₹810
  - ✓ Calculation: (1000 - 100) - ((1000 - 100) × 0.10) = 900 - 90 = 810

## Frontend Components Affected

### AdminBookingManagement.tsx
- Updated Booking interface
- Added distance display
- Updated save logic to include coordinates and distance
- Updated cashback and discount fields
- Enhanced pricing summary display

## Backend Components Affected

### admin.js
- Added `calculateDistance` helper function
- Updated `/orders/assign-vendor` endpoint
- Updated `/bookings/:bookingId` PUT endpoint

## Future Enhancements

1. **Address Geocoding**: Automatically geocode customer address if coordinates not available
2. **Multiple Vendors**: Show distances to multiple vendors for comparison
3. **Distance-based Pricing**: Automatically adjust delivery fees based on distance
4. **Batch Calculations**: Calculate distances for multiple bookings at once
5. **Vendor Capacity**: Consider distance when auto-assigning vendors
