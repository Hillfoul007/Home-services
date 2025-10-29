import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { vendorAuthService } from "@/services/vendorAuthService";
import { toast } from "sonner";

const VendorLogin: React.FC = () => {
  const [vendorId, setVendorId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await vendorAuthService.login(vendorId.trim(), password);

      if (res && res.success && res.token) {
        localStorage.setItem("laundrify_token", res.token);
        localStorage.setItem("auth_token", res.token);
        toast.success("Login successful");
        navigate("/vendor/dashboard");
        return;
      }

      const err = res?.error || "Login failed";
      toast.error(err as string);
    } catch (error: any) {
      toast.error(error?.message || "Login error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-2 text-center">Vendor Login</h2>
        <p className="text-sm text-gray-500 text-center mb-6">Use your vendor credentials provided by admin</p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block mb-2 text-sm font-semibold text-gray-700">
              Vendor ID <span className="text-red-500">*</span>
            </label>
            <Input
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              placeholder="e.g., V210767WYFH2J"
              className="bg-blue-50 border-blue-200"
            />
            <p className="text-xs text-gray-500 mt-1">Starts with 'V' followed by numbers and letters</p>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-gray-700">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="bg-blue-50 border-blue-200 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">8 character code from admin</p>
          </div>

          <Button
            type="submit"
            disabled={loading || !vendorId || !password}
            className="w-full mt-8 py-2 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        {loading && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            Validating your credentials...
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorLogin;
