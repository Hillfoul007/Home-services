import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false);

  useEffect(() => {
    // Check if app is already installed (running in standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");

    setIsInStandaloneMode(isStandalone);

    // Check if device is iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if user has already been prompted
    const hasBeenPrompted = localStorage.getItem("pwa-install-prompted");
    const hasBeenDismissed = localStorage.getItem("pwa-install-dismissed");

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);

      // Show prompt only if user hasn't been prompted before and hasn't dismissed it
      if (!hasBeenPrompted && !hasBeenDismissed && !isStandalone) {
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 3000); // Show after 3 seconds
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS devices, show manual install instructions if not in standalone mode
    if (iOS && !isStandalone && !hasBeenPrompted && !hasBeenDismissed) {
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 5000); // Show after 5 seconds for iOS
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // For Android/Chrome
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        localStorage.setItem("pwa-install-prompted", "true");
      }

      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  const handleLater = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("pwa-install-prompted", "true");
  };

  const handleIOSInstall = () => {
    // Show more detailed instructions for iOS
    alert(
      `To install Laundrify:\n\n` +
      `1. Tap the Share button (📤) at the bottom of this page\n` +
      `2. Scroll down and tap "Add to Home Screen"\n` +
      `3. Tap "Add" to confirm\n\n` +
      `The app icon will appear on your home screen!`
    );

    // Mark as prompted to prevent showing again
    localStorage.setItem("pwa-install-prompted", "true");
    setShowInstallPrompt(false);
  };

  if (isInStandaloneMode || !showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-laundrify-purple to-laundrify-pink text-white p-4 shadow-lg z-50 border-t border-laundrify-purple/60">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          <Smartphone className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">
            Add Laundrify to Home Screen
          </h3>

          {isIOS ? (
            <p className="text-xs text-white/80 mb-3">
              Tap the <span className="font-medium">Share</span> button (📤) at the bottom,
              then tap <span className="font-medium">"Add to Home Screen"</span>
            </p>
          ) : (
            <p className="text-xs text-white/80 mb-3">
              Install our app for faster access and better experience
            </p>
          )}

          <div className="flex gap-2">
            {!isIOS ? (
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="bg-white text-laundrify-blue hover:bg-white/90 h-8 px-3 text-xs font-medium"
              >
                <Plus className="h-3 w-3 mr-1" />
                Install
              </Button>
            ) : (
              <Button
                onClick={handleIOSInstall}
                size="sm"
                className="bg-white text-laundrify-blue hover:bg-white/90 h-8 px-3 text-xs font-medium"
              >
                <Plus className="h-3 w-3 mr-1" />
                Install
              </Button>
            )}

            <Button
              onClick={handleLater}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-8 px-3 text-xs"
            >
              Later
            </Button>
          </div>
        </div>

        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="sm"
          className="flex-shrink-0 h-8 w-8 p-0 text-white hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default InstallPrompt;
