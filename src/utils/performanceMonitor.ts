// Performance monitoring utility for CleanCare Pro
import React from "react";

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  private memoryCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Measure component render time
  startMeasure(name: string): void {
    if (typeof performance !== "undefined") {
      this.metrics.set(name, performance.now());
    }
  }

  endMeasure(name: string): number {
    if (typeof performance !== "undefined" && this.metrics.has(name)) {
      const startTime = this.metrics.get(name)!;
      const duration = performance.now() - startTime;
      this.metrics.delete(name);

      // Log slow renders in development
      if (process.env.NODE_ENV === "development" && duration > 16) {
        console.warn(
          `⚠️ Slow render detected: ${name} took ${duration.toFixed(2)}ms`,
        );
      }

      return duration;
    }
    return 0;
  }

  // Monitor bundle size in development
  checkBundleSize(): void {
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      // Check if performance.getEntriesByType is available
      if ("getEntriesByType" in performance) {
        const navigation = performance.getEntriesByType("navigation")[0] as any;
        if (navigation) {
          const loadTime = navigation.loadEventEnd - navigation.fetchStart;

          if (loadTime > 3000) {
            console.warn(`⚠️ Slow page load: ${loadTime.toFixed(0)}ms`);
            console.log("Consider:");
            console.log("• Code splitting for large components");
            console.log("• Lazy loading non-critical components");
            console.log("• Reducing bundle size");
          }
        }
      }
    }
  }

  // Memory usage monitoring
  checkMemoryUsage(): void {
    if (typeof window !== "undefined" && "memory" in performance) {
      const memory = (performance as any).memory;
      const used = Math.round(memory.usedJSHeapSize / 1048576); // MB
      const total = Math.round(memory.totalJSHeapSize / 1048576); // MB

      if (used > 100) {
        // More than 100MB
        console.warn(`⚠️ High memory usage: ${used}MB / ${total}MB`);
        console.log("Consider using React.memo for expensive components");
      }
    }
  }

  // Monitor long tasks
  observeLongTasks(): void {
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              // Tasks longer than 50ms
              console.warn(
                `⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`,
              );
            }
          }
        });

        observer.observe({ entryTypes: ["longtask"] });
      } catch (error) {
        // Long task API not supported
      }
    }
  }

  // Initialize monitoring
  init(): void {
    if (process.env.NODE_ENV === "development") {
      // Check initial load performance
      setTimeout(() => {
        this.checkBundleSize();
        this.checkMemoryUsage();
      }, 2000);

      // Monitor long tasks
      this.observeLongTasks();

      // Check memory periodically - but clean up existing interval first
      if (this.memoryCheckInterval) {
        clearInterval(this.memoryCheckInterval);
      }
      this.memoryCheckInterval = setInterval(() => {
        this.checkMemoryUsage();
      }, 30000); // Every 30 seconds
    }
  }

  // Cleanup method
  cleanup(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    this.metrics.clear();
  }
}

// Helper function for component performance tracking
export function withPerformanceTracking<T extends React.ComponentType<any>>(
  Component: T,
  componentName: string,
): T {
  const WrappedComponent = (props: any) => {
    const monitor = PerformanceMonitor.getInstance();

    React.useEffect(() => {
      monitor.startMeasure(componentName);
      return () => {
        monitor.endMeasure(componentName);
      };
    });

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `WithPerformanceTracking(${componentName})`;
  return WrappedComponent as T;
}

export default PerformanceMonitor;
