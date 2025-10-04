import React from "react";

interface LaundrifySplashLoaderProps {
  isVisible?: boolean;
  message?: string;
}

const LaundrifySplashLoader: React.FC<LaundrifySplashLoaderProps> = ({
  isVisible = true,
  message = "Loading...",
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-laundrify-purple via-purple-400 to-laundrify-pink">
      <div className="text-center space-y-6 px-8">
        {/* Logo with Pulse Animation */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/20 rounded-3xl animate-ping"></div>
          <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-2xl">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fb0ac7c2f6e7c46a4a84ce74a0fb98c57%2F4c8fe4f8010c411a9eb989e3b42ef6f3?format=webp&width=800"
              alt="Laundrify Logo"
              className="w-20 h-20 mx-auto object-contain animate-bounce"
            />
          </div>
        </div>

        {/* Brand Name and Tagline */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            Laundrify
          </h1>
          <p className="text-white/90 text-lg font-medium drop-shadow">
            Quick Clean & Convenient
          </p>
        </div>

        {/* Loading Animation */}
        <div className="flex items-center justify-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>

        {/* Loading Message */}
        {message && (
          <p className="text-white/80 text-sm font-medium">
            {message}
          </p>
        )}
      </div>

      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-laundrify-yellow rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-3/4 left-1/3 w-16 h-16 bg-laundrify-mint rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
    </div>
  );
};

export default LaundrifySplashLoader;
