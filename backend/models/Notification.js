const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["order_update", "booking_status", "price_change", "general", "rider_edit"],
      default: "general",
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
    read_at: {
      type: Date,
      default: null,
    },
    action_required: {
      type: Boolean,
      default: false,
    },
    action_type: {
      type: String,
      enum: ["approve_changes", "view_order", "contact_support", "none"],
      default: "none",
    },
    expires_at: {
      type: Date,
      default: null,
    },
    related_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    related_rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider", 
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
notificationSchema.index({ user_id: 1, read: 1 });
notificationSchema.index({ user_id: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expires_at: 1 });
notificationSchema.index({ related_order: 1 });

// Auto-remove expired notifications
notificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Virtual for time since creation
notificationSchema.virtual('time_ago').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
});

// Include virtual fields in JSON
notificationSchema.set('toJSON', { virtuals: true });

// Static method to create order update notification
notificationSchema.statics.createOrderUpdateNotification = async function(userId, order, rider, changes) {
  const title = "Order Updated by Rider";
  const message = `Your order #${order.bookingId || order._id} has been updated by ${rider.name}. Please review the changes.`;
  
  return this.create({
    user_id: userId,
    title,
    message,
    type: "rider_edit",
    data: {
      changes,
      old_items: changes.old_items,
      new_items: changes.new_items,
      price_change: changes.price_change,
      rider_name: rider.name,
      rider_phone: rider.phone,
      order_id: order._id,
      booking_id: order.bookingId
    },
    action_required: true,
    action_type: "approve_changes",
    related_order: order._id,
    related_rider: rider._id,
    priority: changes.price_change > 0 ? "high" : "medium",
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });
};

// Static method to get user's unread notifications
notificationSchema.statics.getUnreadNotifications = function(userId) {
  return this.find({ 
    user_id: userId, 
    read: false 
  })
  .populate('related_rider', 'name phone')
  .populate('related_order', 'bookingId status')
  .sort({ createdAt: -1 });
};

// Static method to mark notification as read
notificationSchema.statics.markAsRead = async function(notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, user_id: userId },
    { 
      read: true, 
      read_at: new Date() 
    },
    { new: true }
  );
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.read_at = new Date();
  return this.save();
};

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
