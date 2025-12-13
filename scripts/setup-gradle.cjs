#!/usr/bin/env node

/**
 * Ensure Gradle wrapper jar is present
 * Handles both initial setup and recovery from missing jar file
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const GRADLE_WRAPPER_JAR = path.join(__dirname, '../android/gradle/wrapper/gradle-wrapper.jar');
const GRADLE_WRAPPER_DIR = path.dirname(GRADLE_WRAPPER_JAR);

console.log('🔧 Checking Gradle wrapper...');

if (fs.existsSync(GRADLE_WRAPPER_JAR)) {
  console.log('✅ Gradle wrapper jar exists');
  process.exit(0);
}

console.log('⚠️  Gradle wrapper jar missing, initializing...');

try {
  // Ensure directory exists
  if (!fs.existsSync(GRADLE_WRAPPER_DIR)) {
    fs.mkdirSync(GRADLE_WRAPPER_DIR, { recursive: true });
    console.log('📁 Created gradle wrapper directory');
  }

  const isWindows = process.platform === 'win32';
  const androidDir = path.join(__dirname, '../android');
  
  // Make wrapper scripts executable (Unix only)
  if (!isWindows) {
    try {
      execSync('chmod +x ./gradlew', { cwd: androidDir, stdio: 'pipe' });
    } catch (e) {
      // Not critical
    }
  }

  console.log('⏳ Running gradle initialization (this may take a minute)...');
  
  try {
    // This should trigger automatic jar download
    const cmd = isWindows ? 'gradlew.bat --version' : './gradlew --version';
    execSync(cmd, { cwd: androidDir, stdio: 'pipe', timeout: 60000 });
  } catch (error) {
    // Gradle might fail on first run but jar might still exist
    // Continue to check
  }

  // Verify jar was created
  if (fs.existsSync(GRADLE_WRAPPER_JAR)) {
    console.log('✅ Gradle wrapper initialized successfully!');
    process.exit(0);
  }

  console.log('⚠️  Gradle wrapper jar not yet available');
  console.log('   It will be downloaded on first gradle task execution');
  process.exit(0);

} catch (error) {
  console.error('❌ Error during Gradle setup:', error.message);
  console.log('\n💡 Try manual initialization:');
  console.log('   cd android');
  console.log('   ./gradlew --version        (macOS/Linux)');
  console.log('   gradlew.bat --version      (Windows Command Prompt)');
  console.log('\n📚 More info: https://gradle.org/install');
  process.exit(1);
}
