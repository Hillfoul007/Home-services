# 🚀 Deploy Backend Fixes to Render.com

## Problem
- ✅ Backend fixes have been made locally
- ❌ They haven't been deployed to your Render.com server yet
- ❌ Your frontend on fly.dev is calling the old backend

## Solution: Redeploy Backend to Render

### Option 1: Automatic Deployment (If using GitHub)

**If you have your code connected to GitHub:**

1. **Push the code changes:**
   ```bash
   git add backend/
   git commit -m "Fix: Referral code validation and consistency issues"
   git push origin main
   ```

2. **Render will automatically redeploy** (if you have auto-deploy enabled)
   - Go to https://dashboard.render.com
   - Find your backend service (cleancare-pro-api or home-services-5alb)
   - Check "Deploy" logs to confirm deployment is complete
   - Should take 2-3 minutes

3. **Wait for deployment to complete:**
   - Status should change from "Deploying" → "Live"
   - Once live, test the API endpoint

---

### Option 2: Manual Redeployment via Render Dashboard

1. **Go to Render Dashboard:**
   - Visit https://dashboard.render.com
   - Look for your backend service (likely named "cleancare-pro-api" or similar)

2. **Trigger Manual Deploy:**
   - Click on the service
   - Scroll to top and click "Deploy" button
   - OR scroll down and find "Latest Deploy" section and click "Redeploy"

3. **Wait for completion:**
   - Build logs should show the deployment progress
   - Look for green checkmark and "Live" status

4. **Verify deployment:**
   - Test API: `curl https://home-services-5alb.onrender.com/api/referrals/health`
   - Should return `200 OK` (if health endpoint exists)
   - Or try the validate endpoint

---

### Option 3: If Backend Service Doesn't Exist Yet

If you don't have a backend service on Render yet:

1. **Create a new Render Web Service:**
   - Go to https://dashboard.render.com → "Create +" → "Web Service"
   - Connect your GitHub repo (if applicable)
   - Configuration:
     - **Name:** cleancare-pro-backend
     - **Build Command:** `cd backend && npm install`
     - **Start Command:** `cd backend && node server-laundry.js`
     - **Port:** 10000

2. **Add Environment Variables:** (in Render dashboard)
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Your JWT secret
   - `DVHOSTING_API_KEY` - SMS API key
   - etc. (same as local .env)

3. **Deploy:**
   - Click "Create Web Service"
   - Render will automatically build and deploy

---

## Changes Made to Backend

### Files Modified:
1. **backend/routes/referrals.js**
   - Added missing `express` import
   - Improved validate endpoint to check both User and Referral models
   - Improved apply endpoint logic

2. **backend/routes/otp-auth.js**
   - Changed referral code generation: now for ALL users, not just new users
   - Updated verify-otp, register, and save-user endpoints

3. **backend/models/User.js**
   - Added phone number normalization in pre-save hook

### Key Fix:
```javascript
// OLD (only new users get codes)
if (isNewUser && !user.referral_code) { ... }

// NEW (all users without codes get them)
if (!user.referral_code) { ... }
```

This ensures same phone number always gets same referral code across devices.

---

## Verification Steps

After deployment, test these:

### Test 1: Health Check
```bash
curl https://home-services-5alb.onrender.com/api/health
```
Should return `200 OK`

### Test 2: Referral Validation
```bash
curl -X POST https://home-services-5alb.onrender.com/api/referrals/validate \
  -H "Content-Type: application/json" \
  -d '{"referralCode":"REF1835PHQ"}'
```
Should return `200` with referral data (not 404)

### Test 3: In the App
1. Open your app on fly.dev
2. Go to Sign In modal
3. Enter referral code (e.g., REF1835PHQ)
4. **Should show:** ✓ Green checkmark with discount info
5. **Should NOT show:** ✗ Red error "Invalid referral code"

---

## Troubleshooting

### Still Getting 404 Errors

**Check 1: Verify backend is running**
- Go to Render dashboard
- Check service status is "Live" (not "Deploying" or "Failed")

**Check 2: Check build logs**
- Click on your service in Render
- Scroll to "Latest Deploy" section
- Review build logs for errors
- Look for "✅ Referral routes registered" message

**Check 3: Clear browser cache**
- Hard refresh the app (Ctrl+Shift+R or Cmd+Shift+R)
- Clear localStorage if needed
- Try incognito/private window

**Check 4: Verify environment variables**
- Make sure all required env vars are set in Render
- Missing env var = backend might not start properly

### Referral Code Still Shows Error

**Check 1: Code exists**
- Verify the code actually exists in database
- Can ask admin to check MongoDB

**Check 2: Code not expired**
- Codes expire after 30 days
- Check if it's an old code

**Check 3: Already used code**
- Some users can't reuse codes
- Different phone numbers needed

---

## Important Notes

⚠️ **Before deploying to production:**
1. Test in development/staging first if possible
2. Backup your database (Render does automatic backups)
3. Deploy during low-traffic period
4. Deployment usually takes 2-5 minutes

✅ **After deployment:**
1. Test referral code validation in the app
2. Test on multiple browsers/devices
3. Verify same phone gets same referral code

---

## Still Need Help?

1. **Check deployment status:** https://dashboard.render.com
2. **View build logs:** Click service → Scroll to "Logs"
3. **Test API directly:** Use curl or Postman
4. **Check frontend config:** Verify API URL in src/config/env.ts points to correct backend

---

## Contact Support

If deployment fails with errors:
- Check Render logs for specific error message
- Share the error with support
- May need to check MongoDB connection or env variables
