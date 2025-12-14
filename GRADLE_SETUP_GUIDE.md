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

### 🚨 Windows - If Gradle Wrapper Jar is Still Missing

If you still get `Unable to access jarfile` error on Windows:

**Option 1: Initialize using Command Prompt (Recommended)**
```cmd
cd android
gradlew.bat --version
cd ..
npm run build:aab
```

**Option 2: Delete and Regenerate Android Project**
```bash
rm -r android
npx cap add android
npm run build:aab
```

### Troubleshooting

**Verify Java is installed:**
```bash
java -version
# Should show JDK 11 or higher
```

**Clear Gradle cache and retry:**
```bash
rm -rf android/.gradle
npm run setup:gradle
npm run build:aab
```

**Check if gradlew scripts exist:**
```bash
ls android/gradlew*        # macOS/Linux
dir android\gradlew*       # Windows
```

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
