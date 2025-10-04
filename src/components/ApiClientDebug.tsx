import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";

const ApiClientDebug: React.FC = () => {
  const [status, setStatus] = useState<string>("Ready");
  const [lastResult, setLastResult] = useState<any>(null);
  const [requestCount, setRequestCount] = useState(0);

  const testHealthCheck = async () => {
    setStatus("Testing health check...");
    setRequestCount(c => c + 1);
    
    try {
      const result = await apiClient.healthCheck();
      setLastResult(result);
      setStatus("Health check completed");
      toast.success("Health check successful");
    } catch (error) {
      console.error("Health check failed:", error);
      setLastResult({ error: error.message });
      setStatus("Health check failed");
      toast.error("Health check failed");
    }
  };

  const testReferralGeneration = async () => {
    setStatus("Testing referral generation...");
    setRequestCount(c => c + 1);
    
    try {
      const result = await apiClient.generateReferralCode("test-user-123");
      setLastResult(result);
      setStatus("Referral generation completed");
      if (result.data) {
        toast.success("Referral generation successful");
      } else {
        toast.warning("Referral generation returned no data");
      }
    } catch (error) {
      console.error("Referral generation failed:", error);
      setLastResult({ error: error.message });
      setStatus("Referral generation failed");
      toast.error("Referral generation failed");
    }
  };

  const clearRequestQueue = () => {
    apiClient.clearPendingRequests();
    toast.info("Request queue cleared");
  };

  const getQueueStatus = () => {
    const queueStatus = apiClient.getRequestQueueStatus();
    setLastResult(queueStatus);
    setStatus(`Queue: ${queueStatus.size} requests`);
    toast.info(`${queueStatus.size} requests in queue`);
  };

  const getConnectionStatus = () => {
    const connectionStatus = apiClient.getConnectionStatus();
    setLastResult(connectionStatus);
    setStatus("Connection status retrieved");
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          API Client Debug
          <Badge variant="outline">Requests: {requestCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={testHealthCheck} variant="outline" size="sm">
            Test Health Check
          </Button>
          <Button onClick={testReferralGeneration} variant="outline" size="sm">
            Test Referral API
          </Button>
          <Button onClick={getQueueStatus} variant="outline" size="sm">
            Check Queue
          </Button>
          <Button onClick={getConnectionStatus} variant="outline" size="sm">
            Connection Status
          </Button>
          <Button onClick={clearRequestQueue} variant="destructive" size="sm">
            Clear Queue
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Status:</p>
          <Badge variant="secondary">{status}</Badge>
        </div>

        {lastResult && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Last Result:</p>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Debug Info:</strong></p>
          <p>Base URL: {window.location.origin}</p>
          <p>Environment: {import.meta.env.MODE}</p>
          <p>Is Dev: {import.meta.env.DEV ? 'Yes' : 'No'}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiClientDebug;
