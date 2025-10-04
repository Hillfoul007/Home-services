#!/usr/bin/env bash
set -e
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BUILD_GRADLE="$ROOT_DIR/android/app/build.gradle"
INCLUDE_LINE="apply from: '../../capacitor-setup/android-signing.gradle'"

if [ ! -f "$BUILD_GRADLE" ]; then
  echo "android/app/build.gradle not found. Run 'npx cap add android' first and ensure Android project exists."
  exit 1
fi

if grep -Fq "$INCLUDE_LINE" "$BUILD_GRADLE"; then
  echo "Signing include already present in build.gradle"
  exit 0
fi

# Insert include at the top of the file (before any plugin or android block)
TEMP_FILE=$(mktemp)
{
  echo "$INCLUDE_LINE"
  echo ""
  cat "$BUILD_GRADLE"
} > "$TEMP_FILE"

mv "$TEMP_FILE" "$BUILD_GRADLE"
chmod +x "$BUILD_GRADLE"

echo "Applied signing include to android/app/build.gradle"
