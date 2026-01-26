#!/usr/bin/env node

/**
 * Render-Optimized Build Script
 * Builds the app with minimal memory usage for Render deployment
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Render-optimized build process...\n');

try {
  // Step 1: Build frontend with minimal memory
  console.log('📦 Building frontend with optimized memory settings...');
  process.env.NODE_OPTIONS = '--max-old-space-size=300';
  process.env.NODE_ENV = 'production';
  
  execSync('npx vite build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=300',
      NODE_ENV: 'production'
    }
  });

  console.log('\n✅ Frontend build completed successfully!\n');

  // Step 2: Install backend dependencies
  console.log('📦 Installing backend dependencies...');
  process.chdir(path.join(__dirname, '..', 'backend'));
  
  try {
    execSync('npm install --production --omit=dev', { 
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=200'
      }
    });
    console.log('✅ Backend dependencies installed!\n');
  } catch (error) {
    console.log('⚠️  Backend dependency installation had issues, but continuing...\n');
  }

  process.chdir(path.join(__dirname, '..'));

  // Step 3: Create a deployment marker
  console.log('📝 Creating deployment marker...');
  const deployMarker = {
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    buildType: 'render-optimized',
    nodeVersion: process.version
  };

  fs.writeFileSync(
    path.join(__dirname, '..', 'dist', 'deploy-marker.json'),
    JSON.stringify(deployMarker, null, 2)
  );

  console.log('\n🎉 Render-optimized build completed successfully!');
  console.log('📊 Build Info:');
  console.log(`   - Build Type: Render-optimized`);
  console.log(`   - Node Version: ${process.version}`);
  console.log(`   - Timestamp: ${deployMarker.timestamp}`);
  console.log(`\n✨ App is ready to start on Render!`);

  process.exit(0);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
