#!/usr/bin/env node

// Optimized build script for Render.com's 512MB memory constraint
const { spawn } = require('child_process');

// Memory configuration for 512MB environments
// Using 400MB heap with aggressive GC tuning
const buildEnv = {
  ...process.env,
  NODE_OPTIONS: '--max-old-space-size=400',
  NODE_ENV: 'production',
};

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    console.log(`Environment: NODE_OPTIONS=${buildEnv.NODE_OPTIONS}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: buildEnv,
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
    console.log('Starting optimized build for Render.com deployment...');
    console.log('Memory configuration: 400MB heap, 512MB total available');
    console.log('');
    
    console.log('Step 1: Building with Vite...');
    await runCommand('npx', ['vite', 'build', '--config', 'vite.render.config.ts', '--mode', 'production']);
    
    console.log('');
    console.log('✅ Optimized build completed successfully!');
    console.log('Build artifacts are ready for deployment');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();
