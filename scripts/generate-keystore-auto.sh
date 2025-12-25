#!/bin/bash

# Automated keystore generation for Laundrify Play Store deployment
# This script generates the signing certificate with predefined passwords

KEYSTORE_FILE="laundrify-release-keystore.jks"
KEY_ALIAS="laundrify-key"
VALIDITY_DAYS=10000
KEY_SIZE=2048
KEYSTORE_PASSWORD="Laundrify@2024#Secure!9x"
KEY_PASSWORD="Laundrify@2024#Secure!9x"

echo "🔑 Generating Android signing keystore for Laundrify..."
echo ""
echo "Keystore will be created at: $(pwd)/$KEYSTORE_FILE"
echo ""

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo "❌ keytool not found. Please ensure Java is installed."
    echo "Install Java from: https://www.oracle.com/java/technologies/downloads/"
    exit 1
fi

# Check if keystore already exists
if [ -f "$KEYSTORE_FILE" ]; then
    echo "⚠️  Keystore file already exists: $KEYSTORE_FILE"
    echo ""
    echo "To regenerate, run:"
    echo "  rm $KEYSTORE_FILE"
    echo "  bash scripts/generate-keystore-auto.sh"
    exit 0
fi

# Generate the keystore
keytool -genkeypair -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize "$KEY_SIZE" \
  -validity "$VALIDITY_DAYS" \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname "CN=Laundrify,O=Laundrify,L=India,ST=India,C=IN"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Keystore generated successfully!"
    echo ""
    echo "📁 Location: $(pwd)/$KEYSTORE_FILE"
    echo "🔐 Keystore Password: $KEYSTORE_PASSWORD"
    echo "🔑 Key Alias: $KEY_ALIAS"
    echo ""
    echo "🚨 IMPORTANT:"
    echo "  1. ✅ Your keystore password: $KEYSTORE_PASSWORD"
    echo "  2. 📋 Save this password in a password manager"
    echo "  3. 💾 Back up the .jks file to external drive"
    echo "  4. 🚫 Do NOT commit this file to git (already in .gitignore)"
    echo ""
    echo "Next step:"
    echo "  Run: npm run build:aab"
    echo "  (You'll be prompted for the keystore password)"
    echo ""
else
    echo "❌ Keystore generation failed"
    exit 1
fi
