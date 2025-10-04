const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // PRIMARY BOOKING IDENTIFIERS - TOP PRIORITY
    custom_order_id: {
      type: String,
      required: false,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, "Customer phone number is required"],
      trim: true,
      index: true,
    },

    // CUSTOMER REFERENCE
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer ID is required"],
    },
    rider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
    assignedVendor: {
      type: String,
      default: null,
    },
    assignedVendorDetails: {
      name: String,
      address: String,
      phone: String,
    },
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
    service: {
      type: String,
      required: [true, "Service is required"],
    },
    service_type: {
      type: String,
      required: [true, "Service type is required"],
    },
    services: [
      {
        type: String,
        required: true,
      },
    ],
    scheduled_date: {
      type: String,
      required: [true, "Scheduled date is required"],
    },
    scheduled_time: {
      type: String,
      required: [true, "Scheduled time is required"],
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
      required: [true, "Provider name is required"],
    },
    address: {
      type: String,
      required: [true, "Address is required"],
    },
    address_details: {
      flatNo: String,
      street: String,
      landmark: String,
      village: String,
      city: String,
      pincode: String,
      type: {
        type: String,
        enum: ["home", "office", "other"],
        default: "other",
      },
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
    // Photos uploaded by rider at pickup/delivery
    pickup_photos: {
      type: [String],
      default: []
    },
    delivery_photos: {
      type: [String],
      default: []
    },
    additional_details: {
      type: String,
      default: "",
    },
    total_price: {
      type: Number,
      required: [true, "Total price is required"],
      min: [0, "Total price must be non-negative"],
    },
    discount_amount: {
      type: Number,
      default: 0,
      min: [0, "Discount amount must be non-negative"],
    },
    coupon_code: {
      type: String,
      default: null,
      trim: true,
    },
    final_amount: {
      type: Number,
      required: [true, "Final amount is required"],
      min: [0, "Final amount must be non-negative"],
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
    estimated_duration: {
      type: Number,
      default: 60, // minutes
    },
    special_instructions: {
      type: String,
      default: "",
    },
    item_prices: [
      {
        service_name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
        unit_price: {
          type: Number,
          required: true,
          min: 0,
        },
        total_price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
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
      delivery_fee: {
        type: Number,
        default: 0,
      },
      handling_fee: {
        type: Number,
        default: 0,
      },
      discount: {
        type: Number,
        default: 0,
      },
    },
    completed_at: {
      type: Date,
    },
    created_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})),
    },
    updated_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})),
    },
  },
  {
    timestamps: true,
  },
);

// Generate custom order ID - moved inside schema statics
bookingSchema.statics.generateCustomOrderId = async function () {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${year}${month}`;

  console.log("🔢 Generating custom order ID for year-month:", yearMonth);

  // Use a more robust query to find the latest booking for this month
  const latestBooking = await this.findOne(
    {
      custom_order_id: {
        $regex: `^[A-Z]${yearMonth}`,
        $exists: true,
        $ne: null,
      },
    },
    null,
    { sort: { custom_order_id: -1 } },
  );

  console.log(
    "🔍 Latest booking found:",
    latestBooking ? latestBooking.custom_order_id : "none",
  );

  let letter = "A";
  let sequence = 1;

  if (latestBooking && latestBooking.custom_order_id) {
    try {
      const lastOrderId = latestBooking.custom_order_id;
      const lastLetter = lastOrderId.charAt(0);
      const lastSequence = parseInt(lastOrderId.slice(-5));

      console.log("📊 Last order details:", {
        lastOrderId,
        lastLetter,
        lastSequence,
      });

      if (!isNaN(lastSequence)) {
        if (lastSequence >= 99999) {
          // Roll over to next letter
          letter = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
          sequence = 1;
        } else {
          letter = lastLetter;
          sequence = lastSequence + 1;
        }
      }
    } catch (parseError) {
      console.warn(
        "⚠️ Error parsing last order ID, using defaults:",
        parseError,
      );
    }
  }

  const sequenceStr = String(sequence).padStart(5, "0");
  const newOrderId = `${letter}${yearMonth}${sequenceStr}`;

  console.log("✨ Generated new order ID:", newOrderId);

  // Double-check that this ID doesn't already exist (prevent duplicates)
  const existingBooking = await this.findOne({ custom_order_id: newOrderId });
  if (existingBooking) {
    console.warn("⚠️ Generated ID already exists, incrementing...");
    sequence++;
    const fallbackSequenceStr = String(sequence).padStart(5, "0");
    const fallbackOrderId = `${letter}${yearMonth}${fallbackSequenceStr}`;
    console.log("�� Fallback order ID:", fallbackOrderId);
    return fallbackOrderId;
  }

  return newOrderId;
};

// Calculate final amount and generate custom order ID before saving
bookingSchema.pre("save", async function (next) {
  try {
    // Get Indian Standard Time
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    const indianDate = new Date(indianTime);

    this.updated_at = indianDate;

    // Set created_at for new documents
    if (this.isNew && !this.created_at) {
      this.created_at = indianDate;
    }

    // Generate custom order ID if it's a new document
    if (this.isNew && !this.custom_order_id) {
      console.log(
        "🔢 Attempting to generate custom order ID for new booking...",
      );
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const generatedId = await this.constructor.generateCustomOrderId();
          this.custom_order_id = generatedId;
          console.log("✅ Generated custom order ID:", this.custom_order_id);

          // Explicitly mark the field as modified to ensure it gets saved
          this.markModified("custom_order_id");
          break;
        } catch (error) {
          retryCount++;
          console.error(
            `❌ Failed to generate custom order ID (attempt ${retryCount}/${maxRetries}):`,
            error,
          );

          if (retryCount >= maxRetries) {
            // Generate a fallback custom order ID
            const fallbackId = `B${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            this.custom_order_id = fallbackId;
            this.markModified("custom_order_id");
            console.warn("⚠️ Using fallback custom order ID:", fallbackId);
          } else {
            // Wait a bit before retrying to avoid race conditions
            await new Promise((resolve) =>
              setTimeout(resolve, 100 * retryCount),
            );
          }
        }
      }
    }

    // Calculate final amount if not already set
    if (!this.final_amount) {
      this.final_amount = this.total_price - (this.discount_amount || 0);
    }

    // Ensure final amount is not negative
    if (this.final_amount < 0) {
      this.final_amount = 0;
    }

    // Synchronize services and service fields with item_prices
    if (this.item_prices && this.item_prices.length > 0) {
      // Include quantities in service representation for better tracking
      const serviceNamesWithQty = this.item_prices.map(item =>
        item.quantity > 1 ? `${item.service_name} x${item.quantity}` : item.service_name
      );

      // Only update if they're different to avoid unnecessary changes
      if (!this.services || this.services.join(',') !== serviceNamesWithQty.join(',')) {
        this.services = serviceNamesWithQty;
        console.log('🔄 Pre-save: Synchronized services array from item_prices with quantities');
      }

      const serviceString = serviceNamesWithQty.join(', ');
      if (this.service !== serviceString) {
        this.service = serviceString;
        console.log('🔄 Pre-save: Synchronized service string from item_prices with quantities');
      }
    }

    // Set completion timestamp if status is completed
    if (this.status === "completed" && !this.completed_at) {
      this.completed_at = new Date();
    }

    next();
  } catch (error) {
    console.error("❌ Error in pre-save middleware:", error);
    next(error);
  }
});

// Create indexes
bookingSchema.index({ custom_order_id: 1 }, { unique: true, sparse: true });
bookingSchema.index({ customer_id: 1 });
bookingSchema.index({ rider_id: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ payment_status: 1 });
bookingSchema.index({ scheduled_date: 1 });
bookingSchema.index({ created_at: -1 });
bookingSchema.index({ "coordinates.lat": 1, "coordinates.lng": 1 });

// Static method to find bookings within radius
bookingSchema.statics.findNearby = function (lat, lng, radiusKm = 5) {
  const radiusInRadians = radiusKm / 6371; // Earth's radius in km

  return this.find({
    "coordinates.lat": {
      $gte: lat - radiusInRadians,
      $lte: lat + radiusInRadians,
    },
    "coordinates.lng": {
      $gte: lng - radiusInRadians,
      $lte: lng + radiusInRadians,
    },
  });
};

module.exports = mongoose.model("Booking", bookingSchema);
