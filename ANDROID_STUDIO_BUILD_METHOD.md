# 🖥️ Android Studio - Build Play Store APK/AAB Using GUI

**Visual method, no gradle command line, easier debugging**

---

## 📋 REQUIREMENTS

- ✅ Android Studio installed (free)
- ✅ Java 17+ installed
- ✅ Your Capacitor Android project

**Download Android Studio:**
https://developer.android.com/studio

---

## 🚀 STEP 1: OPEN PROJECT IN ANDROID STUDIO

1. Open Android Studio
2. Click: **File → Open**
3. Navigate to: `your-project/android/`
4. Click: **Open**
5. Wait for Gradle sync to complete (first time: 2-3 minutes)

**You should see:**
- Project structure in left panel
- Build output messages

---

## 🔑 STEP 2: CREATE SIGNING KEY (Keystore)

### If You Don't Have a Keystore Yet

1. Go to: **Build → Generate Signed Bundle/APK**
2. Select: **Android App Bundle (AAB)**
3. Click: **Next**

### Create New Keystore

4. Click: **Create new...**
5. Fill in:
   - **Key store path:** Choose a location (remember it!)
   - **Password:** `Laundrify@2024#Secure!9x`
   - **Confirm:** `Laundrify@2024#Secure!9x`
   - **Key alias:** `laundrify-key`
   - **Key password:** `Laundrify@2024#Secure!9x`
   - **Confirm:** `Laundrify@2024#Secure!9x`
   - **Validity:** 10000 (years)
   - **Certificate:** Fill name, organization, etc.

6. Click: **Create**

**✅ Keystore created!**

---

## 📦 STEP 3: BUILD SIGNED AAB

After creating keystore:

1. Click: **Next**
2. Select build variant: **release**
3. Click: **Next**
4. Review signing config (should show your keystore)
5. Click: **Finish**

**Android Studio will:**
- ✅ Build web assets
- ✅ Compile Android project
- ✅ Sign with your keystore
- ✅ Create AAB file

**Time:** ~10-15 minutes (first time longer)

---

## ✅ STEP 4: FIND YOUR AAB FILE

After build completes:

1. Look at bottom: Build output message
2. Should say: `✅ Build successful!`
3. You'll see a link to the file location
4. Or go to: `android/app/release/app-release.aab`

**Your AAB is ready!** 📦

---

## 🔒 SAVE YOUR KEYSTORE

**Important:** Back up your keystore file!

1. Find keystore file location (from Step 2)
2. Copy it to a safe place
3. External drive or cloud storage
4. You'll need it for future updates

---

## 🚀 NEXT: UPLOAD TO PLAY STORE

Now you have `app-release.aab`:

1. Go to: https://play.google.com/console
2. Create new app: "Laundrify"
3. Go to: Testing → Internal Testing
4. Upload: `app-release.aab`
5. Fill in description and release notes
6. Test on devices
7. Submit for review!

---

## 🐛 TROUBLESHOOTING

### Build Failed: "Gradle wrapper not found"
- Android Studio will download it automatically
- Wait for sync to complete
- Try build again

### Build Failed: "Java not found"
- Make sure Java 17+ is installed
- Go to: File → Settings → SDK Manager
- Check Java SDK is listed

### Build Failed: "Keystore password wrong"
- Double-check password you entered
- Try again, make sure CAPS LOCK is off
- Characters are case-sensitive

### Build Takes Forever
- First build can take 10-15 minutes
- Subsequent builds are faster
- Don't close Android Studio during build

---

## ✨ ADVANTAGES

✅ **Visual interface** - See everything  
✅ **No command line** - No gradle commands  
✅ **Easy debugging** - Clear error messages  
✅ **Build output** - Real-time feedback  
✅ **Gradle automatically managed** - No wrapper issues  

---

## 📚 NEXT STEPS

Once you have your AAB:
1. Read: `PLAYSTORE_SUBMISSION_GUIDE.md`
2. Upload to Google Play Console
3. Fill store listing
4. Submit for review
5. Wait 24-48 hours
6. App goes live! 🎉

---

**Questions?** Check Android Studio docs:
https://developer.android.com/studio/build/building-apps

Good luck! 🚀
