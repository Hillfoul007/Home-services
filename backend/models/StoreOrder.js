const mongoose = require("mongoose");

const storeOrderSchema = new mongoose.Schema(
  {
    custom_order_id: { type: String, unique: true },
    // Customer info
    customer_name: { type: String, default: "" },
    customer_phone: { type: String, default: "" },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Store info
    store_id: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
    store_code: { type: String, default: "" },
    assigned_store_id: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },
    assigned_store_name: { type: String, default: "" },
    // Services
    service: { type: String, default: "Store Order" },
    service_type: { type: String, default: "Store" },
    services: [String],
    item_prices: [
      {
        service_name: String,
        quantity: { type: Number, default: 1 },
        unit_price: { type: Number, default: 0 },
        total_price: { type: Number, default: 0 },
        piece_count: { type: Number, default: null },
      },
    ],
    // Address / schedule
    address: { type: String, default: "" },
    scheduled_date: String,
    scheduled_time: String,
    delivery_date: String,
    delivery_time: String,
    // Pricing
    total_price: { type: Number, default: 0 },
    discount_amount: { type: Number, default: 0 },
    wallet_applied: { type: Number, default: 0 },
    package_applied: {
      service_name: { type: String, default: null },
      unit_type: { type: String, enum: ["KG", "PC", null], default: null },
      quantity: { type: Number, default: 0 },
      amount_covered: { type: Number, default: 0 },
    },
    final_amount: { type: Number, default: 0 },
    // Status
    status: { type: String, default: "created", index: true },
    riderStatus: { type: String, default: "unassigned" },
    payment_status: { type: String, default: "pending" },
    is_store_order: { type: Boolean, default: true },
    // Payment proof / cash collection
    payment_slips: {
      type: [
        {
          file_id: mongoose.Schema.Types.Mixed,
          filename: String,
          uploaded_at: Date,
        },
      ],
      default: [],
    },
    cod_collected: { type: Boolean, default: false },
    cod_amount: { type: Number, default: 0 },
    cod_collected_at: { type: Date, default: null },
    // Meta
    provider_name: { type: String, default: "" },
    created_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
      index: true,
    },
    updated_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
  },
  {
    timestamps: true,
    collection: "store_orders",
  }
);

storeOrderSchema.index({ store_id: 1, created_at: -1 });
storeOrderSchema.index({ assigned_store_id: 1, created_at: -1 });

module.exports = mongoose.model("StoreOrder", storeOrderSchema);
