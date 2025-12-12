#!/bin/bash

# Generate Android signing keystore for Google Play
# This creates a release signing key for your app

KEYSTORE_FILE="laundrify-release-keystore.jks"
KEY_ALIAS="laundrify-key"
VALIDITY_DAYS=10000
KEY_SIZE=2048

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo "❌ keytool not found. Please ensure Java is installed and in your PATH."
    exit 1
fi

# Check if keystore already exists
if [ -f "$KEYSTORE_FILE" ]; then
    echo "⚠️  Keystore file already exists at: $KEYSTORE_FILE"
    echo "Remove it first if you want to regenerate it."
    exit 0
fi

echo "🔑 Generating Android signing keystore..."
echo "This keystore will be used to sign your app for Google Play."
echo ""
echo "You will be prompted for:"
echo "  1. Keystore password (remember this - you'll need it for Play Console)"
echo "  2. Key password (can be same as keystore password)"
echo "  3. Your information (name, organization, etc.)"
echo ""

keytool -genkeypair -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize "$KEY_SIZE" \
  -validity "$VALIDITY_DAYS" \
  -dname "CN=Laundrify,O=Laundrify,L=India,ST=India,C=IN"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Keystore generated successfully!"
    echo "📁 Location: $(pwd)/$KEYSTORE_FILE"
    echo ""
    echo "🚨 IMPORTANT:"
    echo "  1. This file is sensitive - back it up securely"
    echo "  2. DO NOT commit it to git (add to .gitignore)"
    echo "  3. Keep the password safe"
    echo "  4. You'll need this keystore for future app updates"
    echo ""
    echo "Next steps:"
    echo "  1. Run: npm run build:android"
    echo "  2. Upload the .aab to Google Play Console"
else
    echo "❌ Keystore generation failed"
    exit 1
fi
