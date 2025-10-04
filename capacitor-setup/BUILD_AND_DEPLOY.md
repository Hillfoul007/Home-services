Android build & Play Store deployment checklist

1) Prebuild checks
- Ensure the web app builds successfully: `npm run build` or `npm run build:production`.
- Run lint and type checks: `npm run lint`, `npm run build:check`.
- Confirm PWA assets in `dist/` (icons, manifest.json) are correct.

2) Capacitor setup
- Install Capacitor packages as dev dependencies: `npm i -D @capacitor/cli @capacitor/core @capacitor/android`.
- Ensure `capacitor.config.ts` (project root or this folder) has `webDir: 'dist'`.
- Run `npx cap copy android` after building web assets.

3) Android Studio
- Open the `android/` project with Android Studio using `npx cap open android`.
- Update Android target SDK to the current Play Store minimum (targetSdkVersion 33 or higher as required).
- Configure permissions in `AndroidManifest.xml` only for those the app actually needs (location, camera for uploads, internet). Provide privacy justification in Play Console.

4) App icons and adaptive icons
- Create the following PNG assets: foreground and background for adaptive icons and legacy icons (48x48 up to 512x512). Place them under `android/app/src/main/res/mipmap-*/`.
- Use the provided `scripts/generate-icons.js` and system tools (rsvg-convert or ImageMagick) to generate PNGs from `public/laundrify-exact-icon.svg`.

5) Android permissions and privacy
- If requesting background location, SMS, or call permissions include runtime prompts and a privacy policy link in the Play Store listing.
- If using SMS verification, prefer server-side OTP verification and avoid READ_SMS on Android unless strictly necessary.

6) Signing & App Bundle
- Generate a signing key (keystore) using keytool (example below in android-signing.md).
- Configure signing in `android/app/build.gradle` or use Android Studio's wizard.
- Build an Android App Bundle (.aab) via Android Studio or Gradle (`./gradlew bundleRelease`).

7) Play Console
- Create a new app in Play Console.
- Upload the signed .aab to internal testing first.
- Complete the store listing (title, short & full description), screenshots for supported device sizes, high-res icon (512x512), feature graphic, privacy policy URL, and content rating.
- Fill the Data Safety form and declarations for permissions.
- After internal testing, promote to open testing/production as appropriate.

8) Post-deploy
- Monitor crashes and errors via Sentry or Play Console
- Monitor API/backend load and scale if necessary
- Setup CI to automate `npm run build` + `npx cap copy android` + Gradle bundle generation

Common pitfalls
- Large web bundle size: optimize images and remove unused code
- Missing runtime permissions leading to feature failures
- Hard-coded endpoints in web bundle: use runtime configuration or environment switch

If you want, I can also add example Gradle signing config and a CI example to produce the AAB automatically.
