import React, { useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface ForceUpdateModalProps {
  isOpen: boolean;
  latestVersion: string;
  currentVersion?: string;
  updateUrl?: {
    android?: string;
    ios?: string;
  };
  /** If true: show "Refresh" (web reload) instead of store link */
  isWebUpdate?: boolean;
}

const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  isOpen,
  latestVersion,
  currentVersion,
  updateUrl = {},
  isWebUpdate = false,
}) => {
  // Prevent any background interaction while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.pointerEvents = 'none';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = () => {
    if (isWebUpdate || !Capacitor.isNativePlatform()) {
      // Web: clear SW cache and hard-reload to get fresh files
      if ('caches' in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
      return;
    }

    // Native: redirect to store
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/android/i.test(userAgent) && updateUrl.android) {
      window.location.href = updateUrl.android;
    } else if (/iPad|iPhone|iPod/.test(userAgent) && updateUrl.ios) {
      window.location.href = updateUrl.ios;
    } else {
      window.location.href = updateUrl.android || updateUrl.ios || 'https://play.google.com/store';
    }
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    // Full-screen blocker — pointer-events restored for this element only
    <div
      style={{ pointerEvents: 'all' }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-8 flex flex-col items-center gap-3">
          <div className="bg-white/20 p-4 rounded-full">
            {isNative ? (
              <Download className="w-12 h-12 text-white" />
            ) : (
              <RefreshCw className="w-12 h-12 text-white" />
            )}
          </div>
          <span className="text-white/80 text-sm font-medium uppercase tracking-widest">
            Update Required
          </span>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {isNative ? 'New Version Available' : 'App Update Ready'}
          </h2>

          <p className="text-gray-600 text-sm leading-relaxed">
            {isNative
              ? `A new version (${latestVersion}) is required to continue using Laundrify. Please update now to access the latest features and fixes.`
              : `Laundrify has been updated to v${latestVersion}. Please refresh to load the latest version — you can't continue on the old version.`}
          </p>

          {currentVersion && (
            <p className="text-xs text-gray-400">
              Your version: {currentVersion} → Required: {latestVersion}
            </p>
          )}

          <div className="pt-2 space-y-3">
            <button
              onClick={handleUpdate}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg"
            >
              {isNative ? (
                <>
                  <Download className="w-5 h-5" />
                  Update Now
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Refresh & Update
                </>
              )}
            </button>

            <p className="text-xs text-gray-400">
              This update is mandatory. You cannot use the app until you update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceUpdateModal;
