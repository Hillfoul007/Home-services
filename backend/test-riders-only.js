const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3002;

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server running' });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// Try to load rider routes only
try {
  console.log('Loading rider routes...');
  const riderRoutes = require("./routes/riders");
  app.use("/api/riders", riderRoutes);
  console.log("✅ Rider routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load rider routes:", error);
  console.error("Stack trace:", error.stack);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
});
