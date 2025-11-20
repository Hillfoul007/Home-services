const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:10000',
    'http://localhost:10001',
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

// MongoDB Connection
const connectDB = async () => {
  try {
    const MONGODB_USERNAME = process.env.MONGODB_USERNAME;
    const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
    const MONGODB_CLUSTER = process.env.MONGODB_CLUSTER;
    const MONGODB_DATABASE = process.env.MONGODB_DATABASE || "cleancare_pro";

    if (!MONGODB_USERNAME || !MONGODB_PASSWORD || !MONGODB_CLUSTER) {
      throw new Error("MongoDB credentials not configured via environment variables");
    }

    const mongoURI = `mongodb+srv://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_CLUSTER}/${MONGODB_DATABASE}?retryWrites=true&w=majority`;

    console.log("🔄 Connecting to MongoDB...");
    console.log(`📍 Cluster: ${MONGODB_CLUSTER}`);
    console.log(`📚 Database: ${MONGODB_DATABASE}`);

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected to ${MONGODB_CLUSTER}`);
    console.log(`📚 Database: ${MONGODB_DATABASE}`);

    return true;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    return false;
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'MongoDB backend server running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'API is healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Admin routes - ONLY load this route file
try {
  const adminRoutes = require("./routes/admin");
  app.use("/api/admin", adminRoutes);
  console.log("✅ Admin routes registered at /api/admin");
} catch (error) {
  console.error("❌ Failed to load Admin routes:", error.message);
  console.error("Error details:", error);
}

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Start server
const startServer = async () => {
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    console.warn("⚠️ Running without database connection");
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 MongoDB Backend Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📍 Admin Stats: http://localhost:${PORT}/api/admin/stats\n`);
  });
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await mongoose.connection.close();
  process.exit(0);
});
