const mongoose = require("mongoose");

const customerPackageSchema = new mongoose.Schema(
  {
    customer_name: {
      type: String,
      default: "",
    },
    customer_phone: {
      type: String,
      required: true,
      trim: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    service_name: {
      type: String,
      required: true,
      trim: true,
    },
    unit_type: {
      type: String,
      enum: ["KG", "PC"],
      required: true,
    },
    total_quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    remaining_quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by_store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    created_by_store_name: {
      type: String,
      default: "",
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
    timestamps: false,
  }
);

customerPackageSchema.index({ customer_phone: 1, service_name: 1, is_active: 1 });

customerPackageSchema.pre("save", function (next) {
  this.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  next();
});

module.exports = mongoose.model("CustomerPackage", customerPackageSchema);
