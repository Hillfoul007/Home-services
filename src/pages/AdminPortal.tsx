import React, { useState, useEffect } from "react";
import { AdminAuth } from "@/config/adminConfig";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";
import ErrorBoundary from "@/components/ErrorBoundary";

const AdminPortal: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Check if admin is already logged in
      const checkAuthStatus = () => {
        try {
          const isLoggedIn = AdminAuth.isLoggedIn();
          setIsAuthenticated(isLoggedIn);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error("Auth check error:", err);
          setError(null); // Continue anyway
          setLoading(false);
        }
      };

      checkAuthStatus();

      // Set up interval to check auth status periodically
      const interval = setInterval(() => {
        try {
          checkAuthStatus();
        } catch (err) {
          console.error("Periodic auth check failed:", err);
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    } catch (err) {
      console.error("AdminPortal initialization error:", err);
      setLoading(false);
      setError("Failed to initialize admin portal");
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setError(null);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading admin portal...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <AdminLogin onLoginSuccess={handleLoginSuccess} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AdminDashboard onLogout={handleLogout} />
    </ErrorBoundary>
  );
};

export default AdminPortal;
