#!/usr/bin/env bash
# Usage: ./scripts/encode-keystore.sh /path/to/keystore.jks
set -e
if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/keystore.jks"
  exit 1
fi
KEYSTORE_PATH="$1"
if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "Keystore not found: $KEYSTORE_PATH"
  exit 2
fi
base64 "$KEYSTORE_PATH" | tr -d '\n'
