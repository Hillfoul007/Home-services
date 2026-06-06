#!/bin/bash

# Build signed Android App Bundle (AAB) for Google Play
# Usage: npm run build:aab
# This builds the default User app. For specific apps use:
#   npm run build:aab:user   - User (Customer) app
#   npm run build:aab:rider  - Rider app
#   npm run build:aab:desk   - Desk app
#   npm run build:aab:all    - All three apps

set -e

KEYSTORE_FILE="laundrify-release-keystore.jks"
OUTPUT_DIR="dist-aab"

echo "🏗️  Building Android App Bundle (AAB) for Google Play..."
echo ""

# Step 1: Check if Android project exists
if [ ! -d "android" ]; then
    echo "❌ Android project not found. Run 'npx cap add android' first."
    exit 1
fi

# Step 2: Check if keystore exists
if [ ! -f "$KEYSTORE_FILE" ]; then
    echo "❌ Keystore file not found: $KEYSTORE_FILE"
    echo ""
    echo "Generate it with: npm run generate:keystore"
    exit 1
fi

# Step 3: Build web assets
echo "📦 Step 1/3: Building web assets..."
cmd.exe /c "npm run build"

# Step 4: Sync web assets to Android
echo "📦 Step 2/3: Syncing web assets to Android..."
cmd.exe /c "npx cap sync android"

# Step 5: Build AAB
echo "📦 Step 3/3: Building signed AAB..."
chmod +x android/gradlew 2>/dev/null || true
if [ -f "android/gradlew.bat" ]; then
  (cd android && powershell.exe -Command "./gradlew.bat clean bundleRelease")
else
  (cd android && ./gradlew clean bundleRelease)
fi

# Copy output
mkdir -p "$OUTPUT_DIR"
AAB_FILE="android/app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_FILE" ]; then
    cp "$AAB_FILE" "${OUTPUT_DIR}/laundrify-user-release.aab"
    echo ""
    echo "✅ Build successful!"
    echo "   📱 Output: ${OUTPUT_DIR}/laundrify-user-release.aab"
    echo "   📋 App ID: com.laundrify.laundry.app"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Go to Google Play Console"
    echo "   2. Upload the .aab file"
    echo "   3. Test on internal testing track"
else
    echo "⚠️  AAB file not found at: $AAB_FILE"
    exit 1
fi
