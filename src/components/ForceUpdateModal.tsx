import React from 'react';
import { Download } from 'lucide-react';

interface ForceUpdateModalProps {
  isOpen: boolean;
  latestVersion: string;
  updateUrl: {
    android?: string;
    ios?: string;
  };
}

const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({ 
  isOpen, 
  latestVersion,
  updateUrl 
}) => {
  if (!isOpen) return null;

  const handleUpdate = () => {
    // Detect OS and redirect
    const userAgent = navigator.userAgent || navigator.vendor;
    
    if (/android/i.test(userAgent) && updateUrl.android) {
      window.location.href = updateUrl.android;
    } else if (/iPad|iPhone|iPod/.test(userAgent) && updateUrl.ios) {
      window.location.href = updateUrl.ios;
    } else {
      // Fallback to Android or generic if unable to determine
      window.location.href = updateUrl.android || updateUrl.ios || "https://play.google.com/store";
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-r from-laundrify-blue to-purple-600 p-6 flex items-center justify-center">
          <div className="bg-white/20 p-4 rounded-full">
            <Download className="w-12 h-12 text-white" />
          </div>
        </div>
        
        <div className="p-6 text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">App Update Required</h2>
          
          <p className="text-gray-600 text-sm">
            We've added new features and fixed bugs! To continue using the app, please update to the latest version ({latestVersion}).
          </p>
          
          <div className="pt-4">
            <button
              onClick={handleUpdate}
              className="w-full py-4 bg-laundrify-blue hover:bg-laundrify-blue/90 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg shadow-lg hover:shadow-xl active:scale-95"
            >
              <Download className="w-5 h-5" />
              Update Now
            </button>
          </div>
          
          <p className="text-xs text-gray-400 mt-4">
            If you're unable to update, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForceUpdateModal;
