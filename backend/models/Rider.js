const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      unique: true,
    },
    aadharNumber: {
      type: String,
      required: [true, "Aadhar number is required"],
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: false, // Password is optional for OTP-based authentication
    },
    aadharImageUrl: {
      type: String,
      required: [true, "Aadhar image is required"],
    },
    selfieImageUrl: {
      type: String,
      required: [true, "Selfie image is required"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },
    lastLocationUpdate: {
      type: Date,
      default: null,
    },
    assignedOrders: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    }],
    rating: {
      type: Number,
      default: 5.0,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
    },
    completedOrders: {
      type: Number,
      default: 0,
      min: [0, "Completed orders cannot be negative"],
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: [0, "Total earnings cannot be negative"],
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: String,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
riderSchema.index({ phone: 1 });
riderSchema.index({ aadharNumber: 1 });
riderSchema.index({ isActive: 1 });
riderSchema.index({ status: 1 });
riderSchema.index({ rating: -1 });
riderSchema.index({ "location.lat": 1, "location.lng": 1 });
riderSchema.index({ createdAt: -1 });

// Static method to find active riders near location
riderSchema.statics.findActiveNearby = function (lat, lng, radiusKm = 10) {
  const radiusInRadians = radiusKm / 6371; // Earth's radius in km

  return this.find({
    isActive: true,
    status: "approved",
    "location.lat": {
      $gte: lat - radiusInRadians,
      $lte: lat + radiusInRadians,
    },
    "location.lng": {
      $gte: lng - radiusInRadians,
      $lte: lng + radiusInRadians,
    },
  }).populate("assignedOrders");
};

// Instance method to calculate distance from a point
riderSchema.methods.distanceFrom = function (lat, lng) {
  if (!this.location?.lat || !this.location?.lng) {
    return null;
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((lat - this.location.lat) * Math.PI) / 180;
  const dLng = ((lng - this.location.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((this.location.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Instance method to update location
riderSchema.methods.updateLocation = function (lat, lng) {
  this.location = { lat, lng };
  this.lastLocationUpdate = new Date();
  return this.save();
};

module.exports = mongoose.model("Rider", riderSchema);
