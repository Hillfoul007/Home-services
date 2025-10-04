import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Sparkles, X } from "lucide-react";

interface LocationUnavailableModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectedLocation?: string;
  onExplore?: () => void;
  onNavigateHome?: () => void;
}

const LocationUnavailableModal: React.FC<LocationUnavailableModalProps> = ({
  isOpen,
  onClose,
  detectedLocation,
  onExplore,
  onNavigateHome,
}) => {
  // Debug logging for modal state
  React.useEffect(() => {
    console.log("🔄 LocationUnavailableModal state:", {
      isOpen,
      detectedLocation,
      timestamp: new Date().toISOString()
    });

    // Ensure modal shows on top of everything when opened
    if (isOpen) {
      document.body.classList.add('modal-open');
      // Force modal to be visible with high z-index
      const modalElement = document.querySelector('[data-radix-dialog-content]');
      if (modalElement) {
        (modalElement as HTMLElement).style.zIndex = '10000';
        (modalElement as HTMLElement).style.position = 'fixed';
        (modalElement as HTMLElement).style.pointerEvents = 'auto';
      }
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, detectedLocation]);
  const handleExploreServices = () => {
    console.log("🔍 User clicked Explore Available Services");

    // First execute any custom explore logic
    if (onExplore) {
      onExplore();
    }

    // Then navigate to home page
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      // Fallback: direct navigation to home
      window.location.href = "/";
    }

    // Close the modal
    onClose();
  };

  const handleMaybeLater = () => {
    console.log("⏰ User clicked Maybe Later - closing modal");
    // Just close the modal, allow user to edit address
    onClose();
  };
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md w-[90vw] mx-auto border-0 shadow-2xl rounded-3xl overflow-hidden bg-white mobile-modal z-[10000] !important"
        style={{ zIndex: 10000, position: 'fixed', pointerEvents: 'auto' }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[10000] text-gray-400 hover:text-gray-600 transition-colors pointer-events-auto"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center py-6 px-2">
          {/* Icon with Green Theme */}
          <div className="mx-auto mb-6 relative">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-laundrify-purple to-laundrify-pink rounded-full flex items-center justify-center shadow-lg">
              <MapPin className="h-10 w-10 text-white" />
            </div>
            {/* Decorative sparkles */}
            <div className="absolute -top-2 -right-2">
              <div className="w-6 h-6 bg-laundrify-yellow rounded-full flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 mb-2">
              Service Not Available
            </DialogTitle>
                        <DialogDescription className="text-gray-600 text-base leading-relaxed">
              We're not available in your location yet, but we're expanding
              soon!
              {detectedLocation && (
                <span className="block mt-2 text-sm text-laundrify-blue font-medium">
                  📍 {detectedLocation}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Action Button */}
          <DialogFooter className="flex flex-col gap-3">
            <Button
              onClick={() => {
                onExplore();
                onClose();
              }}
              className="w-full bg-gradient-to-r from-laundrify-purple to-laundrify-pink hover:from-laundrify-purple/90 hover:to-laundrify-pink/90 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 text-base"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Explore Available Services
            </Button>

            {/* Secondary Action */}
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full text-gray-600 hover:text-gray-800 font-medium py-2 rounded-xl hover:bg-gray-50 transition-all duration-200"
            >
              Maybe Later
            </Button>
          </DialogFooter>

          {/* Footer Note */}
          <div className="mt-4 text-xs text-gray-500">
            💜 We'll notify you when we reach your area
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationUnavailableModal;
