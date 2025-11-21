#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Increase memory significantly for build process
const MEMORY_LIMIT = '768'; // 768MB for build process
process.env.NODE_OPTIONS = `--max-old-space-size=${MEMORY_LIMIT} --experimental-modules`;

function runCommand(command, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n📦 Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_OPTIONS: `--max-old-space-size=${MEMORY_LIMIT} --experimental-modules`,
        NODE_ENV: 'production',
        // Reduce V8 memory overhead
        NODE_DISABLE_COLORS: '1',
        ...env,
      },
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Command succeeded`);
        resolve();
      } else {
        console.error(`❌ Command failed with exit code ${code}`);
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Command error:`, error);
      reject(error);
    });
  });
}

async function main() {
  try {
    console.log(`\n🚀 Starting build for memory-constrained environment (${MEMORY_LIMIT}MB heap)`);
    console.log('⚙️  Vite will use aggressive chunking strategy...\n');
    
    // Run vite build with render-specific config
    await runCommand('npx', [
      'vite',
      'build',
      '--config',
      'vite.render.config.ts',
      '--mode',
      'production',
      '--outDir',
      'dist',
      '--emptyOutDir',
    ]);
    
    console.log('\n✨ Build completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Build failed:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
