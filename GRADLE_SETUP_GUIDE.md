# Gradle Wrapper Setup Guide

## Problem
When cloning or pulling the code, the `gradle-wrapper.jar` file may not download automatically, causing AAB builds to fail with:
```
Error: Unable to access jarfile .../android/gradle/wrapper/gradle-wrapper.jar
```

## Solution
The project automatically handles Gradle setup. But if it fails, you can fix it manually.

### ✅ Automatic Setup (happens automatically)
```bash
npm install
# This automatically runs "postinstall" hook which sets up gradle-wrapper.jar
```

### 🔧 Manual Setup (if automatic fails)
Run this command before building:
```bash
npm run setup:gradle
```

Then try building again:
```bash
npm run build:aab
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
