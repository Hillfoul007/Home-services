import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * PWAUpdateNotification
 * Shows a non-dismissable banner when a new service worker is waiting.
 * Clicking "Update" skips waiting and reloads — user always gets the latest.
 */
const PWAUpdateNotification: React.FC = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const checkWaiting = () => {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          if (reg.waiting) setWaitingWorker(reg.waiting);

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
              }
            });
          });
        });
      });
    };

    checkWaiting();
    // Recheck every 90 seconds
    const interval = setInterval(checkWaiting, 90 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if (updating) return;
    setUpdating(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    // Reload after a tick to let SW activate
    setTimeout(() => window.location.reload(), 400);
  };

  if (!waitingWorker) return null;

  return (
    // Non-dismissable sticky banner at top
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-blue-600 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-2 min-w-0">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
        <p className="text-sm font-medium truncate">
          New version available — update to continue
        </p>
      </div>
      <button
        onClick={handleUpdate}
        disabled={updating}
        className="shrink-0 bg-white text-blue-700 font-bold text-sm px-4 py-1.5 rounded-lg hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-60"
      >
        {updating ? "Updating..." : "Update Now"}
      </button>
    </div>
  );
};

export default PWAUpdateNotification;
