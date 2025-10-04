import React, { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface ConfigStatus {
  apiKey: boolean;
  mapId: boolean;
  apiAvailable: boolean;
  errorMessage?: string;
}

export function GoogleMapsConfigTest() {
  const [status, setStatus] = useState<ConfigStatus>({
    apiKey: false,
    mapId: false,
    apiAvailable: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkConfiguration = async () => {
      setIsLoading(true);

      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

        const newStatus: ConfigStatus = {
          apiKey: !!(apiKey && apiKey.trim() !== ""),
          mapId: !!(mapId && mapId.trim() !== ""),
          apiAvailable: false,
        };

        // Test if Google Maps API is available
        if (typeof window !== "undefined") {
          if (window.google && window.google.maps) {
            newStatus.apiAvailable = true;
          } else {
            // Try to load the API to test it
            if (newStatus.apiKey) {
              try {
                const script = document.createElement("script");
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;

                await new Promise((resolve, reject) => {
                  script.onload = resolve;
                  script.onerror = reject;
                  document.head.appendChild(script);
                });

                newStatus.apiAvailable = true;
              } catch (error) {
                newStatus.errorMessage = `Failed to load Google Maps API: ${error}`;
              }
            }
          }
        }

        setStatus(newStatus);
      } catch (error) {
        setStatus({
          apiKey: false,
          mapId: false,
          apiAvailable: false,
          errorMessage: `Configuration check failed: ${error}`,
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkConfiguration();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-blue-50">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Checking Google Maps configuration...</span>
        </div>
      </div>
    );
  }

  const getOverallStatus = () => {
    if (status.errorMessage) return "error";
    if (!status.apiKey) return "error";
    if (!status.apiAvailable) return "error";
    if (!status.mapId) return "warning";
    return "success";
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">
        Google Maps Configuration Status
      </h3>

      {/* Overall Status */}
      <Alert
        variant={
          overallStatus === "error"
            ? "destructive"
            : overallStatus === "warning"
              ? "default"
              : "default"
        }
      >
        <div className="flex items-center gap-2">
          {overallStatus === "success" && (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          {overallStatus === "warning" && (
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          )}
          {overallStatus === "error" && (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription>
            {overallStatus === "success" &&
              "Google Maps is fully configured and ready!"}
            {overallStatus === "warning" &&
              "Google Maps is working but using regular markers (Map ID missing)"}
            {overallStatus === "error" &&
              "Google Maps configuration has issues"}
          </AlertDescription>
        </div>
      </Alert>

      {/* Detailed Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {status.apiKey ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span className={status.apiKey ? "text-green-700" : "text-red-700"}>
            Google Maps API Key: {status.apiKey ? "Configured" : "Missing"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {status.apiAvailable ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span
            className={status.apiAvailable ? "text-green-700" : "text-red-700"}
          >
            Google Maps API:{" "}
            {status.apiAvailable ? "Available" : "Not Available"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {status.mapId ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          )}
          <span className={status.mapId ? "text-green-700" : "text-yellow-700"}>
            Map ID:{" "}
            {status.mapId
              ? "Configured (Advanced Markers available)"
              : "Not configured (using regular markers)"}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {status.errorMessage && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{status.errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-600 space-y-2">
        <p>
          <strong>To fix configuration issues:</strong>
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your .env file
          </li>
          <li>
            Optionally set <code>VITE_GOOGLE_MAPS_MAP_ID</code> for Advanced
            Markers
          </li>
          <li>Ensure APIs are enabled in Google Cloud Console</li>
          <li>Check API key restrictions and permissions</li>
        </ol>
        <p>
          <a
            href="/GOOGLE_MAPS_TROUBLESHOOTING.md"
            target="_blank"
            className="text-blue-600 hover:underline"
          >
            View detailed troubleshooting guide →
          </a>
        </p>
      </div>
    </div>
  );
}

export default GoogleMapsConfigTest;
