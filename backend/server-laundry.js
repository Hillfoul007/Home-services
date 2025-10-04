const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

// Load environment variables
dotenv.config();

// Load production configuration
const productionConfig = require("./config/production");

// Validate configuration
try {
  productionConfig.validateConfig();
} catch (error) {
  console.error("❌ Configuration Error:", error.message);
  if (productionConfig.isProduction()) {
    process.exit(1);
  } else {
    console.log("⚠️ Running in development mode with partial configuration");
  }
}

const app = express();
const PORT = process.env.PORT || productionConfig.PORT || 3001;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false,
    frameguard: false, // Allow iframe display for development
  }),
);

// Compression middleware
app.use(compression());

// Logging middleware
if (productionConfig.isProduction()) {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: productionConfig.RATE_LIMIT.WINDOW_MS,
  max: productionConfig.RATE_LIMIT.MAX_REQUESTS,
  message: { error: "Too many requests, please try again later" },
});

const authLimiter = rateLimit({
  windowMs: productionConfig.RATE_LIMIT.AUTH_WINDOW_MS,
  max: productionConfig.RATE_LIMIT.AUTH_MAX_REQUESTS,
  message: {
    error: "Too many authentication attempts, please try again later",
  },
});

// Apply rate limiting only to API endpoints
if (productionConfig.isProduction()) {
  app.use(generalLimiter);
} else {
  // In development, only rate limit API endpoints
  app.use("/api", generalLimiter);
}
app.use("/api/auth", authLimiter);

// Middleware to add cache control headers for iOS
app.use("/api/auth", (req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Additional CORS middleware to ensure headers are always set
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Check if origin is allowed
  const isAllowed = !origin || productionConfig.ALLOWED_ORIGINS.includes(origin) ||
    productionConfig.ALLOWED_ORIGINS.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return false;
    });

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  next();
});

// Log allowed origins for debugging
console.log("🌐 CORS allowed origins:", productionConfig.ALLOWED_ORIGINS);

// CORS configuration - Enhanced for iOS Safari compatibility
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check if the origin is in our allowed list (exact match)
      if (productionConfig.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      // Also check for wildcard patterns
      const isAllowed = productionConfig.ALLOWED_ORIGINS.some(allowedOrigin => {
        if (allowedOrigin.includes('*')) {
          const pattern = allowedOrigin.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      // Only log CORS blocks (actual issues)
      console.log(`🚫 CORS blocked origin: ${origin}`);
      return callback(null, true); // Temporarily allow all origins for debugging
    },
    credentials: true, // Enable credentials for iOS
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "user-id",
      "admin-token", // Add admin-token header support
      "Cache-Control", // Add Cache-Control header support
      "Pragma",
      "Expires",
      "X-Requested-With",
      "Access-Control-Allow-Origin"
    ],
    exposedHeaders: ["Clear-Site-Data"], // Expose clear site data header
    optionsSuccessStatus: 200, // Support legacy browsers
    preflightContinue: false,
  }),
);

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  const origin = req.headers.origin;

  // Check if origin is allowed
  const isAllowed = !origin || productionConfig.ALLOWED_ORIGINS.includes(origin) ||
    productionConfig.ALLOWED_ORIGINS.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return false;
    });

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    console.log(`🚫 Preflight blocked origin: ${origin}`);
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, user-id, admin-token, Cache-Control, Pragma, Expires, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// MongoDB connection with production configuration
const connectDB = async () => {
  try {
    // Use production MongoDB URI
    const mongoURI = productionConfig.MONGODB_URI;
    ("mongodb+srv://sunflower110001:fV4LhLpWlKj5Vx87@cluster0.ic8p792.mongodb.net/cleancare_pro?retryWrites=true&w=majority");

    await mongoose.connect(mongoURI);

    console.log(
      "✅ MongoDB connected successfully to:",
      mongoURI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@"),
    );
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    console.log("⚠️ Running in mock mode without database");
  }
};

// Connect to database
connectDB();

// Google Sheets services removed

// Import routes with error handling
let otpAuthRoutes, bookingRoutes, locationRoutes;

try {
  otpAuthRoutes = require("./routes/otp-auth");
  console.log("✅ OTP Auth routes loaded");
} catch (error) {
  console.error("❌ Failed to load OTP Auth routes:", error.message);
}

try {
  bookingRoutes = require("./routes/bookings");
  console.log("✅ Booking routes loaded");
} catch (error) {
  console.error("❌ Failed to load Booking routes:", error.message);
}

// Temporarily disable location routes to debug path-to-regexp issue
/*
try {
  locationRoutes = require("./routes/location");
  console.log("✅ Location routes loaded");
} catch (error) {
  console.error("❌ Failed to load Location routes:", error.message);
}
*/

// Serve static frontend files in production
if (productionConfig.isProduction()) {
  const frontendPath = path.join(__dirname, "../dist");
  app.use(express.static(frontendPath));
  console.log("📁 Serving frontend static files from:", frontendPath);
}

// Main health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🏥 Main health check endpoint hit');
  res.json({
    status: 'healthy',
    service: 'laundrify-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: {
      connected: !!mongoose.connection.readyState,
      state: mongoose.connection.readyState,
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    routes: {
      auth: '/api/auth',
      bookings: '/api/bookings',
      riders: '/api/riders',
      admin: '/api/admin',
      quickPickup: '/api/quick-pickup',
      notifications: '/api/notifications'
    }
  });
});

// API Routes with error handling
if (otpAuthRoutes) {
  app.use("/api/auth", otpAuthRoutes);
  console.log("�� Auth routes registered at /api/auth");
}

if (bookingRoutes) {
  app.use("/api/bookings", bookingRoutes);
  console.log("🔗 Booking routes registered at /api/bookings");
}

/*
if (locationRoutes) {
  app.use("/api/location", locationRoutes);
  console.log("🔗 Location routes registered at /api/location");
}
*/

// WhatsApp Auth routes
try {
  const whatsappAuthRoutes = require("./routes/whatsapp-auth");
  app.use("/api/whatsapp", whatsappAuthRoutes);
  console.log("🔗 WhatsApp Auth routes registered at /api/whatsapp");
} catch (error) {
  console.error("❌ Failed to load WhatsApp Auth routes:", error.message);
}

// Addresses routes - using simple version for debugging
try {
  const addressRoutes = require("./routes/addresses-simple");
  app.use("/api/addresses", addressRoutes);
  console.log("🔗 Simple Address routes registered at /api/addresses");
} catch (error) {
  console.error("❌ Failed to load Address routes:", error.message);
  console.error("❌ Full error:", error);
}

// Google Sheets routes removed

// Dynamic Services routes
try {
  const dynamicServicesRoutes = require("./routes/dynamic-services");
  app.use("/api/services", dynamicServicesRoutes);
  console.log("🔗 Dynamic Services routes registered at /api/services");
} catch (error) {
  console.error("❌ Failed to load Dynamic Services routes:", error.message);
}



// Detected Locations routes
try {
  const detectedLocationRoutes = require("./routes/detected-locations");
  app.use("/api/detected-locations", detectedLocationRoutes);
  console.log(
    "🔗 Detected Locations routes registered at /api/detected-locations",
  );
} catch (error) {
  console.error("❌ Failed to load Detected Locations routes:", error.message);
}

// AiSensy Webhooks routes (WhatsApp chatbot integration)
try {
  const aisenseyRoutes = require("./routes/aisensey-webhooks");
  app.use("/api/aisensey", aisenseyRoutes);
  console.log("🔗 AiSensy webhook routes registered at /api/aisensey");
} catch (error) {
  console.error("❌ Failed to load AiSensy webhook routes:", error.message);
}

// Coupons routes
try {
  const couponRoutes = require("./routes/coupons");
  app.use("/api/coupons", couponRoutes);
  console.log("🔗 Coupon routes registered at /api/coupons");
} catch (error) {
  console.error("❌ Failed to load Coupon routes:", error.message);
}

// Referral routes
try {
  const referralRoutes = require("./routes/referrals");
  app.use("/api/referrals", referralRoutes);
  console.log("🔗 Referral routes registered at /api/referrals");
} catch (error) {
  console.error("❌ Failed to load Referral routes:", error.message);
}

// Admin routes
try {
  const adminRoutes = require("./routes/admin");
  app.use("/api/admin", adminRoutes);
  console.log("🔗 Admin routes registered at /api/admin");
} catch (error) {
  console.error("❌ Failed to load Admin routes:", error.message);
  console.error("❌ Full admin routes error:", error);
}

// Quick Pickup routes (new)
try {
  const quickPickupRoutes = require("./routes/quick-pickup");
  app.use("/api/quick-pickup", quickPickupRoutes);
  console.log("🔗 Quick Pickup routes registered at /api/quick-pickup");
} catch (error) {
  console.error("❌ Failed to load Quick Pickup routes:", error.message);
  console.error("❌ Full quick pickup routes error:", error);
}

// Quick Book routes (legacy support)
try {
  const quickBookRoutes = require("./routes/quick-book");
  app.use("/api/quick-book", quickBookRoutes);
  console.log("🔗 Quick Book routes registered at /api/quick-book (legacy support)");
} catch (error) {
  console.error("❌ Failed to load Quick Book routes:", error.message);
  console.error("❌ Full quick book routes error:", error);
}

// Rider routes
try {
  const riderRoutes = require("./routes/riders");
  app.use("/api/riders", riderRoutes);
  console.log("🔗 Rider routes registered at /api/riders");
} catch (error) {
  console.error("❌ Failed to load Rider routes:", error.message);
  console.error("❌ Full rider routes error:", error);
}

// Notification routes
try {
  const notificationRoutes = require("./routes/notifications");
  app.use("/api/notifications", notificationRoutes);
  console.log("🔗 Notification routes registered at /api/notifications");
} catch (error) {
  console.error("❌ Failed to load Notification routes:", error.message);
  console.error("❌ Full notification routes error:", error);
}

// Google Sheets integration removed

// Push notification endpoints
app.post("/api/push/subscribe", (req, res) => {
  // Store push subscription in database
  // In production, save this to your user's profile
  console.log("Push subscription received:", req.body);
  res.json({ success: true });
});

app.post("/api/push/unsubscribe", (req, res) => {
  // Remove push subscription from database
  console.log("Push unsubscribe request");
  res.json({ success: true });
});

// Helper function to get IST timestamp
const getISTTimestamp = () => {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // UTC + 5:30
  return istTime.toISOString().replace('Z', '+05:30');
};

// Health check endpoint with comprehensive monitoring
app.get("/api/health", async (req, res) => {
  const healthCheck = {
    status: "ok",
    timestamp: getISTTimestamp(),
    utc_timestamp: new Date().toISOString(),
    service: "CleanCare Pro API",
    version: "1.0.0",
    environment: productionConfig.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: "unknown",
    features: productionConfig.FEATURES,
  };

  // Check database connection
  try {
    if (mongoose.connection.readyState === 1) {
      healthCheck.database = "connected";
    } else {
      healthCheck.database = "disconnected";
      healthCheck.status = "degraded";
    }
  } catch (error) {
    healthCheck.database = "error";
    healthCheck.status = "unhealthy";
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  if (memoryUsage.heapUsed > productionConfig.MEMORY_THRESHOLD) {
    healthCheck.status = "degraded";
    healthCheck.warning = "High memory usage";
  }

  const statusCode =
    healthCheck.status === "ok"
      ? 200
      : healthCheck.status === "degraded"
        ? 200
        : 503;

  res.status(statusCode).json(healthCheck);
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({
    message: "CleanCare Pro API is working!",
    timestamp: getISTTimestamp(),
    timezone: "Asia/Kolkata (IST)",
    utc_timestamp: new Date().toISOString(),
  });
});

// Serve static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
console.log("📁 Static files served from /uploads");

// Serve frontend static files and handle React Router routes (only if dist exists)
const frontendPath = path.join(__dirname, "../dist");
const fs = require("fs");

if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  console.log("📁 Serving frontend static files from:", frontendPath);

  // Catch-all handler: send back React's index.html file for non-API routes
  app.get("*", (req, res) => {
    // Don't handle API routes
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }

    const indexPath = path.join(frontendPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error("Error serving index.html:", err);
        res.status(500).send("Error loading application");
      }
    });
  });
  console.log("��� SPA catch-all route configured for React Router");
} else {
  console.log("📁 Dist folder not found - running in development mode");

  // In development, only handle API 404s
  app.get("/api/*", (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("💥 Global Error Handler:", err);

  // Log error details in production
  if (productionConfig.isProduction()) {
    console.error("Error Stack:", err.stack);
    console.error("Request Details:", {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    });
  }

  // Return appropriate error response
  const statusCode = err.statusCode || 500;
  const message = productionConfig.isProduction()
    ? "Internal server error"
    : err.message || "Something went wrong";

  res.status(statusCode).json({
    success: false,
    message,
    error: productionConfig.isDevelopment() ? err.stack : undefined,
    timestamp: getISTTimestamp(),
    timezone: "Asia/Kolkata (IST)",
  });
});

// Development root route to prevent 404s
if (productionConfig.isDevelopment()) {
  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "CleanCare Pro API Server",
      environment: "development",
      frontend: "http://localhost:10000",
      api: "http://localhost:3001/api",
      availableRoutes: [
        "/api/health",
        "/api/test",
        "/api/auth",
        "/api/bookings",
        "/api/addresses",
        "/api/location",
        "/api/whatsapp",
        "/api/sheets/order",
        "/api/sheets/test",
        "/api/sheets/sync",
      ],
    });
  });
}

// Catch-all handler: send back React's index.html file for frontend routing
if (productionConfig.isProduction()) {
  app.get("*", (req, res) => {
    // Only handle 404 for API routes, serve React app for all other routes
    if (req.originalUrl.startsWith('/api/')) {
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
          "/api/health",
          "/api/test",
          "/api/auth",
          "/api/bookings",
          "/api/addresses",
          "/api/location",
          "/api/whatsapp",
          "/api/admin",
          "/api/quick-book",
        ],
      });
    } else {
      res.sendFile(path.join(__dirname, "../dist/index.html"));
    }
  });
  console.log(
    "🔗 Frontend routing configured - all non-API routes serve index.html",
  );
} else {
  // In development mode, provide helpful redirect for non-API routes
  app.get("*", (req, res) => {
    // Only show helpful message for non-API routes
    if (!req.path.startsWith("/api/")) {
      res.send(`
        <html>
          <head><title>Backend Server - Redirect Required</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #C46DD8;">🔄 Redirect Required</h1>
              <p>You're accessing the <strong>backend server</strong>, but you need the <strong>frontend</strong> for the Rider Portal.</p>

              <h3>For the Rider System:</h3>
              <ul>
                <li><strong>Frontend URL:</strong> <a href="http://localhost:10000${req.path}">http://localhost:10000${req.path}</a></li>
                <li><strong>Current URL:</strong> ${req.protocol}://${req.get('host')}${req.path} (Backend API server)</li>
              </ul>

              <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <strong>💡 Solution:</strong> Access the rider portal at the frontend URL above.
              </div>

              <p><small>This is the backend API server. The React app (rider portal) runs on a separate frontend server.</small></p>
            </div>
          </body>
        </html>
      `);
    } else {
      res.status(404).json({ error: "API endpoint not found" });
    }
  });
  console.log("🔧 Development mode: Providing redirect help for frontend routes");
}

// Keep-alive mechanism for Render deployment
const setupKeepAlive = () => {
  if (productionConfig.isProduction()) {
    const keepAliveInterval = 5 * 60 * 1000; // 5 minutes in milliseconds

    setInterval(async () => {
      try {
        const url =
          process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        const response = await fetch(`${url}/api/health`);

        if (response.ok) {
          console.log("🔄 Keep-alive ping successful");
        } else {
          console.log(
            "⚠��� Keep-alive ping failed with status:",
            response.status,
          );
        }
      } catch (error) {
        console.log("⚠️ Keep-alive ping error:", error.message);
      }
    }, keepAliveInterval);

    console.log("🔄 Keep-alive mechanism started (5 min intervals)");
  }
};

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`🚀 CleanCare Pro server running on port ${PORT}`);
  console.log(`📱 Environment: ${productionConfig.NODE_ENV}`);
  if (productionConfig.isProduction()) {
    console.log(`🌐 Frontend and API available at: http://localhost:${PORT}`);
  } else {
    console.log(`�� API available at: http://localhost:${PORT}/api`);
  }
  console.log(`��� Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔒 Security: Helmet enabled`);
  console.log(`⚡ Compression: Enabled`);
  console.log(`🛡��  Rate limiting: Enabled`);

  if (productionConfig.FEATURES.SMS_VERIFICATION) {
    console.log(`📱 SMS Service: DVHosting`);
  }

  // Start keep-alive mechanism
  setupKeepAlive();

  // Google Sheets integration removed
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n�� Received ${signal}. Starting graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      console.error("❌ Error during server shutdown:", err);
      process.exit(1);
    }

    console.log("✅ HTTP server closed");

    // Cleanup Google Sheets service
    if (sheetsService) {
      await sheetsService.cleanup();
    }

    // Close database connection
    mongoose.connection.close(false, (err) => {
      if (err) {
        console.error("❌ Error closing MongoDB connection:", err);
        process.exit(1);
      }

      console.log("✅ MongoDB connection closed");
      console.log("👋 Graceful shutdown completed");
      process.exit(0);
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error("⚠️  Forced shutdown after 30 seconds");
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("��� Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  mongoose.connection.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  mongoose.connection.close();
  process.exit(0);
});

module.exports = app;
