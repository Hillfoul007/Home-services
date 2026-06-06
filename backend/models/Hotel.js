const mongoose = require("mongoose");

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    address: { type: String, default: "", trim: true },
    contact: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    is_active: { type: Boolean, default: true, index: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("Hotel", hotelSchema);
