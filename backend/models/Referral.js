const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    // The person who is referring (inviter)
    referrer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Referrer ID is required"],
      index: true,
    },
    
    // The person who was referred (invitee)
    referee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Referee ID is required"],
      index: true,
    },
    
    // Unique referral code used for this referral
    referral_code: {
      type: String,
      required: [true, "Referral code is required"],
      uppercase: true,
      trim: true,
      index: true,
    },
    
    // Status of the referral
    status: {
      type: String,
      enum: ["pending", "first_order_completed", "rewarded", "expired"],
      default: "pending",
      index: true,
    },
    
    // Discount given to referee on first order (30%)
    referee_discount_percentage: {
      type: Number,
      default: 30,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
    },
    
    // Reward given to referrer when referee completes first order (50%)
    referrer_reward_percentage: {
      type: Number,
      default: 50,
      min: [0, "Reward cannot be negative"],
      max: [100, "Reward cannot exceed 100%"],
    },
    
    // Maximum discount amount for referee
    referee_max_discount: {
      type: Number,
      default: 200,
      min: [0, "Max discount cannot be negative"],
    },
    
    // When the referee made their first order
    first_order_completed_at: {
      type: Date,
      default: null,
    },
    
    // The booking ID of referee's first order
    first_order_booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    
    // Amount of discount applied to referee's first order
    referee_discount_applied: {
      type: Number,
      default: 0,
      min: [0, "Discount applied cannot be negative"],
    },
    
    // When the referrer reward was given
    referrer_rewarded_at: {
      type: Date,
      default: null,
    },
    
    // Referrer reward coupon code generated
    referrer_reward_coupon_code: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    
    // Expiry date for the referral (e.g., 30 days from creation)
    expires_at: {
      type: Date,
      default: function() {
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      },
    },
    
    // Additional metadata
    metadata: {
      source: {
        type: String,
        default: "web",
      },
      campaign: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better query performance
referralSchema.index({ referrer_id: 1, status: 1 });
referralSchema.index({ referee_id: 1, status: 1 });
referralSchema.index({ referral_code: 1, status: 1 });
referralSchema.index({ expires_at: 1 });
referralSchema.index({ createdAt: -1 });

// Virtual for checking if referral is expired
referralSchema.virtual('isExpired').get(function() {
  return this.expires_at < new Date();
});

// Virtual for checking if referee can still get discount
referralSchema.virtual('canApplyRefereeDiscount').get(function() {
  return this.status === 'pending' && !this.isExpired;
});

// Virtual for checking if referrer can get reward
referralSchema.virtual('canRewardReferrer').get(function() {
  return this.status === 'first_order_completed' && !this.referrer_rewarded_at;
});

// Instance method to mark first order as completed
referralSchema.methods.markFirstOrderCompleted = async function(bookingId, discountApplied = 0) {
  this.status = 'first_order_completed';
  this.first_order_completed_at = new Date();
  this.first_order_booking_id = bookingId;
  this.referee_discount_applied = discountApplied;
  
  return this.save();
};

// Instance method to mark referrer as rewarded
referralSchema.methods.markReferrerRewarded = async function(couponCode) {
  this.status = 'rewarded';
  this.referrer_rewarded_at = new Date();
  this.referrer_reward_coupon_code = couponCode;
  
  return this.save();
};

// Static method to generate unique referral code
referralSchema.statics.generateReferralCode = function(userId) {
  // Create a referral code based on user ID and timestamp
  const timestamp = Date.now().toString(36);
  const userPart = userId.toString().slice(-4);
  const randomPart = Math.random().toString(36).substr(2, 4).toUpperCase();
  
  return `REF${userPart}${timestamp}${randomPart}`.toUpperCase();
};

// Static method to generate reward coupon code
referralSchema.statics.generateRewardCouponCode = function(referrerId) {
  const timestamp = Date.now().toString(36);
  const userPart = referrerId.toString().slice(-4);
  const randomPart = Math.random().toString(36).substr(2, 3).toUpperCase();
  
  return `REWARD${userPart}${timestamp}${randomPart}`.toUpperCase();
};

// Static method to find valid referral by code
referralSchema.statics.findValidReferral = function(referralCode) {
  return this.findOne({
    referral_code: referralCode.toUpperCase(),
    status: 'pending',
    expires_at: { $gt: new Date() }
  }).populate('referrer_id', 'name phone');
};

// Static method to get referrer's pending rewards
referralSchema.statics.getPendingRewards = function(referrerId) {
  return this.find({
    referrer_id: referrerId,
    status: 'first_order_completed',
    referrer_rewarded_at: null
  }).populate('referee_id', 'name phone');
};

// Static method to get user's referral stats
referralSchema.statics.getUserReferralStats = async function(userId) {
  const [referrerStats, refereeInfo] = await Promise.all([
    // Stats as referrer
    this.aggregate([
      { $match: { referrer_id: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          completedReferrals: {
            $sum: { $cond: [{ $ne: ['$first_order_completed_at', null] }, 1, 0] }
          },
          pendingRewards: {
            $sum: { $cond: [{ $eq: ['$status', 'first_order_completed'] }, 1, 0] }
          },
          totalRewardsEarned: {
            $sum: { $cond: [{ $ne: ['$referrer_rewarded_at', null] }, 1, 0] }
          }
        }
      }
    ]),
    
    // Info as referee
    this.findOne({ referee_id: userId }).populate('referrer_id', 'name')
  ]);

  return {
    asReferrer: referrerStats[0] || {
      totalReferrals: 0,
      completedReferrals: 0,
      pendingRewards: 0,
      totalRewardsEarned: 0
    },
    asReferee: refereeInfo ? {
      hasUsedReferral: true,
      referrerName: refereeInfo.referrer_id?.name,
      status: refereeInfo.status
    } : {
      hasUsedReferral: false
    }
  };
};

// Pre-save middleware to set expiry if not set
referralSchema.pre('save', function(next) {
  if (!this.expires_at) {
    this.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  }
  next();
});

module.exports = mongoose.model("Referral", referralSchema);
