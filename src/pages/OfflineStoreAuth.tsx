import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Phone, Lock, Store } from "lucide-react";
import { toast } from "sonner";
import { DVHostingSmsService } from "@/services/dvhostingSmsService";

type AuthStep = "phone" | "otp" | "register" | "vendor";

export default function OfflineStoreAuth() {
  const navigate = useNavigate();
  const dvhostingSmsService = DVHostingSmsService.getInstance();
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/offline-store/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("OTP sent to your phone");
        setStep("otp");
      } else {
        // If user not found, ask if they want to create new account
        if (data.error.includes("not found")) {
          setIsNewUser(true);
          setStep("register");
        } else {
          toast.error(data.error || "Error sending OTP");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Error logging in");
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/offline-store/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await response.json();

      if (data.success) {
        // Save token and user data
        localStorage.setItem("offline_store_token", data.token);
        localStorage.setItem("offline_store_user", JSON.stringify(data.user));
        dvhostingSmsService.setCurrentUser(data.user, data.token);

        toast.success("Login successful!");
        navigate("/desk");
      } else {
        toast.error(data.error || "Invalid OTP");
      }
    } catch (error: any) {
      toast.error(error.message || "Error verifying OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVendorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !password) {
      toast.error("Please enter Vendor ID and password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/offline-store/vendor-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Save token and user data
        localStorage.setItem("offline_store_token", data.token);
        localStorage.setItem("offline_store_user", JSON.stringify(data.user));
        dvhostingSmsService.setCurrentUser(data.user, data.token);

        toast.success("Vendor login successful!");
        navigate("/desk");
      } else {
        toast.error(data.error || "Invalid vendor credentials");
      }
    } catch (error: any) {
      toast.error(error.message || "Error logging in");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName) {
      toast.error("Please enter store name");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/offline-store/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          store_name: storeName,
          store_address: storeAddress,
          store_phone: storePhone || phone,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("OTP sent for verification");
        setOtpSent(true);
      } else {
        toast.error(data.error || "Error creating account");
      }
    } catch (error: any) {
      toast.error(error.message || "Error registering");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/offline-store/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          otp,
          store_name: storeName,
          store_address: storeAddress,
          store_phone: storePhone || phone,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Save token and user data
        localStorage.setItem("offline_store_token", data.token);
        localStorage.setItem("offline_store_user", JSON.stringify(data.user));
        dvhostingSmsService.setCurrentUser(data.user, data.token);
        
        toast.success("Account created successfully!");
        navigate("/desk");
      } else {
        toast.error(data.error || "Error verifying");
      }
    } catch (error: any) {
      toast.error(error.message || "Error verifying OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-center mb-8">
            <Store className="w-8 h-8 text-blue-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-800">Offline Store</h1>
          </div>

          {/* Phone Step */}
          {step === "phone" && (
            <>
              <form onSubmit={handlePhoneSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <Input
                        type="tel"
                        placeholder="Enter 10-digit phone number"
                        value={phone}
                        onChange={(e) =>
                          setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                        maxLength={10}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? "Sending OTP..." : "Send OTP"}
                  </Button>
                </div>
              </form>
              <div className="mt-6 pt-6 border-t">
                <p className="text-center text-sm text-gray-600 mb-4">Are you a vendor?</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep("vendor")}
                >
                  Login with Vendor Credentials
                </Button>
              </div>
            </>
          )}

          {/* Vendor Login Step */}
          {step === "vendor" && (
            <form onSubmit={handleVendorLogin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor ID
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Enter Vendor ID"
                      value={vendorId}
                      onChange={(e) => setVendorId(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Vendor Login"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep("phone")}
                >
                  Back to Phone Login
                </Button>
              </div>
            </form>
          )}

          {/* OTP Step */}
          {step === "otp" && !isNewUser && (
            <form onSubmit={handleOTPSubmit}>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Enter the OTP sent to {phone}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OTP
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      maxLength={6}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep("phone")}
                >
                  Back
                </Button>
              </div>
            </form>
          )}

          {/* Register Step */}
          {step === "register" && (
            <form
              onSubmit={
                isNewUser && otpSent ? handleVerifyRegistration : handleRegisterSubmit
              }
            >
              <div className="space-y-4">
                {isNewUser && !otpSent ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Create your offline store account
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Store Name *
                      </label>
                      <Input
                        type="text"
                        placeholder="Enter store name"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Store Address
                      </label>
                      <Input
                        type="text"
                        placeholder="Enter store address"
                        value={storeAddress}
                        onChange={(e) => setStoreAddress(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Store Phone (optional)
                      </label>
                      <Input
                        type="tel"
                        placeholder="Store phone number"
                        value={storePhone}
                        onChange={(e) => setStorePhone(e.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={loading}
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setStep("phone");
                        setIsNewUser(false);
                      }}
                    >
                      Back
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Enter the OTP sent to {phone}
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        OTP
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Enter 6-digit OTP"
                          value={otp}
                          onChange={(e) =>
                            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          maxLength={6}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={loading}
                    >
                      {loading ? "Verifying..." : "Verify & Create"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                      }}
                    >
                      Back
                    </Button>
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
