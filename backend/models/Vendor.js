const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    // Auto-generated vendor credentials
    vendor_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    password_hash: {
      type: String,
      required: true,
      select: false, // Don't return password by default
    },
    
    // Vendor details
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      default: "",
    },
    
    // Address/Location
    address: {
      type: String,
    },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    
    // Services offered
    services: [String],
    
    // Status
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    
    // Assigned orders (denormalized for faster queries)
    assigned_orders: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Booking",
      default: [],
    },
    
    // Metadata
    created_by: mongoose.Schema.Types.ObjectId, // Admin who created
    created_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
    updated_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
    last_login: Date,
  },
  {
    timestamps: true,
    collection: "vendors",
  }
);

// Index for faster queries
vendorSchema.index({ vendor_id: 1 });
vendorSchema.index({ is_active: 1, created_at: -1 });

// Generate unique vendor ID
vendorSchema.statics.generateVendorId = function () {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.random().toString(36).substring(2, 8).toUpperCase(); // Random alphanumeric
  return `V${timestamp}${random}`;
};

// Hash password before saving
vendorSchema.pre("save", async function (next) {
  if (!this.isModified("password_hash")) {
    return next();
  }

  try {
    const bcryptjs = require("bcryptjs");
    const salt = await bcryptjs.genSalt(10);
    this.password_hash = await bcryptjs.hash(this.password_hash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
vendorSchema.methods.comparePassword = async function (plainPassword) {
  try {
    const bcryptjs = require("bcryptjs");
    return await bcryptjs.compare(plainPassword, this.password_hash);
  } catch (error) {
    return false;
  }
};

// Method to update password
vendorSchema.methods.setPassword = async function (newPassword) {
  const bcryptjs = require("bcryptjs");
  const salt = await bcryptjs.genSalt(10);
  this.password_hash = await bcryptjs.hash(newPassword, salt);
  this.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return this.save();
};

module.exports = mongoose.model("Vendor", vendorSchema);
