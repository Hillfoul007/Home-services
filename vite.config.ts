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
      middlewareMode: false,
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
      },
    },
            build: {
      chunkSizeWarningLimit: 2000,
      minify: mode === "production" ? "esbuild" : false,
      sourcemap: false,
      reportCompressedSize: false,
      target: 'esnext',
      assetsInlineLimit: 8192,
      emptyOutDir: true,

      // MEMORY OPTIMIZATION FOR RENDER.COM (512MB limit)
      rollupOptions: {
        maxParallelFileOps: 1,
        // Suppress warnings to save memory
        onwarn(warning) {
          if (warning.code === 'CIRCULAR_DEPENDENCY' || warning.code === 'EVAL') return;
        },
        output: {
          // Larger chunks - fewer splits reduce build memory
          manualChunks: (id) => {
            // Core vendor - single large chunk
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-core';
            }
            // UI + utilities
            if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/lucide-react')) {
              return 'vendor-ui';
            }
            // Everything else in one chunk
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
          // Optimize filenames
          entryFileNames: '[name]-[hash].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          // Reduce intermediate chunk creation
          inlineDynamicImports: false,
          // Don't split by output format
          format: 'es',
        },
      },

      // Aggressively optimize memory during build
      cssCodeSplit: false,
      write: true,

      // Reduce what needs to be kept in memory
      commonjsOptions: {
        transformMixedEsModules: true,
        sourceMap: false,
      },
    },
    // Optimize esbuild for memory efficiency
    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
      logLevel: 'warning',
      // Reduce intermediate representations in memory
      keepNames: false,
      pure: ['console.log', 'console.warn', 'console.error'],
    },
    // Optimize dependencies - be selective to save memory
    optimizeDeps: {
      // Only pre-bundle critical deps
      include: ['react', 'react-dom', '@radix-ui/react-dialog', '@radix-ui/react-select'],
      exclude: ['vite-plugin-pwa', '@googlemaps/js-api-loader'],
      // Reduce cache overhead
      holdFiles: [],
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
