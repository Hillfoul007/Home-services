const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001;

// Basic middleware
app.use(cors({
  origin: [
    'http://localhost:10000',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:10000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple middleware to verify rider token (demo mode)
const verifyRiderToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  // In demo mode, just accept any token
  req.rider = { riderId: 'demo_rider_123', phone: '9876543210' };
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Simple backend server running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API health check',
    timestamp: new Date().toISOString()
  });
});

// Rider routes
app.get('/api/riders/test', (req, res) => {
  res.json({
    success: true,
    message: 'Rider API is working! ✅',
    timestamp: new Date().toISOString()
  });
});

// Update order items and details - the route that was failing
app.put('/api/riders/orders/:orderId/update', verifyRiderToken, (req, res) => {
  try {
    const { orderId } = req.params;
    const { items, notes, requiresVerification, verificationStatus, notificationData } = req.body;

    console.log(`🔄 Demo: Updating order ${orderId} with ${items?.length || 0} items`);

    // Get Indian timezone date
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});

    // Calculate price changes
    const originalTotal = 320; // Mock original total
    const newTotal = items?.reduce((sum, item) => sum + (item.quantity * item.price), 0) || 0;
    const priceChange = newTotal - originalTotal;

    // Mock successful response
    res.json({
      message: 'Order updated successfully (demo mode)',
      order: {
        _id: orderId,
        custom_order_id: `LAU-${orderId.slice(-4)}`,
        items: items || [],
        total_price: newTotal,
        final_amount: newTotal,
        updated_at: indianTime,
        notes: notes
      },
      price_change: priceChange,
      notification_sent: true,
      indian_time: indianTime,
      mode: 'demo'
    });

    console.log(`✅ Demo: Order ${orderId} updated successfully`);
  } catch (error) {
    console.error('❌ Demo order update error:', error);
    res.status(500).json({ 
      message: 'Failed to update order', 
      error: error.message 
    });
  }
});

// Get rider's assigned orders
app.get('/api/riders/orders', verifyRiderToken, (req, res) => {
  console.log('🔍 Demo: Fetching rider assigned orders');
  
  const sampleOrders = [
    {
      _id: '68a57c7b00ad443e5b072e37',
      bookingId: 'LAU-001',
      customerName: 'John Doe',
      customerPhone: '+91 9876543210',
      address: '123 MG Road, Sector 14, Gurugram',
      pickupTime: '2:00 PM - 4:00 PM',
      type: 'Regular',
      riderStatus: 'assigned',
      assignedAt: new Date().toISOString(),
      items: [
        { name: 'Shirt', quantity: 2, price: 50 },
        { name: 'Trouser', quantity: 1, price: 80 }
      ]
    }
  ];

  res.json(sampleOrders);
});

// Get specific order details
app.get('/api/riders/orders/:orderId', verifyRiderToken, (req, res) => {
  const { orderId } = req.params;
  
  console.log(`🔍 Demo: Fetching order details for ${orderId}`);

  // Return mock order data
  res.json({
    _id: orderId,
    bookingId: 'LAU-001',
    custom_order_id: 'A202412001',
    customerName: 'John Doe',
    customerPhone: '+91 9876543210',
    customer_id: '67890123456789abcdef0123',
    address: 'D62, Extension, Chhawla, New Delhi, Delhi, 122101',
    address_details: {
      flatNo: 'D62',
      street: 'Extension, Chhawla',
      city: 'New Delhi',
      pincode: '122101',
      type: 'home'
    },
    pickupTime: '2:00 PM - 4:00 PM',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '14:00',
    delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    delivery_time: '18:00',
    type: 'Regular',
    service: 'Dry Cleaning Service',
    service_type: 'premium',
    services: ['Dry Cleaning', 'Premium Care', 'Express Delivery'],
    riderStatus: 'accepted',
    assignedAt: new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
    status: 'confirmed',
    payment_status: 'pending',
    items: [
      {
        id: '1',
        serviceId: 'dry-clean-mens-shirt',
        name: "Men's Shirt/T-Shirt",
        description: "Professional dry cleaning for men's shirts and t-shirts.",
        price: 100,
        unit: 'PC',
        category: 'mens-dry-clean',
        quantity: 2,
        total: 200
      },
      {
        id: '2',
        serviceId: 'dry-clean-mens-trouser',
        name: 'Trouser/Jeans',
        description: "Expert dry cleaning for men's trousers and jeans.",
        price: 120,
        unit: 'PC',
        category: 'mens-dry-clean',
        quantity: 1,
        total: 120
      }
    ],
    item_prices: [
      {
        service_name: "Men's Shirt/T-Shirt - Dry Clean",
        quantity: 2,
        unit_price: 100,
        total_price: 200
      },
      {
        service_name: "Trouser/Jeans - Dry Clean",
        quantity: 1,
        unit_price: 120,
        total_price: 120
      }
    ],
    charges_breakdown: {
      base_price: 320,
      tax_amount: 19.20,
      service_fee: 15,
      delivery_fee: 25,
      handling_fee: 10,
      discount: 0
    },
    total_price: 389.20,
    discount_amount: 0,
    coupon_code: null,
    final_amount: 389.20,
    specialInstructions: 'Handle with care - customer prefers gentle wash for delicate items.',
    additional_details: 'Customer will be available after 2 PM. Ring doorbell twice.',
    provider_name: 'Laundrify Premium Services',
    estimated_duration: 120,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
    updated_at: new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
  });
});

// Catch all for other rider routes
app.all('/api/riders/*', (req, res) => {
  console.log(`📝 Demo API call: ${req.method} ${req.path}`);
  res.json({
    message: 'Demo backend - endpoint available',
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Catch all for other API routes
app.all('/api/*', (req, res) => {
  console.log(`📝 API call: ${req.method} ${req.path}`);
  res.json({
    message: 'Simple backend server',
    method: req.method,
    path: req.path,
    available_endpoints: [
      'GET /api/health',
      'GET /api/riders/test',
      'GET /api/riders/orders',
      'GET /api/riders/orders/:orderId',
      'PUT /api/riders/orders/:orderId/update'
    ],
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple backend server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 API Health: http://localhost:${PORT}/api/health`);
  console.log(`📍 Rider Test: http://localhost:${PORT}/api/riders/test`);
});
