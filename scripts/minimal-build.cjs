#!/usr/bin/env node

// Ultra-minimal build script for memory-constrained environments (512MB)
const { spawn } = require('child_process');

// Set very conservative memory allocation
process.env.NODE_OPTIONS = '--max-old-space-size=300';

// Function to run command with minimal memory settings
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=300',
        // Disable V8 optimization to save memory
        NODE_ENV: 'production'
      }
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
    console.log('Starting minimal build process for 512MB environment...');
    
    // Skip PWA build script to save memory
    console.log('Skipping PWA build script to conserve memory...');
    
        // Run vite build with minimal settings and render-specific config
    console.log('Starting minimal Vite build...');
    await runCommand('npx', ['vite', 'build', '--config', 'vite.render.config.ts', '--mode', 'production']);
    
    // Skip optimization script to save memory
    console.log('Skipping build optimization to conserve memory...');
    
    console.log('Minimal build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

main();
