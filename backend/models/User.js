const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: false,
      unique: false,
      lowercase: true,
      trim: true,
      sparse: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: false,
      minlength: [6, "Password must be at least 6 characters"],
    },
    full_name: {
      type: String,
      required: false,
      trim: true,
      minlength: [1, "Name must be at least 1 character"],
    },
    name: {
      type: String,
      required: false,
      trim: true,
      minlength: [1, "Name must be at least 1 character"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^\d{10,12}$/, "Please enter a valid phone number (10-12 digits)"],
    },
    user_type: {
      type: String,
      enum: ["customer", "provider", "rider"],
      default: "customer",
    },
    profile_image: {
      type: String,
      default: "",
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    email_verified: {
      type: Boolean,
      default: false,
    },
    phone_verified: {
      type: Boolean,
      default: false,
    },
    address: {
      type: String,
      default: "",
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    last_login: {
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
    // Coupon tracking fields
    used_coupons: [{
      type: String,
      uppercase: true,
    }],
    coupon_usage_history: [{
      code: {
        type: String,
        uppercase: true,
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
      bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
      orderAmount: Number,
      discountAmount: Number,
    }],

    // Referral system fields
    referral_code: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // Referral statistics
    referral_stats: {
      total_referrals: {
        type: Number,
        default: 0,
        min: 0,
      },
      successful_referrals: {
        type: Number,
        default: 0,
        min: 0,
      },
      pending_rewards: {
        type: Number,
        default: 0,
        min: 0,
      },
      total_rewards_earned: {
        type: Number,
        default: 0,
        min: 0,
      },
      last_referral_at: {
        type: Date,
        default: null,
      },
    },

    // Available discount coupons (including referral rewards)
    available_coupons: [{
      code: {
        type: String,
        uppercase: true,
        required: true,
      },
      type: {
        type: String,
        enum: ["referral_reward", "promotional", "bonus"],
        required: true,
      },
      discount_percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      max_discount_amount: {
        type: Number,
        default: 500,
        min: 0,
      },
      created_at: {
        type: Date,
        default: () => new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})),
      },
      expires_at: {
        type: Date,
        required: true,
      },
      is_used: {
        type: Boolean,
        default: false,
      },
      used_at: {
        type: Date,
        default: null,
      },
      used_in_booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null,
      },
    }],
  },
  {
    timestamps: true,
  },
);

// Update the updated_at field before saving
userSchema.pre("save", function (next) {
  this.updated_at = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  next();
});

// Hash password before saving (only if password exists)
userSchema.pre("save", async function (next) {
  // Only hash if password is modified and exists
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Sync name and full_name fields
userSchema.pre("save", function (next) {
  // If name is provided but full_name is not, copy name to full_name
  if (this.name && !this.full_name) {
    this.full_name = this.name;
  }
  // If full_name is provided but name is not, copy full_name to name
  if (this.full_name && !this.name) {
    this.name = this.full_name;
  }
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to find user by email (case-insensitive)
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to check if email exists
userSchema.statics.emailExists = async function (email) {
  const user = await this.findOne({ email: email.toLowerCase() });
  return !!user;
};

// Static method to check if phone exists
userSchema.statics.phoneExists = async function (phone) {
  const user = await this.findOne({ phone });
  return !!user;
};

// Create indexes
userSchema.index({ user_type: 1 });
userSchema.index({ created_at: -1 });

module.exports = mongoose.model("User", userSchema);
