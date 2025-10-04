const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    // Use direct MongoDB credentials
    const MONGODB_USERNAME = process.env.MONGODB_USERNAME;
    const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;

    if (!MONGODB_USERNAME || !MONGODB_PASSWORD) {
      throw new Error(
        "MongoDB credentials must be provided via environment variables",
      );
    }
    const MONGODB_CLUSTER = process.env.MONGODB_CLUSTER;
    if (!MONGODB_CLUSTER) {
      throw new Error("MONGODB_CLUSTER environment variable is required");
    }
    const MONGODB_DATABASE = process.env.MONGODB_DATABASE || "homeservices";

    const mongoURI = `mongodb+srv://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_CLUSTER}/${MONGODB_DATABASE}?retryWrites=true&w=majority`;

    console.log("🔄 Connecting to MongoDB...");
    console.log(`📍 Cluster: ${MONGODB_CLUSTER}`);
    console.log(`📚 Database: ${MONGODB_DATABASE}`);
    console.log(`👤 Username: ${MONGODB_USERNAME}`);

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000, // Keep trying to send operations for 30 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📚 Database: ${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected");
    });

    return conn;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    await mongoose.connection.close();
    console.log("🔒 MongoDB connection closed");
  } catch (error) {
    console.error("❌ Error during MongoDB shutdown:", error);
  }
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

module.exports = { connectDB, gracefulShutdown };
