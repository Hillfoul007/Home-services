import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy,
  Share2,
  MessageCircle,
  Gift,
  Users,
  Trophy,
  CheckCircle,
  Clock,
  Sparkles,
  Heart,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

interface ReferralStats {
  asReferrer: {
    totalReferrals: number;
    completedReferrals: number;
    pendingRewards: number;
    totalRewardsEarned: number;
  };
  asReferee: {
    hasUsedReferral: boolean;
    referrerName?: string;
    status?: string;
  };
}

const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [referralCode, setReferralCode] = useState<string>("");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate a persistent referral code based on user data
  const generatePersistentReferralCode = () => {
    if (!currentUser?.phone && !currentUser?._id) return null; // Don't generate for anonymous users

    const userId = currentUser._id || currentUser.phone;
    const storageKey = `referral_code_${userId}`;

    // Check if we already have a stored code for this user
    const existingCode = localStorage.getItem(storageKey);
    if (existingCode) {
      return existingCode;
    }

    // Generate new persistent code
    const phoneOrId = currentUser.phone || currentUser._id?.toString();
    const lastFour = phoneOrId.slice(-4).padStart(4, '0');
    const randomPart = Math.random().toString(36).substr(2, 3).toUpperCase();
    const newCode = `REF${lastFour}${randomPart}`;

    // Store it persistently
    localStorage.setItem(storageKey, newCode);
    return newCode;
  };

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchReferralData();
    }
  }, [isOpen, currentUser]);

  const fetchReferralData = async () => {
    if (!currentUser) return;

    setLoading(true);

    try {
      // Generate fallback code immediately if no user ID
      if (!currentUser._id && !currentUser.phone) {
        console.log('⚠️ No user ID or phone, using local fallback');
        const demoCode = generatePersistentReferralCode();
        setReferralCode(demoCode);
        setStats({
          asReferrer: {
            totalReferrals: 0,
            completedReferrals: 0,
            pendingRewards: 0,
            totalRewardsEarned: 0,
          },
          asReferee: {
            hasUsedReferral: false,
          },
        });
        setLoading(false);
        return;
      }

      // Clear any potential stuck requests
      apiClient.clearRequest('/referrals/user/', 'GET');

      const userId = currentUser._id || currentUser.phone;
      console.log('🔍 Fetching referral data for user:', userId);

      // Try to fetch real data from API with timeout
      const response = await Promise.race([
        apiClient.getUserReferralInfo(userId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('API timeout after 5s')), 5000)
        )
      ]);

      if (response?.data?.myReferralCode) {
        console.log('✅ Got referral code from API:', response.data.myReferralCode);
        setReferralCode(response.data.myReferralCode);
        setStats(response.data.stats || null);
      } else {
        console.log('⚠️ No referral code in response, generating one...');
        // If API fails or no code exists, generate one
        const generateResponse = await Promise.race([
          apiClient.generateReferralCode(userId),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Generate timeout after 5s')), 5000)
          )
        ]);

        if (generateResponse?.data?.referralCode) {
          console.log('✅ Generated new referral code:', generateResponse.data.referralCode);
          setReferralCode(generateResponse.data.referralCode);
        } else {
          throw new Error("Failed to generate code from API");
        }
      }
    } catch (error) {
      console.warn("🔄 API failed, using local fallback:", error?.message || error);

      // Fallback to persistent local code
      const localCode = generatePersistentReferralCode();
      if (localCode) {
        console.log('💾 Using local persistent code:', localCode);
        setReferralCode(localCode);

        // Set empty stats for local code
        setStats({
          asReferrer: {
            totalReferrals: 0,
            completedReferrals: 0,
            pendingRewards: 0,
            totalRewardsEarned: 0,
          },
          asReferee: {
            hasUsedReferral: false,
          },
        });
      } else {
        // No user ID available, can't generate code
        console.warn('Cannot generate referral code - no user identification');
        setReferralCode("");
        setStats(null);
      }

      toast.success("Referral code ready!");
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (!referralCode) return;

    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = referralCode;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("Referral code copied!");
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        toast.error("Failed to copy. Please copy manually.");
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const shareViaWhatsApp = () => {
    if (!referralCode) {
      toast.error("Referral code not ready yet");
      return;
    }

    const userName = currentUser?.name || currentUser?.full_name || "Friend";
    const referralLink = `${window.location.origin}?ref=${referralCode}`;

    const message = `🧺 *Laundrify - Professional Laundry Service*

Hi! I've been using Laundrify for my laundry needs and I absolutely love their service!

🎁 *Special Offer for You:*
Use my referral code: *${referralCode}*
Get *30% OFF* your first order!

✨ Why Laundrify?
• Professional cleaning & pressing
• Free pickup & delivery
• Same-day service available
• Trusted by thousands

🔗 *Click here to get started:*
${referralLink}

(Your referral code will be automatically applied!)

Happy cleaning! 🌟
- ${userName}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");

    toast.success("WhatsApp share opened!");
  };

  const shareViaSMS = () => {
    if (!referralCode) {
      toast.error("Referral code not ready yet");
      return;
    }

    const referralLink = `${window.location.origin}?ref=${referralCode}`;
    const message = `Hey! Use my Laundrify referral code ${referralCode} and get 30% OFF your first laundry order! Click here: ${referralLink} (Code auto-applied!)`;

    try {
      const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
      window.open(smsUrl);
      toast.success("SMS app opened!");
    } catch (error) {
      // Fallback - copy to clipboard
      copyReferralCode();
    }
  };

  const shareGeneral = async () => {
    if (!referralCode) {
      toast.error("Referral code not ready yet");
      return;
    }

    const referralLink = `${window.location.origin}?ref=${referralCode}`;
    const shareData = {
      title: "Laundrify Referral - 30% OFF",
      text: `Use my referral code ${referralCode} and get 30% OFF your first laundry order with Laundrify!`,
      url: referralLink,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
      } else {
        // Fallback - copy to clipboard
        const shareText = `${shareData.text} ${shareData.url}`;
        await navigator.clipboard.writeText(shareText);
        toast.success("Referral link copied to clipboard!");
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        copyReferralCode();
      }
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-laundrify-purple mb-4"></div>
            <p className="text-gray-600">Loading your referral code...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="flex items-center justify-center gap-2 text-2xl">
            <Gift className="h-7 w-7 text-laundrify-purple" />
            Refer & Earn
          </DialogTitle>
          <DialogDescription className="text-base">
            Share with friends and earn amazing rewards!
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="share" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="share" className="text-sm">Share & Earn</TabsTrigger>
            <TabsTrigger value="stats" className="text-sm">My Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-6 mt-6">
            {/* How it Works */}
            <Card className="border-2 border-laundrify-purple/20 bg-gradient-to-br from-laundrify-purple/5 to-laundrify-pink/5">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-laundrify-purple">
                  <Sparkles className="h-5 w-5" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-laundrify-purple text-white rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Share your code</p>
                    <p className="text-sm text-gray-600">
                      Send your unique referral code to friends and family
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-laundrify-pink text-white rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">They get 30% off</p>
                    <p className="text-sm text-gray-600">
                      Your friends save big on their first laundry order
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-laundrify-mint text-gray-800 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">You get 50% off</p>
                    <p className="text-sm text-gray-600">
                      Earn a 50% discount coupon when their order completes!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Referral Code Section */}
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle className="text-xl text-gray-900">Your Referral Code</CardTitle>
                <CardDescription className="text-base">
                  Share this code with friends to start earning rewards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="referral-code" className="text-sm font-medium">Referral Code</Label>
                  <div className="flex gap-3">
                    <Input
                      id="referral-code"
                      value={referralCode}
                      readOnly
                      className="font-mono text-xl font-bold bg-gray-50 border-2 border-gray-300 text-center tracking-wider"
                    />
                    <Button
                      onClick={copyReferralCode}
                      variant={copied ? "default" : "outline"}
                      className={`px-4 min-w-[80px] ${copied ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
                      disabled={!referralCode}
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <Button
                    onClick={shareViaWhatsApp}
                    className="bg-green-500 hover:bg-green-600 text-white h-12 text-base font-medium"
                    disabled={!referralCode}
                  >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Share via WhatsApp
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      onClick={shareViaSMS} 
                      variant="outline" 
                      className="h-12 border-2"
                      disabled={!referralCode}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      SMS
                    </Button>
                    <Button 
                      onClick={shareGeneral} 
                      variant="outline" 
                      className="h-12 border-2"
                      disabled={!referralCode}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      More
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6 mt-6">
            {stats && (
              <>
                {/* Stats Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="text-center">
                    <CardContent className="p-6">
                      <Users className="h-10 w-10 text-laundrify-purple mx-auto mb-3" />
                      <p className="text-3xl font-bold text-gray-900">{stats.asReferrer.totalReferrals}</p>
                      <p className="text-sm text-gray-600 font-medium">Total Referrals</p>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="p-6">
                      <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
                      <p className="text-3xl font-bold text-gray-900">{stats.asReferrer.totalRewardsEarned}</p>
                      <p className="text-sm text-gray-600 font-medium">Rewards Earned</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Referred By Info */}
                {stats.asReferee.hasUsedReferral && (
                  <Card className="border-2 border-laundrify-mint/50 bg-laundrify-mint/10">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-5 w-5 text-laundrify-pink" />
                        <p className="font-semibold">You were referred by</p>
                      </div>
                      <p className="text-xl font-bold text-laundrify-purple">
                        {stats.asReferee.referrerName}
                      </p>
                      <Badge variant="secondary" className="mt-2">
                        Status: {stats.asReferree.status}
                      </Badge>
                    </CardContent>
                  </Card>
                )}

                {/* Empty State or Success Message */}
                {stats.asReferrer.totalReferrals === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-xl font-semibold mb-2">Start Referring!</p>
                      <p className="text-gray-600 mb-6">
                        Share your referral code to earn amazing rewards
                      </p>
                      <Button
                        onClick={() => {
                          const shareTab = document.querySelector('[value="share"]') as HTMLElement;
                          shareTab?.click();
                        }}
                        className="bg-laundrify-purple hover:bg-laundrify-purple/90"
                      >
                        Share Now
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-green-50 border-2 border-green-200">
                    <CardContent className="p-6 text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                      <p className="text-lg font-semibold text-green-800">Great job!</p>
                      <p className="text-green-700">
                        You've successfully referred {stats.asReferrer.totalReferrals} friend{stats.asReferrer.totalReferrals !== 1 ? 's' : ''}!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ReferralModal;
