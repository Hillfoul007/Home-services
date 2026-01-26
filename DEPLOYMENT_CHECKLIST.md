# Render Deployment Checklist

Complete this checklist before deploying to Render:

## Pre-Deployment (Local)

- [ ] Run local development server: `npm run dev`
- [ ] Test that frontend loads correctly
- [ ] Test that backend API is accessible
- [ ] No console errors or warnings
- [ ] Verify all features work as expected

## Build Testing

- [ ] Test production build locally:
  ```bash
  npm run build
  npm run preview
  ```
- [ ] Test Render-optimized build:
  ```bash
  RENDER=true npm run render:build
  ```
- [ ] Check that `dist/` folder is created
- [ ] Verify build completes without "Out of memory" errors

## Files to Verify

- [ ] `render.yaml` exists and is valid
- [ ] `.renderignore` exists in root directory
- [ ] `scripts/render-optimized-build.js` exists
- [ ] `package.json` has updated `start:prod` script
- [ ] `vite.config.ts` has Render optimizations
- [ ] `RENDER_DEPLOYMENT_GUIDE.md` for reference
- [ ] `RENDER_OPTIMIZATION_SUMMARY.md` for reference

## Git Commit

- [ ] All files are added to git
- [ ] Commit message is descriptive:
  ```bash
  git add .
  git commit -m "Optimize Render deployment with memory-efficient build"
  ```
- [ ] Changes are pushed to `zen-hub` branch:
  ```bash
  git push origin zen-hub
  ```

## Render Setup

### Service Configuration
- [ ] Service name: `laundrify` (or preferred name)
- [ ] GitHub repository selected and connected
- [ ] Branch: `zen-hub`
- [ ] Runtime: Node.js

### Build & Start Commands
- [ ] Build Command: `npm run render:build`
- [ ] Start Command: `npm run render:start`

### Environment Variables
Set the following in Render dashboard:
- [ ] `NODE_ENV` = `production`
- [ ] `NODE_OPTIONS` = `--max-old-space-size=300`
- [ ] `RENDER` = `true`
- [ ] `ENABLE_PWA` = `false`
- [ ] `MONGODB_URI` = (your MongoDB connection string)
- [ ] Any other backend API keys

## Deployment

- [ ] Click "Deploy" in Render dashboard
- [ ] Monitor build logs in real-time
- [ ] Watch for "Out of memory" errors (should NOT appear)
- [ ] Build should complete in under 3 minutes
- [ ] Application should be live at provided URL

## Post-Deployment Testing

### Frontend
- [ ] Homepage loads without errors
- [ ] Search functionality works
- [ ] Browse services works
- [ ] Responsive design works on mobile
- [ ] Images load correctly

### Backend
- [ ] API endpoints are accessible
- [ ] Database connection works
- [ ] Authentication features work (if applicable)
- [ ] Rider features work (if applicable)
- [ ] Admin panel works (if applicable)

### Performance
- [ ] Page load time is reasonable (<5s)
- [ ] No 500 errors in logs
- [ ] No memory warnings in logs
- [ ] All API calls complete successfully

## Monitoring

- [ ] Set up Render log monitoring
- [ ] Check logs for any warnings or errors
- [ ] Verify application is running (green status)
- [ ] Note the deployed URL for team access

## If Deployment Fails

1. **Check Build Logs**
   - Look for "Out of memory" errors
   - Check if npm install completed successfully
   - Verify build command ran correctly

2. **Verify Configuration**
   - Confirm all environment variables are set
   - Check that `.renderignore` is working
   - Verify `render.yaml` is correct

3. **Clear Cache and Retry**
   - Go to service settings
   - Click "Clear build cache"
   - Click "Manual Deploy"

4. **Common Fixes**
   - Ensure `ENABLE_PWA=false`
   - Ensure `RENDER=true`
   - Ensure `NODE_OPTIONS=--max-old-space-size=300`

## Rollback Plan

If the deployed version has issues:

1. Go to Render service → Deployments
2. Find the previous successful deployment
3. Click the "..." menu and select "Deploy"
4. This restarts the previous working version

## Documentation References

- **Deployment Guide**: `RENDER_DEPLOYMENT_GUIDE.md`
- **Optimization Summary**: `RENDER_OPTIMIZATION_SUMMARY.md`
- **Render Official Docs**: https://render.com/docs
- **Vite Config Docs**: https://vitejs.dev/config/

## Success Criteria

✅ Deployment complete when:
- [ ] Build completes without "Out of memory" errors
- [ ] Application is running (green status in Render)
- [ ] Frontend loads and displays correctly
- [ ] Backend API responds to requests
- [ ] Team can access the application URL
- [ ] No critical errors in logs

---

## Quick Reference Commands

```bash
# Local testing
npm run dev              # Development server
npm run build           # Standard build
npm run preview         # Preview production build

# Render testing
RENDER=true npm run render:build    # Test Render build locally
npm run render:start                # Test Render startup

# Git operations
git status              # Check what's changed
git add .              # Stage all changes
git commit -m "message" # Commit changes
git push origin zen-hub # Push to GitHub
```

---

**Date Started**: January 26, 2026
**Optimization Level**: Maximum (for Render's memory constraints)
**Status**: Ready for deployment
