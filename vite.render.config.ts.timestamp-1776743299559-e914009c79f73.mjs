// vite.render.config.ts
import { defineConfig } from "file:///C:/Users/Kataria/Home-services/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Kataria/Home-services/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\Kataria\\Home-services";
var vite_render_config_default = defineConfig({
  server: {
    host: "::",
    port: 1e4
  },
  build: {
    // Aggressive memory optimizations
    chunkSizeWarningLimit: 1e3,
    // Limit concurrent workers to prevent memory spikes
    ssr: false,
    // Use rollup for better tree-shaking
    rollupOptions: {
      // Native-only Capacitor plugins — not resolvable in a web build
      external: ["@capacitor-community/background-geolocation"],
      // Absolute minimum parallel operations to prevent memory spikes
      maxParallelFileOps: 1,
      // Limit concurrent chunk processing
      maxChunks: 50,
      // Aggressive manual chunking to spread load
      output: {
        // Minimal chunking to reduce file I/O and memory pressure
        // Group vendors but keep it simple
        manualChunks: {
          "vendors": ["react", "react-dom", "react-router-dom"],
          "ui": ["@radix-ui/react-accordion", "@radix-ui/react-alert-dialog", "@radix-ui/react-avatar", "@radix-ui/react-checkbox", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-label", "@radix-ui/react-popover", "@radix-ui/react-select", "@radix-ui/react-separator", "@radix-ui/react-switch", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
          "extras": ["lucide-react", "date-fns", "recharts"]
        },
        // Limit chunk size to prevent large chunks
        chunkFileNames: "js/[name]-[hash].js",
        entryFileNames: "js/[name]-[hash].js",
        assetFileNames: "[ext]/[name]-[hash].[ext]"
      }
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
    target: "esnext",
    // Don't include module preload polyfill
    polyfillModulePreload: false,
    // Inline small assets
    assetsInlineLimit: 4096,
    // Reduce JS transpilation overhead
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2
      },
      output: {
        comments: false
      }
    }
  },
  // Aggressive esbuild configuration
  esbuild: {
    drop: ["console", "debugger"],
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    // Reduce target to minimize transpilation
    target: "esnext",
    // Limit inline threshold to reduce AST size
    pure: ["console.log", "console.debug"]
  },
  plugins: [
    react({
      // Disable fast refresh in production
      fastRefresh: false,
      // Reduce jsxImportSource overhead
      jsxImportSource: "react"
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  // Minimal dependency optimization to save memory during build
  optimizeDeps: {
    // Only optimize critical dependencies
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "lucide-react",
      "date-fns"
    ],
    // Exclude heavy dependencies that don't need pre-bundling
    exclude: ["vite-plugin-pwa", "googleapis", "mongodb", "@radix-ui/*", "@capacitor-community/background-geolocation"]
  }
});
export {
  vite_render_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5yZW5kZXIuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcS2F0YXJpYVxcXFxIb21lLXNlcnZpY2VzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxLYXRhcmlhXFxcXEhvbWUtc2VydmljZXNcXFxcdml0ZS5yZW5kZXIuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9LYXRhcmlhL0hvbWUtc2VydmljZXMvdml0ZS5yZW5kZXIuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuLy8gVWx0cmEtbWluaW1hbCBjb25maWd1cmF0aW9uIGZvciA1MTJNQiBtZW1vcnkgY29uc3RyYWludFxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogXCI6OlwiLFxyXG4gICAgcG9ydDogMTAwMDAsXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgLy8gQWdncmVzc2l2ZSBtZW1vcnkgb3B0aW1pemF0aW9uc1xyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgLy8gTGltaXQgY29uY3VycmVudCB3b3JrZXJzIHRvIHByZXZlbnQgbWVtb3J5IHNwaWtlc1xyXG4gICAgc3NyOiBmYWxzZSxcclxuICAgIC8vIFVzZSByb2xsdXAgZm9yIGJldHRlciB0cmVlLXNoYWtpbmdcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgLy8gTmF0aXZlLW9ubHkgQ2FwYWNpdG9yIHBsdWdpbnMgXHUyMDE0IG5vdCByZXNvbHZhYmxlIGluIGEgd2ViIGJ1aWxkXHJcbiAgICAgIGV4dGVybmFsOiBbJ0BjYXBhY2l0b3ItY29tbXVuaXR5L2JhY2tncm91bmQtZ2VvbG9jYXRpb24nXSxcclxuICAgICAgLy8gQWJzb2x1dGUgbWluaW11bSBwYXJhbGxlbCBvcGVyYXRpb25zIHRvIHByZXZlbnQgbWVtb3J5IHNwaWtlc1xyXG4gICAgICBtYXhQYXJhbGxlbEZpbGVPcHM6IDEsXHJcbiAgICAgIC8vIExpbWl0IGNvbmN1cnJlbnQgY2h1bmsgcHJvY2Vzc2luZ1xyXG4gICAgICBtYXhDaHVua3M6IDUwLFxyXG4gICAgICAvLyBBZ2dyZXNzaXZlIG1hbnVhbCBjaHVua2luZyB0byBzcHJlYWQgbG9hZFxyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAvLyBNaW5pbWFsIGNodW5raW5nIHRvIHJlZHVjZSBmaWxlIEkvTyBhbmQgbWVtb3J5IHByZXNzdXJlXHJcbiAgICAgICAgLy8gR3JvdXAgdmVuZG9ycyBidXQga2VlcCBpdCBzaW1wbGVcclxuICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICd2ZW5kb3JzJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgJ3VpJzogWydAcmFkaXgtdWkvcmVhY3QtYWNjb3JkaW9uJywgJ0ByYWRpeC11aS9yZWFjdC1hbGVydC1kaWFsb2cnLCAnQHJhZGl4LXVpL3JlYWN0LWF2YXRhcicsICdAcmFkaXgtdWkvcmVhY3QtY2hlY2tib3gnLCAnQHJhZGl4LXVpL3JlYWN0LWRpYWxvZycsICdAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudScsICdAcmFkaXgtdWkvcmVhY3QtbGFiZWwnLCAnQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXInLCAnQHJhZGl4LXVpL3JlYWN0LXNlbGVjdCcsICdAcmFkaXgtdWkvcmVhY3Qtc2VwYXJhdG9yJywgJ0ByYWRpeC11aS9yZWFjdC1zd2l0Y2gnLCAnQHJhZGl4LXVpL3JlYWN0LXRhYnMnLCAnQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXAnXSxcclxuICAgICAgICAgICdleHRyYXMnOiBbJ2x1Y2lkZS1yZWFjdCcsICdkYXRlLWZucycsICdyZWNoYXJ0cyddLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLy8gTGltaXQgY2h1bmsgc2l6ZSB0byBwcmV2ZW50IGxhcmdlIGNodW5rc1xyXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnanMvW25hbWVdLVtoYXNoXS5qcycsXHJcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdqcy9bbmFtZV0tW2hhc2hdLmpzJyxcclxuICAgICAgICBhc3NldEZpbGVOYW1lczogJ1tleHRdL1tuYW1lXS1baGFzaF0uW2V4dF0nLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIC8vIFVzZSBlc2J1aWxkIGZvciBmYXN0ZXIsIGxvd2VyIG1lbW9yeSBtaW5pZmljYXRpb25cclxuICAgIG1pbmlmeTogXCJlc2J1aWxkXCIsXHJcbiAgICAvLyBEbyBOT1Qgc3BsaXQgQ1NTIHRvIHJlZHVjZSBmaWxlIG9wZXJhdGlvbnMgYW5kIG1lbW9yeSB1c2FnZVxyXG4gICAgY3NzQ29kZVNwbGl0OiBmYWxzZSxcclxuICAgIC8vIElubGluZSBDU1MgZm9yIGNyaXRpY2FsIHN0eWxlcyB0byByZWR1Y2UgSFRUUCByZXF1ZXN0cyBhbmQgbWVtb3J5XHJcbiAgICBjc3NNaW5pZnk6IFwiZXNidWlsZFwiLFxyXG4gICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgIHJlcG9ydENvbXByZXNzZWRTaXplOiBmYWxzZSxcclxuICAgIC8vIExpbWl0IHRoZSBudW1iZXIgb2YgbW9kdWxlcyBwcm9jZXNzZWQgYXQgb25jZVxyXG4gICAgbW9kdWxlUHJlbG9hZDoge1xyXG4gICAgICBwb2x5ZmlsbDogZmFsc2VcclxuICAgIH0sXHJcbiAgICAvLyBVc2UgbGF0ZXN0IEpTIGZlYXR1cmVzIHRvIHJlZHVjZSBidW5kbGUgc2l6ZVxyXG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcclxuICAgIC8vIERvbid0IGluY2x1ZGUgbW9kdWxlIHByZWxvYWQgcG9seWZpbGxcclxuICAgIHBvbHlmaWxsTW9kdWxlUHJlbG9hZDogZmFsc2UsXHJcbiAgICAvLyBJbmxpbmUgc21hbGwgYXNzZXRzXHJcbiAgICBhc3NldHNJbmxpbmVMaW1pdDogNDA5NixcclxuICAgIC8vIFJlZHVjZSBKUyB0cmFuc3BpbGF0aW9uIG92ZXJoZWFkXHJcbiAgICB0ZXJzZXJPcHRpb25zOiB7XHJcbiAgICAgIGNvbXByZXNzOiB7XHJcbiAgICAgICAgZHJvcF9jb25zb2xlOiB0cnVlLFxyXG4gICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWUsXHJcbiAgICAgICAgcGFzc2VzOiAyLFxyXG4gICAgICB9LFxyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBjb21tZW50czogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgLy8gQWdncmVzc2l2ZSBlc2J1aWxkIGNvbmZpZ3VyYXRpb25cclxuICBlc2J1aWxkOiB7XHJcbiAgICBkcm9wOiBbXCJjb25zb2xlXCIsIFwiZGVidWdnZXJcIl0sXHJcbiAgICBtaW5pZnlJZGVudGlmaWVyczogdHJ1ZSxcclxuICAgIG1pbmlmeVN5bnRheDogdHJ1ZSxcclxuICAgIG1pbmlmeVdoaXRlc3BhY2U6IHRydWUsXHJcbiAgICAvLyBSZWR1Y2UgdGFyZ2V0IHRvIG1pbmltaXplIHRyYW5zcGlsYXRpb25cclxuICAgIHRhcmdldDogJ2VzbmV4dCcsXHJcbiAgICAvLyBMaW1pdCBpbmxpbmUgdGhyZXNob2xkIHRvIHJlZHVjZSBBU1Qgc2l6ZVxyXG4gICAgcHVyZTogW1wiY29uc29sZS5sb2dcIiwgXCJjb25zb2xlLmRlYnVnXCJdLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3Qoe1xyXG4gICAgICAvLyBEaXNhYmxlIGZhc3QgcmVmcmVzaCBpbiBwcm9kdWN0aW9uXHJcbiAgICAgIGZhc3RSZWZyZXNoOiBmYWxzZSxcclxuICAgICAgLy8gUmVkdWNlIGpzeEltcG9ydFNvdXJjZSBvdmVyaGVhZFxyXG4gICAgICBqc3hJbXBvcnRTb3VyY2U6ICdyZWFjdCcsXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIC8vIE1pbmltYWwgZGVwZW5kZW5jeSBvcHRpbWl6YXRpb24gdG8gc2F2ZSBtZW1vcnkgZHVyaW5nIGJ1aWxkXHJcbiAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAvLyBPbmx5IG9wdGltaXplIGNyaXRpY2FsIGRlcGVuZGVuY2llc1xyXG4gICAgaW5jbHVkZTogW1xyXG4gICAgICAncmVhY3QnLFxyXG4gICAgICAncmVhY3QtZG9tJyxcclxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxyXG4gICAgICAnbHVjaWRlLXJlYWN0JyxcclxuICAgICAgJ2RhdGUtZm5zJyxcclxuICAgIF0sXHJcbiAgICAvLyBFeGNsdWRlIGhlYXZ5IGRlcGVuZGVuY2llcyB0aGF0IGRvbid0IG5lZWQgcHJlLWJ1bmRsaW5nXHJcbiAgICBleGNsdWRlOiBbJ3ZpdGUtcGx1Z2luLXB3YScsICdnb29nbGVhcGlzJywgJ21vbmdvZGInLCAnQHJhZGl4LXVpLyonLCAnQGNhcGFjaXRvci1jb21tdW5pdHkvYmFja2dyb3VuZC1nZW9sb2NhdGlvbiddLFxyXG4gIH0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtTLFNBQVMsb0JBQW9CO0FBQy9ULE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyw2QkFBUSxhQUFhO0FBQUEsRUFDMUIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBLElBRUwsdUJBQXVCO0FBQUE7QUFBQSxJQUV2QixLQUFLO0FBQUE7QUFBQSxJQUVMLGVBQWU7QUFBQTtBQUFBLE1BRWIsVUFBVSxDQUFDLDZDQUE2QztBQUFBO0FBQUEsTUFFeEQsb0JBQW9CO0FBQUE7QUFBQSxNQUVwQixXQUFXO0FBQUE7QUFBQSxNQUVYLFFBQVE7QUFBQTtBQUFBO0FBQUEsUUFHTixjQUFjO0FBQUEsVUFDWixXQUFXLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ3BELE1BQU0sQ0FBQyw2QkFBNkIsZ0NBQWdDLDBCQUEwQiw0QkFBNEIsMEJBQTBCLGlDQUFpQyx5QkFBeUIsMkJBQTJCLDBCQUEwQiw2QkFBNkIsMEJBQTBCLHdCQUF3Qix5QkFBeUI7QUFBQSxVQUMzVyxVQUFVLENBQUMsZ0JBQWdCLFlBQVksVUFBVTtBQUFBLFFBQ25EO0FBQUE7QUFBQSxRQUVBLGdCQUFnQjtBQUFBLFFBQ2hCLGdCQUFnQjtBQUFBLFFBQ2hCLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFFQSxRQUFRO0FBQUE7QUFBQSxJQUVSLGNBQWM7QUFBQTtBQUFBLElBRWQsV0FBVztBQUFBLElBQ1gsV0FBVztBQUFBLElBQ1gsc0JBQXNCO0FBQUE7QUFBQSxJQUV0QixlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsSUFDWjtBQUFBO0FBQUEsSUFFQSxRQUFRO0FBQUE7QUFBQSxJQUVSLHVCQUF1QjtBQUFBO0FBQUEsSUFFdkIsbUJBQW1CO0FBQUE7QUFBQSxJQUVuQixlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxlQUFlO0FBQUEsUUFDZixRQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sVUFBVTtBQUFBLE1BQ1o7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDUCxNQUFNLENBQUMsV0FBVyxVQUFVO0FBQUEsSUFDNUIsbUJBQW1CO0FBQUEsSUFDbkIsY0FBYztBQUFBLElBQ2Qsa0JBQWtCO0FBQUE7QUFBQSxJQUVsQixRQUFRO0FBQUE7QUFBQSxJQUVSLE1BQU0sQ0FBQyxlQUFlLGVBQWU7QUFBQSxFQUN2QztBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBO0FBQUEsTUFFSixhQUFhO0FBQUE7QUFBQSxNQUViLGlCQUFpQjtBQUFBLElBQ25CLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUVBLGNBQWM7QUFBQTtBQUFBLElBRVosU0FBUztBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFFQSxTQUFTLENBQUMsbUJBQW1CLGNBQWMsV0FBVyxlQUFlLDZDQUE2QztBQUFBLEVBQ3BIO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
