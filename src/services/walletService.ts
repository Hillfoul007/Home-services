import { apiClient } from './apiClient';
import { getApiUrl } from '../config/env';

export interface WalletTransaction {
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  booking_id?: string;
  created_at: string;
}

export interface UserWallet {
  _id: string;
  name: string;
  full_name: string;
  phone: string;
  wallet_balance: number;
  created_at: string;
}

export class WalletService {
  private static instance: WalletService;

  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  private getBaseUrl(): string {
    return getApiUrl();
  }

  /**
   * Get user's wallet balance
   */
  async getWalletBalance(userId: string): Promise<{ success: boolean; wallet_balance?: number; error?: string }> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/balance/${userId}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return { success: false, error: 'Failed to fetch wallet balance' };
    }
  }

  /**
   * Get user's wallet transactions
   */
  async getWalletTransactions(userId: string): Promise<{ success: boolean; transactions?: WalletTransaction[]; error?: string }> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/transactions/${userId}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching wallet transactions:', error);
      return { success: false, error: 'Failed to fetch transactions' };
    }
  }

  /**
   * Admin: Add wallet cashback to a single user
   */
  async adminAddCashback(userId: string, amount: number, description: string = ''): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/admin/add-cashback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount, description })
      });
      return await response.json();
    } catch (error) {
      console.error('Error adding cashback:', error);
      return { success: false, error: 'Failed to add cashback' };
    }
  }

  /**
   * Admin: Add wallet cashback to multiple users (specific user IDs)
   */
  async adminBulkAddCashback(userIds: string[], amount: number, description: string = ''): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/admin/bulk-add-cashback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds, amount, description })
      });
      return await response.json();
    } catch (error) {
      console.error('Error adding bulk cashback:', error);
      return { success: false, error: 'Failed to add bulk cashback' };
    }
  }

  /**
   * Admin: Add wallet cashback to ALL users
   */
  async adminBulkAddCashbackToAllUsers(amount: number, description: string = ''): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/admin/bulk-add-to-all-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description })
      });
      return await response.json();
    } catch (error) {
      console.error('Error adding bulk cashback to all users:', error);
      return { success: false, error: 'Failed to add bulk cashback to all users' };
    }
  }

  /**
   * Admin: Deduct wallet amount from a single user
   */
  async adminDeductAmount(userId: string, amount: number, description: string = ''): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/admin/deduct-amount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount, description })
      });
      return await response.json();
    } catch (error) {
      console.error('Error deducting amount:', error);
      return { success: false, error: 'Failed to deduct amount' };
    }
  }

  /**
   * Admin: Deduct wallet amount from multiple users (specific user IDs)
   */
  async adminBulkDeductAmount(userIds: string[], amount: number, description: string = ''): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/admin/bulk-deduct-amount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds, amount, description })
      });
      return await response.json();
    } catch (error) {
      console.error('Error deducting bulk amount:', error);
      return { success: false, error: 'Failed to deduct bulk amount' };
    }
  }

  /**
   * Admin: Deduct wallet amount from ALL users
   */
  async adminBulkDeductFromAllUsers(amount: number, description: string = ''): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/admin/bulk-deduct-from-all-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description })
      });
      return await response.json();
    } catch (error) {
      console.error('Error deducting amount from all users:', error);
      return { success: false, error: 'Failed to deduct amount from all users' };
    }
  }

  /**
   * Admin: Search users for wallet management
   */
  async searchUsers(query: string): Promise<{ success: boolean; users?: UserWallet[]; error?: string }> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/admin/search-users?query=${encodeURIComponent(query)}`);
      return await response.json();
    } catch (error) {
      console.error('Error searching users:', error);
      return { success: false, error: 'Failed to search users' };
    }
  }

  /**
   * Debit wallet when booking cashback is used
   */
  async debitWalletForBooking(userId: string, bookingId: string, amount: number): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/debit-for-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, booking_id: bookingId, amount })
      });
      return await response.json();
    } catch (error) {
      console.error('Error debiting wallet:', error);
      return { success: false, error: 'Failed to debit wallet' };
    }
  }

  /**
   * Credit wallet_cashback after booking completion
   */
  async creditWalletAfterBooking(userId: string, bookingId: string, amount: number): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/wallet/credit-after-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, booking_id: bookingId, amount })
      });
      return await response.json();
    } catch (error) {
      console.error('Error crediting wallet:', error);
      return { success: false, error: 'Failed to credit wallet' };
    }
  }
}

export const walletService = WalletService.getInstance();
