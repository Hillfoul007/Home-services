This document explains the GitHub Actions workflow (.github/workflows/android-build.yml) used to produce an Android App Bundle (AAB) for Play Store upload.

Secrets required in GitHub repository (Settings -> Secrets):
- VITE_API_BASE_URL: Production API base URL (e.g. https://api.yourdomain.com)
- VITE_GOOGLE_MAPS_API_KEY: Google Maps API key used by the app
- VITE_DVHOSTING_API_KEY: DV Hosting SMS key (if used)

Signing secrets / keystore options (choose one):
1) Provide keystore as base64 in secret ANDROID_KEYSTORE_BASE64, plus these:
- RELEASE_STORE_PASSWORD
- RELEASE_KEY_ALIAS
- RELEASE_KEY_PASSWORD

The workflow will decode ANDROID_KEYSTORE_BASE64 into android/keystore/keystore.jks and pass signing properties to Gradle.

2) Alternatively, use Play App Signing and upload an unsigned AAB; adjust workflow to skip keystore step and configure signing in Android Studio before uploading.

Notes & troubleshooting:
- The workflow will attempt to add the Capacitor Android platform if android/ does not already exist. Ensure your project can be initialized with Capacitor in CI (npx cap add android).
- Android Gradle build requires Android SDK components; the workflow uses reactivecircus/android-emulator-runner to install SDK/platform 33.
- If Gradle fails due to missing licenses, run `yes | sdkmanager --licenses` locally and ensure CI has proper SDK packages installed.
- If your Android project uses additional Gradle plugins (Firebase, Play Services), ensure plugin versions are compatible with the installed SDK.

Local build steps (recommended before CI):
1. Build web assets:
   VITE_API_BASE_URL="https://api.yourdomain.com" \
   VITE_GOOGLE_MAPS_API_KEY="YOUR_MAPS_KEY" \
   VITE_DVHOSTING_API_KEY="YOUR_DV_KEY" \
   npm run build

2. Add Capacitor Android (if not present):
   npx cap add android

3. Copy web assets to native project and sync plugins:
   npx cap copy android
   npx cap sync android

4. Open Android Studio and configure signing (recommended for first-time setup):
   npx cap open android
   # In Android Studio: Build > Generate Signed Bundle / APK

If you want, I can also add a Gradle signing example into android/app/build.gradle (non-secret placeholders). I have added a reusable Gradle include at capacitor-setup/android-signing.gradle and a helper script scripts/apply-android-signing.sh which will insert an "apply from" line into android/app/build.gradle after you run `npx cap add android`. Use this workflow:

1. Run locally: `npx cap add android` (if not already added)
2. Run: `./scripts/apply-android-signing.sh` — this will add `apply from: '../../capacitor-setup/android-signing.gradle'` into android/app/build.gradle
3. Ensure keystore is available at android/keystore/keystore.jks or provide keystore via CI secret ANDROID_KEYSTORE_BASE64

Also included: scripts/encode-keystore.sh to produce a base64 string for your keystore for CI.

Note: Do NOT commit credentials. Use CI secrets for production builds.
