const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

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

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    console.log('🔌 Connecting to MongoDB...');
    console.log('📍 URI (masked):', mongoURI ? mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'No URI provided');
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ MongoDB Connected:', mongoose.connection.host);
    console.log('📚 Database:', mongoose.connection.name);
    console.log('🔗 Connection State:', mongoose.connection.readyState);
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️ Running without database connection');
  }
};

// Connect to database
connectDB();

// Import Booking model
let Booking;
try {
  Booking = require('./models/Booking');
  console.log('✅ Booking model loaded');
} catch (error) {
  console.error('❌ Failed to load Booking model:', error.message);
}

// Serve static files from dist directory if available
const frontendPath = path.join(__dirname, '../dist');
try {
  if (require('fs').existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    console.log('✅ Serving static files from:', frontendPath);
  }
} catch (error) {
  console.log('⚠️ Static files not found, frontend served by Vite dev server');
}

// Root route handler
app.get('/', (req, res) => {
  const frontendIndexPath = path.join(__dirname, '../dist/index.html');
  try {
    if (require('fs').existsSync(frontendIndexPath)) {
      res.sendFile(frontendIndexPath);
    } else {
      // In development, redirect to Vite dev server
      res.json({
        message: 'Laundrify Backend API Server',
        status: 'running',
        frontend: 'Development server available at http://localhost:10000',
        api_health: '/api/health',
        database_connected: mongoose.connection.readyState === 1,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.json({
      message: 'Laundrify Backend API Server',
      status: 'running',
      frontend: 'Development server available at http://localhost:10000',
      api_health: '/api/health',
      error: 'Frontend files not found',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Test backend server running',
    database_connected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API health check',
    database_connected: mongoose.connection.readyState === 1,
    mongodb_state: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});

// Update order items and details - the main route we need to test
app.put('/api/riders/orders/:orderId/update', verifyRiderToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items, notes, requiresVerification, verificationStatus, notificationData } = req.body;

    console.log(`🔄 Order update request received:`, {
      orderId,
      itemsCount: items?.length || 0,
      dbConnected: mongoose.connection.readyState === 1
    });
    
    console.log('📤 Request items:', JSON.stringify(items, null, 2));

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, cannot update order');
      return res.status(503).json({ 
        error: 'Database not connected',
        message: 'Cannot update order without database connection'
      });
    }

    // Find the order
    console.log('🔍 Looking for order:', orderId);
    const order = await Booking.findById(orderId);
    
    if (!order) {
      console.log('❌ Order not found:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('✅ Order found:', order._id);
    console.log('📋 Current item_prices:', JSON.stringify(order.item_prices, null, 2));

    // Update item_prices array to match new items
    if (items && items.length > 0) {
      const newItemPrices = items.map(item => ({
        service_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.quantity * item.price
      }));
      
      console.log('🔄 New item_prices to save:', JSON.stringify(newItemPrices, null, 2));
      
      order.item_prices = newItemPrices;

      // Recalculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      order.total_price = subtotal;
      order.final_amount = subtotal;
      order.updated_at = new Date();
      
      console.log('💰 Updated totals - subtotal:', subtotal);
    }

    console.log('💾 Saving order to database...');
    const savedOrder = await order.save();
    console.log('✅ Order saved successfully!');

    // Verify the update by re-fetching from database
    const verificationOrder = await Booking.findById(orderId);
    console.log('🔍 Verification - item_prices from fresh DB query:', JSON.stringify(verificationOrder.item_prices, null, 2));

    res.json({
      message: 'Order updated successfully',
      order: {
        _id: order._id,
        custom_order_id: order.custom_order_id,
        items: order.item_prices?.map(item => ({
          name: item.service_name,
          price: item.unit_price,
          quantity: item.quantity,
          total: item.total_price
        })) || [],
        total_price: order.total_price,
        final_amount: order.final_amount,
        updated_at: order.updated_at
      },
      database_connected: true,
      verification_items: verificationOrder.item_prices
    });

  } catch (error) {
    console.error('❌ Order update error:', error);
    res.status(500).json({ 
      message: 'Failed to update order', 
      error: error.message 
    });
  }
});

// Get specific order details
app.get('/api/riders/orders/:orderId', verifyRiderToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log(`🔍 Fetching order details for ${orderId}`);

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, returning mock data');
      // Return mock data if no DB
      return res.json({
        _id: orderId,
        custom_order_id: 'MOCK-001',
        customerName: 'Test Customer',
        item_prices: [
          { service_name: 'Test Shirt', quantity: 1, unit_price: 50, total_price: 50 }
        ],
        total_price: 50,
        mode: 'mock'
      });
    }

    const order = await Booking.findById(orderId)
      .populate('customer_id', 'full_name phone email');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Convert item_prices to items format for frontend
    const items = order.item_prices?.map(item => ({
      name: item.service_name,
      price: item.unit_price,
      quantity: item.quantity,
      total: item.total_price
    })) || [];

    res.json({
      ...order.toObject(),
      items: items
    });

  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({ 
      message: 'Failed to fetch order', 
      error: error.message 
    });
  }
});

// Catch-all handler for React Router (SPA support)
app.get('*', (req, res) => {
  // Don't interfere with API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  const frontendIndexPath = path.join(__dirname, '../dist/index.html');
  try {
    if (require('fs').existsSync(frontendIndexPath)) {
      res.sendFile(frontendIndexPath);
    } else {
      // In development, let Vite handle routing
      res.redirect('http://localhost:10000' + req.path);
    }
  } catch (error) {
    res.status(404).json({
      error: 'Page not found',
      message: 'Frontend not built. Use http://localhost:10000 for development.'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test backend server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('🔒 MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});
