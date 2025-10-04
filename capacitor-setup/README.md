This folder contains Capacitor configuration and step-by-step instructions to produce an Android build for the Laundrify Rider App.

Summary
- Capacitor will wrap the existing Vite web app (webDir: dist) into Android/iOS native shells.
- The web build must be produced via the repository's build scripts (npm run build or npm run build:production).

Quick start (Linux/macOS/WSL)
1. Install Capacitor CLI and Android platform (once):
   npm install --save-dev @capacitor/cli @capacitor/core @capacitor/android

2. Initialize Capacitor (only first time):
   npx cap init laundrify com.laundrify.app --web-dir=dist

3. Add Android platform (only first time):
   npx cap add android

4. Build the web app and copy into Capacitor native project:
   npm run build
   npx cap copy android
   npx cap sync android

5. Open Android Studio and build/sign:
   npx cap open android
   # In Android Studio: Build > Generate Signed Bundle / APK and follow signing steps.

Notes
- For CI you can run `npm run build` then `npx cap copy android` and use Gradle to build the AAB.
- Capacitor places the web assets into android/app/src/main/assets/public by default (depends on Capacitor version). Ensure build output is in `dist`.

Files in this folder
- capacitor.config.ts — Capacitor configuration for this project
- BUILD_AND_DEPLOY.md — Detailed Play Store checklist and steps
- android-signing.md — Example keystore and Gradle signing configuration
- generate-icons-instructions.md — Steps to generate icons and adaptive icons from the repository SVG

Security & environment
- Do NOT store secrets in the repo. Use native Android keystore and CI secrets for signing.
- Place runtime API keys in native configuration or provide them through a secure remote config. Never hard-code private keys in the web bundle.
