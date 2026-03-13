export interface ReferralStats {
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

export interface ReferralCodeInfo {
  success: boolean;
  referral_code: string;
  name: string;
  phone: string;
  error?: string;
}

export interface ShareLink {
  referral_code: string;
  share_text: string;
  whatsapp_link: string;
  app_link: string;
  copy_text: string;
}

class ReferralService {
  private static instance: ReferralService;

  public static getInstance(): ReferralService {
    if (!ReferralService.instance) {
      ReferralService.instance = new ReferralService();
    }
    return ReferralService.instance;
  }

  /**
   * Get user's referral code
   */
  async getReferralCode(userId: string): Promise<ReferralCodeInfo> {
    try {
      const response = await fetch(`/api/referral/my-code/${userId}`);
      return await response.json();
    } catch (error) {
      console.error("Error fetching referral code:", error);
      return { success: false, referral_code: "", name: "", phone: "", error: "Failed to fetch referral code" };
    }
  }

  /**
   * Get user's referral stats
   */
  async getReferralStats(userId: string): Promise<ReferralStats | null> {
    try {
      const response = await fetch(`/api/referral/stats/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        return {
          total_referrals: data.total_referrals || 0,
          completed_referrals: data.completed_referrals || 0,
          pending_referrals: data.pending_referrals || 0,
          earnings: data.earnings || 0,
          referrals: data.referrals || [],
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      return null;
    }
  }

  /**
   * Validate a referral code
   */
  async validateReferralCode(code: string): Promise<{ valid: boolean; referrer_name?: string; referrer_phone?: string; reward_amount?: number; error?: string }> {
    try {
      const response = await fetch("/api/referral/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referral_code: code }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error validating referral code:", error);
      return { valid: false, error: "Failed to validate code" };
    }
  }

  /**
   * Get share link details
   */
  async getShareLink(userId: string): Promise<ShareLink | null> {
    try {
      const response = await fetch(`/api/referral/share-link/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        return {
          referral_code: data.referral_code,
          share_text: data.share_text,
          whatsapp_link: data.whatsapp_link,
          app_link: data.app_link,
          copy_text: data.copy_text,
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching share link:", error);
      return null;
    }
  }

  /**
   * Check referral status for current user
   */
  async checkReferralStatus(userId: string): Promise<any> {
    try {
      const response = await fetch(`/api/referral/check/${userId}`);
      return await response.json();
    } catch (error) {
      console.error("Error checking referral status:", error);
      return null;
    }
  }
}

export const referralService = ReferralService.getInstance();
