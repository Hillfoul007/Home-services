Android signing example

1) Generate a keystore (run locally, do not commit the keystore):

keytool -genkeypair -v -keystore laundrify-release-keystore.jks \
  -alias laundrify-key -keyalg RSA -keysize 2048 -validity 10000

Keep the keystore file safe. Store the keystore password, key alias and key password in your CI secret store.

2) Example Gradle signing config (place in `android/app/build.gradle` inside `android {}` block):

signingConfigs {
  release {
    storeFile file(project.findProperty('MYAPP_RELEASE_STORE_FILE') ?: '../laundrify-release-keystore.jks')
    storePassword project.findProperty('MYAPP_RELEASE_STORE_PASSWORD') ?: System.getenv('MYAPP_RELEASE_STORE_PASSWORD')
    keyAlias project.findProperty('MYAPP_RELEASE_KEY_ALIAS') ?: 'laundrify-key'
    keyPassword project.findProperty('MYAPP_RELEASE_KEY_PASSWORD') ?: System.getenv('MYAPP_RELEASE_KEY_PASSWORD')
  }
}

buildTypes {
  release {
    signingConfig signingConfigs.release
    shrinkResources true
    minifyEnabled true
  }
}

3) Example `gradle.properties` (DO NOT commit secrets to the repo):

# Example (for local dev only)
#MYAPP_RELEASE_STORE_FILE=/path/to/laundrify-release-keystore.jks
#MYAPP_RELEASE_STORE_PASSWORD=supersecret
#MYAPP_RELEASE_KEY_ALIAS=laundrify-key
#MYAPP_RELEASE_KEY_PASSWORD=supersecret

In CI, set the above as environment variables or use encrypted files that the CI runner places on disk before running Gradle.

4) Build signed bundle (from android/ folder):

# If signing config is set in Gradle and keystore path is accessible:
./gradlew bundleRelease

# Alternatively, use Android Studio: Build > Generate Signed Bundle / APK

After bundle build completes, upload the produced .aab to the Play Console.
