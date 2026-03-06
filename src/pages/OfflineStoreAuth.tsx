import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lock, Store } from "lucide-react";
import { toast } from "sonner";
import { DVHostingSmsService } from "@/services/dvhostingSmsService";

type AuthStep = "vendor";

export default function OfflineStoreAuth() {
  const navigate = useNavigate();
  const dvhostingSmsService = DVHostingSmsService.getInstance();
  const [step, setStep] = useState<AuthStep>("vendor");
  const [vendorId, setVendorId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-center mb-8">
            <Store className="w-8 h-8 text-blue-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-800">Offline Store</h1>
          </div>

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
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
