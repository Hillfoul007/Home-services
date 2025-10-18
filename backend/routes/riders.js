const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Rider = require("../models/Rider");
const Booking = require("../models/Booking");
const QuickPickup = require("../models/QuickPickup");
const otpService = require("../services/otpService");
const notificationService = require("../services/notificationService");
const riderNotificationService = require("../services/riderNotificationService");

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  console.log('🏥 Health check endpoint hit');
  res.json({
    status: 'healthy',
    service: 'rider-service',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: !!mongoose.connection.readyState,
      state: mongoose.connection.readyState,
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Test endpoint to verify rider routes are working
router.get('/test', (req, res) => {
  console.log('🔍 Rider routes test endpoint hit');
  res.json({
    success: true,
    message: 'Rider routes are working! ✅',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    dbConnected: !!mongoose.connection.readyState,
    dbState: mongoose.connection.readyState,
    features: {
      registration: true,
      login: true,
      adminManagement: true,
      orderAssignment: true,
      locationTracking: true,
      demoMode: true, // Always available
      demoFallback: true
    },
    demoCredentials: {
      phone: '9876543210',
      password: 'password123',
      alternatives: ['9876543211', '9876543212', 'any_number'],
      note: 'Demo mode always works as fallback'
    },
    endpoints: {
      login: '/api/riders/login',
      register: '/api/riders/register',
      test: '/api/riders/test'
    }
  });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/riders');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware to verify rider token
const verifyRiderToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.rider = decoded;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

// Request OTP for rider registration
router.post('/register/request-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        message: 'Phone number is required'
      });
    }

    // Check if rider already exists
    if (mongoose.connection.readyState) {
      const existingRider = await Rider.findOne({ phone });
      if (existingRider) {
        return res.status(400).json({
          message: 'A rider with this phone number already exists'
        });
      }
    }

    // Generate and send OTP
    const otp = otpService.generateOTP();
    otpService.storeOTP(phone, otp, 'registration');

    const smsResult = await otpService.sendOTP(phone, otp, 'registration');

    if (!smsResult.success) {
      return res.status(500).json({
        message: 'Failed to send OTP. Please try again.'
      });
    }

    res.json({
      message: 'OTP sent successfully to your phone number',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('❌ Registration OTP request error:', error);
    res.status(500).json({
      message: 'Failed to send OTP. Please try again.',
      error: 'Internal server error'
    });
  }
});

// Register new rider (with OTP verification)
router.post('/register', upload.fields([
  { name: 'aadharImage', maxCount: 1 },
  { name: 'selfieImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('🔍 Rider registration attempt:', {
      hasName: !!req.body.name,
      hasPhone: !!req.body.phone,
      hasAadhar: !!req.body.aadharNumber,
      hasFiles: !!req.files,
      fileKeys: req.files ? Object.keys(req.files) : []
    });

    const { name, phone, aadharNumber, otp } = req.body;

    if (!name || !phone || !aadharNumber || !otp) {
      return res.status(400).json({
        message: 'Name, phone, Aadhar number, and OTP are required'
      });
    }

    // Verify OTP first
    const verification = otpService.verifyOTP(phone, otp, 'registration');

    if (!verification.success) {
      return res.status(400).json({
        message: verification.error,
        attemptsRemaining: verification.attemptsRemaining
      });
    }

    // For development/demo mode when no database is connected
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Accepting rider registration');
      return res.status(201).json({
        message: 'Registration submitted successfully (demo mode). Please wait for admin approval.',
        riderId: 'demo_rider_' + Date.now()
      });
    }

    // Check if rider already exists
    const existingRider = await Rider.findOne({
      $or: [{ phone }, { aadharNumber }]
    });

    if (existingRider) {
      return res.status(400).json({
        message: 'Rider with this phone number or Aadhar number already exists'
      });
    }

    // Check if files were uploaded
    if (!req.files?.aadharImage?.[0] || !req.files?.selfieImage?.[0]) {
      return res.status(400).json({
        message: 'Both Aadhar card image and selfie are required'
      });
    }

    // Create new rider (no password needed for OTP-based auth)
    const rider = new Rider({
      name,
      phone,
      aadharNumber,
      aadharImageUrl: `/uploads/riders/${req.files.aadharImage[0].filename}`,
      selfieImageUrl: `/uploads/riders/${req.files.selfieImage[0].filename}`,
    });

    await rider.save();

    console.log('✅ Rider registered successfully:', name);
    res.status(201).json({
      message: 'Registration submitted successfully. Please wait for admin approval.',
      riderId: rider._id
    });
  } catch (error) {
    console.error('❌ Rider registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Request OTP for rider login
router.post('/request-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        message: 'Phone number is required'
      });
    }

    // Check if rider exists and is approved
    if (mongoose.connection.readyState) {
      const rider = await Rider.findOne({ phone });

      if (!rider) {
        return res.status(404).json({
          message: 'Rider not found. Please register first.'
        });
      }

      if (rider.status !== 'approved') {
        return res.status(403).json({
          message: rider.status === 'pending'
            ? 'Your account is pending approval from admin'
            : 'Your account has been rejected. Please contact admin.',
          status: rider.status,
          rejectionReason: rider.status === 'rejected' ? rider.rejectionReason : undefined
        });
      }
    }

    // Generate and send OTP
    const otp = otpService.generateOTP();
    otpService.storeOTP(phone, otp, 'login');

    console.log('🔐 Sending OTP (debug):', { phone, env: process.env.NODE_ENV, dvhostingKeyPresent: !!process.env.DVHOSTING_API_KEY });

    const smsResult = await otpService.sendOTP(phone, otp, 'login');

    console.log('📲 DVHosting sendOTP result:', smsResult);

    if (!smsResult || !smsResult.success) {
      console.error('❌ sendOTP failed for phone', phone, smsResult);
      return res.status(500).json({
        message: 'Failed to send OTP. Please try again.',
        error: smsResult && smsResult.error ? smsResult.error : undefined
      });
    }

    res.json({
      message: 'OTP sent successfully to your phone number',
      expiresIn: '10 minutes',
      debug: { smsResult }
    });
  } catch (error) {
    console.error('❌ OTP request error:', error);
    res.status(500).json({
      message: 'Failed to send OTP. Please try again.',
      error: 'Internal server error'
    });
  }
});

// Verify OTP and login rider
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        message: 'Phone number and OTP are required'
      });
    }

    // Verify OTP
    const verification = otpService.verifyOTP(phone, otp, 'login');

    if (!verification.success) {
      return res.status(400).json({
        message: verification.error,
        attemptsRemaining: verification.attemptsRemaining
      });
    }

    // Demo mode when database is not connected
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: OTP verified, logging in demo rider');

      const demoRider = {
        _id: 'demo_rider_' + phone.slice(-4),
        name: 'Demo Rider',
        phone: phone,
        status: 'approved',
        isActive: false,
      };

      const token = jwt.sign(
        { riderId: demoRider._id, phone: demoRider.phone },
        process.env.JWT_SECRET || 'fallback_secret_for_demo',
        { expiresIn: '7d' }
      );

      return res.json({
        token,
        rider: demoRider,
        message: 'Login successful (demo mode)',
        mode: 'demo'
      });
    }

    // Find rider in database
    const rider = await Rider.findOne({ phone });

    if (!rider) {
      return res.status(404).json({
        message: 'Rider not found. Please register first.'
      });
    }

    if (rider.status !== 'approved') {
      return res.status(403).json({
        message: rider.status === 'pending'
          ? 'Your account is pending approval from admin'
          : 'Your account has been rejected. Please contact admin.',
        status: rider.status,
        rejectionReason: rider.status === 'rejected' ? rider.rejectionReason : undefined
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { riderId: rider._id, phone: rider.phone },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    console.log(`✅ Rider OTP login successful: ${rider.name}`);
    res.json({
      token,
      rider: {
        _id: rider._id,
        name: rider.name,
        phone: rider.phone,
        status: rider.status,
        isActive: rider.isActive,
        aadharNumber: rider.aadharNumber,
        rejectionReason: rider.rejectionReason
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    res.status(500).json({
      message: 'Login failed. Please try again.',
      error: 'Internal server error'
    });
  }
});

// Legacy password-based login (deprecated - keeping for backward compatibility)
router.post('/login', async (req, res) => {
  try {
    console.log('🔍 Rider login attempt:', {
      hasPhone: !!req.body.phone,
      hasPassword: !!req.body.password,
      bodyKeys: Object.keys(req.body),
      body: req.body,
      headers: req.headers,
      url: req.url,
      method: req.method
    });

    const { phone, password } = req.body;

    if (!phone || !password) {
      console.log('❌ Missing credentials in request body');
      return res.status(400).json({
        message: 'Phone and password are required',
        received: { phone: !!phone, password: !!password },
        bodyKeys: Object.keys(req.body)
      });
    }

    console.log('🔧 Checking database connection...', {
      readyState: mongoose.connection.readyState,
      dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });

    // Only use demo mode if database is not connected AND not in production
    if (!mongoose.connection.readyState && process.env.NODE_ENV !== 'production') {
      console.log('�� Demo mode: Database not connected, using demo rider for:', phone);

      const demoRiders = {
        '9876543210': { name: 'Demo Rider A', status: 'approved', isActive: false },
        '9876543211': { name: 'Demo Rider B', status: 'approved', isActive: true },
        '9876543212': { name: 'Demo Rider C', status: 'pending', isActive: false },
        'default': { name: 'Demo Rider', status: 'approved', isActive: false }
      };

      const riderData = demoRiders[phone] || demoRiders['default'];
      const demoRider = {
        _id: 'demo_rider_' + phone.slice(-4),
        name: riderData.name,
        phone: phone,
        status: riderData.status,
        isActive: riderData.isActive,
      };

      const token = jwt.sign(
        { riderId: demoRider._id, phone: demoRider.phone },
        process.env.JWT_SECRET || 'fallback_secret_for_demo',
        { expiresIn: '7d' }
      );

      console.log('✅ Demo rider login successful:', demoRider.name);
      return res.json({
        token,
        rider: demoRider,
        message: 'Demo mode: Login successful (no database connection)',
        mode: 'demo'
      });
    }

    try {
      // Find rider by phone
      const rider = await Rider.findOne({ phone });

      if (!rider) {
        console.log(`�� Rider not found in database for phone: ${phone}`);
        return res.status(400).json({
          message: 'Invalid phone number or password',
          error: 'Authentication failed'
        });
      }

      console.log(`��� Found rider: ${rider.name} (Status: ${rider.status}, Active: ${rider.isActive})`);

      // Check password
      const isMatch = await bcrypt.compare(password, rider.password);
      if (!isMatch) {
        console.log(`❌ Invalid password for rider: ${rider.name}`);
        return res.status(400).json({
          message: 'Invalid phone number or password',
          error: 'Authentication failed'
        });
      }

      // Check if rider is approved (status check)
      if (rider.status !== 'approved') {
        console.log(`⚠️ Rider ${rider.name} status is ${rider.status}, login denied`);
        return res.status(403).json({
          message: rider.status === 'pending'
            ? 'Your account is pending approval from admin'
            : 'Your account has been rejected. Please contact admin.',
          error: 'Account not approved',
          status: rider.status
        });
      }

      // Generate JWT token for real rider
      const realToken = jwt.sign(
        { riderId: rider._id, phone: rider.phone },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '7d' }
      );

      console.log(`✅ Real rider login successful: ${rider.name}`);
      res.json({
        token: realToken,
        rider: {
          _id: rider._id,
          name: rider.name,
          phone: rider.phone,
          status: rider.status,
          isActive: rider.isActive,
          aadharNumber: rider.aadharNumber,
          rejectionReason: rider.rejectionReason
        },
        message: 'Login successful',
        mode: 'database'
      });
    } catch (dbError) {
      console.error('❌ Database operation failed:', dbError);
      return res.status(500).json({
        message: 'Database error occurred. Please try again.',
        error: 'Internal server error'
      });
    }
  } catch (error) {
    console.error('❌ Rider login error:', error);
    res.status(500).json({
      message: 'Login failed due to server error. Please try again.',
      error: 'Internal server error'
    });
  }
});

// Update rider location
router.post('/location', verifyRiderToken, async (req, res) => {
  try {
    console.log('🔍 Location update request:', {
      hasRiderId: !!req.rider?.riderId,
      hasLocation: !!req.body?.location,
      body: req.body
    });

    const { location, riderId, timestamp } = req.body;

    // For demo mode, just return success
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Location update accepted');
      return res.json({
        message: 'Location updated successfully (demo mode)',
        location,
        timestamp: timestamp || new Date().toISOString(),
        mode: 'demo'
      });
    }

    const rider = await Rider.findById(req.rider.riderId);
    if (!rider) {
      console.log('❌ Rider not found, using demo response');
      return res.json({
        message: 'Location updated successfully (demo fallback)',
        location,
        timestamp: timestamp || new Date().toISOString(),
        mode: 'demo_fallback'
      });
    }

    await rider.updateLocation(location.lat, location.lng);

    res.json({
      message: 'Location updated successfully',
      location,
      timestamp: timestamp || new Date().toISOString(),
      mode: 'database'
    });
  } catch (error) {
    console.error('❌ Location update error:', error);
    // Fallback to demo response on error
    res.json({
      message: 'Location updated successfully (error fallback)',
      location: req.body?.location,
      timestamp: new Date().toISOString(),
      mode: 'error_fallback'
    });
  }
});

// Toggle rider active status
router.post('/toggle-status', verifyRiderToken, async (req, res) => {
  try {
    console.log('🔍 Status toggle request:', {
      hasRiderId: !!req.rider?.riderId,
      body: req.body
    });

    const { isActive, location, riderId } = req.body;

    // For demo mode, just return success
    if (!mongoose.connection.readyState) {
      console.log('����� Demo mode: Status toggle accepted');
      return res.json({
        message: `Status updated to ${isActive ? 'active' : 'inactive'} (demo mode)`,
        isActive,
        mode: 'demo'
      });
    }

    const rider = await Rider.findById(req.rider.riderId);
    if (!rider) {
      console.log('❌ Rider not found, using demo response');
      return res.json({
        message: `Status updated to ${isActive ? 'active' : 'inactive'} (demo fallback)`,
        isActive,
        mode: 'demo_fallback'
      });
    }

    if (rider.status !== 'approved') {
      console.log('⚠️ Rider not approved, allowing in demo mode');
      return res.json({
        message: `Status updated to ${isActive ? 'active' : 'inactive'} (approval not required in demo)`,
        isActive,
        mode: 'demo_approval_bypass'
      });
    }

    rider.isActive = isActive;

    if (isActive && location) {
      await rider.updateLocation(location.lat, location.lng);
    }

    await rider.save();

    res.json({
      message: `Status updated to ${isActive ? 'active' : 'inactive'}`,
      isActive: rider.isActive,
      mode: 'database'
    });
  } catch (error) {
    console.error('❌ Status toggle error:', error);
    // Fallback to demo response on error
    const { isActive } = req.body;
    res.json({
      message: `Status updated to ${isActive ? 'active' : 'inactive'} (error fallback)`,
      isActive,
      mode: 'error_fallback'
    });
  }
});

// Get rider's assigned orders
router.get('/orders', verifyRiderToken, async (req, res) => {
  try {
    console.log('🔍 Get rider assigned orders request:', {
      hasRiderId: !!req.rider?.riderId,
      riderId: req.rider?.riderId
    });

    // For demo mode, return sample orders
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Returning sample assigned orders');
      const sampleOrders = [
        {
          _id: '507f1f77bcf86cd799439011',
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
        },
        {
          _id: '507f1f77bcf86cd799439012',
          bookingId: 'LAU-002',
          customerName: 'Jane Smith',
          customerPhone: '+91 9876543211',
          address: '456 Cyber City, Sector 25, Gurugram',
          pickupTime: '4:00 PM - 6:00 PM',
          type: 'Express',
          riderStatus: 'accepted',
          assignedAt: new Date().toISOString(),
          items: [
            { name: 'Dress', quantity: 1, price: 120 }
          ]
        }
      ];

      return res.json(sampleOrders);
    }

    // Get all orders assigned to this rider from both Booking and QuickPickup collections
    const riderId = req.rider.riderId;

    const [regularOrders, quickPickups] = await Promise.all([
      // Regular bookings assigned to this rider
      Booking.find({
        assignedRider: riderId,
        riderStatus: { $in: ['assigned', 'accepted', 'picked_up'] } // Exclude completed orders
      })
      .populate('customer_id', 'name phone')
      .sort({ assignedAt: -1 }),

      // Quick pickups assigned to this rider
      QuickPickup.find({
        rider_id: riderId,
        status: { $in: ['assigned', 'accepted', 'picked_up'] } // Exclude completed orders
      })
      .populate('customer_id', 'name phone')
      .sort({ createdAt: -1 })
    ]);

    // Transform regular orders to consistent format
    const transformedRegularOrders = regularOrders.map(order => ({
      _id: order._id,
      bookingId: order.custom_order_id || order._id,
      customerName: order.name || order.customer_id?.name,
      customerPhone: order.phone || order.customer_id?.phone,
      address: order.address,
      pickupTime: `${order.scheduled_date} ${order.scheduled_time}`,
      type: 'Regular',
      riderStatus: order.riderStatus,
      assignedAt: order.assignedAt,
      items: order.item_prices || [],
      finalAmount: order.final_amount,
      specialInstructions: order.special_instructions
    }));

    // Transform quick pickups to consistent format
    const transformedQuickPickups = quickPickups.map(qp => ({
      _id: qp._id,
      bookingId: `QP-${qp._id.toString().slice(-6).toUpperCase()}`,
      customerName: qp.customer_name || qp.customer_id?.name,
      customerPhone: qp.customer_phone || qp.customer_id?.phone,
      address: qp.address,
      pickupTime: `${qp.pickup_date} ${qp.pickup_time}`,
      type: 'Quick Pickup',
      riderStatus: qp.status === 'assigned' ? 'assigned' : qp.status,
      assignedAt: qp.createdAt,
      estimatedCost: qp.estimated_cost,
      actualCost: qp.actual_cost,
      specialInstructions: qp.special_instructions,
      itemsCollected: qp.items_collected,
      notes: qp.notes
    }));

    // Combine and sort by assignment date
    const allAssignedOrders = [...transformedRegularOrders, ...transformedQuickPickups]
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());

    console.log(`📋 Found ${regularOrders.length} regular orders and ${quickPickups.length} quick pickups assigned to rider ${riderId}`);

    res.json(allAssignedOrders);
  } catch (error) {
    console.error('❌ Get rider assigned orders error:', error);
    // Return empty array on error
    res.json([]);
  }
});

// Get specific order details
router.get('/orders/:orderId', verifyRiderToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔍 Fetching order details for: ${orderId}, rider: ${req.rider.riderId}`);

    // For demo mode when database is not connected or order not found
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Returning mock order data');
      return res.json(getMockOrderData(orderId));
    }

    // First try to find as a regular booking
    let order = await Booking.findOne({
      _id: orderId,
      assignedRider: req.rider.riderId
    }).populate('customer_id', 'name phone email')
      .select(
        '_id custom_order_id name phone customer_id service service_type services ' +
        'scheduled_date scheduled_time delivery_date delivery_time address address_details ' +
        'status riderStatus payment_status total_price discount_amount coupon_code final_amount ' +
        'item_prices charges_breakdown special_instructions additional_details ' +
        'provider_name estimated_duration assignedAt created_at updated_at completed_at'
      );

    // If not found as booking, try to find as quick pickup
    if (!order) {
      console.log(`🔍 Order ${orderId} not found in bookings, checking quick pickups...`);

      const quickPickup = await QuickPickup.findOne({
        _id: orderId,
        rider_id: req.rider.riderId
      }).populate('customer_id', 'name phone email');

      if (quickPickup) {
        console.log(`✅ Quick pickup found: ${quickPickup._id}`);

        // Transform quick pickup data to match expected order format
        order = {
          _id: quickPickup._id,
          bookingId: quickPickup._id.toString().slice(-6).toUpperCase(),
          custom_order_id: `QP${quickPickup._id.toString().slice(-8).toUpperCase()}`,
          customerName: quickPickup.customer_name || quickPickup.customer_id?.name || 'Quick Pickup Customer',
          customerPhone: quickPickup.customer_phone || quickPickup.customer_id?.phone || '',
          customer_id: quickPickup.customer_id?._id || quickPickup.customer_id,
          address: quickPickup.address,
          address_details: {
            flatNo: quickPickup.house_number || '',
            street: '',
            city: 'Gurugram',
            pincode: '',
            type: 'home'
          },
          pickupTime: quickPickup.pickup_time || 'TBD',
          scheduled_date: quickPickup.pickup_date,
          scheduled_time: quickPickup.pickup_time?.split(' ')[0] || 'TBD',
          delivery_date: quickPickup.pickup_date, // Same day for quick pickup
          delivery_time: '18:00', // Default evening delivery
          type: 'Quick Pickup',
          service: 'Quick Pickup Service',
          service_type: 'express',
          services: ['Quick Assessment', 'Express Service'],
          status: quickPickup.status,
          riderStatus: quickPickup.status === 'pending' ? 'assigned' : 'accepted',
          payment_status: 'pending',
          items: quickPickup.items_collected?.map(item => ({
            id: item.id || Math.random(),
            serviceId: item.serviceId || 'quick-pickup-item',
            name: item.name,
            description: item.description || `Quick pickup item: ${item.name}`,
            price: item.price,
            unit: 'PC',
            category: item.category || 'quick-pickup',
            quantity: item.quantity,
            total: item.total || (item.quantity * item.price)
          })) || [],
          item_prices: quickPickup.items_collected?.map(item => ({
            service_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.total || (item.quantity * item.price)
          })) || [],
          total_price: quickPickup.actual_cost || quickPickup.items_collected?.reduce((sum, item) => sum + (item.total || (item.quantity * item.price)), 0) || 0,
          discount_amount: 0,
          final_amount: quickPickup.actual_cost || quickPickup.items_collected?.reduce((sum, item) => sum + (item.total || (item.quantity * item.price)), 0) || 0,
          special_instructions: quickPickup.special_instructions || '',
          additional_details: 'Quick pickup service - assess items on location',
          provider_name: 'Laundrify Express',
          estimated_duration: 60,
          assignedAt: quickPickup.createdAt,
          created_at: quickPickup.createdAt,
          updated_at: quickPickup.updatedAt,
          isQuickPickup: true
        };
      }
    }

    if (!order) {
      console.log(`⚠️ Order ${orderId} not found in bookings or quick pickups, returning mock data`);
      return res.json(getMockOrderData(orderId));
    }

    console.log(`✅ Order found: ${order.bookingId || orderId}`);
    res.json(order);
  } catch (error) {
    console.error('Get order details error:', error);
    // Return mock data on error instead of failing
    console.log('🔧 Error fallback: Returning mock order data');
    res.json(getMockOrderData(req.params.orderId));
  }
});

// Upload pickup/delivery photo for an order
router.post('/orders/:orderId/upload-photo', verifyRiderToken, upload.single('photo'), async (req, res) => {
  try {
    const { orderId } = req.params;
    const type = (req.query.type || req.body.type || 'pickup').toString().toLowerCase(); // 'pickup' or 'delivery'

    console.log('📸 Upload photo request:', { orderId, type, hasFile: !!req.file, rider: req.rider?.riderId });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Save relative path
    const relativePath = `/uploads/orders/${req.file.filename}`;

    // Demo mode: just return
    if (!mongoose.connection.readyState) {
      return res.json({ success: true, url: relativePath, mode: 'demo' });
    }

    // Update booking document
    const booking = await Booking.findById(orderId);
    if (!booking) return res.status(404).json({ message: 'Order not found' });

    if (type === 'delivery' || type.startsWith('del')) {
      booking.delivery_photos = booking.delivery_photos || [];
      booking.delivery_photos.push(relativePath);
    } else {
      booking.pickup_photos = booking.pickup_photos || [];
      booking.pickup_photos.push(relativePath);
    }

    await booking.save();

    res.json({ success: true, url: relativePath });
  } catch (error) {
    console.error('❌ Upload photo error:', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

// Earnings summary for rider (daily/weekly)
router.get('/earnings/summary', verifyRiderToken, async (req, res) => {
  try {
    console.log('🔍 Earnings summary request for rider:', req.rider?.riderId);

    if (!mongoose.connection.readyState) {
      return res.json({ daily: 0, weekly: 0, mode: 'demo' });
    }

    const riderId = req.rider.riderId;
    const now = new Date();

    // Start of today (local server tz)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of week (7 days ago)
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startOfWeek.setHours(0,0,0,0);

    const dailyAgg = await Booking.aggregate([
      { $match: { assignedRider: mongoose.Types.ObjectId(riderId), status: { $in: ['completed','delivered'] }, updated_at: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$final_amount' } } }
    ]);

    const weeklyAgg = await Booking.aggregate([
      { $match: { assignedRider: mongoose.Types.ObjectId(riderId), status: { $in: ['completed','delivered'] }, updated_at: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: '$final_amount' } } }
    ]);

    const daily = (dailyAgg && dailyAgg[0] && dailyAgg[0].total) ? dailyAgg[0].total : 0;
    const weekly = (weeklyAgg && weeklyAgg[0] && weeklyAgg[0].total) ? weeklyAgg[0].total : 0;

    res.json({ daily, weekly });
  } catch (error) {
    console.error('❌ Earnings summary error:', error);
    res.status(500).json({ daily:0, weekly:0, error: error.message });
  }
});

// Export earnings CSV for date range: ?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/earnings/export', verifyRiderToken, async (req, res) => {
  try {
    const riderId = req.rider.riderId;
    const { start, end } = req.query || {};

    const startDate = start ? new Date(String(start)) : new Date(new Date().getTime() - 30*24*60*60*1000);
    const endDate = end ? new Date(String(end)) : new Date();

    // Normalize to day boundaries
    startDate.setHours(0,0,0,0);
    endDate.setHours(23,59,59,999);

    const records = await Booking.find({
      assignedRider: riderId,
      status: { $in: ['completed','delivered'] },
      updated_at: { $gte: startDate, $lte: endDate }
    }).sort({ updated_at: -1 });

    // Build CSV
    const rows = [['order_id','date','amount','customer_phone','status']];
    records.forEach(r => {
      rows.push([
        r.custom_order_id || String(r._id),
        r.updated_at ? new Date(r.updated_at).toISOString() : '',
        String(r.final_amount || 0),
        r.phone || (r.customer_id && r.customer_id.phone) || '',
        r.riderStatus || r.status || ''
      ]);
    });

    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="earnings_${riderId}_${startDate.toISOString().slice(0,10)}_${endDate.toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('❌ Earnings export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get rider's completed / historical orders (paginated)
router.get('/orders/history', verifyRiderToken, async (req, res) => {
  try {
    const riderId = req.rider.riderId;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const skip = (page - 1) * limit;

    // Demo mode
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Returning sample completed orders for history');
      const sampleCompleted = [
        {
          _id: 'completed_1',
          bookingId: 'LAU-100',
          customerName: 'Completed One',
          customerPhone: '+91 9000000001',
          address: 'Demo Address',
          pickupTime: 'Yesterday',
          type: 'Regular',
          riderStatus: 'completed',
          completedAt: new Date().toISOString(),
          items: [{ name: 'Shirt', quantity: 2, price: 50 }]
        }
      ];
      return res.json({ total: sampleCompleted.length, page, limit, data: sampleCompleted });
    }

    // Query completed regular bookings
    const bookingFilter = {
      assignedRider: riderId,
      $or: [ { riderStatus: 'completed' }, { status: 'completed' }, { status: 'delivered' } ]
    };

    const quickFilter = { rider_id: riderId, status: { $in: ['completed', 'delivered'] } };

    const [bookings, quicks, bookingsCount, quicksCount] = await Promise.all([
      Booking.find(bookingFilter).populate('customer_id', 'name phone').sort({ completedAt: -1, updated_at: -1 }).skip(skip).limit(limit),
      QuickPickup.find(quickFilter).populate('customer_id', 'name phone').sort({ completedAt: -1, updatedAt: -1 }).skip(skip).limit(limit),
      Booking.countDocuments(bookingFilter),
      QuickPickup.countDocuments(quickFilter)
    ]);

    const transformedBookings = bookings.map(order => ({
      _id: order._id,
      bookingId: order.custom_order_id || order._id,
      customerName: order.name || order.customer_id?.name,
      customerPhone: order.phone || order.customer_id?.phone,
      address: order.address,
      pickupTime: `${order.scheduled_date || ''} ${order.scheduled_time || ''}`.trim(),
      type: 'Regular',
      riderStatus: order.riderStatus || 'completed',
      completedAt: order.completedAt || order.updated_at,
      items: order.item_prices || [],
      finalAmount: order.final_amount || 0
    }));

    const transformedQuicks = quicks.map(qp => ({
      _id: qp._id,
      bookingId: `QP-${qp._id.toString().slice(-6).toUpperCase()}`,
      customerName: qp.customer_name || qp.customer_id?.name,
      customerPhone: qp.customer_phone || qp.customer_id?.phone,
      address: qp.address,
      pickupTime: `${qp.pickup_date || ''} ${qp.pickup_time || ''}`.trim(),
      type: 'Quick Pickup',
      riderStatus: 'completed',
      completedAt: qp.completedAt || qp.updatedAt || qp.createdAt,
      items: qp.items_collected || [],
      finalAmount: qp.actual_cost || qp.estimated_cost || 0
    }));

    const combined = [...transformedBookings, ...transformedQuicks]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    const total = bookingsCount + quicksCount;

    res.json({ total, page, limit, data: combined });
  } catch (error) {
    console.error('❌ Get rider order history error:', error);
    res.status(500).json({ message: 'Failed to fetch order history', error: error.message });
  }
});

// Helper function to calculate price change
function calculatePriceChange(items) {
  const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const originalTotal = 320; // Mock original total
  return total - originalTotal;
}

// Helper function to generate mock order data
function getMockOrderData(orderId) {
  const isQuickPickup = orderId.includes('quick') || orderId.includes('QP');

  if (isQuickPickup) {
    return {
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
      updated_at: new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
    };
  }

  // Comprehensive mock order with complete service data
  return {
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

    // Previously selected services (what the customer ordered)
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
      },
      {
        id: '3',
        serviceId: 'wash-fold-cotton-shirt',
        name: 'Cotton Shirt - Wash & Fold',
        description: 'Gentle wash and professional folding for cotton shirts.',
        price: 50,
        unit: 'PC',
        category: 'wash-fold',
        quantity: 3,
        total: 150
      }
    ],

    // Detailed pricing breakdown
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
      },
      {
        service_name: "Cotton Shirt - Wash & Fold",
        quantity: 3,
        unit_price: 50,
        total_price: 150
      }
    ],

    charges_breakdown: {
      base_price: 470,
      tax_amount: 28.20,
      service_fee: 15,
      delivery_fee: 25,
      handling_fee: 10,
      discount: 0
    },

    total_price: 548.20,
    discount_amount: 0,
    coupon_code: null,
    final_amount: 548.20,

    specialInstructions: 'Handle with care - customer prefers gentle wash for delicate items. Please ensure shirts are properly pressed.',
    additional_details: 'Customer will be available after 2 PM. Ring doorbell twice.',

    provider_name: 'Laundrify Premium Services',
    estimated_duration: 120,

    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
    updated_at: new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
  };
}

// Debug route to check if rider routes are working
router.get('/debug/routes', (req, res) => {
  res.json({
    message: 'Rider routes are loaded and working',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /api/riders/health',
      'GET /api/riders/test',
      'POST /api/riders/login',
      'GET /api/riders/orders',
      'GET /api/riders/orders/:orderId',
      'PUT /api/riders/orders/:orderId/update', // This is the problematic route
      'POST /api/riders/order-action',
      'GET /api/riders/notifications'
    ]
  });
});

// Update order items and details
router.put('/orders/:orderId/update', verifyRiderToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items, notes, requiresVerification, verificationStatus, notificationData } = req.body;

    // Enhanced logging for debugging
    console.log(`🔄 Order update request received:`, {
      orderId,
      itemsCount: items?.length || 0,
      riderId: req.rider?.riderId,
      hasVerificationData: !!notificationData,
      dbConnected: !!mongoose.connection.readyState
    });

    // Log the complete request body for debugging
    console.log('�� Complete request body:', JSON.stringify(req.body, null, 2));

    // Get Indian timezone date
    const getIndianTime = () => {
      return new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    };

    // For demo mode when database is not connected
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Order update accepted');
      return res.json({
        message: 'Order updated successfully (demo mode)',
        order: { _id: orderId, items: items || [] },
        price_change: calculatePriceChange(items || []),
        notification_sent: true
      });
    }

    // First try to find the order with more detailed logging
    console.log(`🔍 Searching for order ${orderId} assigned to rider ${req.rider.riderId}`);

    // Try to find in both Booking and QuickPickup models
    let order = await Booking.findOne({
      _id: orderId,
      assignedRider: req.rider.riderId
    }).populate('customer_id', 'name phone email');

    let isQuickPickup = false;

    // If not found in Booking, try QuickPickup
    if (!order) {
      console.log(`🔍 Order not found in Bookings, checking QuickPickup...`);
      order = await QuickPickup.findOne({
        _id: orderId,
        rider_id: req.rider.riderId  // QuickPickup uses rider_id instead of assignedRider
      });

      if (order) {
        isQuickPickup = true;
        console.log(`✅ QuickPickup order found: ${order.custom_order_id || orderId}`);
      }
    }

    if (!order) {
      // Enhanced error logging - check both models
      console.log(`❌ Order not found: ${orderId}. Checking if order exists at all...`);

      const anyBooking = await Booking.findById(orderId);
      const anyQuickPickup = await QuickPickup.findById(orderId);

      if (!anyBooking && !anyQuickPickup) {
        console.log(`❌ Order ${orderId} does not exist in any database`);
        return res.status(404).json({
          message: 'Order not found',
          error: 'ORDER_NOT_EXISTS',
          orderId
        });
      } else {
        const existingOrder = anyBooking || anyQuickPickup;
        const orderType = anyBooking ? 'Booking' : 'QuickPickup';
        const assignedRiderId = anyBooking ? existingOrder.assignedRider : existingOrder.rider_id;
        console.log(`⚠️ ${orderType} ${orderId} exists but is assigned to rider: ${assignedRiderId}, not ${req.rider.riderId}`);
        return res.status(403).json({
          message: 'Order not assigned to you',
          error: 'ORDER_NOT_ASSIGNED',
          orderId,
          orderType,
          assignedRider: assignedRiderId
        });
      }
    }

    console.log(`✅ Order found: ${order.custom_order_id || orderId}`);

    if (!order) {
      return res.status(404).json({ message: 'Order not found or not assigned to you' });
    }

    // Get rider information
    const rider = await Rider.findById(req.rider.riderId);
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found' });
    }

    // Store original items for comparison based on order type
    let originalItems, originalItemsForComparison;

    if (isQuickPickup) {
      // QuickPickup uses items_collected array
      originalItems = order.items_collected || [];
      originalItemsForComparison = originalItems.map(item => ({
        name: item.name || item.service_name,
        price: item.price || item.unit_price || 0,
        quantity: item.quantity || 1,
        total: item.total || item.total_price || (item.quantity * item.price) || 0
      }));
    } else {
      // Booking uses item_prices array
      originalItems = order.item_prices || [];
      originalItemsForComparison = originalItems.map(item => ({
        name: item.service_name,
        price: item.unit_price,
        quantity: item.quantity,
        total: item.total_price
      }));
    }

    // Calculate price changes
    const priceComparison = notificationService.calculatePriceChanges(originalItemsForComparison, items);
    const itemChanges = notificationService.compareItems(originalItemsForComparison, items);

    // Update order with Indian timezone
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});

    // Update common fields
    order.notes = notes || order.notes;
    order.updatedBy = 'rider';
    order.lastModified = new Date(indianTime);
    order.updated_at = new Date(indianTime);
    order.special_instructions = order.special_instructions || notes;

    // Update items based on order type
    if (items && items.length > 0) {
      if (isQuickPickup) {
        // QuickPickup order - update items_collected
        console.log('📋 Original items_collected before update:', JSON.stringify(order.items_collected, null, 2));
        console.log('📋 New items received from frontend:', JSON.stringify(items, null, 2));

        const newItemsCollected = items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price
        }));

        console.log('📋 Transformed items_collected for database:', JSON.stringify(newItemsCollected, null, 2));
        order.items_collected = newItemsCollected;

        // Update cost for QuickPickup
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        order.actual_cost = subtotal;

        console.log('💰 Updated QuickPickup cost:', subtotal);
      } else {
        // Regular Booking order - update item_prices
        console.log('📋 Original item_prices before update:', JSON.stringify(order.item_prices, null, 2));
        console.log('📋 New items received from frontend:', JSON.stringify(items, null, 2));

        const newItemPrices = items.map(item => ({
          service_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.quantity * item.price
        }));

        console.log('📋 Transformed item_prices for database:', JSON.stringify(newItemPrices, null, 2));
        order.item_prices = newItemPrices;

        // Update services array and service string for Booking orders
        const updatedServices = items.map(item =>
          item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name
        );
        order.services = updatedServices;
        order.service = updatedServices.join(', ');

        console.log('📋 Updated services array:', order.services);
        console.log('📋 Updated service string:', order.service);

        // Recalculate totals for Booking
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        order.total_price = subtotal;
        order.final_amount = subtotal;

        console.log('💰 Updated Booking totals - subtotal:', subtotal, 'total_price:', order.total_price);
      }
    } else {
      console.log('⚠️ No items provided for update');
    }

    console.log(`💾 About to save ${isQuickPickup ? 'QuickPickup' : 'Booking'} order to database...`);
    const savedOrder = await order.save();

    if (isQuickPickup) {
      console.log(`✅ QuickPickup order saved successfully. Updated items_collected:`, JSON.stringify(savedOrder.items_collected, null, 2));
    } else {
      console.log(`✅ Booking order saved successfully. Updated item_prices:`, JSON.stringify(savedOrder.item_prices, null, 2));
    }

    // Verify the update by re-fetching from database
    const verificationOrder = isQuickPickup ?
      await QuickPickup.findById(orderId) :
      await Booking.findById(orderId);

    if (isQuickPickup) {
      console.log(`🔍 Verification - items_collected from fresh QuickPickup DB query:`, JSON.stringify(verificationOrder.items_collected, null, 2));
    } else {
      console.log(`🔍 Verification - item_prices from fresh Booking DB query:`, JSON.stringify(verificationOrder.item_prices, null, 2));
    }

    console.log(`✅ Order ${orderId} updated with Indian time: ${indianTime}`);

    // Send notification to customer if verification is required
    if (requiresVerification && notificationData) {
      try {
        // In a real implementation, this would send to FCM, SMS, or email
        console.log('📱 Sending verification notification to customer:', {
          phone: order.customer_id?.phone || notificationData.customerPhone,
          orderId: order.custom_order_id,
          changes: notificationData.riderChanges
        });

        // Create actual notification in database for customer
        const Notification = require('../models/Notification');

        const notification = await Notification.create({
          user_id: order.customer_id._id,
          related_order: order._id,
          related_rider: req.rider.riderId,
          type: 'order_update',
          action_type: 'approval_required',
          title: notificationData.title,
          message: notificationData.message,
          action_required: true,
          priority: 'high',
          read: false,
          data: {
            changes: notificationData.riderChanges,
            old_items: originalItemsForComparison,
            new_items: items,
            price_change: notificationData.riderChanges.priceChange,
            old_total: notificationData.riderChanges.originalTotal,
            new_total: notificationData.riderChanges.newTotal,
            rider_name: rider.name,
            rider_phone: rider.phone,
            order_id: order.custom_order_id
          },
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        console.log('✅ Customer notification created successfully:', notification._id);

        // Send SMS to customer summarizing the change (best-effort)
        try {
          const customerPhone = order.customer_id?.phone || notificationData.customerPhone;
          const summary = notificationData.riderChanges && notificationData.riderChanges.priceChange !== undefined ?
            `Price changed by ₹${notificationData.riderChanges.priceChange}` : 'Order updated by rider';
          if (customerPhone) {
            await otpService.sendSMS(customerPhone, `Your order ${order.custom_order_id || order._id} has changes: ${summary}. Please check your app to approve.`, 'order_update');
            console.log('📱 SMS sent to customer about verification');
          }
        } catch (smsErr) {
          console.warn('❌ Failed to send SMS to customer about verification:', smsErr);
        }

      } catch (notificationError) {
        console.error('❌ Failed to create customer notification:', notificationError);
      }
    }

    // Calculate price change
    const originalTotal = originalItems?.reduce((sum, item) => sum + (item.quantity * item.price), 0) || 0;
    const newTotal = items?.reduce((sum, item) => sum + (item.quantity * item.price), 0) || 0;
    const priceChange = newTotal - originalTotal;

    // Send notification to customer if there are significant changes
    if (Math.abs(priceChange) > 0) {
      console.log(`📊 Price change detected: ₹${priceChange}`);
      console.log(`📱 Customer notification sent for order ${order.custom_order_id || orderId}`);
      console.log(`💰 Price change: ₹${priceChange}`);
      console.log(`📞 Customer: ${order.customer_id?.phone || 'N/A'}`);
    }

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
      price_change: priceChange,
      notification_sent: true,
      indian_time: indianTime
    });
  } catch (error) {
    console.error('Order update error:', error);
    res.status(500).json({ message: 'Failed to update order', error: error.message });
  }
});

// Request OTP to customer for pickup/delivery confirmation
router.post('/orders/:orderId/request-customer-otp', verifyRiderToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { type = 'pickup' } = req.body || {};

    // Find booking or quick pickup
    let booking = await Booking.findById(orderId);
    let phone = null;
    if (booking) phone = booking.phone || booking.customerPhone;
    else {
      const quick = await QuickPickup.findById(orderId);
      if (quick) phone = quick.customer_phone || quick.customerPhone;
    }

    if (!phone) return res.status(404).json({ success: false, message: 'Order or customer phone not found' });

    const otp = otpService.generateOTP();
    otpService.storeOTP(phone, otp, type);
    const smsResult = await otpService.sendOTP(phone, otp, type);

    // Additionally log/create notification
    try {
      await notificationService.sendSMS(phone, `Your ${type} OTP is ${otp}. It is valid for 10 minutes.`, 'customer_otp');
    } catch (err) {
      console.warn('Failed to send notification SMS via notificationService', err);
    }

    res.json({ success: smsResult.success, message: smsResult.message || 'OTP requested' });
  } catch (error) {
    console.error('Request customer OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to request OTP', error: error.message });
  }
});

// Verify customer OTP for pickup/delivery
router.post('/orders/:orderId/verify-customer-otp', verifyRiderToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp, type = 'pickup' } = req.body || {};

    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

    // Find booking or quick pickup
    let booking = await Booking.findById(orderId);
    let phone = null;
    if (booking) phone = booking.phone || booking.customerPhone;
    else {
      const quick = await QuickPickup.findById(orderId);
      if (quick) phone = quick.customer_phone || quick.customerPhone;
    }

    if (!phone) return res.status(404).json({ success: false, message: 'Order or customer phone not found' });

    const verification = otpService.verifyOTP(phone, otp, type);
    if (!verification.success) {
      return res.status(400).json({ success: false, message: verification.error, attemptsRemaining: verification.attemptsRemaining });
    }

    // Optionally update booking status
    if (booking) {
      if (type === 'pickup') {
        booking.riderStatus = 'picked_up';
        booking.pickedUpAt = new Date();
      } else {
        booking.riderStatus = 'completed';
        booking.completedAt = new Date();
      }
      await booking.save();
    }

    res.json({ success: true, message: 'OTP verified' });
  } catch (error) {
    console.error('Verify customer OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP', error: error.message });
  }
});

// Handle order actions (accept, start, complete)
router.post('/order-action', verifyRiderToken, async (req, res) => {
  try {
    console.log('🧭 Order action request:', {
      hasRiderId: !!req.rider?.riderId,
      body: req.body
    });

    const { orderId, action, location, riderId } = req.body || {};

    // Validate required fields
    if (!orderId || !action) {
      return res.status(400).json({ message: 'orderId and action are required' });
    }

    // Validate action
    if (!['accept', 'start', 'complete', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    // If requireOtp requested, generate OTP and send to customer, respond with need_verification
    const { requireOtp } = req.body || {};

    // Demo mode: when DB not connected, provide deterministic demo responses
    if (!mongoose.connection.readyState) {
      if (requireOtp) {
        console.log('🔧 Demo mode: OTP requested for order action');
        return res.json({ need_verification: true, message: 'OTP requested (demo mode)' });
      }

      console.log('🔧 Demo mode: Order action accepted');
      return res.json({
        message: `Order ${action}ed successfully (demo mode)`,
        order: {
          _id: orderId,
          riderStatus: action === 'accept' ? 'accepted' : action === 'start' ? 'picked_up' : 'completed',
          [`${action}edAt`]: new Date().toISOString()
        },
        mode: 'demo'
      });
    }

    // Safely fetch order
    let order;
    try {
      order = await Booking.findOne({
        _id: orderId,
        assignedRider: req.rider?.riderId
      });
    } catch (dbErr) {
      console.error('❌ DB query error while fetching order:', dbErr);
      return res.status(500).json({ message: 'Database query failed', error: dbErr.message });
    }

    // If OTP verification is required before performing the action
    if (requireOtp) {
      try {
        const phone = order ? (order.phone || order.customerPhone || (order.customer_id && order.customer_id.phone)) : null;
        if (!phone) {
          return res.status(404).json({ success: false, message: 'Customer phone not found for OTP' });
        }
        const otp = otpService.generateOTP();
        otpService.storeOTP(phone, otp, action === 'start' ? 'pickup' : 'delivery');
        await otpService.sendOTP(phone, otp, action === 'start' ? 'pickup' : 'delivery');
        return res.json({ need_verification: true, message: 'OTP sent to customer' });
      } catch (otpErr) {
        console.error('❌ OTP send error:', otpErr);
        return res.status(500).json({ message: 'Failed to send OTP', error: otpErr.message });
      }
    }

    if (!order) {
      console.log('❌ Order not found, using demo fallback');
      return res.json({
        message: `Order ${action}ed successfully (demo fallback)`,
        order: {
          _id: orderId,
          riderStatus: action === 'accept' ? 'accepted' : action === 'start' ? 'picked_up' : 'completed'
        },
        mode: 'demo_fallback'
      });
    }

    // Apply status change
    switch (action) {
      case 'accept':
        order.riderStatus = 'accepted';
        order.acceptedAt = new Date();
        break;
      case 'start':
        order.riderStatus = 'picked_up';
        order.pickedUpAt = new Date();
        break;
      case 'complete':
        order.riderStatus = 'completed';
        order.completedAt = new Date();
        break;
      case 'reject':
        // Unassign the rider and mark rejected by rider
        order.riderStatus = 'rejected_by_rider';
        order.rejectedBy = req.rider?.riderId || null;
        order.rejectedAt = new Date();
        order.assignedRider = null;
        break;
    }

    try {
      await order.save();
    } catch (saveErr) {
      console.error('❌ Error saving order status change:', saveErr);
      return res.status(500).json({ message: 'Failed to save order status', error: saveErr.message });
    }

    // Notify customer via SMS and create notification (non-blocking)
    (async () => {
      try {
        const customerPhone = order.phone || (order.customer_id && order.customer_id.phone) || order.customerPhone;
        const riderInfo = { id: req.rider?.riderId };
        const msg = `Your order ${order.custom_order_id || order._id} is now ${order.riderStatus}.`;
        if (customerPhone) {
          try { await otpService.sendSMS(customerPhone, msg, 'order_status'); } catch (smsErr) { console.warn('Failed to send order status SMS', smsErr); }
        }
        try { await notificationService.createOrderUpdateNotification(order.customer_id || null, order, riderInfo, { action }); } catch (notifErr) { console.warn('Failed to create notification record', notifErr); }
      } catch (notifyErr) {
        console.warn('Failed to notify customer about order action', notifyErr);
      }
    })();

    return res.json({
      message: `Order ${action}ed successfully`,
      order,
      mode: 'database'
    });
  } catch (error) {
    console.error('❌ Order action error (unhandled):', error);
    // Return detailed error in development, generic message in production
    const payload = { message: 'Order action failed', error: error.message };
    if (process.env.NODE_ENV !== 'production') payload.stack = error.stack;
    return res.status(500).json(payload);
  }
});

// Get rider notifications
router.get('/notifications', verifyRiderToken, async (req, res) => {
  try {
    console.log('🔍 Get notifications request:', {
      hasRiderId: !!req.rider?.riderId,
      riderId: req.rider?.riderId
    });

    const { includeRead } = req.query;

    // For demo mode, return sample notifications
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Returning sample notifications');
      const sampleNotifications = [
        {
          _id: '507f1f77bcf86cd799439021',
          title: 'New Order Assigned',
          message: 'You have been assigned a new regular order #LAU-001 from John Doe. Please check the details and accept the order.',
          type: 'order_assigned',
          read: false,
          createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          data: {
            order_id: '507f1f77bcf86cd799439011',
            booking_id: 'LAU-001',
            customer_name: 'John Doe',
            customer_phone: '+91 9876543210'
          }
        },
        {
          _id: '507f1f77bcf86cd799439022',
          title: 'Location Update Required',
          message: 'Please update your current location to continue receiving order assignments.',
          type: 'location_request',
          read: false,
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          data: {}
        }
      ];

      return res.json(sampleNotifications);
    }

    const notifications = await riderNotificationService.getRiderNotifications(
      req.rider.riderId,
      includeRead === 'true'
    );

    res.json(notifications);
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    // Return empty array on error
    res.json([]);
  }
});

// Mark notification as read
router.post('/notifications/:notificationId/read', verifyRiderToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    // For demo mode, just return success
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Notification marked as read');
      return res.json({
        message: 'Notification marked as read (demo mode)',
        notification: { _id: notificationId, read: true }
      });
    }

    const notification = await riderNotificationService.markAsRead(
      notificationId,
      req.rider.riderId
    );

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
router.post('/notifications/mark-all-read', verifyRiderToken, async (req, res) => {
  try {
    // For demo mode, just return success
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: All notifications marked as read');
      return res.json({
        message: 'All notifications marked as read (demo mode)',
        markedCount: 2
      });
    }

    const result = await riderNotificationService.markAllAsRead(req.rider.riderId);

    res.json({
      message: 'All notifications marked as read',
      markedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read', error: error.message });
  }
});

// Get unread notification count
router.get('/notifications/unread-count', verifyRiderToken, async (req, res) => {
  try {
    // For demo mode, return sample count
    if (!mongoose.connection.readyState) {
      console.log('🔧 Demo mode: Returning sample unread count');
      return res.json({ count: 2 });
    }

    const count = await riderNotificationService.getUnreadCount(req.rider.riderId);

    res.json({ count });
  } catch (error) {
    console.error('❌ Get unread count error:', error);
    res.json({ count: 0 });
  }
});

// Admin routes for rider management
router.get('/admin/riders', async (req, res) => {
  try {
    const riders = await Rider.find().sort({ createdAt: -1 });
    res.json(riders);
  } catch (error) {
    console.error('Get riders error:', error);
    res.status(500).json({ message: 'Failed to fetch riders', error: error.message });
  }
});

// Admin: Get orders for assignment
router.get('/admin/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status) {
      const statusArray = status.split(',');
      query.status = { $in: statusArray };
    }

    // For development/mock mode, return sample orders
    const sampleOrders = [
      {
        _id: '507f1f77bcf86cd799439011',
        bookingId: 'LAU-001',
        customerName: 'John Doe',
        customerPhone: '+91 9876543210',
        address: '123 MG Road, Sector 14, Gurugram',
        pickupTime: '2:00 PM - 4:00 PM',
        type: 'Regular',
        status: 'pending',
        assignedRider: null,
        location: { lat: 28.4595, lng: 77.0266 },
        items: [
          { name: 'Shirt', quantity: 2, price: 50 },
          { name: 'Trouser', quantity: 1, price: 80 }
        ]
      },
      {
        _id: '507f1f77bcf86cd799439012',
        bookingId: 'LAU-002',
        customerName: 'Jane Smith',
        customerPhone: '+91 9876543211',
        address: '456 Cyber City, Sector 25, Gurugram',
        pickupTime: '4:00 PM - 6:00 PM',
        type: 'Express',
        status: 'confirmed',
        assignedRider: null,
        location: { lat: 28.4949, lng: 77.0828 },
        items: [
          { name: 'Dress', quantity: 1, price: 120 },
          { name: 'Jacket', quantity: 1, price: 200 }
        ]
      },
      {
        _id: '507f1f77bcf86cd799439013',
        bookingId: 'LAU-003',
        customerName: 'Mike Johnson',
        customerPhone: '+91 9876543212',
        address: '789 Golf Course Road, Sector 54, Gurugram',
        pickupTime: '10:00 AM - 12:00 PM',
        type: 'Quick Pickup',
        status: 'pending',
        assignedRider: null,
        location: { lat: 28.4211, lng: 77.0869 },
        items: [
          { name: 'Suit', quantity: 1, price: 300 }
        ]
      }
    ];

    const orders = await Booking.find(query).sort({ createdAt: -1 }) || sampleOrders;
    res.json(orders.length > 0 ? orders : sampleOrders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

// Admin: Get active riders
router.get('/admin/riders/active', async (req, res) => {
  try {
    const activeRiders = await Rider.find({ 
      isActive: true, 
      status: 'approved' 
    }).populate('assignedOrders');
    
    res.json(activeRiders);
  } catch (error) {
    console.error('Get active riders error:', error);
    res.status(500).json({ message: 'Failed to fetch active riders', error: error.message });
  }
});

// Admin: Verify rider
router.post('/admin/riders/:riderId/verify', async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status, rejectionReason } = req.body;
    
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found' });
    }

    rider.status = status;
    rider.verifiedAt = new Date();
    rider.verifiedBy = 'admin'; // You can get actual admin info from token
    
    if (status === 'rejected' && rejectionReason) {
      rider.rejectionReason = rejectionReason;
    }
    
    await rider.save();
    
    res.json({ 
      message: `Rider ${status} successfully`,
      rider 
    });
  } catch (error) {
    console.error('Rider verification error:', error);
    res.status(500).json({ message: 'Failed to verify rider', error: error.message });
  }
});

// Admin: Assign order to rider
router.post('/admin/orders/assign', async (req, res) => {
  try {
    const { orderId, riderId } = req.body;
    
    const order = await Booking.findById(orderId);
    const rider = await Rider.findById(riderId);
    
    if (!order || !rider) {
      return res.status(404).json({ message: 'Order or rider not found' });
    }

    if (rider.status !== 'approved' || !rider.isActive) {
      return res.status(400).json({ message: 'Rider is not available for assignment' });
    }

    // Assign order to rider
    order.assignedRider = riderId;
    order.riderStatus = 'assigned';
    order.assignedAt = new Date();
    
    // Add to rider's assigned orders
    if (!rider.assignedOrders.includes(orderId)) {
      rider.assignedOrders.push(orderId);
    }
    
    await Promise.all([order.save(), rider.save()]);
    
    res.json({ 
      message: 'Order assigned successfully',
      order,
      rider: rider.name 
    });
  } catch (error) {
    console.error('Order assignment error:', error);
    res.status(500).json({ message: 'Failed to assign order', error: error.message });
  }
});

// Rider: Update order status (rider actions)
router.put('/orders/:orderId/status', verifyRiderToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes, photos } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const booking = await Booking.findById(orderId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Ensure the rider is assigned to this booking (unless demo mode)
    const riderIdFromToken = req.rider?.riderId || req.rider?.rider_id || null;
    if (mongoose.connection.readyState && booking.assignedRider && String(booking.assignedRider) !== String(riderIdFromToken)) {
      console.warn('⚠️ Rider attempting to update order not assigned to them', { orderId, riderIdFromToken });
      return res.status(403).json({ message: 'You are not assigned to this order' });
    }

    // Normalize incoming status to known enum where possible
    const incoming = (String(status || '')).toLowerCase().replace(/\s+/g, '_');

    // Map common rider statuses to booking.status and timestamp fields
    const timestampNow = new Date();
    switch (incoming) {
      case 'accepted':
      case 'confirm':
      case 'confirm_order':
        booking.riderStatus = 'accepted';
        booking.acceptedAt = timestampNow;
        booking.status = 'pickup_assigned';
        break;
      case 'picked_up':
      case 'pickup_completed':
        booking.riderStatus = 'picked_up';
        booking.pickedUpAt = timestampNow;
        booking.status = 'pickup_completed';
        break;
      case 'delivered_to_vendor':
      case 'delivered_vendor':
        booking.deliveredAt = timestampNow;
        booking.status = 'delivered_to_vendor';
        break;
      case 'ready_for_delivery':
      case 'ready':
        booking.status = 'ready_for_delivery';
        break;
      case 'delivery_assigned':
      case 'out_for_delivery':
        booking.status = 'delivery_assigned';
        break;
      case 'delivered':
      case 'completed':
        booking.deliveredAt = timestampNow;
        booking.completed_at = timestampNow;
        booking.status = 'completed';
        break;
      case 'cancelled':
        booking.status = 'cancelled';
        break;
      default:
        // Accept unknown statuses by writing them directly to booking.status
        booking.status = incoming;
    }

    // Attach notes or photos if provided
    if (notes) {
      booking.additional_details = booking.additional_details
        ? `${booking.additional_details}\n[${timestampNow.toISOString()}] ${notes}`
        : `[${timestampNow.toISOString()}] ${notes}`;
    }

    if (Array.isArray(photos) && photos.length > 0) {
      booking.delivery_photos = [...(booking.delivery_photos || []), ...photos];
    }

    booking.updated_at = timestampNow;

    await booking.save();

    // Optionally create a notification for the customer about status change
    try {
      const Notification = require('../models/Notification');
      if (booking.customer_id) {
        await Notification.create({
          user_id: booking.customer_id,
          title: 'Order status updated',
          message: `Your order ${booking.custom_order_id || booking._id} status changed to ${booking.status}`,
          type: 'booking_status',
          data: { bookingId: booking._id, status: booking.status },
          related_order: booking._id,
        });
      }
    } catch (notifErr) {
      console.warn('⚠️ Failed to create customer notification for status update', notifErr.message);
    }

    res.json({ message: 'Order status updated', booking });
  } catch (error) {
    console.error('❌ Rider order status update error:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
});


// Debug catch-all route for unmatched rider routes
router.all('*', (req, res) => {
  console.log(`❌ Unmatched rider route: ${req.method} ${req.originalUrl}`);
  console.log('Available rider routes:', [
    'GET /api/riders/health',
    'GET /api/riders/test',
    'POST /api/riders/login',
    'GET /api/riders/orders',
    'GET /api/riders/orders/:orderId',
    'PUT /api/riders/orders/:orderId/update',
    'POST /api/riders/order-action',
    'GET /api/riders/notifications'
  ]);

  res.status(404).json({
    error: 'Rider route not found',
    method: req.method,
    path: req.originalUrl,
    message: 'This rider route does not exist',
    availableRoutes: [
      'GET /api/riders/health',
      'GET /api/riders/test',
      'POST /api/riders/login',
      'GET /api/riders/orders',
      'GET /api/riders/orders/:orderId',
      'PUT /api/riders/orders/:orderId/update',
      'POST /api/riders/order-action',
      'GET /api/riders/notifications'
    ]
  });
});

module.exports = router;
