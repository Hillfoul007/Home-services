#!/usr/bin/env node

/**
 * Initialize Gradle wrapper by downloading gradle-wrapper.jar
 * Run this after cloning or pulling to ensure gradle is ready
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const gradleWrapperDir = path.join(__dirname, '../android/gradle/wrapper');
const gradleWrapperJar = path.join(gradleWrapperDir, 'gradle-wrapper.jar');

console.log('🔧 Setting up Gradle wrapper...');

// Check if jar exists
if (fs.existsSync(gradleWrapperJar)) {
  console.log('✅ Gradle wrapper jar already exists');
  process.exit(0);
}

console.log('📥 Downloading Gradle wrapper jar...');

try {
  // Try to run gradlew to trigger automatic download
  const isWindows = process.platform === 'win32';
  const gradleCmd = isWindows ? '.\\gradlew.bat' : './gradlew';
  
  const cmd = `cd android && ${gradleCmd} --version`;
  console.log(`Running: ${cmd}`);
  
  execSync(cmd, { stdio: 'inherit' });
  
  if (fs.existsSync(gradleWrapperJar)) {
    console.log('✅ Gradle wrapper jar downloaded successfully!');
  } else {
    console.warn('⚠️  Gradle wrapper jar not found after running gradlew');
    console.warn('Try running manually: cd android && ./gradlew --version');
  }
} catch (error) {
  console.error('❌ Error setting up Gradle wrapper:', error.message);
  console.log('\n📖 Please run manually:');
  console.log('   cd android');
  console.log('   ./gradlew.bat --version  (Windows)');
  console.log('   ./gradlew --version      (macOS/Linux)');
  process.exit(1);
}
