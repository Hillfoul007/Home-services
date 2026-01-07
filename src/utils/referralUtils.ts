/**
 * Get referral code from URL parameters
 * Supports formats:
 * - ?ref=CODE
 * - ?referral=CODE
 * - Deep link from WhatsApp: laundrify://app?ref=CODE
 */
export const getReferralCodeFromUrl = (): string | null => {
  try {
    // Check current URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref") || urlParams.get("referral");
    
    if (refCode) {
      console.log("🔗 Referral code detected from URL:", refCode);
      return refCode.toUpperCase();
    }
    
    // Check hash for mobile apps
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
    const hashRefCode = hashParams.get("ref") || hashParams.get("referral");
    
    if (hashRefCode) {
      console.log("🔗 Referral code detected from hash:", hashRefCode);
      return hashRefCode.toUpperCase();
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting referral code from URL:", error);
    return null;
  }
};

/**
 * Store referral code in localStorage for later use
 */
export const storeReferralCode = (code: string): void => {
  try {
    localStorage.setItem("pending_referral_code", code.toUpperCase());
    console.log("💾 Stored pending referral code:", code);
  } catch (error) {
    console.error("Error storing referral code:", error);
  }
};

/**
 * Get stored referral code from localStorage
 */
export const getStoredReferralCode = (): string | null => {
  try {
    return localStorage.getItem("pending_referral_code");
  } catch (error) {
    console.error("Error retrieving referral code:", error);
    return null;
  }
};

/**
 * Clear stored referral code
 */
export const clearStoredReferralCode = (): void => {
  try {
    localStorage.removeItem("pending_referral_code");
    console.log("🧹 Cleared pending referral code");
  } catch (error) {
    console.error("Error clearing referral code:", error);
  }
};

/**
 * Generate WhatsApp share link for referral
 */
export const generateWhatsAppShareLink = (
  referralCode: string,
  referrerName: string,
  appUrl: string = "https://laundrify.app"
): string => {
  const message = encodeURIComponent(
    `Hey! 🎉 Join me on Laundrify! Use my referral code *${referralCode}* to get ₹50 bonus on your first order. I'll also earn ₹100 when you complete your first order! 💰 \n\nOpen: ${appUrl}?ref=${referralCode}`
  );
  return `https://wa.me/?text=${message}`;
};

/**
 * Check if user was referred (has referred_by set)
 */
export const isUserReferred = (user: any): boolean => {
  return !!(user && user.referred_by);
};

/**
 * Check if user has completed first order
 */
export const hasCompletedFirstOrder = (user: any): boolean => {
  return !!(user && user.has_completed_first_order);
};

/**
 * Get user's referral code
 */
export const getUserReferralCode = (user: any): string | null => {
  return (user && user.referral_code) || null;
};
