#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 Starting MongoDB-powered Home Services App...\n");

// Start backend server
console.log("📡 Starting backend server...");
const backend = spawn("node", ["server/index.js"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

// Wait a bit for backend to start, then start frontend
setTimeout(() => {
  console.log("\n🎨 Starting frontend development server...");
  const frontend = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
  });

  // Handle process termination
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down servers...");
    backend.kill();
    frontend.kill();
    process.exit(0);
  });

  frontend.on("close", (code) => {
    console.log(`Frontend process exited with code ${code}`);
    backend.kill();
    process.exit(code);
  });
}, 3000);

backend.on("close", (code) => {
  console.log(`Backend process exited with code ${code}`);
  process.exit(code);
});

backend.on("error", (err) => {
  console.error("❌ Failed to start backend:", err);
  process.exit(1);
});

console.log("\n📋 Server Information:");
console.log("  - Backend API: http://localhost:3001");
console.log("  - Frontend App: http://localhost:8080");
console.log("  - Health Check: http://localhost:3001/health");
console.log("\n💡 Tip: Make sure to set your MongoDB password in .env file");
console.log("🔧 Press Ctrl+C to stop both servers\n");
