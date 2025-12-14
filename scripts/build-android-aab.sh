#!/bin/bash

# Build signed Android App Bundle (AAB) for Google Play
# Usage: npm run build:aab
# or: chmod +x scripts/build-android-aab.sh && ./scripts/build-android-aab.sh

set -e

KEYSTORE_FILE="laundrify-release-keystore.jks"
OUTPUT_DIR="dist-aab"

echo "🏗️  Building Android App Bundle (AAB) for Google Play..."
echo ""

# Step 0: Check if Android project exists
if [ ! -d "android" ]; then
    echo "❌ Android project not found. Run 'npx cap add android' first."
    exit 1
fi

# Step 0b: Initialize Gradle wrapper if needed
if [ ! -f "android/gradle/wrapper/gradle-wrapper.jar" ]; then
    echo "📥 Initializing Gradle wrapper (first time only)..."
    bash scripts/init-gradle.sh || true
fi

# Step 1: Check if keystore exists
if [ ! -f "$KEYSTORE_FILE" ]; then
    echo "❌ Keystore file not found: $KEYSTORE_FILE"
    echo ""
    echo "Generate it with: npm run generate:keystore"
    echo "Or: bash scripts/generate-keystore.sh"
    exit 1
fi

# Step 3: Build web assets
echo "📦 Step 1/3: Building web assets..."
npm run build

# Step 4: Sync web assets to Android
echo "📦 Step 2/3: Syncing web assets to Android..."
npx cap sync android

# Step 5: Build AAB
echo "📦 Step 3/3: Building signed AAB..."
echo ""
echo "Switching to android directory..."
cd android

# Check if gradle wrapper scripts exist
if [ ! -f "gradlew" ] && [ ! -f "gradlew.bat" ]; then
    echo "❌ Gradle wrapper not found. Please run 'npx cap add android' first."
    exit 1
fi

# Make gradle executable on Unix
chmod +x gradlew 2>/dev/null || true

# Check if keystore passwords are set
if [ -z "$MYAPP_RELEASE_STORE_PASSWORD" ] && [ -z "$MYAPP_RELEASE_KEY_PASSWORD" ]; then
    echo "⚠️  Signing passwords not set as environment variables."
    echo ""
    echo "For automated builds, set:"
    echo "  export MYAPP_RELEASE_STORE_PASSWORD=your_keystore_password"
    echo "  export MYAPP_RELEASE_KEY_PASSWORD=your_key_password"
    echo ""
    echo "🚀 Running Gradle bundleRelease..."
    echo "You will be prompted for passwords interactively."
else
    echo "✅ Using environment variable passwords"
fi

echo ""
echo "📦 Building Android App Bundle..."
echo "This may take 3-5 minutes..."
echo ""

# Run gradle build - use proper path handling for Windows and Unix
if [ -f "gradlew.bat" ]; then
    # Windows - run from current directory
    cmd /c gradlew.bat bundleRelease
elif [ -f "gradlew" ]; then
    # Unix - make executable and run
    ./gradlew bundleRelease
else
    echo "❌ Neither gradlew.bat nor gradlew found"
    exit 1
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    
    # Find the generated AAB
    AAB_FILE=$(find . -name "*.aab" -type f -exec ls -t {} + | head -1)
    
    if [ -n "$AAB_FILE" ]; then
        echo "📱 App Bundle location:"
        echo "   $AAB_FILE"
        echo ""
        echo "📋 Next steps:"
        echo "   1. Go to Google Play Console: https://play.google.com/console"
        echo "   2. Create a new app (or select existing)"
        echo "   3. Go to 'Testing' → 'Internal Testing'"
        echo "   4. Click 'Upload new build' and select the .aab file"
        echo "   5. Test on internal testing track before releasing"
        echo ""
        echo "🔐 Signing details:"
        echo "   - Keystore: $(pwd)/../$KEYSTORE_FILE"
        echo "   - Package ID: com.laundrify.app"
        echo "   - Version: Check android/app/build.gradle for versionCode/versionName"
    else
        echo "⚠️  Could not find generated .aab file"
    fi
else
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi

cd ..
