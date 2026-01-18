# 📦 Play Store Assets Checklist & Organization

This file helps you organize all assets needed for Play Store submission.

---

## 📁 RECOMMENDED FOLDER STRUCTURE

Create this folder structure for organized asset management:

```
playstore-assets/
├── 01-app-icon/
│   ├── icon-512.png                          # Required
│   ├── icon-512-backup.png                   # Backup
│   └── icon-original.svg                     # Original design
│
├── 02-screenshots/
│   ├── phone-screenshots/
│   │   ├── 1-home.png                        # (1170×2532)
│   │   ├── 2-booking.png                     # (1170×2532)
│   │   ├── 3-payment.png                     # (1170×2532)
│   │   ├── 4-tracking.png                    # (1170×2532)
│   │   └── 5-rewards.png                     # (1170×2532)
│   │
│   └── tablet-screenshots/                   # Optional
│       ├── 1-home-tablet.png                 # (2560×1600)
│       └── 2-booking-tablet.png              # (2560×1600)
│
├── 03-feature-graphics/
│   ├── feature-graphic.png                   # (1024×500) - Optional
│   └── promotional-graphic.png               # (1024×500) - Optional
│
├── 04-text-content/
│   ├── app-name.txt                          # "Laundrify"
│   ├── short-description.txt                 # 80 chars max
│   ├── full-description.txt                  # 4000 chars max
│   ├── keywords.txt                          # 10 keywords
│   ├── changelog.txt                         # Release notes
│   └── privacy-policy.md                     # Privacy policy
│
├── 05-metadata/
│   ├── app-metadata.json                     # JSON with all info
│   ├── store-listing.csv                     # Store listing data
│   └── screenshots-info.txt                  # Screenshot descriptions
│
├── 06-legal/
│   ├── privacy-policy.md                     # Full privacy policy
│   ├── terms-of-service.md                   # TOS (optional)
│   └── licenses.md                           # Open source licenses
│
└── README.md                                 # Organization guide
```

---

## ✅ COMPLETE ASSET CHECKLIST

### 🔑 CRITICAL - Must Have

- [ ] **App Icon (512×512 PNG)**
  - Location: `playstore-assets/01-app-icon/icon-512.png`
  - Status: _____________
  - Notes: _____________

- [ ] **App Bundle (AAB)**
  - Location: `android/app/release/app-release.aab`
  - Status: _____________
  - Size: _________ MB
  - Notes: _____________

- [ ] **Keystore File**
  - Location: `laundrify-release-keystore.jks`
  - Status: Backed up? ☐ Yes ☐ No
  - Password saved? ☐ Yes ☐ No
  - Notes: _____________

### 📸 SCREENSHOTS (Required - Minimum 2, Max 8)

| # | Name | Dimensions | Status | File Location |
|---|------|-----------|--------|---------------|
| 1 | Home Screen | 1170×2532 | ☐ Ready | `01-home.png` |
| 2 | Booking Flow | 1170×2532 | ☐ Ready | `02-booking.png` |
| 3 | Payment | 1170×2532 | ☐ Ready | `03-payment.png` |
| 4 | Tracking | 1170×2532 | ☐ Ready | `04-tracking.png` |
| 5 | Rewards | 1170×2532 | ☐ Ready | `05-rewards.png` |

### 📝 TEXT CONTENT

| Content | Max Length | Status | Notes |
|---------|-----------|--------|-------|
| **App Name** | Unlimited | ☐ Ready | Laundrify |
| **Short Description** | 80 chars | ☐ Ready | See PLAY_STORE_METADATA.md |
| **Full Description** | 4000 chars | ☐ Ready | See PLAY_STORE_METADATA.md |
| **Keywords** | 10 max | ☐ Ready | laundry, cleaning, delivery... |

### 🖼️ GRAPHICS (Optional but Recommended)

- [ ] **Feature Graphic (1024×500 PNG)**
  - Status: _____________
  - Location: `playstore-assets/03-feature-graphics/feature-graphic.png`

- [ ] **Promotional Graphic (1024×500 PNG)**
  - Status: _____________
  - Location: `playstore-assets/03-feature-graphics/promotional-graphic.png`

### 📋 METADATA

- [ ] **App Category** → Lifestyle or Utilities
- [ ] **Content Rating** → G / PG / Teen / Mature
- [ ] **Target Audience** → 13+ or 18+
- [ ] **Primary Language** → English
- [ ] **Supported Languages** → Check

### 🔐 LEGAL

- [ ] **Privacy Policy URL**
  - Status: _____________
  - URL: _________________________
  - Hosted on: _________________________

- [ ] **Terms of Service** (Optional)
  - Status: ☐ Not needed ☐ In progress ☐ Ready
  - URL: _________________________

### 👤 ACCOUNT INFO

- [ ] **Developer Name**
  - Name: _________________________

- [ ] **Contact Email**
  - Email: _________________________

- [ ] **Phone Number** (Optional)
  - Phone: _________________________

- [ ] **Website** (Optional)
  - Website: _________________________

- [ ] **Support Email** (Optional)
  - Email: _________________________

---

## 📸 SCREENSHOT CREATION GUIDE

### Method 1: From Android Emulator (Recommended)

**Step 1: Setup Emulator**
```bash
# Download Android Studio
# Create virtual device: Pixel 4, API 30+
# Start emulator
emulator -avd Pixel_4_API_30 &
```

**Step 2: Install App**
```bash
npm run build:android
```

**Step 3: Take Screenshots**
- Android Studio menu: View → Tool Windows → Logcat
- Open device, navigate to app screens
- Use Android Studio screenshot tool (Camera icon in Device window)
- Save to: `playstore-assets/02-screenshots/phone-screenshots/`

**Step 4: Verify Dimensions**
```bash
# Check image size
identify playstore-assets/02-screenshots/phone-screenshots/1-home.png
# Should show: 1170x2532
```

### Method 2: From Real Android Phone

**Step 1: Install App**
```bash
npm run build:android
adb install android/app/release/app-release.apk
```

**Step 2: Navigate Through App**
- Open app on phone
- Go to each screen you want to capture

**Step 3: Take Screenshots**
- Press: Power + Volume Down
- Screenshot saved to Photos

**Step 4: Transfer to Computer**
```bash
adb pull /sdcard/DCIM/Screenshots/ ./playstore-assets/02-screenshots/
```

### Method 3: From Web Version (Quick Preview)

**For preview/reference only (not for submission):**
```bash
npm run dev
# Open http://localhost:5173
# Use browser DevTools:
#   - Click device toggle
#   - Select iPhone X (1125×2436)
#   - Zoom to 25% for 1170×2532 aspect ratio
#   - Take browser screenshots
```

### Screenshot Best Practices

✅ **Do:**
- Show clean, uncluttered screens
- Include app UI elements
- Showcase key features
- Use consistent color scheme
- Add descriptive text overlays (optional)

❌ **Don't:**
- Show personal information (emails, phone numbers)
- Include test data (fake names, addresses)
- Show system notifications
- Have blurry or low-quality images
- Include competitor mentions
- Show profanity or inappropriate content

---

## 🎨 CREATING FEATURE GRAPHICS

### Feature Graphic (1024×500 pixels)

**Content suggestions:**
```
[App Logo]        [Key Feature 1]  [Key Feature 2]  [Key Feature 3]
Laundrify         Quick Pickup      Fast Delivery    Secure Payment
```

**Colors to use:**
- Primary: Brand colors from your app
- Accent: Complementary colors
- Background: Clean, professional

**Tools to create:**
1. **Figma** (free): https://www.figma.com
2. **Canva** (free): https://www.canva.com
3. **Adobe Express** (free): https://www.adobe.com/express

**Template dimensions:**
- Width: 1024 pixels
- Height: 500 pixels
- DPI: 72

---

## 📄 TEXT CONTENT FORMATTING

### Short Description (80 characters)

**Format:**
```
[Service Name] - [Main Benefit]. [Secondary Benefit].
```

**Examples:**
```
Professional laundry service at your doorstep. Fast, reliable, trusted. (79 chars)
Quick laundry booking app. Professional care, fast delivery, great prices. (72 chars)
Laundrify: Book laundry online. Convenient, affordable, reliable service. (71 chars)
```

### Full Description (4000 characters)

**Structure:**
```
[Line 1] Hook/Main benefit
[Line 2] Empty
[Line 3-5] Key features (3-5 features, bulleted)
[Line 6] Empty
[Line 7-10] Why choose us (benefits)
[Line 11] Empty
[Line 12] Call to action
[Line 13] Contact info
```

**See:** `PLAY_STORE_METADATA.md` → Full Description section

### Keywords (10 max)

**Format:** Comma-separated, no hashtags

```
laundry, dry cleaning, ironing, washing, service, delivery, convenient, online, professional, fast
```

**Tips:**
- Use common search terms
- Include service types (wash, iron, dry cleaning)
- Include benefits (fast, reliable, professional)
- Match your full description keywords
- Don't repeat same keyword

---

## 🎬 RELEASE NOTES TEMPLATE

### For Version 1.0 (Initial Release)

```
🎉 Laundrify v1.0 - Welcome!

We're excited to launch Laundrify - your trusted laundry partner.

✨ KEY FEATURES:
✓ Book laundry service in 3 simple steps
✓ Professional cleaning with expert care
✓ Real-time order tracking
✓ Secure wallet payment system
✓ Earn rewards on every order
✓ Fast pickup and delivery
✓ Special PG hostel service
✓ 24/7 customer support

📱 WHAT YOU CAN DO:
• Browse various laundry services
• Schedule pickup at your convenience
• Make secure payments
• Track your order in real-time
• View order history
• Earn and redeem rewards
• Refer friends and get bonuses

🎯 WHY LAUNDRIFY?
• Professional and trusted
• Transparent pricing
• Quality guaranteed
• Customer support always available
• Eco-friendly methods

Download now and experience hassle-free laundry service!

Thank you for choosing Laundrify! 🧺✨
```

**Character count:** ~700 characters ✅

---

## 📦 VERIFICATION CHECKLIST

Before uploading to Play Console:

### Images
- [ ] Icon is 512×512 PNG with no blur
- [ ] Screenshots are 1170×2532 PNG with no watermarks
- [ ] Feature graphic is 1024×500 if included
- [ ] All images have descriptive filenames
- [ ] File sizes are reasonable (< 5MB each)

### Text
- [ ] App name is accurate and spelled correctly
- [ ] Short description is under 80 characters
- [ ] Full description is under 4000 characters
- [ ] No HTML tags in descriptions
- [ ] Keywords are separated by commas
- [ ] Release notes are formatted nicely

### Legal
- [ ] Privacy policy URL is accessible
- [ ] Privacy policy mentions data collection
- [ ] Privacy policy mentions third-party services
- [ ] Content rating questionnaire completed
- [ ] Developer info is accurate

### Technical
- [ ] AAB file exists and is not corrupted
- [ ] Keystore password is saved securely
- [ ] App version code is incremented correctly
- [ ] App target API is 35+ (you have 36 ✅)

---

## 💾 FILE BACKUP CHECKLIST

**Critical files to backup:**

- [ ] `laundrify-release-keystore.jks`
  - Backup location: _____________________________
  - Backed up on: _____________________________
  - Backup method: ☐ External drive ☐ Cloud ☐ Both

- [ ] Keystore password
  - Saved in: ☐ Password manager ☐ Secure note ☐ Encrypted file
  - Locations: _____________________________

- [ ] `android/app/release/app-release.aab`
  - Backup location: _____________________________
  - Backed up on: _____________________________

- [ ] All screenshots
  - Backup location: _____________________________
  - Backed up on: _____________________________

- [ ] Privacy policy
  - Backup location: _____________________________
  - Hosted on: _____________________________

---

## 🔄 VERSION MANAGEMENT

For future updates, update these files:

**1. Version code in build.gradle:**
```gradle
versionCode 1  // Increment by 1 for each release
versionName "1.0"
```

**Increment schedule:**
```
v1.0 (versionCode 1) → Initial release
v1.1 (versionCode 2) → Bug fixes
v1.2 (versionCode 3) → New features
v2.0 (versionCode 4) → Major update
etc.
```

**2. Keep changelog:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial release |
| 1.1 | 2024-02-01 | Bug fixes, UX improvements |
| 1.2 | 2024-03-01 | New features: X, Y, Z |

---

## 📋 READY FOR SUBMISSION?

**Final checklist:**

- [ ] All required assets created
- [ ] All text content written and reviewed
- [ ] Privacy policy hosted and URL ready
- [ ] Screenshots captured and verified
- [ ] App icon created and tested
- [ ] AAB file built and verified
- [ ] Keystore backed up and password saved
- [ ] Metadata organized and accessible
- [ ] Developer account details complete
- [ ] Pricing and distribution set
- [ ] Content rating completed
- [ ] Privacy policy URL added
- [ ] App tested thoroughly

---

**Once everything is checked:** Follow `PLAYSTORE_SUBMISSION_GUIDE.md` to submit! 🚀

---

## 📞 QUICK REFERENCE

### Essential URLs
- Google Play Console: https://play.google.com/console
- Privacy Policy Generator: https://termly.io/
- Screenshot Tool: Android Studio or Figma
- Icon Creator: Canva or Adobe Express

### File Locations
```
Your App Assets
├── Icon: playstore-assets/01-app-icon/icon-512.png
├── Screenshots: playstore-assets/02-screenshots/phone-screenshots/
├── Feature Graphic: playstore-assets/03-feature-graphics/
├── Text: playstore-assets/04-text-content/
└── Metadata: playstore-assets/05-metadata/
```

### Key Dimensions
| Asset | Size |
|-------|------|
| App Icon | 512×512 pixels |
| Screenshots | 1170×2532 pixels |
| Feature Graphic | 1024×500 pixels |

Good luck! 🎉
