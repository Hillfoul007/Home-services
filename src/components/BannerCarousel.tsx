import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Banner {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  redirectUrl: string;
  duration: number;
  position: number;
}

interface BannerCarouselProps {
  onBannerClick?: (banner: Banner) => void;
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({ onBannerClick }) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);

  // Fetch banners from API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await fetch("/api/banners/active");
        if (response.ok) {
          const data = await response.json();
          if (data.banners && data.banners.length > 0) {
            setBanners(data.banners);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching banners:", error);
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    if (!autoRotateEnabled || banners.length === 0) return;

    const currentBanner = banners[currentIndex];
    const duration = currentBanner?.duration || 3000;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [currentIndex, banners, autoRotateEnabled]);

  // Track banner click
  const trackBannerClick = async (bannerId: string) => {
    try {
      await fetch(`/api/banners/${bannerId}/click`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Error tracking banner click:", error);
    }
  };

  const handleBannerClick = (banner: Banner) => {
    setSelectedBanner(banner);
    setShowConfirmDialog(true);
    setAutoRotateEnabled(false);
    trackBannerClick(banner._id);

    if (onBannerClick) {
      onBannerClick(banner);
    }
  };

  const handleConfirmRedirect = () => {
    if (selectedBanner) {
      window.open(selectedBanner.redirectUrl, "_blank");
      setShowConfirmDialog(false);
      setSelectedBanner(null);
      setTimeout(() => setAutoRotateEnabled(true), 500);
    }
  };

  const handleCancelRedirect = () => {
    setShowConfirmDialog(false);
    setSelectedBanner(null);
    setAutoRotateEnabled(true);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    setAutoRotateEnabled(false);
    setTimeout(() => setAutoRotateEnabled(true), 5000);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
    setAutoRotateEnabled(false);
    setTimeout(() => setAutoRotateEnabled(true), 5000);
  };

  if (loading || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  return (
    <>
      {/* Banner Carousel */}
      <div className="relative w-full mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-laundrify-purple to-laundrify-pink">
        <div
          className="relative w-full h-48 md:h-64 cursor-pointer flex items-center justify-center bg-cover bg-center transition-all duration-500"
          style={{
            backgroundImage: currentBanner.imageUrl
              ? `url(${currentBanner.imageUrl})`
              : undefined,
          }}
          onClick={() => handleBannerClick(currentBanner)}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/20"></div>

          {/* Content */}
          <div className="relative z-10 text-center text-white px-6 py-8">
            <h3 className="text-2xl md:text-3xl font-bold mb-2">
              {currentBanner.title}
            </h3>
            {currentBanner.description && (
              <p className="text-white/90 text-sm md:text-base mb-4">
                {currentBanner.description}
              </p>
            )}
            <button className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all duration-200 text-white font-medium">
              Explore
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Arrows */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/30 hover:bg-white/50 text-white p-2 rounded-full transition-all duration-200"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/30 hover:bg-white/50 text-white p-2 rounded-full transition-all duration-200"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Dots Indicator */}
        {banners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setAutoRotateEnabled(false);
                  setTimeout(() => setAutoRotateEnabled(true), 5000);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-white w-8"
                    : "bg-white/50 w-2 hover:bg-white/75"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedBanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Visit External Website?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedBanner.title}
                </p>
              </div>
              <button
                onClick={handleCancelRedirect}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-gray-600 text-sm mb-6">
              You are about to leave Laundrify and visit an external website.
              Continue?
            </p>

            <div className="flex gap-3">
              <Button
                onClick={handleCancelRedirect}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmRedirect}
                className="flex-1 bg-laundrify-purple hover:bg-laundrify-purple/90 text-white"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BannerCarousel;
