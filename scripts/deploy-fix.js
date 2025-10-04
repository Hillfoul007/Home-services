#!/usr/bin/env node

/**
 * Deployment fix script to address common deployment issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Running deployment fixes...');

// 1. Ensure _headers file has correct MIME types
const headersPath = path.join(__dirname, '../public/_headers');
const headersContent = `# Cache static assets for 1 year
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Cache fonts for 1 year
/fonts/*
  Cache-Control: public, max-age=31536000, immutable

# Cache images for 30 days
/images/*
  Cache-Control: public, max-age=2592000

# Cache icons for 30 days
/*.ico
  Cache-Control: public, max-age=2592000

# Cache manifest for 1 day
/manifest.json
  Cache-Control: public, max-age=86400

# Don't cache service worker
/sw.js
  Cache-Control: no-cache

# Cache HTML for 1 hour
/*.html
  Cache-Control: public, max-age=3600

# Cache CSS and JS from assets folder for 1 year with proper MIME types
/*.css
  Cache-Control: public, max-age=31536000, immutable
  Content-Type: text/css

/*.js
  Cache-Control: public, max-age=31536000, immutable
  Content-Type: application/javascript

# Explicit MIME types for assets folder
/assets/*.css
  Content-Type: text/css
  Cache-Control: public, max-age=31536000, immutable

/assets/*.js
  Content-Type: application/javascript
  Cache-Control: public, max-age=31536000, immutable
`;

fs.writeFileSync(headersPath, headersContent);
console.log('✅ Updated _headers file with proper MIME types');

// 2. Ensure _redirects file has correct backend URL
const redirectsPath = path.join(__dirname, '../public/_redirects');
const redirectsContent = `# Netlify redirects for client-side routing
# Redirect all non-API routes to index.html for React Router

# API routes should pass through to backend
/api/*  https://backend-vaxf.onrender.com/api/:splat  200

# Ensure CSS and JS files are served with correct MIME types
/*.css   /assets/*.css   200
/*.js    /assets/*.js    200

# All other routes should serve the React app
/*    /index.html   200
`;

fs.writeFileSync(redirectsPath, redirectsContent);
console.log('✅ Updated _redirects file with correct backend URL');

// 3. Create netlify.toml for additional configuration
const netlifyTomlPath = path.join(__dirname, '../netlify.toml');
const netlifyTomlContent = `[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Content-Type = "text/css"
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Content-Type = "application/javascript"
    Cache-Control = "public, max-age=31536000, immutable"

[[redirects]]
  from = "/api/*"
  to = "https://backend-vaxf.onrender.com/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;

fs.writeFileSync(netlifyTomlPath, netlifyTomlContent);
console.log('✅ Created netlify.toml configuration file');

console.log('🎉 Deployment fixes completed!');
console.log('');
console.log('Next steps:');
console.log('1. Clear browser cache (Ctrl+Shift+R)');
console.log('2. Clear Netlify cache if deploying to Netlify');
console.log('3. Redeploy the application');
