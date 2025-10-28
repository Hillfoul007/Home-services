import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { vendorAuthService } from "@/services/vendorAuthService";
import { toast } from "sonner";

const VendorLogin: React.FC = () => {
  const [vendorId, setVendorId] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-6 bg-white rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Vendor Login</h2>
        <form onSubmit={submit}>
          <label className="block mb-2 text-sm text-gray-600">Vendor ID</label>
          <Input value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="Vendor ID" />
          <label className="block mt-4 mb-2 text-sm text-gray-600">Password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />

          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={loading || !vendorId || !password}>{loading ? 'Signing in...' : 'Sign in'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorLogin;
