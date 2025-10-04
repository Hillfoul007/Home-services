const mongoose = require("mongoose");

const riderNotificationSchema = new mongoose.Schema(
  {
    rider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
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
      enum: ["order_assigned", "order_updated", "order_cancelled", "general", "location_request", "customer_verification_response"],
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
      enum: ["accept_order", "start_pickup", "update_location", "none"],
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
    related_quick_pickup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuickPickup",
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    sent_via: {
      type: [String],
      enum: ["app", "sms", "push"],
      default: ["app"],
    },
    delivery_status: {
      app: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
riderNotificationSchema.index({ rider_id: 1, read: 1 });
riderNotificationSchema.index({ rider_id: 1, createdAt: -1 });
riderNotificationSchema.index({ type: 1 });
riderNotificationSchema.index({ expires_at: 1 });
riderNotificationSchema.index({ related_order: 1 });
riderNotificationSchema.index({ related_quick_pickup: 1 });

// Auto-remove expired notifications
riderNotificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Virtual for time since creation
riderNotificationSchema.virtual('time_ago').get(function() {
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
riderNotificationSchema.set('toJSON', { virtuals: true });

// Static method to create order assignment notification
riderNotificationSchema.statics.createOrderAssignmentNotification = async function(riderId, order, orderType = 'regular') {
  const isQuickPickup = orderType === 'Quick Pickup';
  const orderId = isQuickPickup ? order._id : (order.custom_order_id || order._id);
  const customerName = isQuickPickup ? order.customer_name : order.name;
  const customerPhone = isQuickPickup ? order.customer_phone : order.phone;
  const address = order.address;
  
  const title = `New ${orderType} Order Assigned`;
  const message = `You have been assigned a new ${orderType.toLowerCase()} order #${orderId} from ${customerName}. Please check the details and accept the order.`;
  
  return this.create({
    rider_id: riderId,
    title,
    message,
    type: "order_assigned",
    data: {
      order_id: order._id,
      order_type: orderType,
      booking_id: orderId,
      customer_name: customerName,
      customer_phone: customerPhone,
      address: address,
      pickup_time: isQuickPickup ? `${order.pickup_date} ${order.pickup_time}` : `${order.scheduled_date} ${order.scheduled_time}`,
      special_instructions: isQuickPickup ? order.special_instructions : order.special_instructions,
      estimated_cost: isQuickPickup ? order.estimated_cost : order.final_amount
    },
    action_required: true,
    action_type: "accept_order",
    related_order: isQuickPickup ? null : order._id,
    related_quick_pickup: isQuickPickup ? order._id : null,
    priority: isQuickPickup ? "high" : "medium",
    sent_via: ["app", "sms"],
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });
};

// Static method to create order update notification for riders
riderNotificationSchema.statics.createOrderUpdateNotification = async function(riderId, order, updateType, additionalData = {}) {
  const title = `Order Update: ${updateType}`;
  let message = '';
  let actionType = 'none';
  
  switch (updateType) {
    case 'Customer Modified':
      message = `Order #${order.custom_order_id || order._id} has been modified by the customer. Please review the changes.`;
      actionType = 'view_order';
      break;
    case 'Admin Modified':
      message = `Order #${order.custom_order_id || order._id} has been updated by admin. Please check the latest details.`;
      actionType = 'view_order';
      break;
    case 'Cancelled':
      message = `Order #${order.custom_order_id || order._id} has been cancelled. You no longer need to handle this order.`;
      break;
    case 'Priority Changed':
      message = `Order #${order.custom_order_id || order._id} priority has been changed to ${additionalData.priority || 'normal'}.`;
      break;
    default:
      message = `Order #${order.custom_order_id || order._id} has been updated. Please check the latest details.`;
  }
  
  return this.create({
    rider_id: riderId,
    title,
    message,
    type: "order_updated",
    data: {
      order_id: order._id,
      booking_id: order.custom_order_id || order._id,
      update_type: updateType,
      ...additionalData
    },
    action_required: actionType !== 'none',
    action_type: actionType,
    related_order: order._id,
    priority: updateType === 'Cancelled' ? 'high' : 'medium',
    sent_via: ["app"],
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
  });
};

// Static method to get rider's unread notifications
riderNotificationSchema.statics.getUnreadNotifications = function(riderId) {
  return this.find({ 
    rider_id: riderId, 
    read: false 
  })
  .populate('related_order', 'custom_order_id status')
  .populate('related_quick_pickup', 'status')
  .sort({ createdAt: -1 });
};

// Static method to mark notification as read
riderNotificationSchema.statics.markAsRead = async function(notificationId, riderId) {
  return this.findOneAndUpdate(
    { _id: notificationId, rider_id: riderId },
    { 
      read: true, 
      read_at: new Date(),
      'delivery_status.app': true
    },
    { new: true }
  );
};

// Instance method to mark as read
riderNotificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.read_at = new Date();
  this.delivery_status.app = true;
  return this.save();
};

const RiderNotification = mongoose.model("RiderNotification", riderNotificationSchema);

module.exports = RiderNotification;
