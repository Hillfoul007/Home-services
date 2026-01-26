# Render Deployment Guide for Laundrify

This guide explains how to deploy Laundrify to Render with optimized memory usage.

## Overview

The Render deployment is configured to handle the memory constraints of Render's services. The build process has been optimized to use minimal memory while still producing a working application.

## Key Optimizations

### 1. **Memory-Optimized Build**
- Uses `NODE_OPTIONS=--max-old-space-size=300` (300MB limit)
- Disables PWA plugin to save ~100MB during build
- Uses esbuild instead of terser for minification (faster, less memory)
- Aggressive code splitting with manual chunks

### 2. **Render Configuration**
- `render.yaml` specifies optimized build and start commands
- Environment variables configured for production:
  - `NODE_ENV=production`
  - `NODE_OPTIONS=--max-old-space-size=300`
  - `RENDER=true` (disables PWA)
  - `ENABLE_PWA=false` (explicitly disabled)

### 3. **Build Process**
The custom `scripts/render-optimized-build.js` script:
- Builds frontend with minimal dependencies
- Installs backend production dependencies
- Keeps build under 512MB memory limit

### 4. **File Exclusions**
`.renderignore` excludes unnecessary files to:
- Reduce build context size
- Speed up deployment
- Lower memory usage during build

## Deployment Steps

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Render deployment optimizations"
git push origin zen-hub
```

### Step 2: Connect to Render
1. Go to https://render.com/
2. Sign up or log in
3. Click "New +" → "Web Service"
4. Select "GitHub" as repository source
5. Find and connect your GitHub repository
6. Configure:
   - **Name**: laundrify (or your preferred name)
   - **Runtime**: Node
   - **Build Command**: `npm run render:build`
   - **Start Command**: `npm run render:start`

### Step 3: Environment Variables
If render.yaml doesn't load automatically, add these manually:
```
NODE_ENV = production
NODE_OPTIONS = --max-old-space-size=300
RENDER = true
ENABLE_PWA = false
MONGODB_URI = your_mongodb_connection_string
```

### Step 4: Configure Services
1. Create a PostgreSQL or MongoDB service if needed
2. Add the connection string to environment variables
3. Ensure backend environment variables are set

## Troubleshooting

### "Out of Memory" Errors

**Solution**: The memory limits are already optimized. If still failing:

1. Check if PWA is disabled:
   ```
   ENABLE_PWA=false
   RENDER=true
   ```

2. Clear Render's cache and rebuild:
   - Go to service settings
   - Click "Clear build cache"
   - Redeploy

3. Check build logs for memory spikes:
   - Look for "Out of memory" in logs
   - Verify NODE_OPTIONS is set correctly

### Build Takes Too Long

**Solution**: 
1. Ensure `.renderignore` is being used
2. Check that PWA is disabled
3. Verify minimal dependencies are installed

### Backend Connection Issues

**Solution**:
1. Ensure MongoDB/database connection string is set
2. Check backend service is running: `npm run render:start`
3. Verify API endpoint URLs in frontend point to backend service

## Production Features

### Enabled
- ✅ Express server with compression
- ✅ MongoDB integration
- ✅ API endpoints
- ✅ Rider and admin features

### Disabled (To Save Memory)
- ❌ PWA (Progressive Web App)
- ❌ Service Workers
- ❌ Source maps
- ❌ Development logging

## Performance Tips

1. **Caching**: Render caches npm installs. Clear cache if dependencies cause issues.

2. **Database**: 
   - Use MongoDB Atlas for reliable database hosting
   - Set connection pool size: `maxPoolSize=10`

3. **Frontend**:
   - Assets are gzipped automatically
   - CSS is minified
   - JavaScript is optimized with esbuild

4. **Monitoring**:
   - Use Render's dashboard to monitor memory usage
   - Check build logs for warnings
   - Monitor response times

## Updating Deployment

To update the deployment:

1. Make code changes
2. Commit and push to GitHub
3. Render automatically deploys on push to `zen-hub` branch
4. View deployment progress in Render dashboard

## Scaling

To increase resources:
1. Go to Render dashboard → Service settings
2. Change plan from Starter to Professional or higher
3. Increase instance resources as needed

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Build fails with "Out of memory" | Check RENDER=true and ENABLE_PWA=false env vars |
| Frontend can't reach backend | Verify backend service URL in API client |
| Files not updated | Clear cache in Render dashboard and redeploy |
| Slow build times | Ensure .renderignore is working |

## Support

For more help:
- Render Docs: https://render.com/docs
- GitHub Issues: Report build problems
- Check Render service dashboard for detailed logs

---

**Last Updated**: January 2026
**Optimization Level**: Maximum (300MB memory limit)
