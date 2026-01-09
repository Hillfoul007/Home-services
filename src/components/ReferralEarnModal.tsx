import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  Share2,
  Copy,
  MessageCircle,
  Users,
  TrendingUp,
  Gift,
  CheckCircle,
  Clock,
  Loader,
} from "lucide-react";
import { toast } from "sonner";

interface ReferralEarnModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

interface ReferralStats {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  earnings: number;
  referrals: Array<{
    referee_phone: string;
    referee_name: string;
    status: "pending" | "completed";
    created_at: string;
    completed_at?: string;
    reward_amount: number;
  }>;
}

interface ReferralCodeInfo {
  referral_code: string;
  name: string;
  phone: string;
}

interface ShareLink {
  referral_code: string;
  share_text: string;
  whatsapp_link: string;
  app_link: string;
  copy_text: string;
}

const ReferralEarnModal: React.FC<ReferralEarnModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [referralCode, setReferralCode] = useState<string>("");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadReferralData();
    }
  }, [isOpen, currentUser?.phone]);

  const generateReferralCode = (user: any): string => {
    // Generate a referral code from phone number: last 6 digits + random suffix
    let code = "REF";
    if (user.phone) {
      // Extract last 6 digits of phone
      const phoneDigits = user.phone.replace(/\D/g, "").slice(-6);
      code += phoneDigits;
    } else if (user._id) {
      code += user._id.slice(-6).toUpperCase();
    } else {
      code += Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    return code;
  };

  const loadReferralData = () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Generate referral code from user data
      const code = currentUser.referral_code || generateReferralCode(currentUser);
      setReferralCode(code);

      // Set default stats (no API call needed)
      setStats({
        total_referrals: 0,
        completed_referrals: 0,
        pending_referrals: 0,
        earnings: 0,
        referrals: [],
      });

      // Generate share link locally
      const appUrl = window.location.origin;
      const shareText = `Hey! 🎉 Join me on Laundrify! Use my referral code *${code}* to get ₹50 bonus on your first order. I'll also earn ₹100 when you complete your first order! 💰`;
      const whatsappLink = `https://wa.me/?text=${encodeURIComponent(shareText + `\n\nOpen: ${appUrl}?ref=${code}`)}`;
      const appLink = `${appUrl}?ref=${code}`;
      const copyText = `${shareText}\n\n${appLink}`;

      setShareLink({
        referral_code: code,
        share_text: shareText,
        whatsapp_link: whatsappLink,
        app_link: appLink,
        copy_text: copyText,
      });
    } catch (error) {
      console.error("Error loading referral data:", error);
      toast.error("Failed to load referral data");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) {
      toast.error("Referral code not available");
      return;
    }
    try {
      setCopying(true);
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied! 📋");
    } catch (error) {
      toast.error("Failed to copy code");
    } finally {
      setCopying(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!referralCode) {
      toast.error("Referral code not available");
      return;
    }

    if (shareLink?.whatsapp_link) {
      window.open(shareLink.whatsapp_link, "_blank");
      toast.success("Opening WhatsApp... 📱");
    } else {
      toast.error("Unable to open WhatsApp");
    }
  };

  const handleShareLink = () => {
    if (!referralCode || !shareLink?.app_link) {
      toast.error("Share link not available");
      return;
    }

    try {
      if (navigator.share) {
        navigator.share({
          title: "Join Laundrify",
          text: shareLink.share_text,
          url: shareLink.app_link,
        });
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareLink.copy_text || shareLink.app_link);
        toast.success("Share link copied to clipboard! 📋");
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast.error("Unable to share");
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-green-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-green-600" />
            Refer & Earn
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Your Referral Code Section */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Your Referral Code
            </h3>
            <div className="flex items-center gap-3 bg-white rounded-lg p-4 border border-green-200">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Share this code</p>
                <p className="text-2xl font-bold text-green-600 font-mono">
                  {referralCode}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleCopyCode}
                disabled={copying}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copying ? "Copied!" : "Copy"}
              </Button>
            </div>
          </Card>

          {/* How it Works */}
          <Card className="border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              How It Works
            </h3>
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                    <span className="text-sm font-bold text-green-700">1</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Share Your Code</p>
                  <p className="text-sm text-gray-600">
                    Share your referral code with friends and family
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                    <span className="text-sm font-bold text-green-700">2</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    They Sign Up & Get ₹50
                  </p>
                  <p className="text-sm text-gray-600">
                    Your friend gets ₹50 bonus on signup to use in their first
                    order
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                    <span className="text-sm font-bold text-green-700">3</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    They Complete First Order
                  </p>
                  <p className="text-sm text-gray-600">
                    When your friend completes their first order, you both get
                    rewards
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                    <span className="text-sm font-bold text-green-700">4</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    You Earn ₹100 Instantly
                  </p>
                  <p className="text-sm text-gray-600">
                    ₹100 is credited to your wallet once their first order is
                    completed
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Rewards Summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-blue-50 border-blue-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-600">
                  Total Referrals
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {stats?.total_referrals || 0}
              </p>
            </Card>
            <Card className="bg-purple-50 border-purple-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-semibold text-gray-600">
                  Earnings
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                ₹{stats?.earnings || 0}
              </p>
            </Card>
          </div>

          {/* Share Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleWhatsAppShare}
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base font-semibold flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-5 w-5" />
              Share on WhatsApp
            </Button>
            <Button
              onClick={handleShareLink}
              variant="outline"
              className="w-full h-12 text-base font-semibold flex items-center justify-center gap-2"
            >
              <Share2 className="h-5 w-5" />
              Share Link
            </Button>
          </div>

          {/* Referrals List */}
          {stats && stats.referrals.length > 0 && (
            <Card className="border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Your Referrals
              </h3>
              <div className="space-y-3">
                {stats.referrals.map((referral, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      {referral.status === "completed" ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {referral.referee_name || referral.referee_phone}
                          </p>
                          <p className="text-sm text-gray-600">
                            {referral.referee_phone}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Referred:{" "}
                            {new Date(referral.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${
                              referral.status === "completed"
                                ? "text-green-600"
                                : "text-gray-600"
                            }`}
                          >
                            {referral.status === "completed"
                              ? "✓ Completed"
                              : "Pending"}
                          </p>
                          <p className="text-lg font-bold text-green-600 mt-1">
                            +₹{referral.reward_amount}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferralEarnModal;
