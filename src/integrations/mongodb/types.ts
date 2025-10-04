// MongoDB Types for the application

export interface User {
  _id: string;
  email: string;
  password?: string; // Optional in responses
  full_name: string;
  phone: string;
  user_type: "customer" | "provider" | "rider";
  created_at: Date;
  updated_at: Date;
  profile_image?: string;
  is_verified?: boolean;
  address?: string;
  preferences?: Record<string, any>;
}

export interface Booking {
  _id: string;
  customer_id: string;
  rider_id?: string;
  service: string;
  service_type: string;
  services: string[];
  scheduled_date: string;
  scheduled_time: string;
  delivery_date?: string;
  delivery_time?: string;
  provider_name: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  additional_details?: string;
  total_price: number;
  discount_amount?: number;
  final_amount: number;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  created_at: Date;
  updated_at: Date;
  estimated_duration?: number;
  special_instructions?: string;
  charges_breakdown?: {
    base_price: number;
    tax_amount: number;
    service_fee: number;
    discount: number;
  };
}

export interface AuthResponse {
  data: {
    user: User;
    session: {
      access_token: string;
      user: User;
    };
  } | null;
  error: {
    message: string;
  } | null;
}

export interface BookingResponse {
  data: Booking | Booking[] | null;
  error: {
    message: string;
  } | null;
}

export interface UserResponse {
  data: User | null;
  error: {
    message: string;
  } | null;
}

// Service Provider interface (if needed)
export interface Provider {
  _id: string;
  user_id: string;
  services: string[];
  hourly_rate: number;
  bio: string;
  rating: number;
  completed_jobs: number;
  status: "pending" | "approved" | "suspended";
  created_at: Date;
  updated_at: Date;
  user?: User;
}

// Rider interface (if needed)
export interface Rider {
  _id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  is_online: boolean;
  current_location?: string;
  rating: number;
  completed_rides: number;
  status: "pending" | "approved" | "suspended";
  created_at: Date;
  updated_at: Date;
  user?: User;
}

export type UserType = "customer" | "provider" | "rider";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
