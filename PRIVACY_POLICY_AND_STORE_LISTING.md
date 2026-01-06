# Privacy Policy & Google Play Store Listing

Complete setup for privacy policy and store listing metadata.

## 🔒 Privacy Policy (Required)

Google Play Store requires a privacy policy URL. Here's how to create one:

### Option 1: Free Privacy Policy Generator (Recommended)

1. Go to: https://termly.io/products/privacy-policy-generator/
2. Answer the questions about your app:
   - App name: Laundrify
   - What data you collect:
     - Location (for service delivery)
     - Phone number (for OTP verification)
     - Account information
   - Do you have analytics? (Yes - track usage)
   - Do you share data with third parties? (No/Yes depending on your setup)
3. Download the generated privacy policy
4. Host it on your website or use a free hosting service

### Option 2: Using Iubenda
1. Go to: https://www.iubenda.com/en/privacy-policy-generator/
2. Create your policy
3. Host on your domain

### Privacy Policy Template for Laundrify

Minimum content to include:

```markdown
# Privacy Policy for Laundrify

## Information We Collect

1. **Location Information**: We collect your location to provide laundry service delivery
2. **Contact Information**: Phone number for OTP verification and service updates
3. **Account Data**: Name, email, address for your service orders
4. **Payment Information**: Processed through secure payment gateway (not stored by us)
5. **Usage Data**: How you use our app (analytics)

## How We Use Your Information

- Provide laundry services (pickup, delivery, tracking)
- Send SMS/email notifications for your orders
- Verify your identity via OTP
- Improve our services through analytics
- Customer support

## Data Security

- All data is encrypted in transit (HTTPS)
- Sensitive data is never logged or shared
- We comply with data protection regulations

## Your Rights

- You can request your data anytime
- You can delete your account
- You can opt-out of non-essential communications

## Contact Us

Email: support@laundrify.com
```

### After Creating Privacy Policy:

1. Upload to your website/hosting
2. Get the full URL (e.g., `https://yourdomain.com/privacy-policy`)
3. Add to Google Play Console
4. Test that the URL works

---

## 📋 Store Listing Requirements

### 1. App Name
```
Laundrify
```

### 2. Short Description (80 characters max)
```
Quick, convenient laundry services at your doorstep
```
**Character count:** 53/80 ✅

### 3. Full Description (4000 characters max)
```
Laundrify brings professional laundry services right to your home.

✨ KEY FEATURES:

⚡ Express Service
- Quick pickup and delivery in 45 minutes
- Book with just a few taps
- Track your order in real-time

👔 Quality Care
- Professional cleaning experts
- Gentle handling of delicate fabrics
- Premium washing and ironing

💳 Easy Payments
- Secure wallet system
- Multiple payment options
- Transparent pricing

🎁 Rewards Program
- Earn credits with every order
- Referral bonuses for friends
- Exclusive deals and offers

📱 Smart Features
- Real-time order tracking
- Push notifications for updates
- Order history and receipts
- Customer reviews and ratings

🌍 Convenient Coverage
- Available in major cities
- Same-day service options
- No hidden charges

WHY CHOOSE LAUNDRIFY?

✓ Trusted by thousands
✓ 5-star rated service
✓ Professional team
✓ Quality guaranteed
✓ Affordable prices

Download Laundrify today and say goodbye to laundry hassles!

For support: support@laundrify.com
Privacy Policy: [your-privacy-policy-url]
```

### 4. App Category
```
Lifestyle / Business Services / Utilities
```

### 5. Content Rating
Go to **Content rating** and answer:
- Violence: No
- Sexual content: No
- Profanity: No
- Drugs: No
- Result: Likely **G (General Audiences)** or **PG**

### 6. Screenshots (Required)

You need at least **2** screenshots in these sizes:
- **Phone**: 1170x2532 pixels (9:19.5 aspect ratio)

**Screenshot 1 - Home Screen:**
- Show the Laundrify logo
- Display available services (Iron, Wash, etc.)
- Show pricing
- Show search functionality

**Screenshot 2 - Booking Process:**
- Show the booking flow
- Display location selection
- Show selected services
- Display pricing summary

**Screenshot 3 - Tracking (Optional but recommended):**
- Show real-time order tracking
- Display delivery status
- Show estimated arrival time

**Screenshot 4 - Success (Optional):**
- Show completed order
- Display ratings
- Show wallet/rewards

**How to generate screenshots:**

Option 1: Use your app directly
```bash
npm run dev
# Open in Chrome DevTools
# Set phone resolution to 1170x2532
# Take screenshots using built-in tools
```

Option 2: Use design tools
- Figma: Create mockups
- Sketch: Design screenshots
- Tools like: https://www.smartmockups.com/

Option 3: Get from UI components
- Check `src/components/ResponsiveLaundryHome.tsx`
- Use these as base for screenshots

### 7. Feature Graphic (1024x500)
- Header image shown on app listing
- Your app logo/brand
- Tagline: "Quick. Convenient. Clean."

### 8. Icon (512x512)
```
Use: public/laundrify-exact-icon.svg
Convert to PNG 512x512
```

---

## 📝 Content Rating Form

When you submit app to Google Play, you must answer:

1. **Violence**: No
2. **Sexual Content**: No  
3. **Profanity**: No
4. **Alcohol/Tobacco/Drugs**: No
5. **Gambling**: No
6. **Personal Information Collection**: 
   - Yes: Location, Phone number, User-generated content
7. **Advertising**: No
8. **Other Sensitive Topics**: No

**Result:** Usually **G (General Audiences)** rating

---

## 🔐 Data Safety Form

Google Play requires you to fill out a Data Safety form:

**Personal & Sensitive Information:**
- Location: Collected
- Phone number: Collected
- Email: Collected

**How it's used:**
- Service delivery
- User identification
- Communication

**Do you share data with third parties?**
- Yes: Payment processor (for transactions)
- Yes: Analytics (usage patterns)
- No: Other parties

**Encryption:**
- All data encrypted in transit (HTTPS)

---

## 🎯 Store Listing Checklist

Before submitting to Play Store:

- [ ] Privacy policy written
- [ ] Privacy policy URL accessible
- [ ] Privacy policy added to Play Console
- [ ] App name: Laundrify
- [ ] Short description (80 chars): "Quick, convenient laundry services..."
- [ ] Full description (4000 chars): Complete description above
- [ ] Category selected: Lifestyle
- [ ] 2+ screenshots (1170x2532): Prepared
- [ ] Feature graphic (1024x500): Ready
- [ ] Icon (512x512): PNG format
- [ ] Content rating completed
- [ ] Data safety form filled
- [ ] Contact email provided
- [ ] Support email provided

---

## 🚀 Submission Process

1. **Go to Play Console**: https://play.google.com/console
2. **Select your app** (or create new)
3. **Left sidebar → Store listing**
4. **Fill all sections** above
5. **Review your listing** preview
6. **Save your store listing**
7. **Go to Testing → Internal Testing**
8. **Upload your AAB** (from `npm run build:aab`)
9. **Add release notes**
10. **Start rollout to testing** first
11. **Test with internal users**
12. **Then promote to production**

---

## 📞 Sample Support Information

**Email**: support@laundrify.com
**Website**: https://yourlaundrify.com
**Phone**: +91-XXXXXXXXXX (optional)

---

## ✅ Common Play Store Rejections & How to Avoid

| Issue | Solution |
|-------|----------|
| No privacy policy | Add privacy policy URL |
| App crashes | Test thoroughly before upload |
| Misleading description | Be honest about features |
| Missing permissions justification | Explain why you need location |
| Poor quality screenshots | Use high-resolution images |
| Inappropriate content | Ensure app is family-friendly |

---

## 📱 What Users See

When users search for "Laundrify" on Play Store, they will see:

```
[App Icon] Laundrify
⭐⭐⭐⭐⭐ (ratings)
Quick, convenient laundry services...
[Screenshots]
[Install Button]
```

Make sure your listing is professional and appealing!

---

## 🔄 Updating Your Listing

After launch, you can update:
- Screenshots (rotate new ones)
- Description (update features)
- Privacy policy (if changed)
- Support email
- Website

Changes take effect immediately or within a few hours.

---

**Next Steps:**
1. Create privacy policy
2. Prepare screenshots
3. Fill store listing in Play Console
4. Upload AAB: `npm run build:aab`
5. Submit for review

Good luck! 🎉
