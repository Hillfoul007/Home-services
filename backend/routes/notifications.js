const express = require("express");
const notificationService = require("../services/notificationService");
const Notification = require("../models/Notification");

const router = express.Router();

// Middleware to verify user token (simple for now)
const verifyUserToken = (req, res, next) => {
  // In production, implement proper JWT token verification
  const userToken = req.headers["user-token"] || req.headers["authorization"];
  
  // For demo purposes, extract user ID from header
  const userId = req.headers["user-id"];
  
  if (!userId) {
    return res.status(401).json({ message: 'User ID required' });
  }
  
  req.userId = userId;
  next();
};

// Get user's notifications
router.get("/", verifyUserToken, async (req, res) => {
  try {
    const { include_read = 'false', limit = '20' } = req.query;
    const includeRead = include_read === 'true';
    const limitNum = parseInt(limit) || 20;

    console.log(`📋 Fetching notifications for user ${req.userId}`);

    let query = { user_id: req.userId };
    
    if (!includeRead) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .populate('related_rider', 'name phone')
      .populate('related_order', 'bookingId status')
      .sort({ createdAt: -1 })
      .limit(limitNum);

    console.log(`✅ Found ${notifications.length} notifications`);

    res.json({
      notifications,
      unread_count: await notificationService.getUnreadCount(req.userId)
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
});

// Get unread notification count
router.get("/count", verifyUserToken, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId);
    
    res.json({ unread_count: count });
  } catch (error) {
    console.error('❌ Get notification count error:', error);
    res.status(500).json({ message: 'Failed to get notification count', error: error.message });
  }
});

// Mark notification as read
router.put("/:notificationId/read", verifyUserToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    console.log(`👁️ Marking notification ${notificationId} as read for user ${req.userId}`);

    const notification = await notificationService.markAsRead(notificationId, req.userId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ 
      message: 'Notification marked as read',
      notification 
    });
  } catch (error) {
    console.error('❌ Mark notification as read error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read', error: error.message });
  }
});

// Mark all notifications as read
router.put("/read-all", verifyUserToken, async (req, res) => {
  try {
    console.log(`👁️ Marking all notifications as read for user ${req.userId}`);

    const result = await notificationService.markAllAsRead(req.userId);
    
    res.json({ 
      message: 'All notifications marked as read',
      updated_count: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read', error: error.message });
  }
});

// Approve order changes (for rider edit notifications)
router.post("/:notificationId/approve", verifyUserToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { approved } = req.body;
    
    console.log(`${approved ? '✅' : '❌'} User ${req.userId} ${approved ? 'approved' : 'rejected'} changes in notification ${notificationId}`);

    const notification = await Notification.findOne({
      _id: notificationId,
      user_id: req.userId,
      action_type: 'approve_changes'
    }).populate('related_order');
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found or not actionable' });
    }

    // Mark notification as read and update with approval status
    notification.read = true;
    notification.read_at = new Date();
    notification.data.approved = approved;
    notification.data.approved_at = new Date();
    notification.action_required = false;
    
    await notification.save();

    // Here you could update the order status based on approval
    if (notification.related_order) {
      const order = notification.related_order;
      order.rider_changes_approved = approved;
      order.rider_changes_approved_at = new Date();
      await order.save();
    }

    res.json({ 
      message: `Changes ${approved ? 'approved' : 'rejected'} successfully`,
      notification 
    });
  } catch (error) {
    console.error('❌ Approve changes error:', error);
    res.status(500).json({ message: 'Failed to process approval', error: error.message });
  }
});

// Delete notification
router.delete("/:notificationId", verifyUserToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    console.log(`🗑️ Deleting notification ${notificationId} for user ${req.userId}`);

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user_id: req.userId
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({ message: 'Failed to delete notification', error: error.message });
  }
});

module.exports = router;
