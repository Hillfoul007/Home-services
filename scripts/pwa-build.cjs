#!/usr/bin/env node

/**
 * PWA Build Script with Cache Busting
 *
 * This script ensures proper cache invalidation for PWA updates
 */

const fs = require("fs");
const path = require("path");

function updateVersion() {
  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  // Generate a new version with timestamp for cache busting
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const currentVersion = packageJson.version.split("-")[0]; // Remove any existing timestamp
  const newVersion = `${currentVersion}-${timestamp}`;

  packageJson.version = newVersion;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`✅ Updated version to: ${newVersion}`);

  return newVersion;
}

function updateManifest() {
  const manifestPath = path.join(__dirname, "..", "public", "manifest.json");

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    // Add a cache-busting query parameter to the start_url
    const timestamp = Date.now();
    manifest.start_url = `/?v=${timestamp}`;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(
      `✅ Updated manifest start_url with cache buster: ${manifest.start_url}`,
    );
  } else {
    console.log("⚠️ No manifest.json found in public folder");
  }
}

function main() {
  console.log("🚀 Starting PWA cache-busting build...");

  try {
    // Update version for cache busting
    const newVersion = updateVersion();

    // Update manifest
    updateManifest();

    console.log("✅ PWA cache-busting preparation complete!");
    console.log("");
    console.log("🔧 Next steps:");
    console.log("1. Run: npm run build");
    console.log("2. Deploy the build");
    console.log("3. Users will automatically get the update notification");
    console.log("");
    console.log(`📦 Version: ${newVersion}`);
  } catch (error) {
    console.error("❌ Error during PWA cache-busting setup:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateVersion, updateManifest };
