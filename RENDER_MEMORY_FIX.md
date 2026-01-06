# Render.com Deployment Memory Optimization

## Problem
The deployment was failing with: `FATAL ERROR: Reached heap limit - JavaScript heap out of memory`

This occurred because the Vite build process was trying to allocate more memory than the 512MB available on Render's free plan.

## Solution Implemented

### 1. **Increased Heap Size (300MB → 400MB)**
   - Updated all build scripts to use `--max-old-space-size=400` instead of 300MB
   - This provides the Node.js process with 400MB of JavaScript heap space
   - Leaves ~100MB for system and ~12MB for other processes

**Files Updated:**
- `package.json` - All build scripts
- `scripts/minimal-build.cjs` - Minimal build script
- `render.yaml` - Render deployment configuration

### 2. **Aggressive Vite Build Optimizations**
   - **Manual Code Splitting**: Split dependencies into separate chunks:
     - React vendors (react, react-dom, react-router-dom)
     - Radix UI components
     - Charts library (recharts)
     - Forms libraries
     - Utility libraries
   - This reduces peak memory usage during the rendering phase
   
   - **Output File Organization**: Organized assets into logical folders (js/, css/, etc.)
   - **Aggressive Minification**: Enable all esbuild optimizers:
     - Minify identifiers
     - Minify syntax
     - Minify whitespace
     - Drop console/debugger statements
   
   - **Dependency Pre-bundling**: Pre-bundle commonly used dependencies to reduce processing during build
   
   - **Exclude Heavy Dependencies**: Excluded from optimization:
     - `googleapis` (very large)
     - `mongodb` (not needed in frontend)
     - `vite-plugin-pwa` (save memory)

### 3. **New Build Script**
Created `scripts/render-optimized-build.cjs` for explicit Render deployments with:
- Memory-optimized configuration
- Garbage collection exposure for better memory management
- Clear logging of memory configuration

## Configuration Details

### Memory Configuration
```
Total Available: 512MB
JavaScript Heap: 400MB
System/Other: ~100-112MB
```

### Chunk Strategy
- `react-vendors`: Core React libraries
- `radix-ui`: All Radix UI component libraries combined
- `charts`: Recharts library
- `forms`: Form-related libraries (react-hook-form, input-otp)
- `utils`: Utility libraries (date-fns, clsx, etc.)
- `main`: Application code and other modules

This strategy:
1. Reduces memory spikes during the rendering phase
2. Allows each chunk to be processed more independently
3. Improves garbage collection efficiency

### Vite Build Settings
- **CSS Code Split**: Disabled (reduces processing overhead)
- **Sourcemaps**: Disabled (saves memory and disk space)
- **Polyfill Module Preload**: Disabled (reduces bundle overhead)
- **Target**: `esnext` (minimal transpilation overhead)

## How to Deploy

### Using Render.com

1. The deployment will automatically use the optimized configuration from `render.yaml`
2. Build command: `NODE_OPTIONS=--max-old-space-size=400 npm install && NODE_OPTIONS=--max-old-space-size=400 npm run build:minimal`
3. The optimized Vite config (`vite.render.config.ts`) is automatically used by `build:minimal`

### Local Development

- Development: `npm run dev` (standard Vite dev server)
- Build locally: `npm run build` (uses the optimized minimal build)
- Build with PWA: `npm run build:pwa` (includes PWA features)

## Performance Impact

### Bundle Size
- Manual chunking spreads code across multiple files
- Better caching for unchanged chunks
- Aggressive minification reduces overall size

### Build Time
- May be slightly slower due to more chunks
- Better memory efficiency means more reliable builds

### Runtime Performance
- Multiple small chunks can improve initial load time
- Code splitting enables better browser caching

## If Build Still Fails

If you still encounter OOM errors on Render:

1. **Check for unnecessary dependencies**:
   - Remove unused packages from `package.json`
   - Be especially careful with large dependencies like `googleapis`

2. **Consider upgrading Render plan**:
   - Free plan: 512MB
   - Paid plans: 1GB+ memory

3. **Reduce bundle size**:
   - Lazy load heavy components
   - Remove unused Radix UI components
   - Consider alternatives to large libraries

4. **Enable more aggressive GC**:
   - The `render-optimized-build.cjs` script exposes GC with `--expose-gc`
   - Can be used for manual GC tuning

## Troubleshooting

### If you see "heap out of memory" after these changes:
- Check if new dependencies were added that are very large
- Verify the build command is using `--max-old-space-size=400`
- Check Render logs to see memory usage trends

### To monitor memory during build locally:
```bash
NODE_OPTIONS=--max-old-space-size=400 --expose-gc npm run build
```

## Files Modified

1. `vite.render.config.ts` - Enhanced Vite configuration
2. `scripts/minimal-build.cjs` - Updated heap size
3. `package.json` - Updated all build scripts with 400MB heap
4. `render.yaml` - Updated build command
5. `scripts/render-optimized-build.cjs` - New optimized build script (optional)
