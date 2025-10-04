const http = require('http');
const url = require('url');

const PORT = 3001;

// In-memory storage for updated orders
const orderUpdates = new Map();

// Simple JSON parser for POST requests
function parseJSON(req, callback) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (error) {
      callback(error, null);
    }
  });
}

// CORS headers
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
}

// Simple token verification (demo mode)
function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  // In demo mode, accept any token
  return { riderId: 'demo_rider_123', phone: '9876543210' };
}

// Create server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers
  setCORSHeaders(res);

  // Log all requests to help debug
  console.log(`🔍 [${method}] ${path}`);

  // Handle OPTIONS requests
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`${method} ${path}`);

  // Health check endpoints
  if (path === '/health' || path === '/api/health' || path === '/api/riders/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Simple backend server running',
      timestamp: new Date().toISOString(),
      endpoint: path
    }));
    return;
  }

  // Rider login endpoint
  if (path === '/api/riders/login' && method === 'POST') {
    parseJSON(req, (err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
        return;
      }

      const { phone, password } = data;
      console.log('🔍 Rider login attempt:', { phone, hasPassword: !!password });

      const demoRider = {
        _id: 'demo_rider_123',
        name: 'Demo Rider',
        phone: phone || '9876543210',
        status: 'approved',
        isActive: false,
      };

      const token = 'demo_token_' + Date.now();

      console.log('✅ Demo rider login successful:', demoRider.name);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        token,
        rider: demoRider,
        message: 'Login successful (demo mode)',
        mode: 'demo'
      }));
    });
    return;
  }

  // Get rider orders
  if (path === '/api/riders/orders' && method === 'GET') {
    const rider = verifyToken(req);
    if (!rider) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Access denied. No token provided.' }));
      return;
    }

    console.log('🔍 Get rider orders request');
    
    const sampleOrders = [
      {
        _id: 'quick_pickup_demo',
        bookingId: 'QP-001',
        customerName: 'Sarah Johnson',
        customerPhone: '+91 9876543211',
        address: 'A-45, Sector 12, Noida, Uttar Pradesh, 201301',
        pickupTime: '3:00 PM - 5:00 PM',
        type: 'Quick Pickup',
        riderStatus: 'assigned',
        assignedAt: new Date().toISOString(),
        items: []
      },
      {
        _id: 'demo_order_1',
        bookingId: 'LAU-001',
        customerName: 'John Doe',
        customerPhone: '+91 9876543210',
        address: 'D62, Extension, Chhawla, New Delhi, Delhi, 122101',
        pickupTime: '2:00 PM - 4:00 PM',
        type: 'Regular',
        riderStatus: 'assigned',
        assignedAt: new Date().toISOString(),
        items: [
          { name: 'Shirt', quantity: 2, price: 100 },
          { name: 'Trouser', quantity: 1, price: 120 }
        ]
      }
    ];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sampleOrders));
    return;
  }

  // Get specific order details
  if (path.startsWith('/api/riders/orders/') && method === 'GET' && !path.endsWith('/update')) {
    const rider = verifyToken(req);
    if (!rider) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Access denied. No token provided.' }));
      return;
    }

    const orderId = path.split('/')[4];
    console.log(`🔍 Fetching order details for: ${orderId}`);
    
    let orderData;
    
    if (orderId === 'quick_pickup_demo') {
      orderData = {
        _id: orderId,
        bookingId: 'QP-002',
        custom_order_id: 'QP202412002',
        customerName: 'Sarah Johnson',
        customerPhone: '+91 9876543211',
        customer_id: '67890123456789abcdef0124',
        address: 'A-45, Sector 12, Noida, Uttar Pradesh, 201301',
        address_details: {
          flatNo: 'A-45',
          street: 'Sector 12',
          city: 'Noida',
          pincode: '201301',
          type: 'home'
        },
        pickupTime: '3:00 PM - 5:00 PM',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '15:00',
        delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        delivery_time: '19:00',
        type: 'Quick Pickup',
        service: 'Quick Pickup Service',
        service_type: 'express',
        services: ['Quick Assessment', 'Express Service'],
        riderStatus: 'accepted',
        assignedAt: new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
        status: 'confirmed',
        payment_status: 'pending',
        items: [],
        item_prices: [],
        total_price: 0,
        discount_amount: 0,
        final_amount: 0,
        specialInstructions: 'Quick pickup - rider will assess items on location and create order',
        additional_details: 'Customer will have items ready for assessment',
        provider_name: 'Laundrify Express',
        estimated_duration: 60,
        created_at: new Date(Date.now() - 60 * 60 * 1000).toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
        updated_at: new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
        isQuickPickup: true
      };
    } else {
      orderData = {
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
        total_price: 320,
        discount_amount: 0,
        final_amount: 320,
        specialInstructions: 'Handle with care - customer prefers gentle wash for delicate items.',
        additional_details: 'Customer will be available after 2 PM. Ring doorbell twice.',
        provider_name: 'Laundrify Premium Services',
        estimated_duration: 120,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
        updated_at: new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
      };
    }

    // Check if there are any stored updates for this order
    const storedUpdates = orderUpdates.get(orderId);
    if (storedUpdates) {
      console.log(`🔄 Applying stored updates for order ${orderId}:`, storedUpdates);

      // Merge stored updates with the base order data
      orderData = {
        ...orderData,
        items: storedUpdates.items,
        item_prices: storedUpdates.item_prices,
        total_price: storedUpdates.total_price,
        final_amount: storedUpdates.final_amount,
        updated_at: storedUpdates.updated_at,
        notes: storedUpdates.notes || orderData.specialInstructions,
        specialInstructions: storedUpdates.notes || orderData.specialInstructions
      };

      console.log(`✅ Order data with updates:`, {
        orderId,
        itemsCount: orderData.items?.length || 0,
        totalPrice: orderData.total_price,
        finalAmount: orderData.final_amount
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(orderData));
    return;
  }

  // Update order - THE MAIN FIX FOR SAVE FUNCTIONALITY
  if (path.endsWith('/update') && method === 'PUT') {
    const rider = verifyToken(req);
    if (!rider) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Access denied. No token provided.' }));
      return;
    }

    const orderId = path.split('/')[4];
    
    parseJSON(req, (err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
        return;
      }

      const { items, notes, requiresVerification, verificationStatus, notificationData } = data;

      console.log(`🔄 Order update request received:`, {
        orderId,
        itemsCount: items?.length || 0,
        riderId: rider?.riderId,
        hasVerificationData: !!notificationData
      });

      console.log('📤 Complete request body:', JSON.stringify(data, null, 2));

      // Calculate price changes
      const originalTotal = 320; // Mock original total
      const newTotal = items?.reduce((sum, item) => sum + (item.quantity * item.price), 0) || 0;
      const priceChange = newTotal - originalTotal;

      console.log(`💰 Price change: ₹${priceChange} (${originalTotal} → ${newTotal})`);

      // Store the updated order data in memory
      const updateData = {
        items: items || [],
        item_prices: items?.map(item => ({
          service_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.quantity * item.price
        })) || [],
        total_price: newTotal,
        final_amount: newTotal,
        notes: notes,
        updated_at: new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
        updatedBy: 'rider'
      };

      orderUpdates.set(orderId, updateData);
      console.log(`💾 Stored order update for ${orderId}:`, updateData);

      // Simulate successful save
      const response = {
        message: 'Order updated successfully (demo mode)',
        order: {
          _id: orderId,
          custom_order_id: orderId.includes('quick') ? 'QP202412002' : 'A202412001',
          items: items || [],
          total_price: newTotal,
          final_amount: newTotal,
          updated_at: updateData.updated_at
        },
        price_change: priceChange,
        notification_sent: !!notificationData,
        indian_time: updateData.updated_at,
        mode: 'demo'
      };

      console.log('✅ Order update response:', JSON.stringify(response, null, 2));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
    return;
  }

  // Other rider endpoints
  if (path === '/api/riders/location' && method === 'POST') {
    const rider = verifyToken(req);
    if (!rider) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Access denied. No token provided.' }));
      return;
    }

    parseJSON(req, (err, data) => {
      console.log('📍 Location update:', data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Location updated successfully (demo mode)',
        location: data?.location,
        timestamp: new Date().toISOString()
      }));
    });
    return;
  }

  if (path === '/api/riders/toggle-status' && method === 'POST') {
    const rider = verifyToken(req);
    if (!rider) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Access denied. No token provided.' }));
      return;
    }

    parseJSON(req, (err, data) => {
      const { isActive } = data;
      console.log('🔄 Status toggle:', isActive);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: `Status updated to ${isActive ? 'active' : 'inactive'} (demo mode)`,
        isActive
      }));
    });
    return;
  }

  if (path === '/api/riders/notifications' && method === 'GET') {
    const rider = verifyToken(req);
    if (!rider) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Access denied. No token provided.' }));
      return;
    }

    console.log('🔔 Get notifications');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  if (path === '/api/riders/notifications/unread-count' && method === 'GET') {
    const rider = verifyToken(req);
    if (!rider) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Access denied. No token provided.' }));
      return;
    }

    console.log('🔔 Get unread notifications count');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: 0 }));
    return;
  }

  // Customer bookings endpoint (for testing the integration)
  if ((path.startsWith('/api/bookings/customer/') || path.startsWith('/bookings/customer/')) && method === 'GET') {
    const customerId = path.split('/').pop();
    console.log('📋 Get customer bookings for:', customerId);

    // Mock customer bookings data (including both regular and quick pickup orders)
    const mockBookings = [
      // Regular booking with items
      {
        _id: '67890123456789abcdef0123',
        custom_order_id: 'A202412001',
        customer_id: customerId,
        service: "Men's Shirt/T-Shirt - Dry Clean, Trouser/Jeans - Dry Clean",
        services: ["Men's Shirt/T-Shirt - Dry Clean x2", "Trouser/Jeans - Dry Clean"],
        service_type: "premium",
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '14:00',
        delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        delivery_time: '18:00',
        provider_name: 'Laundrify Premium Services',
        address: 'D62, Extension, Chhawla, New Delhi, Delhi, 122101',
        additional_details: 'Handle with care - customer prefers gentle wash for delicate items.',
        total_price: 320,
        final_amount: 320,
        status: 'confirmed',
        payment_status: 'pending',
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
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      // Quick pickup order with items (simulating one that was edited by rider)
      {
        _id: 'quick123456789abcdef0123',
        custom_order_id: 'QP-123456',
        customer_id: customerId,
        service: "Women's Kurti x2, Saree x1", // Items added by rider
        services: ["Women's Kurti x2", "Saree x1"],
        service_type: "quick_pickup",
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '15:00',
        delivery_date: new Date().toISOString().split('T')[0],
        delivery_time: 'Same Day',
        provider_name: 'Laundrify Quick Pickup',
        address: 'B-123, Sector 45, Gurgaon, Haryana, 122003',
        additional_details: 'Quick pickup - rider will assess items on location and create order',
        total_price: 350, // Updated price after rider added items
        final_amount: 350,
        status: 'picked_up',
        payment_status: 'pending',
        item_prices: [
          // These items were added when rider edited the quick pickup
          {
            service_name: "Women's Kurti",
            quantity: 2,
            unit_price: 120,
            total_price: 240
          },
          {
            service_name: "Saree",
            quantity: 1,
            unit_price: 110,
            total_price: 110
          }
        ],
        items_collected: [
          {
            name: "Women's Kurti",
            quantity: 2,
            price: 120,
            total: 240
          },
          {
            name: "Saree",
            quantity: 1,
            price: 110,
            total: 110
          }
        ],
        isQuickPickup: true,
        pickup_date: new Date().toISOString().split('T')[0],
        pickup_time: '15:00',
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    console.log(`✅ Returning ${mockBookings.length} bookings for customer: ${customerId}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ bookings: mockBookings }));
    return;
  }

  // 404 handler
  console.log('⚠️ 404 - Route not found:', path);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Route not found',
    path: path,
    timestamp: new Date().toISOString()
  }));
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Simple backend server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 API Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Riders Health check: http://localhost:${PORT}/api/riders/health`);
  console.log('🔧 Demo mode enabled - all rider operations will work');
  console.log('🎯 SAVE FUNCTIONALITY FIXED - /api/riders/orders/:orderId/update endpoint ready');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
});
