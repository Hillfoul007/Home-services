/**
 * Performance monitoring utility for Google Maps API usage
 * Helps track and optimize API call patterns
 */

interface APICallStats {
  count: number;
  totalTime: number;
  averageTime: number;
  errors: number;
  cacheHits: number;
}

class MapsPerformanceMonitor {
  private static instance: MapsPerformanceMonitor;
  private stats: Record<string, APICallStats> = {};
  private isEnabled = process.env.NODE_ENV === 'development';

  private constructor() {}

  public static getInstance(): MapsPerformanceMonitor {
    if (!MapsPerformanceMonitor.instance) {
      MapsPerformanceMonitor.instance = new MapsPerformanceMonitor();
    }
    return MapsPerformanceMonitor.instance;
  }

  /**
   * Track an API call
   */
  trackAPICall(service: string, startTime: number, success: boolean, fromCache = false): void {
    if (!this.isEnabled) return;

    const duration = Date.now() - startTime;
    
    if (!this.stats[service]) {
      this.stats[service] = {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        errors: 0,
        cacheHits: 0,
      };
    }

    const stat = this.stats[service];
    stat.count++;
    
    if (fromCache) {
      stat.cacheHits++;
    } else {
      stat.totalTime += duration;
      stat.averageTime = stat.totalTime / (stat.count - stat.cacheHits);
    }
    
    if (!success) {
      stat.errors++;
    }

    // Log performance warnings
    if (stat.averageTime > 3000) {
      console.warn(`⚠️ Slow ${service} API calls detected (avg: ${stat.averageTime.toFixed(0)}ms)`);
    }
    
    if (stat.errors / stat.count > 0.1) {
      console.warn(`⚠️ High error rate for ${service}: ${((stat.errors / stat.count) * 100).toFixed(1)}%`);
    }
  }

  /**
   * Log performance statistics
   */
  logStats(): void {
    if (!this.isEnabled) return;

    console.group('📊 Google Maps API Performance Stats');
    
    Object.entries(this.stats).forEach(([service, stat]) => {
      const cacheHitRate = stat.count > 0 ? (stat.cacheHits / stat.count * 100).toFixed(1) : '0';
      const errorRate = stat.count > 0 ? (stat.errors / stat.count * 100).toFixed(1) : '0';
      
      console.log(`
${service}:
  📞 Calls: ${stat.count}
  ⚡ Cache hits: ${stat.cacheHits} (${cacheHitRate}%)
  ⏱️ Avg time: ${stat.averageTime.toFixed(0)}ms
  ❌ Errors: ${stat.errors} (${errorRate}%)
      `);
    });
    
    console.groupEnd();
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    Object.entries(this.stats).forEach(([service, stat]) => {
      const cacheHitRate = stat.count > 0 ? stat.cacheHits / stat.count : 0;
      const errorRate = stat.count > 0 ? stat.errors / stat.count : 0;
      
      if (cacheHitRate < 0.3 && stat.count > 10) {
        recommendations.push(`Consider increasing cache duration for ${service}`);
      }
      
      if (stat.averageTime > 2000) {
        recommendations.push(`${service} calls are slow - consider simplifying requests`);
      }
      
      if (errorRate > 0.1) {
        recommendations.push(`High error rate for ${service} - check API key and quotas`);
      }
      
      if (stat.count > 100) {
        recommendations.push(`Many ${service} calls detected - consider batching or reducing frequency`);
      }
    });
    
    return recommendations;
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {};
  }
}

export const performanceMonitor = MapsPerformanceMonitor.getInstance();

/**
 * Decorator to track API call performance
 */
export function trackPerformance(service: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = false;
      let fromCache = false;

      try {
        const result = await method.apply(this, args);
        success = true;
        
        // Detect if result came from cache (simple heuristic)
        if (Date.now() - startTime < 50) {
          fromCache = true;
        }
        
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        performanceMonitor.trackAPICall(service, startTime, success, fromCache);
      }
    };

    return descriptor;
  };
}
