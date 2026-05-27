const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    qty: { type: Number, default: 0, min: 0 },
    dc_qty: { type: Number, default: 0, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const hotelOrderSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },
    hotel_name: { type: String, required: true, trim: true },
    hotel_address: { type: String, default: "", trim: true },

    invoice_no: { type: String, required: true, unique: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD

    items: [itemSchema],
    total: { type: Number, default: 0, min: 0 },

    // Order lifecycle status
    status: {
      type: String,
      enum: [
        "pending",
        "pickup_scheduled",
        "picked_up",
        "processing",
        "ready",
        "drop_scheduled",
        "delivered",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    // Pickup
    pickup_date: { type: String, default: "" },
    pickup_time: { type: String, default: "" },
    pickup_slip_url: { type: String, default: "" }, // Cloudinary URL
    pickup_notes: { type: String, default: "" },

    // Drop / Delivery
    drop_date: { type: String, default: "" },
    drop_time: { type: String, default: "" },
    drop_slip_url: { type: String, default: "" }, // Cloudinary URL
    drop_notes: { type: String, default: "" },

    // Rider assignment
    assigned_rider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    rider_name: { type: String, default: "" },
    rider_phone: { type: String, default: "" },

    // Payment
    is_paid: { type: Boolean, default: false, index: true },
    paid_date: { type: String, default: "" },
    paid_till: { type: String, default: "" },

    notes: { type: String, default: "" },

    // Guest & Staff laundry
    guest_laundry_pcs: { type: Number, default: 0, min: 0 },
    staff_laundry_pcs: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Auto-generate invoice_no like HTL-2026-0001
hotelOrderSchema.statics.generateInvoiceNo = async function () {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const year = now.getFullYear();
  const prefix = `HTL-${year}-`;

  const latest = await this.findOne(
    { invoice_no: { $regex: `^${prefix}` } },
    null,
    { sort: { invoice_no: -1 } }
  );

  let seq = 1;
  if (latest) {
    const parts = latest.invoice_no.split("-");
    const last = parseInt(parts[parts.length - 1]);
    if (!isNaN(last)) seq = last + 1;
  }

  const candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  // Collision guard
  const exists = await this.findOne({ invoice_no: candidate });
  if (exists) return `${prefix}${String(seq + 1).padStart(4, "0")}`;
  return candidate;
};

module.exports = mongoose.model("HotelOrder", hotelOrderSchema);
