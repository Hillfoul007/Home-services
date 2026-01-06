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
    // Use rollup for better tree-shaking
    rollupOptions: {
      // Absolute minimum parallel operations
      maxParallelFileOps: 1,
      // Aggressive manual chunking to spread load
      output: {
        // Split into multiple chunks to reduce peak memory
        manualChunks: {
          'react-vendors': ['react', 'react-dom', 'react-router-dom'],
          'radix-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          'charts': ['recharts'],
          'forms': ['react-hook-form', 'input-otp'],
          'utils': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
        },
        // Limit chunk size to prevent large chunks
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name]-[hash].[ext]',
      },
    },
    // Use esbuild for faster, lower memory minification
    minify: "esbuild",
    // Aggressive size reduction
    cssCodeSplit: false,
    sourcemap: false,
    reportCompressedSize: false,
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
  // Aggressive dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      'lucide-react',
      'date-fns',
      'clsx',
      'react-hook-form',
    ],
    exclude: ['vite-plugin-pwa', 'googleapis', 'mongodb'],
  },
});
