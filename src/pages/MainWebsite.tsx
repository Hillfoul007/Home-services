import React, { useEffect } from "react";

const MainWebsite: React.FC = () => {
  useEffect(() => {
    // Redirect to the main website
    window.location.href = "https://laundrify-about.onrender.com/";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-laundrify-purple to-laundrify-pink">
      <div className="text-center text-white">
        <div className="mb-4">
          <div className="inline-block w-16 h-16 bg-white rounded-lg overflow-hidden p-2">
            <img
              src="/laundrify-exact-icon.svg"
              alt="Laundrify Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Redirecting...</h1>
        <p className="text-white/80">Taking you to the main website</p>
      </div>
    </div>
  );
};

export default MainWebsite;
