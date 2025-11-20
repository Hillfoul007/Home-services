#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔨 Building frontend...');

try {
  // Run Vite build with memory constraints and minimal output
  const buildCmd = 'npx vite build --config vite.render.config.ts --mode production --report-compressed-size false';
  
  console.log(`📦 Running: ${buildCmd}\n`);
  
  execSync(buildCmd, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=512',
      CI: 'true' // Minimal output for CI environments
    }
  });

  // Verify dist folder was created
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      console.log('\n✅ Frontend build completed successfully');
      console.log(`📁 Built frontend location: ${distPath}`);
      process.exit(0);
    } else {
      console.error('❌ Build failed: index.html not found in dist folder');
      process.exit(1);
    }
  } else {
    console.error('❌ Build failed: dist folder not created');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
