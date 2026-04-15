#!/bin/bash
# Build signed AAB for Laundrify User (Customer) app
# Usage: npm run build:aab:user

set -e

KEYSTORE_FILE="laundrify-release-keystore.jks"
APP_ID="com.laundrify.laundry.app"
APP_NAME="Laundrify"
VERSION_CODE=49
VERSION_NAME="2.49"

echo "📱 Building User App Bundle (AAB)..."
echo ""

# Step 1: Check keystore
if [ ! -f "$KEYSTORE_FILE" ]; then
  echo "❌ Keystore not found: $KEYSTORE_FILE"
  echo "   Run: npm run generate:keystore"
  exit 1
fi

# Cleanup function to restore original config on exit
cleanup() {
  echo "🔄 Restoring original configs..."
  if [ -f "capacitor.config.ts.bak" ]; then
    cp capacitor.config.ts.bak capacitor.config.ts
  fi
  # Ensure build.gradle has the correct user app ID (reset any leftover from other builds)
  sed -i "s|applicationId \"com.laundrify.desk.app\"|applicationId \"${APP_ID}\"|g" android/app/build.gradle
  sed -i "s|applicationId \"com.laundrify.rider.app\"|applicationId \"${APP_ID}\"|g" android/app/build.gradle
  # Ensure strings.xml has the correct user app values
  sed -i "s|<string name=\"app_name\">Laundrify Rider</string>|<string name=\"app_name\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"app_name\">Laundrify Desk</string>|<string name=\"app_name\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"title_activity_main\">Laundrify Rider</string>|<string name=\"title_activity_main\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"title_activity_main\">Laundrify Desk</string>|<string name=\"title_activity_main\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"package_name\">com.laundrify.rider.app</string>|<string name=\"package_name\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"package_name\">com.laundrify.desk.app</string>|<string name=\"package_name\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"custom_url_scheme\">com.laundrify.rider.app</string>|<string name=\"custom_url_scheme\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
  sed -i "s|<string name=\"custom_url_scheme\">com.laundrify.desk.app</string>|<string name=\"custom_url_scheme\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
}
trap cleanup EXIT

# Step 2: Build web assets
echo "📦 Step 1/4: Building web assets..."
cmd.exe /c "npm run build"

# Step 3: User app uses main dist/ directory — no route redirect needed
echo "📦 Step 2/4: User app uses default route (/) — no redirect needed."

# Step 4: Swap Capacitor config to user config and sync
echo "📦 Step 3/4: Syncing with Capacitor (User config)..."
cp capacitor.config.ts capacitor.config.ts.bak
cp capacitor.user.config.ts capacitor.config.ts

# Ensure build.gradle has the correct user app ID (reset any leftover)
sed -i "s|applicationId \"com.laundrify.desk.app\"|applicationId \"${APP_ID}\"|g" android/app/build.gradle
sed -i "s|applicationId \"com.laundrify.rider.app\"|applicationId \"${APP_ID}\"|g" android/app/build.gradle

# Ensure strings.xml has user app values
sed -i "s|<string name=\"app_name\">Laundrify Rider</string>|<string name=\"app_name\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"app_name\">Laundrify Desk</string>|<string name=\"app_name\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"title_activity_main\">Laundrify Rider</string>|<string name=\"title_activity_main\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"title_activity_main\">Laundrify Desk</string>|<string name=\"title_activity_main\">${APP_NAME}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"package_name\">com.laundrify.rider.app</string>|<string name=\"package_name\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"package_name\">com.laundrify.desk.app</string>|<string name=\"package_name\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"custom_url_scheme\">com.laundrify.rider.app</string>|<string name=\"custom_url_scheme\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml
sed -i "s|<string name=\"custom_url_scheme\">com.laundrify.desk.app</string>|<string name=\"custom_url_scheme\">${APP_ID}</string>|g" android/app/src/main/res/values/strings.xml

cmd.exe /c "npx cap sync android"

# Update versionCode and versionName in build.gradle (AFTER cap sync)
sed -i "s|versionCode [0-9]*|versionCode ${VERSION_CODE}|g" android/app/build.gradle
sed -i "s|versionName \"[0-9.]*\"|versionName \"${VERSION_NAME}\"|g" android/app/build.gradle

# Fix: ensure cordova plugins res directory has valid structure for Gradle
CORDOVA_RES="android/capacitor-cordova-android-plugins/src/main/res"
if [ -d "$CORDOVA_RES" ] && [ ! -d "$CORDOVA_RES/values" ]; then
  mkdir -p "$CORDOVA_RES/values"
  echo '<?xml version="1.0" encoding="utf-8"?><resources></resources>' > "$CORDOVA_RES/values/strings.xml"
fi

# Step 5: Build signed AAB
echo "📦 Step 4/4: Building signed AAB..."
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
  cp "$AAB_FILE" "dist-aab/laundrify-user-release.aab"
  echo ""
  echo "✅ User AAB built successfully!"
  echo "   📱 Output: dist-aab/laundrify-user-release.aab"
  echo "   📋 App ID: ${APP_ID}"
  echo "   📋 App Name: ${APP_NAME}"
else
  echo "⚠️  AAB file not found at: $AAB_FILE"
  exit 1
fi
