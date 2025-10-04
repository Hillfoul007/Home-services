import React, { useEffect } from "react";

interface PerformanceMetrics {
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
}

const PerformanceMonitor: React.FC = () => {
  useEffect(() => {
    const measurePerformance = () => {
      if (typeof window === "undefined" || !window.performance) return;

      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType("paint");

      const metrics: PerformanceMetrics = {
        navigationStart: navigation.navigationStart,
        domContentLoaded:
          navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
      };

      // Get paint metrics
      paint.forEach((entry) => {
        if (entry.name === "first-paint") {
          metrics.firstPaint = entry.startTime;
        } else if (entry.name === "first-contentful-paint") {
          metrics.firstContentfulPaint = entry.startTime;
        }
      });

      // Get LCP if available
      if ("PerformanceObserver" in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            metrics.largestContentfulPaint = lastEntry.startTime;

            // Log performance data in development
            if (process.env.NODE_ENV === "development") {
              console.group("🚀 Performance Metrics");
              console.log(
                "DOM Content Loaded:",
                `${metrics.domContentLoaded.toFixed(2)}ms`,
              );
              console.log(
                "Load Complete:",
                `${metrics.loadComplete.toFixed(2)}ms`,
              );
              console.log(
                "First Paint:",
                metrics.firstPaint
                  ? `${metrics.firstPaint.toFixed(2)}ms`
                  : "N/A",
              );
              console.log(
                "First Contentful Paint:",
                metrics.firstContentfulPaint
                  ? `${metrics.firstContentfulPaint.toFixed(2)}ms`
                  : "N/A",
              );
              console.log(
                "Largest Contentful Paint:",
                metrics.largestContentfulPaint
                  ? `${metrics.largestContentfulPaint.toFixed(2)}ms`
                  : "N/A",
              );
              console.groupEnd();

              // Performance warnings
              if (metrics.domContentLoaded > 1500) {
                console.warn(
                  "⚠️ Slow DOM Content Loaded time:",
                  `${metrics.domContentLoaded.toFixed(2)}ms`,
                );
              }
              if (
                metrics.largestContentfulPaint &&
                metrics.largestContentfulPaint > 2500
              ) {
                console.warn(
                  "⚠️ Slow Largest Contentful Paint:",
                  `${metrics.largestContentfulPaint.toFixed(2)}ms`,
                );
              }
            }
          });

          observer.observe({ entryTypes: ["largest-contentful-paint"] });
        } catch (error) {
          console.warn("Performance Observer not supported");
        }
      }

      // Send metrics to analytics in production (if needed)
      if (process.env.NODE_ENV === "production") {
        // Example: send to analytics service
        // analytics.track('performance', metrics);
      }
    };

    // Measure performance after load
    if (document.readyState === "complete") {
      setTimeout(measurePerformance, 0);
    } else {
      window.addEventListener("load", measurePerformance);
    }

    return () => {
      window.removeEventListener("load", measurePerformance);
    };
  }, []);

  return null; // This component doesn't render anything
};

export default PerformanceMonitor;
