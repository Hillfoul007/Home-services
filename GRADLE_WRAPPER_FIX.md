# Gradle Wrapper JAR Missing - Fix Guide

## Problem
```
Error: Unable to access jarfile C:\Users\Kataria\Downloads\Home\android\gradle\wrapper\gradle-wrapper.jar
```

The gradle wrapper JAR file is missing and needs to be downloaded.

## Solution - Windows

### Option 1: Use the Fix Script (Recommended)
```bash
# From project root (C:\Users\Kataria\Downloads\Home\)
cd scripts
fix-gradle-windows.bat
```

OR run directly:
```bash
scripts\fix-gradle-windows.bat
```

### Option 2: Manual Fix - Download JAR Directly

1. **Check Gradle Version**
   ```bash
   cd android
   findstr distributionUrl gradle\wrapper\gradle-wrapper.properties
   ```
   Look for something like `gradle-8.13.0-all.zip`

2. **Create gradle\wrapper Directory (if missing)**
   ```bash
   mkdir gradle\wrapper
   ```

3. **Download the JAR**
   - Open browser: `https://gradle-org-downloads.s3.amazonaws.com/distributions/gradle-8.13.0-all.zip`
   - Extract the zip
   - Copy `gradle-8.13.0/lib/gradle-wrapper.jar` to `android\gradle\wrapper\`

### Option 3: Use Gradle Wrapper Command
```bash
cd android

REM Reinitialize the gradle wrapper
gradle wrapper --gradle-version 8.13.0

cd ..
```

## Verify Fix

After running the fix, check that the file exists:
```bash
dir android\gradle\wrapper\gradle-wrapper.jar
```

Should show the gradle-wrapper.jar file (size should be ~200+ KB)

## Try Building Again

Once the JAR is fixed:

```bash
cd android
./gradlew clean bundleRelease
```

Or use the npm script:
```bash
npm run build:aab
```

## If Still Having Issues

1. **Verify Java is installed:**
   ```bash
   java -version
   ```
   Should output Java version 11+

2. **Clear Android build cache:**
   ```bash
   cd android
   ./gradlew clean --offline
   ```

3. **Try building APK first (easier):**
   ```bash
   cd android
   ./gradlew clean assembleDebug
   ```

4. **Check gradle properties:**
   ```bash
   cat android\gradle\wrapper\gradle-wrapper.properties
   ```

## Common Causes

- **Network issue**: Gradle couldn't download jar due to network failure
- **Disk space**: Not enough space to download/extract gradle
- **Permissions**: User doesn't have write permissions in gradle folder
- **Java not installed**: Gradle requires Java to run
- **Corrupted download**: Previous download was incomplete

## Next Steps

Once the build succeeds:
1. APK will be at: `android\app\build\outputs\apk\debug\app-debug.apk`
2. AAB will be at: `android\app\build\outputs\bundle\release\app-release.aab`
3. Upload the AAB to Google Play Console

