import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isPWAEnabled = process.env.ENABLE_PWA !== "false";

  // Dynamically import PWA plugin
  let VitePWA;
  if (isPWAEnabled) {
    try {
      VitePWA = require("vite-plugin-pwa").VitePWA;
    } catch (e) {
      console.warn("vite-plugin-pwa not available, PWA features disabled");
    }
  }
  return {
    server: {
      host: "::",
      port: 10000,
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
      },
    },
            build: {
      chunkSizeWarningLimit: 1000,
      minify: mode === "production" ? "esbuild" : false,
      sourcemap: false,
      reportCompressedSize: false,
      target: 'esnext',
      assetsInlineLimit: 4096,

      // MEMORY OPTIMIZATION FOR RENDER.COM (512MB limit)
      rollupOptions: {
        maxParallelFileOps: 1,
        output: {
          // Reduce total chunks to avoid memory spike
          manualChunks: (id) => {
            // Core vendor
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            // UI library
            if (id.includes('node_modules/@radix-ui')) {
              return 'vendor-ui';
            }
            // Other vendors
            if (id.includes('node_modules')) {
              return 'vendor-other';
            }
          },
          // Reduce inlining overhead
          entryFileNames: 'js/[name]-[hash].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },

      // Aggressively optimize memory during build
      cssCodeSplit: false,

      // Reduce what needs to be kept in memory
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    // Enable gzip compression for assets
    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
      // Reduce memory usage during build
      logLevel: 'warning',
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: ['vite-plugin-pwa'],
    },
    plugins: [
      react({
        // Enable React Fast Refresh for better dev experience
        fastRefresh: true,
      }),
      // Conditionally add PWA plugin
      ...(VitePWA
        ? [
            VitePWA({
              registerType: "autoUpdate", // 🚨 Key for automatic updates
              includeAssets: [
                "favicon.ico",
                "apple-touch-icon.png",
                "masked-icon.svg",
              ],
              manifest: {
                name: "Laundrify - Quick clean & convenient",
                short_name: "Laundrify",
                description: "Quick clean & convenient thats laundrify",
                start_url: "/",
                display: "standalone",
                background_color: "#ffffff",
                theme_color: "#C46DD8",
                icons: [
                  {
                    src: "/laundrify-exact-icon.svg",
                    sizes: "192x192",
                    type: "image/svg+xml",
                  },
                  {
                    src: "/laundrify-exact-icon.svg",
                    sizes: "512x512",
                    type: "image/svg+xml",
                  },
                ],
              },
              workbox: {
                cleanupOutdatedCaches: true, // 🚨 Remove old caches
                clientsClaim: true, // 🚨 Take control immediately
                skipWaiting: true, // 🚨 Activate new SW immediately
                runtimeCaching: [
                  {
                    urlPattern: /^https:\/\/cdn\.builder\.io\/.*/i,
                    handler: "CacheFirst",
                    options: {
                      cacheName: "images-cache",
                      expiration: {
                        maxEntries: 100,
                        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                      },
                    },
                  },
                ],
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
