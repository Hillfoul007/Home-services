import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  X,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Download,
  Eye,
} from "lucide-react";
import {
  imageUploadHelper,
  createServiceImageUploader,
  type UploadedImage,
  type ImageUploadOptions,
} from "@/utils/imageUploadHelper";

interface ImageUploadManagerProps {
  onImagesUploaded?: (images: UploadedImage[]) => void;
  onError?: (error: string) => void;
  maxImages?: number;
  uploadOptions?: ImageUploadOptions;
  showPreview?: boolean;
  allowBulkUpload?: boolean;
}

export const ImageUploadManager: React.FC<ImageUploadManagerProps> = ({
  onImagesUploaded,
  onError,
  maxImages = 10,
  uploadOptions,
  showPreview = true,
  allowBulkUpload = true,
}) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const serviceUploader = createServiceImageUploader(uploadOptions);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      if (images.length + fileArray.length > maxImages) {
        onError?.(`Maximum ${maxImages} images allowed`);
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      try {
        const processedImages: UploadedImage[] = [];

        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i];

          try {
            const processed = await serviceUploader.process(file);
            processedImages.push(processed);

            // Update progress
            const progress = ((i + 1) / fileArray.length) * 100;
            setUploadProgress(progress);
          } catch (error) {
            onError?.(
              `Failed to process ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }

        const newImages = [...images, ...processedImages];
        setImages(newImages);
        onImagesUploaded?.(newImages);
      } catch (error) {
        onError?.(
          `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [images, maxImages, onError, onImagesUploaded, serviceUploader],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles],
  );

  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      setImages(newImages);
      onImagesUploaded?.(newImages);

      // Clean up the removed image preview
      if (images[index]?.preview.startsWith("blob:")) {
        URL.revokeObjectURL(images[index].preview);
      }
    },
    [images, onImagesUploaded],
  );

  const uploadToCloud = useCallback(
    async (image: UploadedImage, serviceName: string) => {
      try {
        const cloudUrl = await serviceUploader.upload(
          image.optimized,
          serviceName,
        );
        return cloudUrl;
      } catch (error) {
        onError?.(
          `Cloud upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        return null;
      }
    },
    [serviceUploader, onError],
  );

  const downloadOptimized = useCallback((image: UploadedImage) => {
    const link = document.createElement("a");
    link.href = image.optimized;
    link.download = `optimized-${image.file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const clearAll = useCallback(() => {
    // Clean up all preview URLs
    images.forEach((image) => {
      if (image.preview.startsWith("blob:")) {
        URL.revokeObjectURL(image.preview);
      }
    });

    setImages([]);
    onImagesUploaded?.([]);
  }, [images, onImagesUploaded]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Service Image Upload Manager
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/10"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {allowBulkUpload
                ? "Drop images here or click to upload"
                : "Click to upload image"}
            </p>
            <p className="text-sm text-gray-500">
              Supports JPEG, PNG, WebP • Max{" "}
              {(uploadOptions?.maxSize || 2 * 1024 * 1024) / (1024 * 1024)}MB
              per image
            </p>
            <p className="text-xs text-gray-400">
              {images.length}/{maxImages} images uploaded
            </p>
          </div>

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || images.length >= maxImages}
            className="mt-4"
          >
            Select Images
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={allowBulkUpload}
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing images...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* Action Buttons */}
        {images.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={uploading}
            >
              Clear All
            </Button>
            <Badge variant="secondary">
              {images.length} image{images.length !== 1 ? "s" : ""} ready
            </Badge>
          </div>
        )}

        {/* Image Previews */}
        {showPreview && images.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Uploaded Images</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden border bg-gray-50">
                    <img
                      src={image.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Image Info Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <div className="text-white text-center text-xs space-y-1">
                      <p className="truncate max-w-[120px]">
                        {image.file.name}
                      </p>
                      <p>{(image.size / 1024).toFixed(1)}KB</p>
                      <p>
                        {image.width}×{image.height}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => downloadOptimized(image)}
                      title="Download optimized"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                      title="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Ready
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Usage Tips:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Images are automatically optimized for web display</li>
              <li>• Recommended size: 800×600px for service images</li>
              <li>• Use high-quality images for better customer engagement</li>
              <li>• Consider uploading different angles or variations</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default ImageUploadManager;
