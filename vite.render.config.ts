import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Ultra-minimal configuration for 512MB memory constraint
export default defineConfig({
  server: {
    host: "::",
    port: 10000,
  },
  build: {
    // Aggressive memory optimizations
    chunkSizeWarningLimit: 1000,
    // Limit concurrent workers to prevent memory spikes
    ssr: false,
    // Use rollup for better tree-shaking
    rollupOptions: {
      // Native-only Capacitor plugins — not resolvable in a web build
      external: ['@capacitor-community/background-geolocation'],
      // Absolute minimum parallel operations to prevent memory spikes
      maxParallelFileOps: 1,
      // Limit concurrent chunk processing
      maxChunks: 50,
      // Aggressive manual chunking to spread load
      output: {
        // Minimal chunking to reduce file I/O and memory pressure
        // Group vendors but keep it simple
        manualChunks: {
          'vendors': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-avatar', '@radix-ui/react-checkbox', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-label', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-separator', '@radix-ui/react-switch', '@radix-ui/react-tabs', '@radix-ui/react-tooltip'],
          'extras': ['lucide-react', 'date-fns', 'recharts'],
        },
        // Limit chunk size to prevent large chunks
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name]-[hash].[ext]',
      },
    },
    // Use esbuild for faster, lower memory minification
    minify: "esbuild",
    // Do NOT split CSS to reduce file operations and memory usage
    cssCodeSplit: false,
    // Inline CSS for critical styles to reduce HTTP requests and memory
    cssMinify: "esbuild",
    sourcemap: false,
    reportCompressedSize: false,
    // Limit the number of modules processed at once
    modulePreload: {
      polyfill: false
    },
    // Use latest JS features to reduce bundle size
    target: 'esnext',
    // Don't include module preload polyfill
    polyfillModulePreload: false,
    // Inline small assets
    assetsInlineLimit: 4096,
    // Reduce JS transpilation overhead
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      output: {
        comments: false,
      },
    },
  },
  // Aggressive esbuild configuration
  esbuild: {
    drop: ["console", "debugger"],
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    // Reduce target to minimize transpilation
    target: 'esnext',
    // Limit inline threshold to reduce AST size
    pure: ["console.log", "console.debug"],
  },
  plugins: [
    react({
      // Disable fast refresh in production
      fastRefresh: false,
      // Reduce jsxImportSource overhead
      jsxImportSource: 'react',
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Minimal dependency optimization to save memory during build
  optimizeDeps: {
    // Only optimize critical dependencies
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'date-fns',
    ],
    // Exclude heavy dependencies that don't need pre-bundling
    exclude: ['vite-plugin-pwa', 'googleapis', 'mongodb', '@radix-ui/*', '@capacitor-community/background-geolocation'],
  },
});
