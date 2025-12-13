#!/bin/bash

# Initialize Gradle wrapper by running gradle tasks
# This ensures gradle-wrapper.jar is downloaded

echo "🔧 Initializing Gradle wrapper..."

if [ ! -d "android" ]; then
    echo "❌ Android directory not found"
    exit 1
fi

cd android

# Check if jar already exists
if [ -f "gradle/wrapper/gradle-wrapper.jar" ]; then
    echo "✅ Gradle wrapper jar already exists"
    cd ..
    exit 0
fi

echo "📥 Downloading Gradle wrapper jar (this may take a minute)..."

# Ensure the wrapper scripts are executable
chmod +x gradlew 2>/dev/null || true

# Try to initialize gradle - this will download the jar if missing
# Use --help as a safe operation that just triggers initialization
if ./gradlew --help > /dev/null 2>&1; then
    echo "✅ Gradle wrapper initialized successfully"
    cd ..
    exit 0
fi

# If that fails, try with tasks
if ./gradlew tasks > /dev/null 2>&1; then
    echo "✅ Gradle wrapper initialized successfully"
    cd ..
    exit 0
fi

# If still not there, the gradle-wrapper.jar will be created when bundleRelease runs
echo "⚠️  Gradle will initialize on first build (bundleRelease)"
cd ..
exit 0
