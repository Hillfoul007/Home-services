const mongoose = require("mongoose");

const pgOrderSchema = new mongoose.Schema(
  {
    // PG ORDER IDENTIFIERS
    order_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Format: PGPARA0A3001 (PGXXXX + 3-char + month + serial)
    },
    pg_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PG",
      required: true,
      index: true,
    },
    pg_name: {
      type: String,
      required: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
    },

    // CUSTOMER INFORMATION
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customer_name: {
      type: String,
      required: true,
      trim: true,
    },
    customer_phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ORDER DETAILS
    number_of_items: {
      type: Number,
      required: [true, "Number of items is required"],
      min: [4, "Minimum 4 items required"],
    },
    item_price: {
      type: Number,
      default: 25, // ₹25 per item
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
    coupon_code: {
      type: String,
      default: null,
      trim: true,
    },
    special_instructions: {
      type: String,
      default: "",
    },

    // VENDOR ASSIGNMENT
    assigned_vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
    vendor_details: {
      name: String,
      phone: String,
      address: String,
    },

    // RIDER ASSIGNMENT
    assigned_rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    rider_details: {
      name: String,
      phone: String,
    },

    // ORDER STATUS TRACKING
    status: {
      type: String,
      enum: [
        "created",
        "confirmed",
        "vendor_assigned",
        "pickup_assigned",
        "picked_up",
        "ready_for_delivery",
        "delivery_assigned",
        "delivered",
        "completed",
        "cancelled",
      ],
      default: "created",
      index: true,
    },

    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    // TIMELINE TRACKING
    pickup_scheduled_at: {
      type: Date,
      default: null,
    },
    pickup_completed_at: {
      type: Date,
      default: null,
    },
    delivery_scheduled_at: {
      type: Date,
      default: null,
    },
    delivery_completed_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },

    // STATUS HISTORY
    status_history: {
      type: [
        {
          status: String,
          changed_at: Date,
          changed_by: String,
          notes: String,
        },
      ],
      default: [],
    },

    // NOTIFICATION TRACKING
    notifications_sent: {
      vendor_assigned: { type: Boolean, default: false },
      rider_assigned: { type: Boolean, default: false },
      picked_up: { type: Boolean, default: false },
      out_for_delivery: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
    },

    // INSTRUCTION BOOK DATA
    instruction_book: {
      booking_done_message: {
        type: String,
        default:
          "Booking done, Order ID created. Pack the order in polybag kept near box area of PG, paste sticker and write order ID, drop the packet inside box which is put by laundrify",
      },
      shown_at: Date,
      acknowledged_by_customer: { type: Boolean, default: false },
    },

    created_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
    updated_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
  },
  {
    timestamps: true,
  }
);

// Generate custom PG order ID
pgOrderSchema.statics.generateOrderId = async function (pgName, pgId) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const yearMonth = `${year}-${month}`;

    // Get PG name's first 4 letters (uppercase)
    const pgPrefix = pgName.substring(0, 4).toUpperCase().padEnd(4, "X");

    // Generate a special 3-character alphanumeric code
    const specialChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let specialCode = "";
    for (let i = 0; i < 3; i++) {
      specialCode += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    }

    // Get monthly counter for this PG
    const pg = await mongoose.model("PG").findById(pgId);
    if (!pg) {
      throw new Error("PG not found");
    }

    let monthlyCount = pg.monthly_order_counter.get(yearMonth) || 0;
    monthlyCount++;

    // Update PG's monthly counter
    pg.monthly_order_counter.set(yearMonth, monthlyCount);
    await pg.save();

    // Format: PGXXX + special3 + month + serial (PGPARA0A3001)
    const serialNumber = String(monthlyCount).padStart(3, "0");
    const orderId = `PG${pgPrefix}${specialCode}${month}${serialNumber}`;

    // Double-check for uniqueness
    const existingOrder = await this.findOne({ order_id: orderId });
    if (existingOrder) {
      // Retry with slight modification if collision
      return this.generateOrderId(pgName, pgId);
    }

    return orderId;
  } catch (error) {
    console.error("Error generating PG order ID:", error);
    throw error;
  }
};

// Pre-save hook to generate order ID and update timestamps
pgOrderSchema.pre("save", async function (next) {
  try {
    const indianTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const indianDate = new Date(indianTime);

    this.updated_at = indianDate;

    if (this.isNew && !this.created_at) {
      this.created_at = indianDate;
    }

    // Generate order ID if not present
    if (this.isNew && !this.order_id) {
      const orderId = await this.constructor.generateOrderId(this.pg_name, this.pg_id);
      this.order_id = orderId;
      this.markModified("order_id");
    }

    // Calculate final amount if not set
    if (!this.final_amount) {
      this.final_amount = this.total_price - (this.discount_amount || 0);
    }

    if (this.final_amount < 0) {
      this.final_amount = 0;
    }

    // Set completion timestamp if status is completed
    if (this.status === "completed" && !this.completed_at) {
      this.completed_at = new Date();
    }

    next();
  } catch (error) {
    console.error("Error in PGOrder pre-save hook:", error);
    next(error);
  }
});

// Indexes for performance
pgOrderSchema.index({ order_id: 1 }, { unique: true });
pgOrderSchema.index({ customer_id: 1 });
pgOrderSchema.index({ pg_id: 1 });
pgOrderSchema.index({ assigned_vendor: 1 });
pgOrderSchema.index({ assigned_rider: 1 });
pgOrderSchema.index({ status: 1 });
pgOrderSchema.index({ city: 1 });
pgOrderSchema.index({ created_at: -1 });

module.exports = mongoose.model("PGOrder", pgOrderSchema);
