# Android MainActivity Fix - Rebuild Guide

## What Was Wrong
The MainActivity class was in the wrong Java package:
- **Package name in build.gradle**: `com.laundrify.laundry` ❌
- **Actual package name should be**: `com.laundrify.laundry.app`
- **Result**: `ClassNotFoundException` when Android tried to launch the app

## What Was Fixed
1. Updated build.gradle to use correct package: `com.laundrify.laundry.app`
2. Created MainActivity in the **correct package**:
```
android/app/src/main/java/com/laundrify/laundry/app/MainActivity.java
```

## How to Rebuild

### Option 1: Using Android Studio (Recommended for Testing)
1. Open **Android Studio**
2. Open the `android/` folder as a project
3. Click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
4. Wait for the build to complete
5. The APK will be in `android/app/build/outputs/apk/debug/`
6. Test on your device using:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Option 2: Using Gradle Command (CLI)
```bash
cd android
./gradlew clean assembleDebug
```
APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option 3: Build Signed Release AAB for Play Store
```bash
cd android
./gradlew clean bundleRelease
```
AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

**Note**: You'll need to provide the signing credentials (keystore password, key alias, key password) via environment variables or gradle.properties

## Testing Before Upload
1. Build the debug APK (Option 1 or 2)
2. Install on a test device:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```
3. Verify the app launches without crashing
4. Check app functionality

## Uploading to Play Store
Once testing is successful:
1. Build the release AAB (Option 3)
2. Go to Google Play Console
3. Navigate to **Internal Testing** → **Release** section
4. Click **Create new release**
5. Upload the new AAB
6. Review the changes and click **Roll out to Internal Testing**

## Verification
After upload, monitor:
- **Testing Status**: Should show "Ready to test" (green checkmark)
- **Device Tests**: Install on test devices and verify startup
- **Logcat**: Monitor for any remaining errors

## If Issues Persist
- Check `adb logcat` for error messages
- Ensure no permission-related crashes
- Verify Capacitor configuration is correct
- Check that all required plugins are installed

