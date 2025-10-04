#!/usr/bin/env node

// Memory-optimized build script for large React applications
const { spawn } = require('child_process');
const path = require('path');

// Set maximum memory allocation for constrained environments
process.env.NODE_OPTIONS = '--max-old-space-size=384';

// Function to run command with proper memory settings
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
            env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=384'
      },
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

async function main() {
  try {
    console.log('Starting memory-optimized build process...');
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('Running garbage collection...');
      global.gc();
    }
    
    // Run PWA build script first if it exists
    try {
      await runCommand('node', ['scripts/pwa-build.cjs']);
      console.log('PWA build script completed');
    } catch (error) {
      console.log('PWA build script not found or failed, continuing...');
    }
    
    // Force garbage collection between steps
    if (global.gc) {
      global.gc();
    }
    
    // Run vite build with memory optimization
    console.log('Starting Vite build...');
    await runCommand('npx', ['vite', 'build']);
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Run optimization script
    try {
      await runCommand('node', ['scripts/optimize-build.js']);
      console.log('Build optimization completed');
    } catch (error) {
      console.log('Build optimization script not found or failed, continuing...');
    }
    
    console.log('Memory-optimized build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main();
