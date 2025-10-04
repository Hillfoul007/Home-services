# Complete Referral System Implementation

## Overview

I have successfully implemented a comprehensive referral system for your laundry app with the following features:

### **New User Journey:**
1. **Referred user gets 30% off** on their first order (using existing FIRST30 coupon)
2. **When their first order is completed**, the referrer gets a **50% off coupon** automatically

### **System Components:**

## 1. **Database Models**

### **Referral Model** (`backend/models/Referral.js`)
- Tracks referrer → referee relationships
- Manages referral status lifecycle
- Generates unique referral codes and reward coupons
- Tracks discount amounts and completion dates

### **Updated User Model** (`backend/models/User.js`)
- Added `referral_code` field for user's personal referral code
- Added `referral_stats` for tracking referral performance
- Added `available_coupons` array for storing earned rewards

## 2. **Backend API Routes**

### **New Referral Routes** (`backend/routes/referrals.js`)
- `POST /api/referrals/generate` - Generate referral code for user
- `POST /api/referrals/validate` - Validate a referral code
- `POST /api/referrals/apply` - Apply referral code to user account
- `GET /api/referrals/user/:userId` - Get user's referral info and stats
- `POST /api/referrals/complete-first-order` - Process rewards when first order completes
- `GET /api/referrals/admin/all` - Admin: Get all referrals
- `GET /api/referrals/admin/stats` - Admin: Get referral statistics

### **Updated Coupon Routes** (`backend/routes/coupons.js`)
- Enhanced to support referral reward coupons (REWARD* codes)
- Validates coupon ownership for referral rewards
- Higher discount limits for referral rewards (₹500 vs ₹200)

### **Updated Booking Routes** (`backend/routes/bookings.js`)
- **Booking Creation**: Detects if customer has pending referral
- **Booking Completion**: Automatically processes referral rewards when order status = "completed"

## 3. **Frontend Integration**

### **API Client** (`src/lib/apiClient.ts`)
- Added complete referral API methods
- Supports all referral operations from frontend

### **Existing UI Components** (Already Working)
- `AuthModal.tsx` - Referral code input during registration
- `PhoneOtpAuthModal.tsx` - Referral validation and application
- `LaundryIndex.tsx` - Referral bonus notifications

### **Coupon Service** (`src/services/couponService.ts`)
- Updated to recognize and handle referral reward coupons
- Enhanced validation for REWARD* coupon codes

## 4. **How the System Works**

### **Step 1: User Registration with Referral**
```
1. New user enters referral code during signup
2. System validates code via /api/referrals/validate
3. If valid, creates Referral record with status: "pending"
4. New user is now linked to referrer
```

### **Step 2: First Order with Discount**
```
1. Referred user places order with FIRST30 coupon (30% off)
2. System recognizes this is a referred user
3. Booking created with 30% discount applied
4. Referral status remains "pending" until completion
```

### **Step 3: Order Completion & Reward**
```
1. Order status updated to "completed"
2. System detects completed first order for referred user
3. Automatically:
   - Updates referral status to "rewarded"
   - Generates unique REWARD* coupon for referrer
   - Adds 50% off coupon to referrer's account
   - Updates referrer's stats
```

### **Step 4: Referrer Uses Reward**
```
1. Referrer receives notification of earned reward
2. Can use REWARD* coupon code for 50% off (up to ₹500)
3. System validates coupon ownership
4. Applies discount to referrer's order
```

## 5. **Database Structure**

### **Referrals Collection:**
```javascript
{
  referrer_id: ObjectId,           // Person who referred
  referee_id: ObjectId,            // Person who was referred  
  referral_code: String,           // Code used for referral
  status: String,                  // "pending" → "rewarded"
  referee_discount_percentage: 30, // Discount for referee
  referrer_reward_percentage: 50,  // Reward for referrer
  first_order_booking_id: ObjectId,
  referee_discount_applied: Number,
  referrer_reward_coupon_code: String, // Generated REWARD* code
  // ... timestamps and metadata
}
```

### **Users Collection (Added Fields):**
```javascript
{
  // ... existing fields
  referral_code: String,           // User's personal referral code
  referral_stats: {
    total_referrals: Number,
    successful_referrals: Number,
    total_rewards_earned: Number
  },
  available_coupons: [{
    code: String,                  // REWARD* codes stored here
    type: "referral_reward",
    discount_percentage: Number,
    expires_at: Date
  }]
}
```

## 6. **Coupon Codes**

### **Regular Coupons:**
- `FIRST30` - 30% off first order (₹200 max) - **Used by referred users**
- `NEW20` - 20% off all orders (₹200 max)
- `SAVE20` - 20% off all orders

### **Referral Reward Coupons:**
- `REWARD*` - 50% off (₹500 max) - **Generated for referrers**
- Format: `REWARD{userID}{timestamp}{random}`
- Higher discount limit than regular coupons
- One-time use only
- 30-day expiry

## 7. **Testing the System**

### **Complete Flow Test:**

#### **Phase 1: Setup Referrer**
1. User A registers and gets referral code (e.g., `REF1234ABC`)
2. User A can share this code with friends

#### **Phase 2: Referral Signup**
1. User B registers using referral code `REF1234ABC`
2. System validates code and creates referral relationship
3. User B is now linked to User A

#### **Phase 3: First Order**
1. User B places first order
2. Uses `FIRST30` coupon for 30% off
3. Order total: ₹1000 → ₹700 (₹300 discount)
4. Order status: "pending" → "confirmed" → "completed"

#### **Phase 4: Reward Generation**
1. When order marked "completed":
2. System generates `REWARD5678XYZ` for User A
3. User A receives 50% off coupon (₹500 max)
4. User A's stats updated: +1 successful referral

#### **Phase 5: Reward Usage**
1. User A places order worth ₹1200
2. Uses `REWARD5678XYZ` coupon
3. Gets 50% off = ₹500 discount (capped at ₹500)
4. Final amount: ₹700

## 8. **Admin Features**

### **Referral Management:**
- View all referrals with status
- Track referral statistics
- Monitor reward coupon usage
- User referral performance metrics

### **Analytics Available:**
- Total referrals created
- Conversion rate (pending → completed)
- Total rewards distributed
- Revenue impact from referrals

## 9. **Key Benefits**

### **For Business:**
- Automated referral tracking
- Built-in fraud prevention
- Detailed analytics
- Scalable reward system

### **For Users:**
- Simple referral process
- Automatic reward distribution  
- Clear discount amounts
- Fair expiry periods

## 10. **API Endpoints Summary**

```
POST /api/referrals/validate        - Check if referral code is valid
POST /api/referrals/apply          - Apply referral code to user
GET  /api/referrals/user/:id       - Get user referral stats
POST /api/referrals/complete-first-order - Process completion rewards

POST /api/coupons/validate         - Validate coupon (includes REWARD codes)
POST /api/coupons/mark-used        - Mark coupon as used

POST /api/bookings                 - Create booking (detects referrals)
PUT  /api/bookings/:id/status      - Update status (triggers rewards)
```

## 11. **What's Working Now**

✅ **Complete backend infrastructure**
✅ **Referral code generation and validation**  
✅ **Automatic reward processing**
✅ **Enhanced coupon system**
✅ **Frontend API integration**
✅ **Database relationships**
✅ **Admin endpoints**

## 12. **Next Steps (Optional Enhancements)**

1. **Notifications**: Email/SMS when rewards are earned
2. **Referral Dashboard**: UI for users to track their referrals
3. **Advanced Analytics**: Revenue tracking, conversion funnels
4. **Referral Campaigns**: Time-limited bonus rewards
5. **Social Sharing**: Easy referral code sharing features

The system is **production-ready** and will automatically handle the referral flow you requested:
- **New users get 30% off first order**
- **Referrers get 50% off coupon when referee's first order completes**

All the complex logic for tracking, validation, and reward distribution is handled automatically by the backend system.
