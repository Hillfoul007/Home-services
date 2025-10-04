#!/usr/bin/env node

// Simple script to start the backend server
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting backend server...');

const backendProcess = spawn('node', ['standalone-backend.cjs'], {
  stdio: 'inherit',
  cwd: __dirname
});

backendProcess.on('error', (err) => {
  console.error('❌ Failed to start backend server:', err);
  process.exit(1);
});

backendProcess.on('close', (code) => {
  console.log(`❌ Backend server exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Shutting down backend server...');
  backendProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down backend server...');
  backendProcess.kill('SIGTERM');
});
