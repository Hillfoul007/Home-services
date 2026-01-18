#!/bin/bash

# Fix gradle wrapper by downloading the wrapper jar

echo "🔧 Fixing gradle wrapper..."
echo ""

cd android

if [ -f "gradlew" ]; then
    echo "✅ gradlew script found"
    echo "Running: ./gradlew clean"
    echo ""
    
    # Make executable
    chmod +x gradlew
    
    # Run clean to download wrapper
    ./gradlew clean
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Gradle wrapper fixed!"
        echo ""
        echo "Next step:"
        echo "  cd .."
        echo "  npm run build:aab"
    else
        echo "❌ Gradle clean failed"
        echo "Please check your Java installation"
        exit 1
    fi
else
    echo "❌ gradlew script not found"
    echo "Make sure you're in the project root directory"
    exit 1
fi

cd ..
