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
          }
        } else {
          console.warn("Failed to fetch banners:", response.status);
        }
      } catch (error) {
        console.error("Error fetching banners:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
    // Refresh banners every 5 minutes
    const interval = setInterval(fetchBanners, 5 * 60 * 1000);
    return () => clearInterval(interval);
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
          className="relative w-full h-40 md:h-56 cursor-pointer flex items-center justify-center bg-cover bg-center bg-no-repeat transition-all duration-500"
          style={{
            backgroundImage: currentBanner.imageUrl
              ? `url(${currentBanner.imageUrl})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          onClick={() => handleBannerClick(currentBanner)}
        >
          {/* Overlay - Subtle to show background */}
          <div className="absolute inset-0 bg-black/10"></div>

          {/* Content - Minimal, positioned at bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-10 text-center text-white px-4 py-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
            <h3 className="text-lg md:text-xl font-bold mb-1 drop-shadow-lg">
              {currentBanner.title}
            </h3>
            {currentBanner.description && (
              <p className="text-white text-xs md:text-sm mb-2 line-clamp-1 drop-shadow-md">
                {currentBanner.description}
              </p>
            )}
            <button className="inline-flex items-center gap-1 bg-white/30 hover:bg-white/40 px-3 py-1 rounded-md transition-all duration-200 text-white text-xs font-medium drop-shadow-md">
              Explore
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Navigation Arrows - Small and subtle */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/40 text-white p-1.5 rounded-full transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/40 text-white p-1.5 rounded-full transition-all duration-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Dots Indicator - Small and subtle */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setAutoRotateEnabled(false);
                  setTimeout(() => setAutoRotateEnabled(true), 5000);
                }}
                className={`rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-white w-6 h-1.5"
                    : "bg-white/40 w-1.5 h-1.5 hover:bg-white/60"
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
