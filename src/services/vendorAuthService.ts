import { apiClient } from '@/lib/apiClient';

interface LoginResponse {
  success: boolean;
  token?: string;
  vendor?: any;
  error?: string;
  data?: {
    token?: string;
    vendor?: any;
    error?: string;
  };
}

interface OrdersResponse {
  success: boolean;
  orders?: any[];
  error?: string;
}

interface StatusUpdateResponse {
  success: boolean;
  message?: string;
  order?: any;
  error?: string;
}

interface ImageUploadResponse {
  success: boolean;
  file_id?: string;
  filename?: string;
  message?: string;
  error?: string;
}

class VendorAuthService {
  private static instance: VendorAuthService;
  private baseUrl = '/api/vendor';

  public static getInstance(): VendorAuthService {
    if (!VendorAuthService.instance) {
      VendorAuthService.instance = new VendorAuthService();
    }
    return VendorAuthService.instance;
  }

  async login(vendorId: string, password: string): Promise<LoginResponse> {
    try {
      console.log('🔐 Vendor login attempt:', vendorId);

      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vendor_id: vendorId, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Vendor login failed:', data);
        return { success: false, error: data.error || 'Login failed' };
      }

      console.log('✅ Vendor login successful');
      return { success: true, token: data.token, vendor: data.vendor };
    } catch (error: any) {
      console.error('❌ Vendor login error:', error);
      return { success: false, error: error.message || 'Login error' };
    }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('❌ Token verification failed');
        return null;
      }

      return data.vendor;
    } catch (error) {
      console.error('❌ Token verification error:', error);
      return null;
    }
  }

  async fetchAssignedOrders(): Promise<OrdersResponse> {
    try {
      const token = localStorage.getItem('laundrify_token') || localStorage.getItem('auth_token');

      if (!token) {
        return { success: false, error: 'No authentication token found' };
      }

      console.log('📋 Fetching assigned orders');

      const response = await fetch(`${this.baseUrl}/orders/assigned-orders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Failed to fetch orders:', data);
        return { success: false, error: data.error || 'Failed to fetch orders' };
      }

      console.log('✅ Fetched assigned orders:', data.orders?.length);
      return { success: true, orders: data.orders };
    } catch (error: any) {
      console.error('❌ Error fetching assigned orders:', error);
      return { success: false, error: error.message || 'Failed to fetch orders' };
    }
  }

  async uploadItemsImage(orderId: string, file: File): Promise<ImageUploadResponse> {
    try {
      const token = localStorage.getItem('laundrify_token') || localStorage.getItem('auth_token');

      if (!token) {
        return { success: false, error: 'No authentication token found' };
      }

      console.log('📸 Uploading items image for order:', orderId);

      const formData = new FormData();
      formData.append('items_image', file);

      const response = await fetch(`${this.baseUrl}-orders/orders/${orderId}/upload-items-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Failed to upload image:', data);
        return { success: false, error: data.error || 'Upload failed' };
      }

      console.log('✅ Image uploaded successfully');
      return { success: true, file_id: data.file_id, filename: data.filename, message: data.message };
    } catch (error: any) {
      console.error('❌ Error uploading image:', error);
      return { success: false, error: error.message || 'Upload error' };
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<StatusUpdateResponse> {
    try {
      const token = localStorage.getItem('laundrify_token') || localStorage.getItem('auth_token');

      if (!token) {
        return { success: false, error: 'No authentication token found' };
      }

      console.log('📝 Updating order status:', { orderId, status });

      const response = await fetch(`${this.baseUrl}-orders/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Failed to update status:', data);
        return { success: false, error: data.error || 'Failed to update status' };
      }

      console.log('✅ Order status updated successfully');
      return { success: true, message: data.message, order: data.order };
    } catch (error: any) {
      console.error('❌ Error updating order status:', error);
      return { success: false, error: error.message || 'Status update error' };
    }
  }

  logout(): void {
    localStorage.removeItem('laundrify_token');
    localStorage.removeItem('auth_token');
    console.log('✅ Vendor logged out');
  }
}

export const vendorAuthService = VendorAuthService.getInstance();
