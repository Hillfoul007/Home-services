#!/bin/bash

# Simple AAB builder that works on Windows without gradle wrapper issues

set -e

KEYSTORE_FILE="laundrify-release-keystore.jks"

echo "🏗️  Building Android App Bundle (AAB) for Google Play..."
echo ""

# Step 1: Build web assets
echo "📦 Step 1/2: Building web assets..."
npm run build

# Step 2: Sync to Android
echo "📦 Step 2/3: Syncing to Android..."
npx cap sync android

# Step 3: Build AAB using gradlew directly from android directory
echo "📦 Step 3/4: Preparing build..."

if [ ! -f "$KEYSTORE_FILE" ]; then
    echo "❌ Keystore not found: $KEYSTORE_FILE"
    echo "Generate with: npm run generate:keystore"
    exit 1
fi

cd android

echo "🔨 Building AAB (this takes 2-3 minutes)..."
echo ""
echo "When prompted, enter your keystore and key passwords."
echo ""

# Windows uses .bat, Unix uses shell script
if [ -f "gradlew.bat" ]; then
    # Windows batch file
    cmd /c gradlew.bat bundleRelease
else
    # Unix shell script
    chmod +x gradlew
    ./gradlew bundleRelease
fi

cd ..

# Check if build was successful
if [ -f "android/app/build/outputs/bundle/release/app-release.aab" ]; then
    echo ""
    echo "✅ AAB built successfully!"
    echo ""
    echo "📱 Location: android/app/build/outputs/bundle/release/app-release.aab"
    echo ""
    echo "📋 Next: Upload to Google Play Console"
    echo "   1. Go to https://play.google.com/console"
    echo "   2. Create app → Internal Testing"
    echo "   3. Upload the AAB file"
else
    echo "❌ Build completed but AAB not found"
    echo "Check android/app/build/outputs/bundle/release/ directory"
    exit 1
fi
