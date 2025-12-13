# Gradle Wrapper Setup Guide

## Problem
When cloning or pulling the code, the `gradle-wrapper.jar` file may not be downloaded automatically, causing builds to fail.

## Solution
The project now automatically sets up Gradle when you run `npm install`.

### Automatic Setup (Recommended)
```bash
npm install
# This automatically runs "postinstall" hook which downloads gradle-wrapper.jar
```

### Manual Setup
If you need to manually trigger Gradle setup:
```bash
npm run setup:gradle
```

### What It Does
- Detects if `android/gradle/wrapper/gradle-wrapper.jar` exists
- If missing, runs `./gradlew --version` to trigger automatic download
- Gradle wrapper then downloads the required Gradle version

### Troubleshooting

**If setup still fails:**
```bash
cd android
./gradlew.bat --version    # Windows
./gradlew --version        # macOS/Linux
```

**To verify Gradle is working:**
```bash
cd android
./gradlew.bat clean        # Windows
./gradlew clean            # macOS/Linux
```

**If gradle still doesn't work:**
- Ensure Java/JDK 11+ is installed: `java -version`
- Try clearing: `rm -rf android/.gradle`
- Then run: `npm run setup:gradle`

## After Cloning or Pulling
After you clone the repository or pull new changes:
```bash
npm install          # This auto-runs setup:gradle via postinstall
npm run build:aab    # Now ready to build AAB
```

## File Locations
- Setup script: `scripts/setup-gradle.js`
- Gradle wrapper: `android/gradle/wrapper/gradle-wrapper.jar`
- Gradle properties: `android/gradle/wrapper/gradle-wrapper.properties`

---

The gradle wrapper jar will now be automatically downloaded whenever you run `npm install`.
