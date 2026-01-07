# Referral & Earn System - Implementation Summary

## Overview

A complete referral and earn system has been implemented for Laundrify that allows users to earn rewards by inviting friends. The system includes wallet integration, WhatsApp sharing, and automatic reward distribution.

## Key Features

✨ **Core Features:**
- Unique referral code for every user (based on phone number, never-changing)
- Share referral code via copy-paste or WhatsApp
- ₹50 bonus for referred user on first order
- ₹100 reward for referrer when referred user completes first order
- Automatic wallet credit when conditions are met
- Referral stats dashboard with earning tracking
- WhatsApp links auto-fill referral code on login

## Files Modified

### Backend Files

#### 1. `backend/models/User.js`
- Added `referral_code` field (unique, never-changing)
- Added `referred_by` field to track who referred this user
- Added `referral_stats` object with: total_referrals, completed_referrals, earned_amount, last_referral_date
- Added `has_completed_first_order` flag
- Added indexes for performance

#### 2. `backend/routes/otp-auth.js` (NEW FUNCTIONALITY)
- Updated `POST /auth/register` to accept `referral_code` parameter
- Updated `POST /auth/save-user` to accept `referral_code` parameter
- Both endpoints now:
  - Generate unique referral code for new users
  - Create Referral document if referral code provided
  - Credit ₹50 to referred user's wallet
  - Update referrer's total_referrals count

#### 3. `backend/routes/referral.js` (NEW FILE)
New API endpoints for referral functionality:
- `GET /api/referral/my-code/:userId` - Get user's referral code
- `GET /api/referral/stats/:userId` - Get referral statistics
- `GET /api/referral/share-link/:userId` - Generate shareable links
- `POST /api/referral/validate` - Validate referral code
- `GET /api/referral/check/:userId` - Check referral status

#### 4. `backend/models/Referral.js` (NEW FILE)
New Mongoose model for tracking referrer-referee relationships:
- Tracks referrer_id, referee_id, referral_code
- Maintains status (pending/completed)
- Records first order booking and date
- Tracks reward crediting for both parties
- Includes reward amounts (100 for referrer, 50 for referee)

#### 5. `backend/routes/bookings.js`
- Updated booking status update endpoint (`PUT /:bookingId/status`)
- Added referral reward logic when booking status changes to "completed"
- Checks if it's first order, credits both referrer and referee
- Updates Referral record status to "completed"
- Includes error handling to not block booking

#### 6. `backend/routes/admin.js`
- Added same referral reward logic for admin booking updates
- Ensures referrals are credited even when admin updates status
- Maintains consistency with regular booking updates

#### 7. `backend/server-laundry.js`
- Registered new referral routes at `/api/referral`
- Added error handling for route loading

### Frontend Files

#### 1. `src/components/ReferralEarnModal.tsx` (NEW FILE)
Complete UI component for Refer & Earn feature:
- Display referral code with copy button
- How it works section (4-step process)
- Share buttons (WhatsApp, Link share)
- Referral stats (total, completed, earnings)
- List of all referrals with status tracking
- Loading states and error handling

#### 2. `src/components/PhoneOtpAuthModal.tsx` (MODIFIED)
- Added `referralCode` optional prop
- Display referral bonus banner when code present
- Pass referral code to backend registration
- Updated visual hierarchy for referral info

#### 3. `src/services/dvhostingSmsService.ts`
- Updated `saveUserToBackend()` to accept optional `referral_code` parameter
- Includes referral code in registration payload
- Properly handles new user with referral code

#### 4. `src/utils/referralUtils.ts` (NEW FILE)
Helper functions for referral handling:
- `getReferralCodeFromUrl()` - Extract ref parameter from URL
- `storeReferralCode()` - Save to localStorage
- `getStoredReferralCode()` - Retrieve from storage
- `clearStoredReferralCode()` - Clean up storage
- `generateWhatsAppShareLink()` - Create shareable WhatsApp link
- Various utility checks for referral status

#### 5. `src/pages/LaundryIndex.tsx` (MODIFIED)
- Added referral code state management
- Detect referral code from URL on app load
- Auto-open auth modal when referral code detected
- Pass referral code through to auth modal
- Clean URL after detecting referral code
- Added showAuthModal state for referral flow

## Database Schema Changes

### User Collection
```javascript
{
  // ... existing fields ...
  referral_code: String, // e.g., "9876543210" (unique)
  referred_by: ObjectId, // Reference to referrer User
  referral_stats: {
    total_referrals: Number,
    completed_referrals: Number,
    earned_amount: Number,
    last_referral_date: Date
  },
  has_completed_first_order: Boolean,
  // ... wallet fields already exist ...
}
```

### Referral Collection (NEW)
```javascript
{
  _id: ObjectId,
  referrer_id: ObjectId, // User who shared code
  referee_id: ObjectId, // User who was referred
  referral_code: String,
  status: "pending" | "completed",
  first_order_booking_id: ObjectId,
  first_order_date: Date,
  referrer_reward: Number, // 100
  referee_reward: Number, // 50
  referrer_reward_credited: Boolean,
  referee_reward_credited: Boolean,
  created_at: Date,
  updated_at: Date
}
```

## API Endpoints

### Referral Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/referral/my-code/:userId` | Get user's referral code |
| GET | `/api/referral/stats/:userId` | Get referral statistics |
| GET | `/api/referral/check/:userId` | Check referral status |
| POST | `/api/referral/validate` | Validate a referral code |
| GET | `/api/referral/share-link/:userId` | Get shareable links |

### Modified Auth Endpoints
| Method | Endpoint | Change |
|--------|----------|--------|
| POST | `/auth/register` | Now accepts `referral_code` |
| POST | `/auth/save-user` | Now accepts `referral_code` |

## Workflow Diagrams

### User Registration with Referral
```
User clicks WhatsApp link with ?ref=CODE
    ↓
App detects referral code from URL
    ↓
Auth modal opens with referral banner
    ↓
User enters phone & completes OTP
    ↓
Backend creates user
    ↓
Backend finds referrer from referral_code
    ↓
Credit ₹50 to user's wallet
    ↓
Increment referrer's total_referrals
    ↓
Create Referral document (status: pending)
    ↓
User logged in with bonus in wallet
```

### First Order Completion Reward
```
Referred user places and completes first order
    ↓
Booking status updated to "completed"
    ↓
Backend checks: is this their first order?
    ↓
Check if user has pending referral
    ↓
Credit ₹100 to referrer's wallet
    ↓
Update Referral record status to "completed"
    ↓
Mark both rewards as credited
    ↓
Set user's has_completed_first_order = true
```

### Sharing Flow
```
User opens Refer & Earn
    ↓
Fetch user's referral code
    ↓
Display code + share options
    ↓
User clicks WhatsApp button
    ↓
Share link with pre-filled message:
"Use code ABC1234 to get ₹50 bonus"
    ↓
Share link also contains app URL with ?ref=CODE
    ↓
Friend clicks link → referral flow starts
```

## Code Examples

### Getting Referral Code
```typescript
const response = await fetch(`/api/referral/my-code/${userId}`);
const data = await response.json();
console.log(data.referral_code); // "9876543210"
```

### Getting Referral Stats
```typescript
const response = await fetch(`/api/referral/stats/${userId}`);
const stats = await response.json();
// stats.total_referrals, stats.completed_referrals, stats.earnings
```

### Registering with Referral Code
```typescript
const response = await fetch(`/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    phone: "9876543210",
    full_name: "John",
    referral_code: "FRIENDSCODE" // NEW
  })
});
```

### Validating Referral Code
```typescript
const response = await fetch(`/api/referral/validate`, {
  method: "POST",
  body: JSON.stringify({ referral_code: "ABC1234" })
});
const { valid, referrer_name } = await response.json();
```

## Reward Logic

### Referral Rewards Distribution

**For Referred User (Referee):**
- Gets ₹50 immediately on signup
- Credited to wallet_balance
- Can use on first order or save for later
- Transaction type: "credit", description: "Sign-up referral bonus"

**For Referrer:**
- Gets ₹100 when referee completes first order
- Only credited once per referral pair
- Not credited if referee doesn't complete first order
- Transaction type: "credit", description: "Referral reward for {name}'s first order"

## Testing

See `REFERRAL_SYSTEM_TESTING_GUIDE.md` for comprehensive testing instructions including:
- User registration with referral code
- Copying and sharing referral code
- First order completion and reward crediting
- Referral code validation
- URL parameter handling
- Edge case testing

## Security Considerations

1. **Referral Code Uniqueness:**
   - Based on last 8 digits of phone
   - Added counter if collision occurs
   - Indexed in database for fast lookup

2. **Authorization:**
   - Users can only access their own referral data
   - Cannot modify referral codes
   - Cannot manually credit rewards

3. **Reward Logic:**
   - Only credited once per referral pair
   - Only credited when first order actually completed
   - Tracked in Referral document to prevent double-crediting

4. **URL Parameters:**
   - Referral code cleaned from URL after processing
   - Stored in localStorage temporarily
   - Cleared after successful registration

## Performance Optimizations

1. **Database Indexes:**
   - Index on referral_code in User collection
   - Index on referee_id and referrer_id in Referral collection
   - Compound index on referrer_id + referee_id for uniqueness

2. **Query Optimization:**
   - Populate queries only fetch needed fields
   - Limited transaction history in responses
   - Indexed lookups for fast referral validation

## Future Enhancements

Possible future improvements:
- Tiered referral rewards (more rewards after X referrals)
- Referral expiry (code expires after Y days)
- Bulk referral codes for marketing campaigns
- Referral analytics dashboard
- Email notifications for referral activities
- Referral leaderboard
- Team referrals support

## Migration Guide

If integrating into existing system:

1. Add fields to User schema
2. Create Referral model
3. Register new routes
4. Update registration endpoints
5. Update booking completion logic
6. Add frontend components
7. Add utility functions
8. Update main app layout to include ReferralEarnModal

No breaking changes - system is backward compatible.
