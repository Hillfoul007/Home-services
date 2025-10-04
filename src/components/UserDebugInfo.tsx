import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, RefreshCw } from "lucide-react";
import { userValidation } from "../utils/userValidation";

const UserDebugInfo: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const handleShowDebug = () => {
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("current_user");
    const user = userValidation.getCurrentValidUser();
    const isAuthenticated = userValidation.isUserAuthenticated();

    setDebugInfo({
      hasToken: !!token,
      tokenValue: token ? token.substring(0, 20) + "..." : null,
      hasUserData: !!userStr,
      userDataValid: !!user,
      isAuthenticated,
      userId: user?._id || null,
      userIdValid: user ? userValidation.isValidUserId(user._id) : false,
      userName: user ? userValidation.getUserDisplayName(user) : null,
      rawUserData: userStr ? JSON.parse(userStr) : null,
    });
    setShowDebug(true);
  };

  const handleClearAuth = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    setShowDebug(false);
    window.location.reload();
  };

  // Only show in development or when there are auth issues
  const shouldShow =
    import.meta.env.DEV || !userValidation.isUserAuthenticated();

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!showDebug ? (
        <Button
          onClick={handleShowDebug}
          variant="outline"
          size="sm"
          className="bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100 text-xs sm:text-sm px-2 py-1"
        >
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Debug Auth</span>
          <span className="sm:hidden">Debug</span>
        </Button>
      ) : (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">
              Authentication Debug
            </h3>
            <button
              onClick={() => setShowDebug(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {debugInfo && (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-gray-600">Has Token:</span>
                <span
                  className={
                    debugInfo.hasToken ? "text-green-600" : "text-red-600"
                  }
                >
                  {debugInfo.hasToken ? "✓" : "✗"}
                </span>

                <span className="text-gray-600">User Data:</span>
                <span
                  className={
                    debugInfo.hasUserData ? "text-green-600" : "text-red-600"
                  }
                >
                  {debugInfo.hasUserData ? "✓" : "✗"}
                </span>

                <span className="text-gray-600">Valid User:</span>
                <span
                  className={
                    debugInfo.userDataValid ? "text-green-600" : "text-red-600"
                  }
                >
                  {debugInfo.userDataValid ? "✓" : "✗"}
                </span>

                <span className="text-gray-600">Authenticated:</span>
                <span
                  className={
                    debugInfo.isAuthenticated
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {debugInfo.isAuthenticated ? "✓" : "✗"}
                </span>
              </div>

              {debugInfo.userId && (
                <div>
                  <span className="text-gray-600">User ID:</span>
                  <div className="bg-gray-100 p-1 rounded text-xs break-all">
                    {debugInfo.userId}
                  </div>
                  <span
                    className={
                      debugInfo.userIdValid ? "text-green-600" : "text-red-600"
                    }
                  >
                    {debugInfo.userIdValid ? "Valid format" : "Invalid format"}
                  </span>
                </div>
              )}

              {debugInfo.userName && (
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="ml-1">{debugInfo.userName}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 space-y-2">
            <Button
              onClick={handleClearAuth}
              size="sm"
              variant="destructive"
              className="w-full"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Clear Auth & Reload
            </Button>

            <Button
              onClick={() => setShowDebug(false)}
              size="sm"
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDebugInfo;
