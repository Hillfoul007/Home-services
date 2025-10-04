// Image preloader utility for faster loading
class ImagePreloader {
  private preloadedImages: Set<string> = new Set();
  private imageCache: Map<string, HTMLImageElement> = new Map();

  /**
   * Preload an image
   */
  preload(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      // Check if already preloaded
      if (this.imageCache.has(src)) {
        resolve(this.imageCache.get(src)!);
        return;
      }

      const img = new Image();

      img.onload = () => {
        this.imageCache.set(src, img);
        this.preloadedImages.add(src);
        resolve(img);
      };

      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${src}`));
      };

      // Start loading
      img.src = src;
    });
  }

  /**
   * Preload multiple images
   */
  preloadMultiple(sources: string[]): Promise<HTMLImageElement[]> {
    return Promise.all(sources.map((src) => this.preload(src)));
  }

  /**
   * Preload popular service images
   */
  preloadPopularServices(services: any[]): Promise<HTMLImageElement[]> {
    const popularServices = services.filter(
      (service) => service.popular && service.image,
    );
    const imageSources = popularServices.map((service) => service.image);

    console.log("🚀 Preloading popular service images:", imageSources.length);
    return this.preloadMultiple(imageSources);
  }

  /**
   * Check if image is preloaded
   */
  isPreloaded(src: string): boolean {
    return this.preloadedImages.has(src);
  }

  /**
   * Get preloaded image
   */
  getPreloadedImage(src: string): HTMLImageElement | null {
    return this.imageCache.get(src) || null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.preloadedImages.clear();
    this.imageCache.clear();
  }

  /**
   * Get cache info
   */
  getCacheInfo() {
    return {
      preloadedCount: this.preloadedImages.size,
      cachedCount: this.imageCache.size,
      preloadedImages: Array.from(this.preloadedImages),
    };
  }
}

// Export singleton instance
export const imagePreloader = new ImagePreloader();

// Utility function to preload critical images on app start
export const preloadCriticalImages = async (services: any[]) => {
  try {
    // Preload first 6 service images (above the fold)
    const criticalServices = services.slice(0, 6).filter((s) => s.image);
    const criticalImages = criticalServices.map((s) => s.image);

    if (criticalImages.length > 0) {
      console.log("🎯 Preloading critical images:", criticalImages.length);
      await imagePreloader.preloadMultiple(criticalImages);
      console.log("✅ Critical images preloaded successfully");
    }
  } catch (error) {
    console.warn("⚠️ Failed to preload some critical images:", error);
  }
};

export default imagePreloader;
