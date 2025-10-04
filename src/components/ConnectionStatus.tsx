import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Cloud, CloudOff } from "lucide-react";

interface ConnectionStatusProps {
  className?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className = "",
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkBackendStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setBackendStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial backend check
    if (isOnline) {
      checkBackendStatus();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

 const checkBackendStatus = async () => {
  try {
    setBackendStatus("checking");

    // Detect hosted environment (same logic as ApiClient)
    const isHostedEnv =
      window.location.hostname.includes("builder.codes") ||
      window.location.hostname.includes("fly.dev") ||
      document.querySelector("[data-loc]") !== null;

    // In hosted environments, skip backend check and show as offline (local mode)
    if (isHostedEnv) {
      console.log("ConnectionStatus: Hosted environment detected, showing local mode");
      setBackendStatus("offline");
      return;
    }

    // Use relative path to leverage the proxy configuration
    const healthUrl = "/api/health";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(healthUrl, {
      signal: controller.signal,
      method: "GET",
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      setBackendStatus("online");
    } else if (response.status === 404) {
      // Health endpoint not found - likely development mode without backend
      console.log("ConnectionStatus: Health endpoint not found, assuming local mode");
      setBackendStatus("offline");
    } else {
      setBackendStatus("offline");
    }
  } catch (error) {
    console.log("ConnectionStatus: Backend health check failed - using local mode");
    setBackendStatus("offline");
  }
};


  // Don't show anything if everything is working normally
  if (isOnline && backendStatus === "online") {
    return null;
  }

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        text: "Offline",
        color: "bg-red-100 text-red-800",
        description: "No internet connection",
      };
    }

    if (backendStatus === "offline") {
      // Check if we're in a hosted environment
      const isHostedEnv =
        window.location.hostname.includes("builder.codes") ||
        window.location.hostname.includes("fly.dev") ||
        document.querySelector("[data-loc]") !== null;

      return {
        icon: CloudOff,
        text: isHostedEnv ? "Demo Mode" : "Local Mode",
        color: "bg-yellow-100 text-yellow-800",
        description: isHostedEnv ? "Demo data only" : "Data saved locally",
      };
    }

    if (backendStatus === "checking") {
      return {
        icon: Cloud,
        text: "Connecting...",
        color: "bg-blue-100 text-blue-800",
        description: "Checking connection",
      };
    }

    return {
      icon: Wifi,
      text: "Online",
      color: "bg-green-100 text-green-800",
      description: "Connected",
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <Badge
        variant="outline"
        className={`${statusInfo.color} flex items-center gap-2 px-3 py-1 shadow-lg`}
      >
        <StatusIcon className="h-3 w-3" />
        <span className="text-xs font-medium">{statusInfo.text}</span>
      </Badge>
    </div>
  );
};

export default ConnectionStatus;
