#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNDLE_SIZE_LIMITS = {
  "index.js": 500, // KB
  "vendor.js": 800, // KB
  total: 1500, // KB total for all chunks
};

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return Math.round(stats.size / 1024); // KB
  } catch (error) {
    return 0;
  }
}

function analyzeBundles() {
  const distPath = path.join(process.cwd(), "dist");
  const assetsPath = path.join(distPath, "assets");

  if (!fs.existsSync(assetsPath)) {
    console.log('❌ Build assets not found. Run "npm run build" first.');
    process.exit(1);
  }

  const files = fs.readdirSync(assetsPath);
  const jsFiles = files.filter((file) => file.endsWith(".js"));
  const cssFiles = files.filter((file) => file.endsWith(".css"));

  let totalSize = 0;
  const results = [];

  console.log("\n📊 Bundle Size Analysis\n");
  console.log("JavaScript Files:");
  console.log("─".repeat(50));

  jsFiles.forEach((file) => {
    const filePath = path.join(assetsPath, file);
    const size = getFileSize(filePath);
    totalSize += size;

    const displayName = file.includes("index")
      ? "index.js"
      : file.includes("vendor")
        ? "vendor.js"
        : file;

    const limit = BUNDLE_SIZE_LIMITS[displayName] || 300;
    const status = size > limit ? "⚠️ " : "✅";

    console.log(
      `${status} ${displayName.padEnd(20)} ${size.toString().padStart(6)} KB`,
    );

    results.push({ file: displayName, size, limit, status: size <= limit });
  });

  console.log("\nCSS Files:");
  console.log("─".repeat(50));

  cssFiles.forEach((file) => {
    const filePath = path.join(assetsPath, file);
    const size = getFileSize(filePath);
    totalSize += size;

    const status = size > 100 ? "⚠️ " : "✅";
    console.log(
      `${status} ${file.padEnd(20)} ${size.toString().padStart(6)} KB`,
    );
  });

  console.log("\nSummary:");
  console.log("─".repeat(50));

  const totalStatus = totalSize > BUNDLE_SIZE_LIMITS.total ? "⚠️ " : "✅";
  console.log(
    `${totalStatus} Total Size:          ${totalSize.toString().padStart(6)} KB`,
  );
  console.log(
    `   Size Limit:          ${BUNDLE_SIZE_LIMITS.total.toString().padStart(6)} KB`,
  );

  if (totalSize > BUNDLE_SIZE_LIMITS.total) {
    console.log("\n❌ Bundle size exceeds recommended limits!");
    console.log("Recommendations:");
    console.log("• Enable code splitting for large components");
    console.log("• Use dynamic imports for non-critical features");
    console.log("• Consider tree shaking unused dependencies");
    process.exit(1);
  } else {
    console.log("\n✅ Bundle size is within recommended limits!");
  }
}

analyzeBundles();
