const express = require("express");
const app = express();
const PORT = 3001;

app.use(express.json());

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({ message: "Test server working" });
});

// Quick book route
app.post("/api/quick-book", (req, res) => {
  console.log("📝 Quick booking request:", req.body);
  res.status(201).json({
    message: "Quick booking created successfully",
    quickBook: req.body,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
});
