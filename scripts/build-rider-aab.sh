#!/bin/bash
# Build signed AAB for Laundrify Rider app
# Usage: npm run build:aab:rider

set -e

KEYSTORE_FILE="laundrify-release-keystore.jks"
APP_FLAVOR="rider"
DIST_DIR="dist-${APP_FLAVOR}"
APP_ID="com.laundrify.rider.app"
APP_NAME="Laundrify Rider"
VERSION_CODE=58
VERSION_NAME="2.58"
DEFAULT_APP_ID="com.laundrify.laundry.app"
DEFAULT_APP_NAME="Laundrify"

echo "🏍️  Building Rider App Bundle (AAB)..."
echo ""

# Step 1: Check keystore
if [ ! -f "$KEYSTORE_FILE" ]; then
  echo "❌ Keystore not found: $KEYSTORE_FILE"
  echo "   Run: npm run generate:keystore"
  exit 1
fi

# Cleanup function to restore original files on exit (success or failure)
cleanup() {
  echo "🔄 Restoring original configs..."
  if [ -f "capacitor.config.ts.bak" ]; then
    cp capacitor.config.ts.bak capacitor.config.ts
  fi
  # Restore build.gradle (applicationId + versionCode/versionName)
  sed -i "s|applicationId \"${APP_ID}\"|applicationId \"${DEFAULT_APP_ID}\"|g" android/app/build.gradle
  sed -i "s|versionCode [0-9]*|versionCode ${VERSION_CODE}|g" android/app/build.gradle
  sed -i "s|versionName \"[0-9.]*\"|versionName \"${VERSION_NAME}\"|g" android/app/build.gradle
  # Restore strings.xml
  sed -i "s|<string name=\"app_name\">${APP_NAME}</string>|<string name=\"app_name\">${DEFAULT_APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"title_activity_main\">${APP_NAME}</string>|<string name=\"title_activity_main\">${DEFAULT_APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"package_name\">${APP_ID}</string>|<string name=\"package_name\">${DEFAULT_APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"custom_url_scheme\">${APP_ID}</string>|<string name=\"custom_url_scheme\">${DEFAULT_APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
}
trap cleanup EXIT

# Step 2: Build web assets
echo "📦 Step 1/5: Building web assets..."
cmd.exe /c "npm run build"

# Step 3: Create rider-specific dist with hash-based route redirect
echo "📦 Step 2/5: Preparing rider web assets..."
rm -rf "$DIST_DIR"
# Use PowerShell Copy-Item on Windows to handle filenames with spaces reliably
powershell.exe -Command "Copy-Item -Path 'dist' -Destination '$DIST_DIR' -Recurse"

# Inject hash-based route redirect so app starts at /#/rider-desk/dashboard (HashRouter)
REDIRECT_SCRIPT='<script>if(!window.location.hash||window.location.hash==="#/"||window.location.hash==="#"){window.location.hash="#/rider-desk/dashboard";}<\/script>'
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s%</head>%${REDIRECT_SCRIPT}</head>%" "${DIST_DIR}/index.html"
else
  sed -i "s%</head>%${REDIRECT_SCRIPT}</head>%" "${DIST_DIR}/index.html"
fi

# Step 4: Swap Capacitor config and update Android project
echo "📦 Step 3/5: Configuring Android project for Rider..."
cp capacitor.config.ts capacitor.config.ts.bak
cp capacitor.rider.config.ts capacitor.config.ts

# Step 5: Sync with Capacitor (must run BEFORE build.gradle/strings.xml changes — cap sync overwrites strings.xml)
echo "📦 Step 4/5: Syncing with Capacitor..."
cmd.exe /c "npx cap sync android"

# Fix: ensure cordova plugins res directory has valid structure for Gradle
CORDOVA_RES="android/capacitor-cordova-android-plugins/src/main/res"
if [ -d "$CORDOVA_RES" ] && [ ! -d "$CORDOVA_RES/values" ]; then
  mkdir -p "$CORDOVA_RES/values"
  echo '<?xml version="1.0" encoding="utf-8"?><resources></resources>' > "$CORDOVA_RES/values/strings.xml"
fi

# Update applicationId and version in build.gradle (AFTER cap sync)
# NOTE: Do NOT change namespace — it must match the Java package (com.laundrify.laundry.app) or MainActivity won't be found
sed -i "s|applicationId \"${DEFAULT_APP_ID}\"|applicationId \"${APP_ID}\"|g" android/app/build.gradle
sed -i "s|versionCode [0-9]*|versionCode ${VERSION_CODE}|g" android/app/build.gradle
sed -i "s|versionName \"[0-9.]*\"|versionName \"${VERSION_NAME}\"|g" android/app/build.gradle

# Update strings.xml with rider app name and package (AFTER cap sync — it overwrites strings.xml)
sed -i "s|<string name=\"app_name\">${DEFAULT_APP_NAME}</string>|<string name=\"app_name\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"title_activity_main\">${DEFAULT_APP_NAME}</string>|<string name=\"title_activity_main\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"package_name\">${DEFAULT_APP_ID}</string>|<string name=\"package_name\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"custom_url_scheme\">${DEFAULT_APP_ID}</string>|<string name=\"custom_url_scheme\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml

# Step 6: Build signed AAB
echo "📦 Step 5/5: Building signed AAB..."
chmod +x android/gradlew 2>/dev/null || true
# Stop stale Gradle daemons and clean build dir to avoid file-lock errors on Windows
(cd android && powershell.exe -Command "./gradlew.bat --stop") 2>/dev/null || true
rm -rf android/app/build 2>/dev/null || true
if [ -f "android/gradlew.bat" ]; then
  (cd android && powershell.exe -Command "./gradlew.bat bundleRelease")
else
  (cd android && ./gradlew bundleRelease)
fi

# Copy output
mkdir -p dist-aab
AAB_FILE="android/app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_FILE" ]; then
  cp "$AAB_FILE" "dist-aab/laundrify-rider-release.aab"
  echo ""
  echo "✅ Rider AAB built successfully!"
  echo "   📱 Output: dist-aab/laundrify-rider-release.aab"
  echo "   📋 App ID: ${APP_ID}"
  echo "   📋 App Name: ${APP_NAME}"
else
  echo "⚠️  AAB file not found at: $AAB_FILE"
  exit 1
fi
