import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Ultra-aggressive optimization for low-memory environments
export default defineConfig({
  server: {
    host: "::",
    port: 10000,
  },
  build: {
    // Absolute minimum chunk sizing
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Strict sequential processing
      maxParallelFileOps: 1,
      output: {
        // Maximize chunking to minimize individual chunk size in memory
        manualChunks: (id) => {
          // Split vendor libraries individually
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'react-vendor';
            }
            if (id.includes('radix-ui')) {
              return 'radix-vendor';
            }
            if (id.includes('recharts')) {
              return 'recharts-vendor';
            }
            if (id.includes('mongoose') || id.includes('mongodb')) {
              return 'db-vendor';
            }
            // Group remaining vendors by first letter to distribute load
            const match = id.match(/\/node_modules\/(@?[a-z])/);
            if (match) {
              return `vendor-${match[1]}`;
            }
            return 'vendor-other';
          }
        },
      },
    },
    // Use fastest minifier
    minify: 'esbuild',
    // No CSS code splitting to reduce build complexity
    cssCodeSplit: false,
    // No sourcemaps to save memory
    sourcemap: false,
    // No reporting
    reportCompressedSize: false,
    // Latest JS to reduce polyfills
    target: 'esnext',
    // Inline all small assets to reduce file processing
    assetsInlineLimit: 4096,
    // Reduce module preload
    polyfillModulePreload: false,
    // Disable minification of identifiers during esbuild to save memory
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: false,
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
    minifySyntax: true,
    minifyWhitespace: true,
    minifyIdentifiers: false, // Keep identifiers to reduce memory during minification
    logLevel: 'error', // Only show errors
    include: /src\/.*\.tsx?$/,
    exclude: /node_modules/,
  },
  plugins: [
    react({
      fastRefresh: false, // Disable in production build
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['vite-plugin-pwa'],
    // Use pre-bundled dependencies
    esbuildOptions: {
      target: 'esnext',
      supported: {
        bigInt: false,
      },
    },
  },
});
