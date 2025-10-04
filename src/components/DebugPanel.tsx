import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bug,
  X,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { WhatsAppOTPService } from "@/services/whatsappOtpService";

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [apiStatus, setApiStatus] = useState<
    "checking" | "working" | "failed" | "demo"
  >("checking");
  const [testPhone, setTestPhone] = useState("9876543210");

  useEffect(() => {
    if (isOpen) {
      checkApiStatus();
      interceptConsole();
    }
  }, [isOpen]);

  const interceptConsole = () => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      setLogs((prev) => [...prev, `[LOG] ${args.join(" ")}`].slice(-20));
    };

    console.error = (...args) => {
      originalError(...args);
      setLogs((prev) => [...prev, `[ERROR] ${args.join(" ")}`].slice(-20));
    };

    console.warn = (...args) => {
      originalWarn(...args);
      setLogs((prev) => [...prev, `[WARN] ${args.join(" ")}`].slice(-20));
    };
  };

  const checkApiStatus = async () => {
    setApiStatus("checking");
    try {
      const service = WhatsAppOTPService.getInstance();
      const result = await service.sendWhatsAppOTP("9999999999", "Test User");

      if (result.success) {
        if (result.message?.includes("Demo")) {
          setApiStatus("demo");
        } else {
          setApiStatus("working");
        }
      } else {
        setApiStatus("failed");
      }
    } catch (error) {
      setApiStatus("failed");
    }
  };

  const testOTPSend = async () => {
    setLogs((prev) => [...prev, "[TEST] Starting OTP test..."]);
    const service = WhatsAppOTPService.getInstance();
    const result = await service.sendWhatsAppOTP(testPhone, "Debug Test");
    setLogs((prev) => [...prev, `[TEST] Result: ${JSON.stringify(result)}`]);
  };

  const getStatusInfo = () => {
    switch (apiStatus) {
      case "checking":
        return {
          icon: RefreshCw,
          color: "bg-blue-100 text-blue-800",
          text: "Checking...",
        };
      case "working":
        return {
          icon: CheckCircle,
          color: "bg-green-100 text-green-800",
          text: "API Working",
        };
      case "demo":
        return {
          icon: AlertTriangle,
          color: "bg-yellow-100 text-yellow-800",
          text: "Demo Mode",
        };
      case "failed":
        return {
          icon: XCircle,
          color: "bg-red-100 text-red-800",
          text: "API Failed",
        };
      default:
        return {
          icon: AlertTriangle,
          color: "bg-gray-100 text-gray-800",
          text: "Unknown",
        };
    }
  };

  if (!isOpen) return null;

  const StatusIcon = getStatusInfo().icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              WhatsApp OTP Debug Panel
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <div className="space-y-4">
            {/* API Status */}
            <div className="flex items-center justify-between">
              <span className="font-medium">API Status:</span>
              <Badge
                className={`${getStatusInfo().color} flex items-center gap-1`}
              >
                <StatusIcon className="h-3 w-3" />
                {getStatusInfo().text}
              </Badge>
            </div>

            {/* Environment Info */}
            <div className="space-y-2">
              <h4 className="font-medium">Environment:</h4>
              <div className="text-sm space-y-1">
                <div>
                  Hostname: <code>{window.location.hostname}</code>
                </div>
                <div>
                  Demo Mode:{" "}
                  <code>
                    {window.location.hostname === "localhost" ? "Yes" : "No"}
                  </code>
                </div>
                <div>
                  API Key:{" "}
                  <code>
                    {import.meta.env.VITE_GUPSHUP_API_KEY ? "Set" : "Not Set"}
                  </code>
                </div>
                <div>
                  Source Number:{" "}
                  <code>
                    {import.meta.env.VITE_GUPSHUP_SOURCE_NUMBER ||
                      "Using fallback"}
                  </code>
                </div>
              </div>
            </div>

            {/* Test Controls */}
            <div className="space-y-2">
              <h4 className="font-medium">Test OTP:</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Phone number"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <Button onClick={testOTPSend} size="sm">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Test
                </Button>
              </div>
            </div>

            {/* Console Logs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Console Logs:</h4>
                <Button variant="outline" size="sm" onClick={() => setLogs([])}>
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-48 border border-gray-200 rounded-md p-3">
                <div className="space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-gray-500 text-sm">No logs yet...</p>
                  ) : (
                    logs.map((log, index) => (
                      <div
                        key={index}
                        className={`text-xs font-mono p-1 rounded ${
                          log.includes("[ERROR]")
                            ? "bg-red-50 text-red-800"
                            : log.includes("[WARN]")
                              ? "bg-yellow-50 text-yellow-800"
                              : "bg-gray-50 text-gray-800"
                        }`}
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Instructions */}
            {apiStatus === "demo" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">
                  Demo Mode Instructions:
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>
                    • Enter any valid Indian phone number (10 digits starting
                    with 6-9)
                  </li>
                  <li>
                    • Use OTP: <strong>123456</strong>
                  </li>
                  <li>• This simulates the real WhatsApp OTP flow</li>
                </ul>
              </div>
            )}

            {apiStatus === "failed" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <h4 className="font-medium text-red-900 mb-2">
                  Troubleshooting:
                </h4>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• Check your internet connection</li>
                  <li>• Verify Gupshup API credentials</li>
                  <li>• Check browser console for CORS errors</li>
                  <li>• Use demo mode for testing (available on localhost)</li>
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugPanel;
