import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";

const MainLanding: React.FC = () => {
  const [showApp, setShowApp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user prefers to see the app instead of the website
    const appPreference = localStorage.getItem("laundrify-view-preference");
    if (appPreference === "app") {
      setShowApp(true);
    }

    // Check if mobile
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleGoToApp = () => {
    localStorage.setItem("laundrify-view-preference", "app");
    setShowApp(true);
  };

  const handleGoToWebsite = () => {
    localStorage.setItem("laundrify-view-preference", "website");
    window.location.href = "https://laundrify-about.onrender.com/";
  };

  // If showApp is true, we'll handle this in App.tsx routing
  if (showApp) {
    window.location.href = "/laundry";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-laundrify-purple via-purple-400 to-laundrify-pink flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-laundrify-purple to-laundrify-pink p-8 text-white text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-lg overflow-hidden p-2 flex items-center justify-center">
            <img
              src="/laundrify-exact-icon.svg"
              alt="Laundrify Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">Laundrify</h1>
          <p className="text-white/90 text-sm">Quick Clean & Convenient</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <p className="text-center text-gray-600">
            Welcome to Laundrify! Choose what you'd like to explore:
          </p>

          <div className="space-y-3">
            {/* Main Website */}
            <Button
              onClick={handleGoToWebsite}
              className="w-full bg-gradient-to-r from-laundrify-purple to-laundrify-pink hover:from-laundrify-purple/90 hover:to-laundrify-pink/90 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <span>Visit Our Website</span>
              <ExternalLink className="h-4 w-4" />
            </Button>

            {/* App */}
            <Button
              onClick={handleGoToApp}
              className="w-full bg-laundrify-mint hover:bg-laundrify-mint/90 text-laundrify-blue font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <span>Go to Laundry App</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Laundrify © 2024. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainLanding;
