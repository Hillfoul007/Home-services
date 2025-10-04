// Vite plugin for cache optimization
export const cacheOptimizationPlugin = () => {
  return {
    name: "cache-optimization",
    generateBundle(options, bundle) {
      // Add cache headers for static assets
      Object.keys(bundle).forEach((fileName) => {
        if (fileName.endsWith(".js") || fileName.endsWith(".css")) {
          bundle[fileName].fileName = fileName.replace(
            /\.[^.]+$/,
            (ext) => `.${Date.now()}${ext}`,
          );
        }
      });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Add cache headers for development
        if (req.url?.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
        next();
      });
    },
  };
};
