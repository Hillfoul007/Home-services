// Global type definitions

declare global {
  const API_BASE_URL: string;
  const supabase: any;
  const riderHelpers: any;
  const WhatsAppAuth: any;

  interface ExotelResponse {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
    callId?: string;
    user?: any;
  }

  interface User {
    _id: string;
    id: string;
    uid: string;
    email: string;
    phone: string;
    full_name: string;
    user_type: "customer" | "provider" | "rider";
    [key: string]: any;
  }
}

export {};
