import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, MessageCircle, Share2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface SimpleReferModalProps {
  referralCode?: string;
  userHasCompletedFirstOrder: boolean;
  referredCount?: number;
  earnings?: number;
}

const SimpleReferModal: React.FC<SimpleReferModalProps> = ({
  referralCode,
  userHasCompletedFirstOrder,
  referredCount = 0,
  earnings = 0,
}) => {
  const [copying, setCopying] = useState(false);

  const handleCopyCode = async () => {
    if (!referralCode) {
      toast.error("Referral code not available");
      return;
    }
    try {
      setCopying(true);
      await navigator.clipboard.writeText(referralCode);
      toast.success("Code copied! 📋");
    } catch (error) {
      toast.error("Failed to copy code");
    } finally {
      setCopying(false);
    }
  };

  const handleCopyLink = async () => {
    if (!referralCode) {
      toast.error("Referral code not available");
      return;
    }
    try {
      const appUrl = window.location.origin;
      const link = `${appUrl}?ref=${referralCode}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link copied! 📋");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleShareWhatsApp = () => {
    if (!referralCode) {
      toast.error("Referral code not available");
      return;
    }

    const appUrl = window.location.origin;
    const message = `Hey! 👋 I'm using Laundrify for laundry services. Sign up with my code *${referralCode}* and get ₹50 instantly in your wallet! I also get ₹50 when you complete your first order. Download here: ${appUrl}?ref=${referralCode}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  if (!userHasCompletedFirstOrder) {
    return (
      <div className="space-y-4">
        <Card className="bg-blue-50 border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <div className="text-2xl">🔒</div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Unlock Referral Feature
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Complete your first order to start referring friends and earning rewards!
              </p>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Place your first order</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Share your referral code</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Earn ₹50 per successful referral</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Referral Code Card */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Your Referral Code
        </h3>
        <div className="flex items-center gap-3 bg-white rounded-lg p-4 border border-green-200 mb-4">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">Share this code</p>
            <p className="text-3xl font-bold text-green-600 font-mono">
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

        {/* How it works */}
        <div className="space-y-3 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">How it works:</p>
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex-shrink-0">
              1
            </span>
            <span>Your friend signs up with your code</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex-shrink-0">
              2
            </span>
            <span>They get ₹50 in their wallet instantly</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex-shrink-0">
              3
            </span>
            <span>When they complete their first order, you get ₹50</span>
          </div>
        </div>
      </Card>

      {/* Stats */}
      {(referredCount > 0 || earnings > 0) && (
        <Card className="grid grid-cols-2 gap-4 p-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Referred</p>
            <p className="text-2xl font-bold text-blue-600">{referredCount}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Earnings</p>
            <p className="text-2xl font-bold text-purple-600">₹{earnings}</p>
          </div>
        </Card>
      )}

      {/* Share Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleShareWhatsApp}
          className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-semibold flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5" />
          Share on WhatsApp
        </Button>
        <Button
          onClick={handleCopyLink}
          variant="outline"
          className="w-full h-12 font-semibold flex items-center justify-center gap-2"
        >
          <Share2 className="h-5 w-5" />
          Copy Link
        </Button>
      </div>
    </div>
  );
};

export default SimpleReferModal;
