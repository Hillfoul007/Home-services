import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bug,
  Play,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  createSuccessNotification,
  createErrorNotification,
  createInfoNotification,
} from "@/utils/notificationUtils";
import {
  createTestBookings,
  clearTestBookings,
  testBookingOperations,
} from "@/utils/bookingTestUtils";

interface BookingDebugPanelProps {
  currentUser?: any;
  isOpen: boolean;
  onClose: () => void;
}

const BookingDebugPanel: React.FC<BookingDebugPanelProps> = ({
  currentUser,
  isOpen,
  onClose,
}) => {
  const { addNotification } = useNotifications();
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    setTestResults((prev) => [...prev, formattedMessage]);

    // Also show as notification
    switch (type) {
      case "success":
        addNotification(createSuccessNotification("Test", message));
        break;
      case "error":
        addNotification(createErrorNotification("Test Error", message));
        break;
      default:
        addNotification(createInfoNotification("Test Info", message));
        break;
    }
  };

  const runCreateTestBookings = async () => {
    if (!currentUser?.id && !currentUser?.phone) {
      addTestResult("No user logged in for testing", "error");
      return;
    }

    setIsRunning(true);
    try {
      const userId = currentUser.id || currentUser.phone;
      addTestResult("Creating test bookings...", "info");
      await createTestBookings(userId);
      addTestResult("Test bookings created successfully", "success");
    } catch (error) {
      addTestResult(`Failed to create test bookings: ${error}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  const runClearBookings = () => {
    try {
      clearTestBookings();
      addTestResult("All bookings cleared", "success");
    } catch (error) {
      addTestResult(`Failed to clear bookings: ${error}`, "error");
    }
  };

  const runFullTest = async () => {
    if (!currentUser?.id && !currentUser?.phone) {
      addTestResult("No user logged in for testing", "error");
      return;
    }

    setIsRunning(true);
    try {
      const userId = currentUser.id || currentUser.phone;
      addTestResult("Starting comprehensive booking test...", "info");
      await testBookingOperations(userId);
      addTestResult("Comprehensive test completed successfully", "success");
    } catch (error) {
      addTestResult(`Comprehensive test failed: ${error}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Bug className="h-6 w-6 text-purple-600" />
              Booking Debug Panel
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
          {currentUser ? (
            <Badge className="bg-green-100 text-green-800 w-fit">
              User: {currentUser.name || currentUser.phone}
            </Badge>
          ) : (
            <Badge variant="destructive" className="w-fit">
              No user logged in
            </Badge>
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col p-6">
          {/* Test Controls */}
          <div className="space-y-4 mb-6">
            <h3 className="font-semibold text-gray-900">Test Controls</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={runCreateTestBookings}
                disabled={isRunning || !currentUser}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Create Test Bookings
              </Button>

              <Button
                onClick={runClearBookings}
                disabled={isRunning}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Bookings
              </Button>

              <Button
                onClick={runFullTest}
                disabled={isRunning || !currentUser}
                className="bg-purple-600 hover:bg-purple-700 text-white sm:col-span-2"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isRunning ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  "Run Full Test Suite"
                )}
              </Button>
            </div>

            <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
              <p>
                <strong>Test Suite includes:</strong>
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Create sample bookings with different statuses</li>
                <li>Test edit booking functionality</li>
                <li>Test cancel booking functionality</li>
                <li>Verify data persistence and state management</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Test Results */}
          <div className="flex-1 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Test Results</h3>
              <Button
                onClick={clearResults}
                variant="ghost"
                size="sm"
                disabled={testResults.length === 0}
              >
                Clear Results
              </Button>
            </div>

            <div className="flex-1 bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-64">
              {testResults.length === 0 ? (
                <p className="text-gray-500">
                  No test results yet. Run a test to see output.
                </p>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="mb-1">
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-amber-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">How to test:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Make sure you're logged in</li>
                  <li>Click "Create Test Bookings" to add sample data</li>
                  <li>Go to Booking History to see the created bookings</li>
                  <li>Test Edit Order and Cancel buttons</li>
                  <li>Run "Full Test Suite" to verify all operations</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingDebugPanel;
