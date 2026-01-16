# Wallet Integration in User Profile

## Overview

The wallet display has been integrated into the User Profile modal with full transaction history. Users can now view their wallet balance and transaction history directly from their profile.

## Changes Made

### 1. Updated UserProfileModal Component
**File**: `src/components/UserProfileModal.tsx`

#### New Features:
- **Two-tab interface**:
  - **Profile Tab**: User name and phone number (existing functionality)
  - **Wallet Tab**: Wallet balance and transaction history (new)

- **Wallet Balance Display**:
  - Shows current balance with green gradient card
  - Displays icon and balance amount (₹X.XX)
  - Refresh button to manually update balance
  - Loading state with spinner

- **Transaction History**:
  - Lists all wallet transactions
  - Shows transaction type (credit/debit)
  - Displays amount with color coding (green for credit, red for debit)
  - Shows transaction date and time in Indian format
  - Scrollable list with max height (400px)
  - Empty state message when no transactions exist

#### Added Imports:
```typescript
import { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Wallet, RefreshCw, TrendingUp, TrendingDown, Loader } from "lucide-react";
import { walletService, type WalletTransaction } from "@/services/walletService";
import { toast } from "sonner";
```

#### New State Variables:
```typescript
const [walletBalance, setWalletBalance] = useState<number>(0);
const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
const [walletLoading, setWalletLoading] = useState(true);
const [activeTab, setActiveTab] = useState("profile");
```

#### New Functions:
- `loadWalletData()`: Fetches wallet balance and transactions from API
- `handleRefreshWallet()`: Manually refreshes wallet data with toast notification

#### Auto-load Behavior:
- Wallet data loads automatically when modal opens
- Updates when user ID changes
- Reloads when modal is reopened

### 2. Removed Wallet Badge from Header
**File**: `src/components/ResponsiveLaundryHome.tsx`

#### Changes:
- Removed import of `WalletBadge` component
- Removed wallet badge display from mobile section (was at line ~873)
- Removed wallet badge display from desktop section (was at line ~1373)
- Wallet now only appears in User Profile modal

#### Why:
- Reduces visual clutter in header
- Centralizes wallet information in profile
- Improves mobile screen real estate
- Users access wallet through dedicated profile section

### 3. WalletBadge Component (Kept for Reference)
**File**: `src/components/WalletBadge.tsx`

- Remains available but not used in main UI
- Can be reused elsewhere if needed
- Contains compact wallet display logic

## UI Structure

### Wallet Tab Layout:

```
┌─────────────────────────────────┐
│ Wallet Balance Card              │
├─────────────────────────────────┤
│ 💚 Wallet Balance                │
│    ₹1,250.50          🔄 Refresh │
│ Available for cashback & discounts
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Transaction History              │
├─────────────────────────────────┤
│ ✓ Booking Cashback (Jan 5, 2024) │
│   +₹50.00                        │
├─────────────────────────────────┤
│ ✓ Cashback Earned (Jan 4, 2024)  │
│   +₹25.00                        │
├─────────────────────────────────┤
│ ✗ Cashback Used (Jan 3, 2024)    │
│   -₹75.00                        │
└─────────────────────────────────┘

[Close Button]
```

## How to Use

### Accessing Wallet:
1. Click user profile button in header
2. Select "Wallet" tab in the profile modal
3. View balance and transaction history
4. Click refresh button to update balance

### Features:
- **View Balance**: Current wallet balance displayed prominently
- **Transaction History**: Complete list of all money movements
- **Date/Time**: Each transaction shows when it occurred
- **Type Indicator**: Visual icons show credit (⬆️) vs debit (⬇️)
- **Refresh**: Manual refresh button to sync latest balance

## API Integration

### Endpoints Used:
- `GET /api/wallet/balance/:userId`
  - Returns: `{ success: true, wallet_balance: number }`
  
- `GET /api/wallet/transactions/:userId`
  - Returns: `{ success: true, transactions: WalletTransaction[] }`

### Error Handling:
- If user not found, API returns 0 balance (graceful degradation)
- Toast notifications on refresh
- Loading states prevent UI freezing
- Errors logged to console without blocking UI

## Code Example

### Opening User Profile with Wallet:
```tsx
import UserProfileModal from '@/components/UserProfileModal';

<UserProfileModal
  isOpen={profileModalOpen}
  onClose={() => setProfileModalOpen(false)}
  currentUser={currentUser}
  onUserUpdate={setCurrentUser}
/>
```

The profile modal automatically loads wallet data when the "Wallet" tab is selected.

## Styling Details

### Wallet Balance Card:
- Gradient background: `from-green-50 to-emerald-50`
- Border: `border-green-200`
- Icon background: `bg-green-600`
- Balance text: `text-green-600` (2xl bold)

### Transaction Items:
- Background: `bg-white`
- Border: `border-gray-200`
- Credit type: Green indicators (`text-green-600`)
- Debit type: Red indicators (`text-red-600`)
- Date format: Indian locale with time

### Loading State:
- Animated spinner with `animate-spin`
- Color: `text-green-600`

## Mobile Responsiveness

- Modal max width: `sm:max-w-md`
- Max height: `max-h-[90vh]` with scrolling
- Transaction list: scrollable with `max-h-[400px]`
- Touch-friendly tab switching
- All text sizes optimized for mobile viewing

## Performance Considerations

- Lazy loading: Data only loads when modal opens
- Scroll optimization: Max height prevents DOM overflow
- Efficient re-renders: useEffect dependencies properly set
- Error handling: Non-blocking failures

## Testing Checklist

- [ ] Profile modal opens correctly
- [ ] Wallet tab shows balance
- [ ] Transactions load and display
- [ ] Refresh button updates data
- [ ] Date/time format is correct (India timezone)
- [ ] No API 404 errors
- [ ] Loading spinner appears during fetch
- [ ] Empty state shows when no transactions
- [ ] Profile tab still works normally
- [ ] Modal closes properly

## File Summary

### Modified Files:
1. `src/components/UserProfileModal.tsx` - Added wallet tab with balance and transactions
2. `src/components/ResponsiveLaundryHome.tsx` - Removed wallet badge from header

### New Documentation:
- `WALLET_PROFILE_INTEGRATION.md` (this file)

### Unchanged Files:
- `src/components/WalletBadge.tsx` - Available for other uses
- `backend/routes/wallet.js` - API unchanged
- `src/services/walletService.ts` - Service unchanged

## Future Enhancements

1. **Transaction Filtering**:
   - Filter by transaction type (credit/debit)
   - Filter by date range
   - Search by description

2. **Wallet Actions**:
   - Use wallet balance for booking discounts
   - Transfer balance to bank
   - Wallet statements/export

3. **Notifications**:
   - Notify when balance changes
   - Celebrate milestone balances
   - Remind about expiring balance

4. **Analytics**:
   - Show total earned/spent
   - Charts of wallet activity
   - Monthly breakdown

## Support

If wallet data doesn't load:
1. Check that user has `_id` or `phone` field
2. Verify API endpoints are responding
3. Check browser console for errors
4. Run migration: `npm run migrate:wallet`
5. Check MongoDB for user wallet_balance field

Contact support if issues persist.
