import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { authHelpers } from "@/integrations/mongodb/client";
import analyticsService from "@/services/analyticsService";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  defaultView?: "signin" | "signup" | "forgot-password" | "reset-password";
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultView = "signin",
}) => {
  const [currentView, setCurrentView] = useState<
    "signin" | "signup" | "forgot-password" | "reset-password"
  >(defaultView);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    userType: "customer" as "customer" | "provider" | "rider",
    referralCode: "",
  });

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      phone: "",
      userType: "customer",
      referralCode: "",
    });
    setError("");
    setSuccess("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Auto-fill referral code from URL parameter
  React.useEffect(() => {
    if (isOpen) {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');

      if (refCode && refCode.trim()) {
        console.log('🎁 Auto-filling referral code from URL:', refCode);
        setFormData(prev => ({
          ...prev,
          referralCode: refCode.trim().toUpperCase()
        }));
      }
    }
  }, [isOpen]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    // Support international phone numbers (Indian and international formats)
    const phoneRegex = /^[\+]?[1-9][\d]{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ""));
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Track sign-in attempt
    analyticsService.trackAuth('login', 'email');

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    if (!validatePassword(formData.password)) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await authHelpers.signIn(
        formData.email,
        formData.password,
      );

      if (error) {
        setError(error.message);
      } else if (data.user) {
        // Store the JWT token in localStorage
        localStorage.setItem("auth_token", data.session.access_token);
        localStorage.setItem("current_user", JSON.stringify(data.user));

        onSuccess(data.user);
        onClose();
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || "Sign in failed");
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("Full name is required");
      setIsLoading(false);
      return;
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    if (!validatePhone(formData.phone)) {
      setError("Please enter a valid phone number");
      setIsLoading(false);
      return;
    }

    if (!validatePassword(formData.password)) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      // Check if user already exists using the authHelpers function
      const { emailExists, phoneExists } = await authHelpers.checkIfUserExists(
        formData.email,
        formData.phone,
      );

      if (emailExists) {
        setError(
          "An account with this email address already exists. Please sign in instead or use a different email.",
        );
        setIsLoading(false);
        return;
      }

      if (phoneExists) {
        setError(
          "An account with this phone number already exists. Please use a different phone number.",
        );
        setIsLoading(false);
        return;
      }

      const { data, error } = await authHelpers.signUp(
        formData.email,
        formData.password,
        formData.name,
        formData.phone,
        formData.userType,
        formData.referralCode,
      );

      if (error) {
        setError(error.message);
      } else if (data.user) {
        setSuccess("Account created successfully!");

        // Store the JWT token in localStorage
        localStorage.setItem("auth_token", data.session.access_token);
        localStorage.setItem("current_user", JSON.stringify(data.user));

        // Auto proceed after successful signup
        setTimeout(() => {
          onSuccess(data.user);
          onClose();
          resetForm();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Account creation failed");
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    try {
      const { error, data } = await authHelpers.resetPassword(formData.email);

      if (error) {
        setError(error.message);
      } else {
        setSuccess(
          "Password reset instructions have been sent to your email. Please check your inbox.",
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    }

    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!validatePassword(formData.password)) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      // Get current user from localStorage
      const currentUser = JSON.parse(
        localStorage.getItem("current_user") || "{}",
      );

      if (!currentUser._id) {
        setError("Please sign in first");
        setIsLoading(false);
        return;
      }

      const { error } = await authHelpers.updatePassword(
        currentUser._id,
        formData.password,
      );

      if (error) {
        setError(error.message);
      } else {
        setSuccess("Password updated successfully!");
        setTimeout(() => {
          setCurrentView("signin");
          resetForm();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    }

    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          {currentView !== "signin" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  currentView === "forgot-password" ||
                  currentView === "reset-password"
                ) {
                  setCurrentView("signin");
                } else {
                  setCurrentView("signin");
                }
                setError("");
                setSuccess("");
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <h2 className="text-2xl font-bold text-gray-900 flex-1 text-center">
            {currentView === "signin" && "Welcome Back"}
            {currentView === "signup" && "Create Account"}
            {currentView === "forgot-password" && "Reset Password"}
            {currentView === "reset-password" && "New Password"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {/* Sign In Form */}
        {currentView === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-gray-700 font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                className="mt-2 rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  className="rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>

            <div className="text-center space-y-3">
              <button
                type="button"
                onClick={() => setCurrentView("forgot-password")}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Forgot your password?
              </button>

              <div>
                <p className="text-gray-600 text-sm">Don't have an account?</p>
                <button
                  type="button"
                  onClick={() => setCurrentView("signup")}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create Account
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-gray-600 text-sm mb-2">Service provider?</p>
                <Button
                  type="button"
                  onClick={() => {
                    window.open("/join-as-pro", "_blank");
                    onClose();
                  }}
                  variant="outline"
                  className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 rounded-xl"
                >
                  Login as Pro
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Sign Up Form */}
        {currentView === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-gray-700 font-medium">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="mt-2 rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-700 font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                className="mt-2 rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-gray-700 font-medium">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                required
                className="mt-2 rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                placeholder="+1 234-567-8900 or +91 98765 43210"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  className="rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  placeholder="Create a password (min. 6 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label
                htmlFor="confirmPassword"
                className="text-gray-700 font-medium"
              >
                Confirm Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                  className="rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label
                htmlFor="referralCode"
                className="text-gray-700 font-medium"
              >
                Referral Code (Optional)
              </Label>
              <Input
                id="referralCode"
                type="text"
                value={formData.referralCode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    referralCode: e.target.value.toUpperCase(),
                  })
                }
                className="mt-2 rounded-xl border-green-200 focus:border-green-500 focus:ring-green-500"
                placeholder="Enter referral code to get 50% off first order"
              />
              {formData.referralCode && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ Referral code applied! Get 50% off your first order (up to
                  ₹200)
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl"
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center">
              <p className="text-gray-600 text-sm">Already have an account?</p>
              <button
                type="button"
                onClick={() => setCurrentView("signin")}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {currentView === "forgot-password" && (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="text-center mb-6">
              <p className="text-gray-600">
                Enter your email address and we'll send you instructions to
                reset your password.
              </p>
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-700 font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                className="mt-2 rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter your email address"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl"
            >
              {isLoading ? "Sending..." : "Send Reset Instructions"}
            </Button>
          </form>
        )}

        {/* Reset Password Form */}
        {currentView === "reset-password" && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="text-center mb-6">
              <p className="text-gray-600">Enter your new password below.</p>
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 font-medium">
                New Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  className="rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  placeholder="Enter new password (min. 6 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label
                htmlFor="confirmPassword"
                className="text-gray-700 font-medium"
              >
                Confirm New Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                  className="rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl"
            >
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
