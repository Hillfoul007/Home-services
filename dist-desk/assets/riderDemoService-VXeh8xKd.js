class RiderDemoService {
  static instance;
  demoNotifications = [];
  demoOrders = [];
  static getInstance() {
    if (!RiderDemoService.instance) {
      RiderDemoService.instance = new RiderDemoService();
      RiderDemoService.instance.initializeDemoData();
    }
    return RiderDemoService.instance;
  }
  initializeDemoData() {
    this.demoNotifications = [
      {
        _id: "demo_notif_1",
        title: "📦 New Order Assigned",
        message: "You have been assigned order LAU-001 for pickup at 2:00 PM",
        type: "order_assignment",
        priority: "high",
        read: false,
        createdAt: new Date(Date.now() - 10 * 60 * 1e3).toISOString(),
        // 10 minutes ago
        related_order: "demo_order_1"
      },
      {
        _id: "demo_notif_2",
        title: "✅ Customer Verified Changes",
        message: "Customer approved changes for order LAU-002",
        type: "customer_verification",
        priority: "medium",
        read: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1e3).toISOString(),
        // 30 minutes ago
        related_order: "demo_order_2"
      },
      {
        _id: "demo_notif_3",
        title: "���� Priority Order Update",
        message: "Order LAU-003 marked as priority - please prioritize pickup",
        type: "priority_update",
        priority: "high",
        read: true,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString(),
        // 2 hours ago
        related_order: "demo_order_3"
      }
    ];
    this.demoOrders = [
      {
        _id: "demo_order_1",
        bookingId: "LAU-001",
        customerName: "John Doe",
        status: "assigned",
        items: [
          { name: "Shirt", quantity: 3, price: 50 },
          { name: "Trouser", quantity: 2, price: 80 }
        ],
        total: 310,
        address: "123 Demo Street, Demo City",
        phone: "+91 9999999999",
        scheduledTime: "2:00 PM - 4:00 PM"
      },
      {
        _id: "demo_order_2",
        bookingId: "LAU-002",
        customerName: "Jane Smith",
        status: "in_progress",
        items: [
          { name: "Dress", quantity: 2, price: 120 },
          { name: "Jacket", quantity: 1, price: 200 }
        ],
        total: 440,
        address: "456 Demo Avenue, Demo City",
        phone: "+91 8888888888",
        scheduledTime: "4:00 PM - 6:00 PM"
      }
    ];
    console.log("🎭 Demo rider service initialized with sample data");
  }
  // Mock API methods
  async getUnreadNotificationCount() {
    const unreadCount = this.demoNotifications.filter((n) => !n.read).length;
    console.log(`🎭 Demo: Returning unread count: ${unreadCount}`);
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1e3));
    return { count: unreadCount };
  }
  async getNotifications(includeRead = false) {
    console.log(`🎭 Demo: Fetching notifications (includeRead: ${includeRead})`);
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
    const notifications = includeRead ? this.demoNotifications : this.demoNotifications.filter((n) => !n.read);
    return [...notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  async markNotificationAsRead(notificationId) {
    console.log(`🎭 Demo: Marking notification ${notificationId} as read`);
    const notification = this.demoNotifications.find((n) => n._id === notificationId);
    if (notification) {
      notification.read = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));
    return { success: true };
  }
  async markAllNotificationsAsRead() {
    console.log("🎭 Demo: Marking all notifications as read");
    this.demoNotifications.forEach((n) => n.read = true);
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 800));
    return { success: true };
  }
  async getOrders() {
    console.log("🎭 Demo: Fetching rider orders");
    await new Promise((resolve) => setTimeout(resolve, 1e3 + Math.random() * 1500));
    return [...this.demoOrders];
  }
  async updateOrderStatus(orderId, status) {
    console.log(`🎭 Demo: Updating order ${orderId} status to ${status}`);
    const order = this.demoOrders.find((o) => o._id === orderId);
    if (order) {
      order.status = status;
    }
    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 900));
    return { success: true };
  }
  // Simulate occasional failures for realistic demo
  async checkHealth() {
    console.log("🎭 Demo: Health check (always returns false to simulate backend unavailable)");
    return false;
  }
  // Add some demo notifications dynamically
  addDemoNotification(title, message, type = "info") {
    const newNotification = {
      _id: `demo_notif_${Date.now()}`,
      title,
      message,
      type,
      priority: "medium",
      read: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.demoNotifications.unshift(newNotification);
    console.log("🎭 Demo: Added new notification:", newNotification.title);
  }
}

export { RiderDemoService as default };
