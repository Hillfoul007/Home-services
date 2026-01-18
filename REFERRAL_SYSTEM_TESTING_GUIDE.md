# Referral & Earn System - Testing Guide

This document provides step-by-step instructions to test the complete referral system implementation.

## System Overview

The referral system works as follows:
1. Every user gets a unique referral code based on their phone number
2. When a user shares their code with a friend:
   - Friend gets ₹50 bonus on signup (can use on first order)
   - Referrer gets ₹100 when friend completes first order
3. Sharing works via copy-paste or WhatsApp direct link
4. WhatsApp links auto-fill the referral code on login

## Implementation Checklist

### Backend Components ✅
- [x] User model updated with referral_code, referred_by, referral_stats fields
- [x] Referral model created for tracking referrer-referee relationships
- [x] Auth registration updated to handle referral codes
- [x] Referral API endpoints created at `/api/referral`
- [x] Booking completion logic updated to credit wallet
- [x] Routes registered in server-laundry.js

### Frontend Components ✅
- [x] ReferralEarnModal component created with full UI
- [x] PhoneOtpAuthModal updated to accept and display referral codes
- [x] Referral utility functions created
- [x] LaundryIndex updated to detect URL referral codes
- [x] WhatsApp sharing integration added

## Testing Steps

### Test 1: User Registration with Referral Code

**Precondition:** User 1 has registered and has a referral code

**Steps:**
1. Get User 1's referral code from their profile
2. Create a referral link: `https://yourdomain.com?ref=USER1_CODE`
3. Open the link in a new browser/device (not logged in)
4. Auth modal should appear with referral banner showing the code
5. Complete registration with User 2's phone number

**Expected Results:**
- ✓ User 2 sees the referral bonus info (₹50)
- ✓ User 2 receives ₹50 credit in wallet upon signup
- ✓ User 1's referral_stats.total_referrals increments
- ✓ Referral record is created with status "pending"

**API Call to Verify:**
```bash
curl http://localhost:5000/api/referral/stats/{user1_phone_or_id}
# Should show total_referrals: 1, pending_referrals: 1
```

### Test 2: Referral Code Copy & Share

**Precondition:** User is logged in

**Steps:**
1. Click "Refer & Earn" or access ReferralEarnModal
2. Copy the referral code to clipboard
3. Click "Share on WhatsApp"
4. Verify WhatsApp link opens correctly
5. Check the share message content

**Expected Results:**
- ✓ Copy button works and shows "Copied!" feedback
- ✓ WhatsApp link opens with pre-filled message
- ✓ Message includes referral code and app link
- ✓ Share Link button works (uses native share or clipboard)

**Manual Verification:**
- Click "Copy" button - check localStorage for `pending_referral_code`
- WhatsApp message should contain: `Use my referral code *CODE* to get ₹50 bonus`

### Test 3: First Order Completion & Rewards

**Precondition:** User 2 is referred by User 1, User 2 has ₹50 wallet credit

**Steps:**
1. User 2 logs in and places an order
2. User 2 uses the ₹50 referral bonus in the order (apply as discount)
3. Complete the order (mark status as "completed" in admin panel)
4. Check both users' wallet balances

**Expected Results:**
- ✓ User 2 can use ₹50 on first order
- ✓ When order completed, User 1 receives ₹100 in wallet
- ✓ Referral status changes to "completed"
- ✓ Both users have transaction records in wallet_transactions
- ✓ User 2's has_completed_first_order flag is true

**API Calls to Verify:**

User 1 stats:
```bash
curl http://localhost:5000/api/referral/stats/{user1_phone_or_id}
# Should show: completed_referrals: 1, earnings: 100
```

User 1 wallet:
```bash
curl http://localhost:5000/api/wallet/transactions/{user1_phone_or_id}
# Should show credit transaction for referral reward
```

User 2 wallet:
```bash
curl http://localhost:5000/api/wallet/balance/{user2_phone_or_id}
# Should show initial ₹50 + any additional credits from order completion
```

### Test 4: Referral Code Validation

**Steps:**
1. Use the validate endpoint with a valid code
2. Use the validate endpoint with an invalid code

**API Calls:**
```bash
# Valid code
curl -X POST http://localhost:5000/api/referral/validate \
  -H "Content-Type: application/json" \
  -d '{"referral_code":"VALID_CODE"}'
# Response should have valid: true, referrer_name, reward_amount

# Invalid code
curl -X POST http://localhost:5000/api/referral/validate \
  -H "Content-Type: application/json" \
  -d '{"referral_code":"INVALID_CODE"}'
# Response should have valid: false
```

### Test 5: URL Parameter Handling

**Steps:**
1. Open app with referral code: `https://yourdomain.com?ref=USERCODE`
2. Not logged in - auth modal should appear with referral info
3. Already logged in - should clean up URL without showing modal

**Expected Results:**
- ✓ URL parameter is detected and stored
- ✓ Auth modal appears if user not logged in
- ✓ Referral banner shows in auth modal
- ✓ URL is cleaned after detection (no ?ref= in URL)
- ✓ Code is passed to registration
- ✓ Code is cleared from localStorage after signup

### Test 6: Referral Stats Display

**Precondition:** User has referred multiple people, some completed orders

**Steps:**
1. Open Refer & Earn modal
2. Check referral stats card
3. Check referrals list

**Expected Results:**
- ✓ Total referrals count is correct
- ✓ Completed referrals shows only completed orders
- ✓ Earnings shows sum of all completed referral rewards
- ✓ Referrals list shows:
  - Friend's phone and name
  - Status (Pending/Completed)
  - Reward amount
  - Dates

## Edge Cases to Test

### Edge Case 1: Same User Can't Refer Themselves
```bash
curl -X POST http://localhost:5000/api/referral/validate \
  -H "Content-Type: application/json" \
  -d '{"referral_code":"THEIR_OWN_CODE"}'
# Should return valid: false
```

### Edge Case 2: Multiple Referrals Don't Stack Rewards
**Steps:**
1. User A refers User B (get ₹100)
2. User A refers User C (get ₹100)
3. User B places order (User A should NOT get another ₹100)
4. Check that each referral is tracked separately

### Edge Case 3: Referral Code Is Immutable
**Steps:**
1. User signs up with referral code X
2. Admin tries to change referral code
3. Verify it cannot be changed

### Edge Case 4: First Order Bonus Only Given Once
**Steps:**
1. User places first order with referral (get ₹100 reward)
2. User places second order
3. Verify no additional rewards are given

## Database Queries for Verification

### Check User Referral Code
```javascript
db.users.findOne({ phone: "9876543210" }, { referral_code: 1, referred_by: 1, wallet_balance: 1 })
```

### Check Referral Record
```javascript
db.referrals.findOne({ referee_phone: "9876543210" })
```

### Check Wallet Transactions
```javascript
db.users.findOne({ phone: "9876543210" }, { wallet_transactions: 1 }).wallet_transactions
```

## Admin Panel Testing

1. Navigate to Admin Dashboard
2. Open Wallet Management tab
3. Search for referred users
4. Verify wallet balances are correct
5. Verify transaction history shows referral credits

## Performance Testing

- [ ] Load referral stats with 100+ referrals
- [ ] Check API response times
- [ ] Verify no N+1 queries in referral endpoints
- [ ] Check database indexes are working

## Mobile/WhatsApp Testing

- [ ] Test on Android device
- [ ] Test on iOS device
- [ ] Click WhatsApp link from mobile - should open WhatsApp
- [ ] Test URL parameters on mobile browser
- [ ] Test deep linking from WhatsApp

## Troubleshooting

### Referral Code Not Generated
**Problem:** User doesn't have referral_code
**Solution:** 
1. Check User model has referral_code field
2. Check migration/update script was run
3. Manually generate using: `generateReferralCode(phone)`

### Rewards Not Credited
**Problem:** User completes order but no wallet credit
**Solution:**
1. Check booking status is actually "completed"
2. Check Referral model has status "pending"
3. Check referrer_reward_credited is false
4. Check MongoDB connection in booking update logic

### WhatsApp Link Not Working
**Problem:** WhatsApp link doesn't open
**Solution:**
1. Check URL encoding in share_text
2. Verify wa.me link format
3. Test on mobile device (may not work on desktop)

## Success Criteria

The referral system is working correctly when:

1. ✓ Every new user gets a unique referral code on signup
2. ✓ Referral code is never-changing and based on phone
3. ✓ New users can register with a referral code
4. ✓ Referred users get ₹50 on signup
5. ✓ Referrer gets ₹100 when referred user completes first order
6. ✓ WhatsApp sharing works with pre-filled message
7. ✓ URL parameters auto-fill referral code in login
8. ✓ Users can copy code to share
9. ✓ Referral stats are accurate
10. ✓ Wallet transactions are recorded correctly
11. ✓ Rewards only given once per referral pair

## Notes

- All monetary amounts are in INR (₹)
- Referral rewards are added to wallet_balance
- Wallet transactions have type "credit" for referral rewards
- Referral code format: Last 8 digits of phone number (uppercase)
- If code exists, add counter: CODE1, CODE2, etc.
