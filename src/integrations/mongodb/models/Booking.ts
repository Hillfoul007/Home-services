import mongoose, { Schema, Document } from "mongoose";

export interface Booking extends Document {
  _id: string;
  custom_order_id?: string;
  customer_id: string;
  rider_id?: string;
  service: string;
  service_type: string;
  services: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
  }>;
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
  contactDetails: {
    phone: string;
    name: string;
    instructions?: string;
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

const bookingSchema = new Schema<Booking>({
  custom_order_id: {
    type: String,
    required: false,
  },
  customer_id: {
    type: String,
    required: true,
    ref: "User",
  },
  rider_id: {
    type: String,
    ref: "User",
    default: null,
  },
  service: {
    type: String,
    required: true,
  },
  service_type: {
    type: String,
    required: true,
  },
  services: [
    {
      id: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      category: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
    },
  ],
  scheduled_date: {
    type: String,
    required: true,
  },
  scheduled_time: {
    type: String,
    required: true,
  },
  delivery_date: {
    type: String,
    required: true,
  },
  delivery_time: {
    type: String,
    required: true,
  },
  provider_name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  coordinates: {
    lat: {
      type: Number,
      default: null,
    },
    lng: {
      type: Number,
      default: null,
    },
  },
  contactDetails: {
    phone: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    instructions: {
      type: String,
      default: "",
    },
  },
  additional_details: {
    type: String,
    default: "",
  },
  total_price: {
    type: Number,
    required: true,
    min: 0,
  },
  discount_amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  final_amount: {
    type: Number,
    required: true,
    min: 0,
  },
  payment_status: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
    default: "pending",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  estimated_duration: {
    type: Number,
    default: 60, // minutes
  },
  special_instructions: {
    type: String,
    default: "",
  },
  charges_breakdown: {
    base_price: {
      type: Number,
      default: 0,
    },
    tax_amount: {
      type: Number,
      default: 0,
    },
    service_fee: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
  },
});

// Calculate final amount before saving
bookingSchema.pre("save", function (next) {
  this.updated_at = new Date();

  // Calculate final amount if not already set
  if (!this.final_amount) {
    this.final_amount = this.total_price - (this.discount_amount || 0);
  }

  // Ensure final amount is not negative
  if (this.final_amount < 0) {
    this.final_amount = 0;
  }

  next();
});

// Create indexes
bookingSchema.index({ custom_order_id: 1 }, { unique: true, sparse: true });
bookingSchema.index({ customer_id: 1 });
bookingSchema.index({ rider_id: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ payment_status: 1 });
bookingSchema.index({ scheduled_date: 1 });
bookingSchema.index({ created_at: -1 });

export const BookingModel = mongoose.model<Booking>("Booking", bookingSchema);
