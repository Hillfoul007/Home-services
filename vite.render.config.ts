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
    // Minimal chunking to reduce memory usage
    chunkSizeWarningLimit: 500,
        rollupOptions: {
      // Absolute minimum parallel operations
      maxParallelFileOps: 1,
    },
    // Use esbuild for faster, lower memory minification
    minify: "esbuild",
    // Disable all non-essential features
    cssCodeSplit: false,
    sourcemap: false,
    reportCompressedSize: false,
    // Use latest JS features to reduce bundle size
    target: 'esnext',
    // Reduce polyfills
    polyfillModulePreload: false,
  },
  // Minimal esbuild configuration
  esbuild: {
    drop: ["console", "debugger"],
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  plugins: [
    react({
      // Disable fast refresh in production
      fastRefresh: false,
    }),
    // No PWA plugin to save memory
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: ["vite-plugin-pwa"],
  },
});
