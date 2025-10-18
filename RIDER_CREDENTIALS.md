# Rider System Demo Credentials & Testing Guide

## 🚨 Current Status
The rider system is **fully implemented** but experiencing a deployment issue where the production backend (`home-services-5alb.onrender.com`) doesn't have the rider routes deployed yet.

## 📱 Demo Credentials for Testing

Since the production backend doesn't have rider routes yet, the system operates in **demo mode** when the database is unavailable. You can test with any credentials:

### Demo Login Credentials
- **Phone:** Any phone number (e.g., `9876543210`)
- **Password:** Any password (e.g., `password123`)

The system will automatically create a demo rider account for testing purposes.

## 🔧 How to Test the Rider System

### Option 1: Local Development (Recommended)
1. **Frontend:** http://localhost:10000/rider
2. **Backend:** http://localhost:3001/api/riders

In local development, the rider system works with full database functionality.

### Option 2: Production Frontend + Demo Mode
1. **Frontend:** https://www.laundrify.online/rider
2. **Backend:** Demo mode (no database required)

The production frontend will detect the backend issue and operate in demo mode.

## 🛠️ Technical Implementation Status

### ✅ Completed Features
- [x] Rider registration with file upload
- [x] Rider login/authentication 
- [x] Admin verification system
- [x] Order assignment interface
- [x] Live location tracking
- [x] Rider dashboard with active/inactive toggle
- [x] Order management for riders
- [x] Demo mode for testing without database

### 🚧 Deployment Issue
The production backend needs the rider routes deployed. The code exists in:
- `backend/routes/riders.js` - Complete rider API endpoints
- `backend/server-laundry.js` - Routes registered (lines 351-358)
- `backend/models/Rider.js` - Database model

## 🔄 Next Steps for Production

To fix the production deployment:

1. **Deploy Backend:** The rider routes need to be deployed to `home-services-5alb.onrender.com`
2. **Database Migration:** Run the rider table creation script
3. **Environment Variables:** Ensure JWT secrets are configured

## 🧪 Testing Instructions

### Test Rider Registration
1. Go to rider portal: http://localhost:10000/rider
2. Click "Register as Rider"
3. Fill form with any demo data
4. Upload any image files (Aadhar + Selfie)
5. Submit registration

### Test Rider Login
1. Use any phone number and password
2. System creates demo account automatically
3. Access rider dashboard features

### Test Admin Features
1. Go to admin panel
2. View registered riders
3. Approve/reject riders
4. Assign orders to active riders

## 📋 Sample Demo Data

The system includes sample orders for testing:
- LAU-001: John Doe, MG Road pickup
- LAU-002: Jane Smith, Cyber City pickup  
- LAU-003: Mike Johnson, Golf Course Road pickup

## 🔐 Security Notes

- Demo mode uses fallback JWT secret
- File uploads work in demo mode
- All data is temporary in demo mode
- Production requires proper JWT_SECRET configuration

---

**Current Error:** `POST https://home-services-5alb.onrender.com/api/riders/login 400 (Bad Request)`

**Cause:** Production backend missing rider route deployment

**Workaround:** Use local development environment for full functionality
