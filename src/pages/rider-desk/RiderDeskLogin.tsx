import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getApiUrl } from "@/config/env";

const RiderDeskLogin: React.FC = () => {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("rider_desk_token")) navigate("/rider-desk/dashboard");
  }, [navigate]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/riders/desk-send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed to send OTP"); return; }
      toast.success("OTP sent to your registered number");
      setStep("otp");
      setResendTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch { toast.error("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpStr = otp.join("");
    if (otpStr.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/riders/desk-verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: otpStr }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Invalid OTP"); return; }
      localStorage.setItem("rider_desk_token", data.token);
      localStorage.setItem("rider_desk_info", JSON.stringify(data.rider));

      try {
        const { MobilePushService } = await import('@/services/MobilePushService');
        MobilePushService.getInstance().initialize(undefined, { riderId: data.rider._id || data.rider.id });
      } catch { /* silent */ }

      toast.success(`Welcome, ${data.rider.name}!`);
      navigate("/rider-desk/dashboard");
    } catch { toast.error("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...otp];
    pasted.split("").forEach((d, i) => { if (i < 6) next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const resendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/riders/desk-send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed to resend OTP"); return; }
      toast.success("OTP resent");
      setOtp(["", "", "", "", "", ""]);
      setResendTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch { toast.error("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rider App</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === "phone" ? "Enter your registered phone number" : `OTP sent to ${phone}`}
          </p>
        </div>

        {/* Step 1 — Phone */}
        {step === "phone" && (
          <form onSubmit={sendOtp} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                maxLength={10}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || phone.trim().length < 10}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        )}

        {/* Step 2 — OTP */}
        {step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Enter 6-digit OTP
              </label>
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="w-11 h-12 border-2 border-gray-200 rounded-xl text-center text-lg font-bold focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 bg-gray-50"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => { setStep("phone"); setOtp(["", "", "", "", "", ""]); }}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Change number
              </button>
              <button
                type="button"
                onClick={resendOtp}
                disabled={resendTimer > 0 || loading}
                className={`font-medium ${resendTimer > 0 ? "text-gray-400" : "text-green-600 hover:text-green-700"}`}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RiderDeskLogin;
