import { getApiUrl } from '../config/env';

export interface CustomerPackageBalance {
  KG: number;
  PC: number;
}

export class CustomerPackageService {
  private static instance: CustomerPackageService;

  public static getInstance(): CustomerPackageService {
    if (!CustomerPackageService.instance) {
      CustomerPackageService.instance = new CustomerPackageService();
    }
    return CustomerPackageService.instance;
  }

  private getBaseUrl(): string {
    return getApiUrl();
  }

  /**
   * Get a customer's quantity package balance (kg/pcs) by phone number.
   */
  async getBalance(phone: string): Promise<{ success: boolean; balance?: CustomerPackageBalance; error?: string }> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/customer-packages/balance/${phone}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching customer package balance:', error);
      return { success: false, error: 'Failed to fetch package balance' };
    }
  }
}

export const customerPackageService = CustomerPackageService.getInstance();
