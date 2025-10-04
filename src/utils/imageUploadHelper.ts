export interface ImageUploadOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for JPEG compression
}

export interface UploadedImage {
  file: File;
  preview: string;
  optimized: string;
  size: number;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<ImageUploadOptions> = {
  maxSize: 2 * 1024 * 1024, // 2MB
  allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  maxWidth: 1200,
  maxHeight: 800,
  quality: 0.8,
};

class ImageUploadHelper {
  /**
   * Validate if file is a valid image
   */
  validateImage(
    file: File,
    options: ImageUploadOptions = {},
  ): Promise<boolean> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
      // Check file type
      if (!opts.allowedTypes.includes(file.type)) {
        reject(
          new Error(
            `Invalid file type. Allowed types: ${opts.allowedTypes.join(", ")}`,
          ),
        );
        return;
      }

      // Check file size
      if (file.size > opts.maxSize) {
        reject(
          new Error(
            `File too large. Maximum size: ${(opts.maxSize / (1024 * 1024)).toFixed(1)}MB`,
          ),
        );
        return;
      }

      resolve(true);
    });
  }

  /**
   * Create preview URL for image
   */
  createPreview(file: File): string {
    return URL.createObjectURL(file);
  }

  /**
   * Optimize image for web display
   */
  optimizeImage(file: File, options: ImageUploadOptions = {}): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const aspectRatio = width / height;

        if (width > opts.maxWidth) {
          width = opts.maxWidth;
          height = width / aspectRatio;
        }

        if (height > opts.maxHeight) {
          height = opts.maxHeight;
          width = height * aspectRatio;
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress image
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to optimized data URL
        const optimizedDataUrl = canvas.toDataURL("image/jpeg", opts.quality);
        resolve(optimizedDataUrl);
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get image dimensions
   */
  getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Process uploaded image with all optimizations
   */
  async processImage(
    file: File,
    options: ImageUploadOptions = {},
  ): Promise<UploadedImage> {
    try {
      // Validate image
      await this.validateImage(file, options);

      // Get dimensions
      const { width, height } = await this.getImageDimensions(file);

      // Create preview
      const preview = this.createPreview(file);

      // Optimize image
      const optimized = await this.optimizeImage(file, options);

      return {
        file,
        preview,
        optimized,
        size: file.size,
        width,
        height,
      };
    } catch (error) {
      throw new Error(
        `Image processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Upload image to cloud storage (placeholder for your preferred service)
   */
  async uploadToCloudStorage(
    optimizedImageData: string,
    fileName: string,
    folder: string = "services",
  ): Promise<string> {
    // This is a placeholder implementation
    // Replace with your preferred cloud storage service (Cloudinary, AWS S3, etc.)

    try {
      // Convert data URL to blob
      const response = await fetch(optimizedImageData);
      const blob = await response.blob();

      // Create FormData for upload
      const formData = new FormData();
      formData.append("file", blob, fileName);
      formData.append("folder", folder);

      // Example upload to your backend
      const uploadResponse = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const result = await uploadResponse.json();
      return result.url;
    } catch (error) {
      console.error("Cloud upload failed:", error);

      // Fallback: return the optimized data URL for now
      // In production, you should implement proper cloud storage
      return optimizedImageData;
    }
  }

  /**
   * Batch process multiple images
   */
  async processMultipleImages(
    files: FileList | File[],
    options: ImageUploadOptions = {},
  ): Promise<UploadedImage[]> {
    const fileArray = Array.from(files);
    const promises = fileArray.map((file) => this.processImage(file, options));

    try {
      return await Promise.all(promises);
    } catch (error) {
      throw new Error(
        `Batch processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Clean up preview URLs to prevent memory leaks
   */
  cleanupPreviews(images: UploadedImage[]): void {
    images.forEach((image) => {
      if (image.preview.startsWith("blob:")) {
        URL.revokeObjectURL(image.preview);
      }
    });
  }

  /**
   * Convert file to base64 for easy storage/transmission
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Resize image to specific dimensions
   */
  resizeImage(
    file: File,
    targetWidth: number,
    targetHeight: number,
    maintainAspectRatio: boolean = true,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        let width = targetWidth;
        let height = targetHeight;

        if (maintainAspectRatio) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;

          if (targetWidth / targetHeight > aspectRatio) {
            width = targetHeight * aspectRatio;
          } else {
            height = targetWidth / aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };

      img.onerror = () => reject(new Error("Failed to resize image"));
      img.src = URL.createObjectURL(file);
    });
  }
}

export const imageUploadHelper = new ImageUploadHelper();

// Utility functions for common use cases
export const createServiceImageUploader = (options?: ImageUploadOptions) => {
  const serviceOptions = {
    maxSize: 1024 * 1024, // 1MB for service images
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxWidth: 800,
    maxHeight: 600,
    quality: 0.85,
    ...options,
  };

  return {
    process: (file: File) =>
      imageUploadHelper.processImage(file, serviceOptions),
    upload: (optimizedData: string, serviceName: string) =>
      imageUploadHelper.uploadToCloudStorage(
        optimizedData,
        `${serviceName.toLowerCase().replace(/\s+/g, "-")}.jpg`,
        "services",
      ),
  };
};

export const createBulkImageUploader = (options?: ImageUploadOptions) => {
  return {
    processAll: (files: FileList | File[]) =>
      imageUploadHelper.processMultipleImages(files, options),
    cleanup: (images: UploadedImage[]) =>
      imageUploadHelper.cleanupPreviews(images),
  };
};
