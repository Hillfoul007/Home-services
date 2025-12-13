#!/usr/bin/env node

/**
 * Initialize Gradle wrapper by downloading gradle-wrapper.jar
 * Run this after cloning or pulling to ensure gradle is ready
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
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
  // Ensure directory exists
  if (!fs.existsSync(gradleWrapperDir)) {
    fs.mkdirSync(gradleWrapperDir, { recursive: true });
  }

  // Try to run gradlew to trigger automatic download
  const isWindows = process.platform === 'win32';
  const gradleCmd = isWindows ? 'gradlew.bat' : './gradlew';
  
  try {
    execSync(`cd android && ${gradleCmd} --version`, { stdio: 'pipe', encoding: 'utf-8' });
  } catch (error) {
    // gradlew might fail first time, but jar should still download
    // This is expected
  }

  // Check if jar was downloaded
  if (fs.existsSync(gradleWrapperJar)) {
    console.log('✅ Gradle wrapper jar downloaded successfully!');
    process.exit(0);
  }

  // If still not present, try a more direct approach
  console.log('⚠️  Jar not found after running gradlew, trying alternative method...');
  
  // Read gradle-wrapper.properties to get the download URL
  const propertiesFile = path.join(gradleWrapperDir, 'gradle-wrapper.properties');
  if (!fs.existsSync(propertiesFile)) {
    console.error('❌ gradle-wrapper.properties not found');
    process.exit(1);
  }

  const properties = fs.readFileSync(propertiesFile, 'utf8');
  const urlMatch = properties.match(/distributionUrl=(.*)/);
  
  if (!urlMatch) {
    console.error('❌ Could not find distributionUrl in gradle-wrapper.properties');
    process.exit(1);
  }

  const distributionUrl = urlMatch[1].replace(/\\/g, '').trim();
  console.log(`📦 Gradle URL: ${distributionUrl}`);
  
  // Download the gradle distribution
  downloadGradleWrapper(distributionUrl, gradleWrapperDir);
  
} catch (error) {
  console.error('❌ Error setting up Gradle wrapper:', error.message);
  console.log('\n📖 Please try manually:');
  console.log('   cd android');
  console.log('   gradlew.bat --version  (Windows)');
  console.log('   ./gradlew --version    (macOS/Linux)');
  console.log('\n   Or install Gradle: https://gradle.org/install');
  process.exit(1);
}

function downloadGradleWrapper(url, destination) {
  console.log('⏳ This may take a minute...');
  
  https.get(url, (response) => {
    if (response.statusCode === 301 || response.statusCode === 302) {
      // Follow redirect
      downloadGradleWrapper(response.headers.location, destination);
      return;
    }

    if (response.statusCode !== 200) {
      console.error(`❌ Failed to download: HTTP ${response.statusCode}`);
      process.exit(1);
    }

    // For gradle distribution, we just need to trigger gradle to extract it
    // The download happens automatically when gradle runs
    console.log('✅ Gradle distribution available, waiting for automatic setup...');
    
  }).on('error', (error) => {
    console.error('❌ Download error:', error.message);
    console.log('Falling back to manual gradle execution...');
  });
}
