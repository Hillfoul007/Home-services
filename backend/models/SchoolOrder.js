const mongoose = require("mongoose");

const schoolOrderSchema = new mongoose.Schema(
  {
    // Order ID format: SCH{schoolCode}-{MMYY}-{0001}
    // e.g. SCH01-0426-0001
    custom_order_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    school_name: {
      type: String,
      required: true,
    },
    school_code: {
      type: String,
      required: true,
    },

    // Member reference
    member_id: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    member_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    member_db_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolMember",
      default: null,
    },

    // Service details
    service: {
      type: String,
      enum: ["wash_and_iron", "wash_and_fold"],
      required: true,
    },
    items_count: {
      type: Number,
      required: true,
      min: 1,
    },
    price_per_item: {
      type: Number,
      required: true,
      min: 0,
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Order status
    status: {
      type: String,
      enum: ["pending", "picked_up", "processing", "ready", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },

    // Dates
    pickup_date: {
      type: Date,
      default: null,
    },
    delivery_date: {
      type: Date,
      default: null,
    },
    delivered_at: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: "",
    },

    // Payment
    payment_status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    payment_method: {
      type: String,
      enum: ["cash", "online", "monthly_bill"],
      default: "monthly_bill",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Generate order ID: SCH{schoolCode}-{MMYY}-{seq 0001}
schoolOrderSchema.statics.generateCustomOrderId = async function (schoolCode) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  const monthYear = `${month}${year}`;
  const prefix = `SCH${schoolCode}-${monthYear}-`;

  const latestOrder = await this.findOne(
    {
      custom_order_id: { $regex: `^${prefix}`, $exists: true, $ne: null },
    },
    null,
    { sort: { custom_order_id: -1 } }
  );

  let sequence = 1;

  if (latestOrder && latestOrder.custom_order_id) {
    try {
      const parts = latestOrder.custom_order_id.split("-");
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    } catch (e) {
      sequence = 1;
    }
  }

  const seqStr = String(sequence).padStart(4, "0");
  const newOrderId = `${prefix}${seqStr}`;

  // Collision check
  const existing = await this.findOne({ custom_order_id: newOrderId });
  if (existing) {
    const fallbackSeqStr = String(sequence + 1).padStart(4, "0");
    return `${prefix}${fallbackSeqStr}`;
  }

  return newOrderId;
};

schoolOrderSchema.pre("save", async function (next) {
  try {
    if (this.isNew && !this.custom_order_id) {
      this.custom_order_id = await this.constructor.generateCustomOrderId(this.school_code);
    }
    // Auto-calculate total
    if (this.isModified("items_count") || this.isModified("price_per_item")) {
      this.total_amount = this.items_count * this.price_per_item;
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("SchoolOrder", schoolOrderSchema);
