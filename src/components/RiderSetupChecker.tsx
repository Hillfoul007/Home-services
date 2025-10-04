import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Database, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface RiderSetupCheckerProps {
  onSetupComplete?: () => void;
}

const RiderSetupChecker: React.FC<RiderSetupCheckerProps> = ({
  onSetupComplete,
}) => {
  const [checking, setChecking] = useState(true);
  const [setupStatus, setSetupStatus] = useState({
    mongodbConfigured: false,
    backendRunning: false,
    apiEndpoints: false,
  });
  const [error, setError] = useState("");

  const checkSetup = async () => {
    setChecking(true);
    setError("");

    try {
      let status = {
        mongodbConfigured: false,
        backendRunning: false,
        apiEndpoints: false,
      };

      // Check if backend is running
      try {
        const apiBaseUrl =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
        const healthResponse = await fetch(
          `${apiBaseUrl.replace("/api", "")}/health`,
        );
        if (healthResponse.ok) {
          status.backendRunning = true;

          // Check if API endpoints are working
          const testResponse = await fetch(`${apiBaseUrl}/test`);
          if (testResponse.ok) {
            status.apiEndpoints = true;
            status.mongodbConfigured = true; // If API works, MongoDB is likely configured
          }
        }
      } catch (error) {
        console.log("Backend not running or not accessible");
      }

      setSetupStatus(status);

      // If everything is working, auto-complete setup
      if (
        status.mongodbConfigured &&
        status.backendRunning &&
        status.apiEndpoints
      ) {
        setTimeout(() => {
          if (onSetupComplete) {
            onSetupComplete();
          }
        }, 1000);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkSetup();
  }, []);

  const getStatusBadge = (status: boolean) => {
    return status ? (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle className="h-3 w-3 mr-1" />
        Working
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Not Ready
      </Badge>
    );
  };

  const allReady =
    setupStatus.mongodbConfigured &&
    setupStatus.backendRunning &&
    setupStatus.apiEndpoints;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          MongoDB Backend Setup Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">Backend Server</h3>
              <p className="text-sm text-gray-600">Server running on Render</p>
            </div>
            {getStatusBadge(setupStatus.backendRunning)}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">API Endpoints</h3>
              <p className="text-sm text-gray-600">
                REST API endpoints responding
              </p>
            </div>
            {getStatusBadge(setupStatus.apiEndpoints)}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">MongoDB Connection</h3>
              <p className="text-sm text-gray-600">
                Database connection configured
              </p>
            </div>
            {getStatusBadge(setupStatus.mongodbConfigured)}
          </div>
        </div>

        {!allReady && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>Some components are not ready. Please ensure:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {!setupStatus.backendRunning && (
                    <li>Backend server is running on Render</li>
                  )}
                  {!setupStatus.mongodbConfigured && (
                    <li>MongoDB connection is properly configured</li>
                  )}
                  {!setupStatus.apiEndpoints && (
                    <li>API endpoints are responding correctly</li>
                  )}
                </ul>
                <p className="text-sm mt-2">
                  Check the terminal logs and ensure your .env file has the
                  correct MongoDB credentials.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {allReady && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              ✅ All systems are ready! You can now proceed with rider
              registration.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button
            onClick={checkSetup}
            disabled={checking}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${checking ? "animate-spin" : ""}`}
            />
            {checking ? "Checking..." : "Refresh Status"}
          </Button>

          {allReady && onSetupComplete && (
            <Button
              onClick={onSetupComplete}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Continue Setup
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            🔧 Backend Health:{" "}
            {import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"}
            /health
          </p>
          <p>
            🧪 API Test:{" "}
            {import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api"}
            /test
          </p>
          <p>📚 Documentation: See MONGODB_SETUP_GUIDE.md</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RiderSetupChecker;
