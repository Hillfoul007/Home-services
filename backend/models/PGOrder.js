const mongoose = require("mongoose");

const pgOrderSchema = new mongoose.Schema(
  {
    // PRIMARY ORDER IDENTIFIERS
    custom_order_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
    },
    city: {
      type: String,
      required: true,
      index: true,
    },

    // CUSTOMER REFERENCE
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // VENDOR & RIDER ASSIGNMENT
    assignedVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    assignedVendorDetails: {
      name: String,
      address: String,
      phone: String,
    },
    assignedRider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    assignedRiderPhone: {
      type: String,
      default: null,
    },

    // RIDER STATUS TRACKING
    riderStatus: {
      type: String,
      enum: ["unassigned", "assigned", "accepted", "picked_up", "delivered", "completed"],
      default: "unassigned",
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },

    // SERVICE DETAILS - PG only has Laundry and Iron service
    service: {
      type: String,
      default: "Laundry and Iron",
    },
    service_type: {
      type: String,
      default: "pg_laundry",
    },
    services: [
      {
        type: String,
      },
    ],

    // ITEM DETAILS
    no_of_items: {
      type: Number,
      required: true,
      min: 4,
    },
    price_per_item: {
      type: Number,
      default: 25,
    },
    item_prices: [
      {
        service_name: {
          type: String,
          default: "Laundry and Iron",
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unit_price: {
          type: Number,
          default: 25,
        },
        total_price: {
          type: Number,
          required: true,
        },
      },
    ],

    // PRICING
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
    cashback: {
      type: Number,
      default: 0,
      min: 0,
    },
    wallet_cashback: {
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

    // ADDRESS & LOCATION
    address: {
      type: String,
      required: true,
    },
    address_details: {
      flatNo: String,
      street: String,
      landmark: String,
      city: String,
      pincode: String,
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

    // ORDER STATUS
    status: {
      type: String,
      enum: [
        "created",
        "vendor_assigned",
        "pending",
        "confirmed",
        "pickup_assigned",
        "pickup_completed",
        "ready_for_delivery",
        "delivery_assigned",
        "delivered",
        "completed",
        "cancelled",
      ],
      default: "created",
    },
    status_history: {
      type: [
        {
          status: String,
          changed_at: Date,
          changed_by: String,
        },
      ],
      default: [],
    },

    // PHOTOS
    pickup_photos: {
      type: [String],
      default: [],
    },
    delivery_photos: {
      type: [String],
      default: [],
    },

    // SPECIAL INSTRUCTIONS
    special_instructions: {
      type: String,
      default: "",
    },

    // TIMELINE
    estimated_duration: {
      type: Number,
      default: 60,
    },
    completed_at: {
      type: Date,
    },
    created_at: {
      type: Date,
      default: () =>
        new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        ),
    },
    updated_at: {
      type: Date,
      default: () =>
        new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        ),
    },
  },
  {
    timestamps: true,
  }
);

// Generate custom order ID for PG Orders
pgOrderSchema.statics.generateCustomOrderId = async function (pgName, pgCity) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const pgPrefix = pgName.substring(0, 4).toUpperCase();

  console.log("🔢 Generating PG order ID for:", { pgName, pgPrefix, month });

  // Find latest PG order for this PG and month
  const latestOrder = await this.findOne(
    {
      pg_name: pgName,
      custom_order_id: {
        $regex: `^PG${pgPrefix}.*${month}`,
      },
    },
    null,
    { sort: { created_at: -1 } }
  );

  let sequenceNumber = 1;

  if (latestOrder && latestOrder.custom_order_id) {
    try {
      // Extract sequence number from last order ID
      // Format: PGPARA0A3001/002/003 -> extract last 3 digit sequence
      const parts = latestOrder.custom_order_id.split("/");
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        const lastSeq = parseInt(lastPart);
        if (!isNaN(lastSeq)) {
          sequenceNumber = lastSeq + 1;
        }
      }
    } catch (parseError) {
      console.warn("⚠️ Error parsing last PG order ID, using defaults:", parseError);
    }
  }

  // Generate 3-letter/digit special code (using letters and numbers)
  const specialCode = generateSpecialCode();
  const sequenceStr = String(sequenceNumber).padStart(3, "0");
  const monthStr = month;

  const newOrderId = `PG${pgPrefix}${specialCode}${monthStr}/${sequenceStr}`;

  console.log("✨ Generated new PG order ID:", newOrderId);

  // Double-check that this ID doesn't already exist
  const existingOrder = await this.findOne({ custom_order_id: newOrderId });
  if (existingOrder) {
    console.warn("⚠️ Generated ID already exists, incrementing...");
    const fallbackSeqStr = String(sequenceNumber + 1).padStart(3, "0");
    const fallbackId = `PG${pgPrefix}${specialCode}${monthStr}/${fallbackSeqStr}`;
    console.log("🔄 Fallback PG order ID:", fallbackId);
    return fallbackId;
  }

  return newOrderId;
};

// Helper function to generate 3-character special code
function generateSpecialCode() {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Pre-save middleware
pgOrderSchema.pre("save", async function (next) {
  try {
    const indianTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const indianDate = new Date(indianTime);

    this.updated_at = indianDate;

    if (this.isNew && !this.created_at) {
      this.created_at = indianDate;
    }

    // Generate custom order ID if it's a new document
    if (this.isNew && !this.custom_order_id) {
      console.log("🔢 Attempting to generate PG custom order ID...");
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const generatedId = await this.constructor.generateCustomOrderId(
            this.pg_name,
            this.city
          );
          this.custom_order_id = generatedId;
          console.log("✅ Generated PG custom order ID:", this.custom_order_id);
          this.markModified("custom_order_id");
          break;
        } catch (error) {
          retryCount++;
          console.error(
            `❌ Failed to generate PG order ID (attempt ${retryCount}/${maxRetries}):`,
            error
          );

          if (retryCount >= maxRetries) {
            const fallbackId = `PGAUTO${Date.now()}`;
            this.custom_order_id = fallbackId;
            this.markModified("custom_order_id");
            console.warn("⚠️ Using fallback PG order ID:", fallbackId);
          } else {
            await new Promise((resolve) =>
              setTimeout(resolve, 100 * retryCount)
            );
          }
        }
      }
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
    console.error("❌ Error in PG pre-save middleware:", error);
    next(error);
  }
});

// Create indexes
pgOrderSchema.index({ custom_order_id: 1 }, { unique: true, sparse: true });
pgOrderSchema.index({ pg_id: 1 });
pgOrderSchema.index({ customer_id: 1 });
pgOrderSchema.index({ city: 1 });
pgOrderSchema.index({ status: 1 });
pgOrderSchema.index({ assignedVendor: 1 });
pgOrderSchema.index({ created_at: -1 });

module.exports = mongoose.model("PGOrder", pgOrderSchema);
