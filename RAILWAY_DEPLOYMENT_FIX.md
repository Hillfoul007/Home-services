# Railway Backend Deployment Fix

## Issue
The production backend at `https://cleancare-pro-api-production-129e.up.railway.app` is returning 404 for `/api/addresses` endpoint.

## Root Cause
The deployed backend doesn't have the latest code that includes the address routes.

## Solution

### 1. Verify Backend Code
Ensure the Railway deployment includes the latest `backend/` folder with:
- `backend/routes/addresses.js` (address routes)
- `backend/models/Address.js` (address model)
- `backend/server-laundry.js` (with address routes registered)

### 2. Key Files to Deploy
```
backend/
├── routes/
│   ├── addresses.js      ← REQUIRED
│   └── ...
├── models/
│   ├── Address.js        ← REQUIRED
│   └── ...
└── server-laundry.js     ← Must include address routes registration
```

### 3. Server Registration Check
In `backend/server-laundry.js`, ensure this code is present:
```javascript
// Addresses routes
try {
  const addressRoutes = require("./routes/addresses");
  app.use("/api/addresses", addressRoutes);
  console.log("🔗 Address routes registered at /api/addresses");
} catch (error) {
  console.error("❌ Failed to load Address routes:", error.message);
}
```

### 4. Database Connection
Ensure MongoDB connection is properly configured for the Address model.

### 5. Environment Variables
Required environment variables for Railway:
```
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=production
PORT=3000
```

## Current Fallback
The frontend has been updated to handle this gracefully:
- ✅ Shows helpful 404 warnings in console
- ✅ Automatically falls back to localStorage
- ✅ UI continues to work normally
- ✅ Addresses can be saved locally until backend is fixed

## Testing
After deployment, test these endpoints:
- `GET /api/addresses` - Should return user addresses
- `POST /api/addresses` - Should create new address
- `DELETE /api/addresses/:id` - Should delete address

## Logs to Check
Look for these logs in Railway deployment:
```
🔗 Address routes registered at /api/addresses
```

If you see:
```
❌ Failed to load Address routes: [error]
```
Then there's an issue with the route files or dependencies.
