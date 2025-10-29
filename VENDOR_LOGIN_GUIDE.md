# Vendor Login & Credential Management Guide

## Overview
Vendors use auto-generated credentials to login to the vendor portal. Each vendor gets a unique **Vendor ID** and a temporary **Password** that admins must securely share.

---

## Creating a Vendor (Admin)

### Steps:
1. Go to **Admin Portal → Vendor Management**
2. Click **"Create Vendor"** button
3. Fill in vendor details:
   - **Name** (Required): Vendor business name
   - **Phone** (Required): Contact number
   - **Email**: Optional email address
   - **Address**: Optional address
   - **Services**: Comma-separated services (e.g., "Dry Clean, Regular Iron")
4. Click **"Create"**

### What You'll See:
A modal popup appears with the auto-generated credentials:
```
✅ Vendor Created Successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vendor ID:  V210767WYFH2J
Password:   ABC12XYZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Save these credentials securely. 
   The password will not be shown again.
```

### Important:
- **Copy and save both values immediately**
- Share Vendor ID and Password securely with the vendor
- Each vendor gets a unique ID starting with **"V"**
- Passwords are **8 random characters** (uppercase letters + numbers)

---

## Vendor Login

### Steps:
1. Go to **Vendor Portal** (or `/vendor/login`)
2. Enter credentials:
   - **Vendor ID**: Copy from admin email/message (e.g., `V210767WYFH2J`)
   - **Password**: Temporary password from admin (e.g., `ABC12XYZ`)
3. Click **"Sign in"**

### Common Issues:

#### ❌ "Invalid vendor ID or password"
- **Check 1**: Is Vendor ID correct? (Should start with **V**)
  - ✗ Wrong: `12345678` or `Test Vendor`
  - ✓ Correct: `V210767WYFH2J`
- **Check 2**: Is password exactly as provided? (Case-sensitive)
- **Check 3**: Contact admin if you lost the password

#### ❌ "Vendor account is inactive"
- Vendor was disabled in admin panel
- Contact your admin to reactivate

---

## Managing Vendor Passwords

### As Admin:
1. Go to **Admin Portal → Vendor Management**
2. Find the vendor in the list
3. Click **"Edit"** button
4. In the edit dialog:
   - Leave **Password field blank** to keep current password
   - Enter **new password** to reset it
5. Click **"Save"**
6. Share new password securely with vendor

### Important:
- You can see passwords in the edit dialog (click "Show")
- Original temporary password is not recoverable
- Always share new passwords securely

---

## Vendor Portal Features

Once logged in, vendors can:
- ✅ View assigned orders
- ✅ Update order status (pickup complete, processing, ready to deliver)
- ✅ Upload item images during order processing
- ✅ Track order progress
- ✅ Logout when done

---

## Emergency Password Reset

If a vendor loses their password:
1. Admin goes to **Vendor Management**
2. Finds the vendor and clicks **"Edit"**
3. Sets a new temporary password
4. Shares new password with vendor
5. Vendor logs in with new password

---

## Best Practices

✅ **Do:**
- Store credentials in a secure location
- Share credentials via secure channels (email, encrypted message)
- Reset password if vendor account is compromised
- Deactivate vendor account when no longer needed

❌ **Don't:**
- Share credentials via insecure messaging (SMS, WhatsApp)
- Write passwords in plaintext files
- Use same password for multiple vendors
- Show passwords in plain text during creation (modal shows it once, then it's gone)

---

## Test Vendor Credentials

For testing purposes, you can create a test vendor:
- **Name**: Test Vendor
- **Phone**: 9999999999
- Create it and note the Vendor ID and Password
- Use these credentials to test the vendor login flow

