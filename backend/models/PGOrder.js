const mongoose = require("mongoose");

const pgOrderSchema = new mongoose.Schema(
  {
    order_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pg_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PG",
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
    },
    num_items: {
      type: Number,
      required: true,
      min: 4,
    },
    price_per_item: {
      type: Number,
      default: 25,
    },
    total_price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "picked_up", "processing", "ready", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
    assigned_vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assigned_rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    pg_details: {
      name: String,
      city: String,
      address: String,
      phone: String,
    },
    pickup_date: {
      type: Date,
      required: true,
    },
    delivery_date: {
      type: Date,
      default: null,
    },
    special_instructions: {
      type: String,
      trim: true,
    },
    whatsapp_sent_to_vendor: {
      type: Boolean,
      default: false,
    },
    whatsapp_sent_to_rider: {
      type: Boolean,
      default: false,
    },
    whatsapp_sent_to_customer: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PGOrder", pgOrderSchema);
