#!/usr/bin/env node

const { spawn } = require('child_process');
const { setTimeout } = require('timers');

console.log('🚀 Starting both frontend and backend servers...');

// Start backend first
console.log('📡 Starting backend server on port 3001...');
const backendProcess = spawn('node', ['simple-backend.cjs'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: __dirname
});

// Log backend output with prefix
backendProcess.stdout.on('data', (data) => {
  process.stdout.write(`[BACKEND] ${data}`);
});

backendProcess.stderr.on('data', (data) => {
  process.stderr.write(`[BACKEND] ${data}`);
});

// Wait a moment for backend to start, then start frontend
setTimeout(() => {
  console.log('🎨 Starting frontend server...');
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });

  // Log frontend output with prefix
  frontendProcess.stdout.on('data', (data) => {
    process.stdout.write(`[FRONTEND] ${data}`);
  });

  frontendProcess.stderr.on('data', (data) => {
    process.stderr.write(`[FRONTEND] ${data}`);
  });

  frontendProcess.on('error', (err) => {
    console.error('❌ Failed to start frontend server:', err);
  });

  frontendProcess.on('close', (code) => {
    console.log(`❌ Frontend server exited with code ${code}`);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down servers...');
    frontendProcess.kill('SIGINT');
    backendProcess.kill('SIGINT');
    setTimeout(() => process.exit(0), 1000);
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down servers...');
    frontendProcess.kill('SIGTERM');
    backendProcess.kill('SIGTERM');
    setTimeout(() => process.exit(0), 1000);
  });

}, 2000); // Wait 2 seconds for backend to start

backendProcess.on('error', (err) => {
  console.error('❌ Failed to start backend server:', err);
  process.exit(1);
});

backendProcess.on('close', (code) => {
  console.log(`❌ Backend server exited with code ${code}`);
});
