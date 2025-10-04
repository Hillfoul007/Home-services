const mongoose = require("mongoose");

const loggedInUserSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    full_address: {
      type: String,
      required: [true, "Full address is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: "India",
    },
    pincode: {
      type: String,
      trim: true,
    },
    coordinates: {
      lat: {
        type: Number,
        required: false,
      },
      lng: {
        type: Number,
        required: false,
      },
    },
    ip_address: {
      type: String,
      trim: true,
    },
    user_agent: {
      type: String,
      trim: true,
    },
    device_fingerprint: {
      type: String,
      trim: true,
    },
    detection_method: {
      type: String,
      enum: ["gps", "ip", "manual", "autocomplete"],
      default: "gps",
    },
    login_timestamp: {
      type: Date,
      default: Date.now,
    },
    session_id: {
      type: String,
      trim: true,
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

// Update the updated_at field before saving
loggedInUserSchema.pre("save", function (next) {
  this.updated_at = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  next();
});

// Create indexes for efficient querying
loggedInUserSchema.index({ user_id: 1 });
loggedInUserSchema.index({ phone: 1 });
loggedInUserSchema.index({ city: 1, pincode: 1 });
loggedInUserSchema.index({ coordinates: "2dsphere" });
loggedInUserSchema.index({ login_timestamp: -1 });
loggedInUserSchema.index({ created_at: -1 });
loggedInUserSchema.index({ ip_address: 1 });

// Static method to save logged-in user location
loggedInUserSchema.statics.saveLoggedInUserLocation = async function (userData) {
  try {
    // Create device fingerprint
    const fingerprint = `${userData.ip_address || "unknown"}_${
      userData.phone || "unknown"
    }_${userData.coordinates?.lat || "unknown"}_${userData.coordinates?.lng || "unknown"}`;

    const loggedInUser = new this({
      ...userData,
      device_fingerprint: fingerprint,
      login_timestamp: new Date(),
    });

    await loggedInUser.save();
    console.log(`✅ Logged-in user location saved for ${userData.name} (${userData.phone})`);
    return loggedInUser;
  } catch (error) {
    console.error("Error saving logged-in user location:", error);
    throw error;
  }
};

module.exports = mongoose.model("LoggedInUser", loggedInUserSchema);
