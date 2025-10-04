interface CouponData {
  code: string;
  discount: number;
  maxDiscount: number;
  description: string;
  type: string;
  isFirstOrder?: boolean;
  isOneTimeUse?: boolean;
  excludeFirstOrder?: boolean;
  minimumAmount?: number;
  isActive: boolean;
  isReferralReward?: boolean;
}

interface CouponUsage {
  code: string;
  userId: string;
  usedAt: string;
  orderAmount: number;
  discountAmount: number;
}

export class CouponService {
  private static instance: CouponService;
  private pendingValidations = new Map<string, Promise<{ valid: boolean; coupon?: CouponData; error?: string }>>();

  public static getInstance(): CouponService {
    if (!CouponService.instance) {
      CouponService.instance = new CouponService();
    }
    return CouponService.instance;
  }

  // Get all available coupons
  getAllCoupons(): CouponData[] {
    return [
      {
        code: "FIRST30",
        discount: 30,
        maxDiscount: 200,
        description: "30% off on first order only - one-time use (up to ₹200)",
        type: "first_order",
        isFirstOrder: true,
        isOneTimeUse: true,
        isActive: true,
      },
      {
        code: "NEW20",
        discount: 20,
        maxDiscount: 200,
        description: "20% off on all orders (up to ₹200)",
        type: "general",
        isActive: true,
      },
      {
        code: "FIRST10",
        discount: 10,
        maxDiscount: 200,
        description: "10% off on first order only - one-time use",
        type: "first_order",
        isFirstOrder: true,
        isOneTimeUse: true,
        isActive: true,
      },
      {
        code: "SAVE20",
        discount: 20,
        maxDiscount: 200,
        description: "20% off",
        type: "general",
        isActive: true,
      },
    ];
  }

  // Check if a coupon is a referral reward coupon
  isReferralRewardCoupon(couponCode: string): boolean {
    return couponCode.toUpperCase().startsWith('REWARD');
  }

  // Check if user is a first-time user
  isFirstTimeUser(userId: string): boolean {
    if (!userId) return false;
    
    // Check if user has any existing bookings
    const existingBookings = JSON.parse(
      localStorage.getItem(`user_bookings_${userId}`) || "[]",
    );

    // Check if user has used any first-order coupons before
    const usedCoupons = JSON.parse(
      localStorage.getItem(`used_coupons_${userId}`) || "[]",
    ) as CouponUsage[];

    const hasUsedFirstOrderCoupon = usedCoupons.some(coupon =>
      coupon.code === "FIRST30"
    );

    return existingBookings.length === 0 && !hasUsedFirstOrderCoupon;
  }

  /**
   * Check if user has already used a specific coupon (with multiple safeguards)
   */
  hasCouponBeenUsed(couponCode: string, userId: string): boolean {
    if (!userId) return false;

    // Check user-specific usage
    const usedCoupons = JSON.parse(
      localStorage.getItem(`used_coupons_${userId}`) || "[]",
    ) as CouponUsage[];

    const hasUsedSpecific = usedCoupons.some(usage => usage.code === couponCode);

    // Additional safeguard: Check if FIRST30/FIRST10 has been used across all guest sessions
    // to prevent guest ID switching abuse
    if ((couponCode === "FIRST30" || couponCode === "FIRST10") && userId.startsWith('guest_')) {
      const allKeys = Object.keys(localStorage);
      const hasUsedAcrossGuests = allKeys.some(key => {
        if (key.startsWith('used_coupons_guest_')) {
          try {
            const coupons = JSON.parse(localStorage.getItem(key) || '[]');
            return coupons.some((usage: any) => usage.code === couponCode);
          } catch (e) {
            return false;
          }
        }
        return false;
      });

      if (hasUsedAcrossGuests) {
        console.log(`🚫 Detected ${couponCode} usage across guest sessions - preventing reuse`);
        return true;
      }
    }

    return hasUsedSpecific;
  }

  // Validate a coupon for a specific user
  validateCoupon(
    couponCode: string,
    userId: string,
    orderAmount: number = 0
  ): { valid: boolean; coupon?: CouponData; error?: string } {
    if (!couponCode || !userId) {
      return { valid: false, error: "Invalid input" };
    }

    const coupons = this.getAllCoupons();
    const coupon = coupons.find(c => c.code.toLowerCase() === couponCode.toLowerCase());

    if (!coupon) {
      return { valid: false, error: `Invalid coupon code: ${couponCode}` };
    }

    if (!coupon.isActive) {
      return { valid: false, error: "This coupon is no longer active" };
    }

    const isFirstTime = this.isFirstTimeUser(userId);

    // Check first order restrictions
    if (coupon.isFirstOrder && !isFirstTime) {
      return { valid: false, error: "This coupon is valid for first orders only" };
    }

    // For FIRST30, check if it's been used before
    if (coupon.code === "FIRST30" && this.hasCouponBeenUsed(coupon.code, userId)) {
      return { valid: false, error: "This coupon has already been used" };
    }

    // For referral reward coupons, always validate via API
    if (this.isReferralRewardCoupon(couponCode)) {
      // Referral reward coupons need backend validation
      // Return tentative approval, actual validation happens in validateCouponAsync
      return { valid: true, coupon: {
        ...coupon,
        code: couponCode.toUpperCase(),
        type: "referral_reward",
        isReferralReward: true,
        description: "Referral reward coupon - validating..."
      }};
    }

    return { valid: true, coupon };
  }

  // Calculate discount amount
  calculateDiscount(subtotal: number, coupon: CouponData): number {
    const discountAmount = Math.round(
      subtotal * (coupon.discount / 100),
    );
    return Math.min(discountAmount, coupon.maxDiscount);
  }

  // Mark coupon as used
  markCouponAsUsed(
    couponCode: string,
    userId: string,
    orderAmount: number,
    discountAmount: number
  ): void {
    const usage: CouponUsage = {
      code: couponCode,
      userId,
      usedAt: new Date().toISOString(),
      orderAmount,
      discountAmount,
    };

    const existingUsages = JSON.parse(
      localStorage.getItem(`used_coupons_${userId}`) || "[]",
    ) as CouponUsage[];

    existingUsages.push(usage);
    localStorage.setItem(`used_coupons_${userId}`, JSON.stringify(existingUsages));

    // Mark user as having made an order (no longer first-time)
    localStorage.setItem(`has_ordered_${userId}`, "true");

    console.log(`✅ Marked coupon ${couponCode} as used locally for user ${userId} and set order history flag`);
  }

  /**
   * Check API health
   */
  private async checkApiHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/coupons/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.log('🏥 Coupon API health check failed:', error);
      return false;
    }
  }

  /**
   * Validate a coupon for a specific user using backend API
   */
  async validateCouponAsync(
    couponCode: string,
    userId: string,
    orderAmount: number = 0
  ): Promise<{ valid: boolean; coupon?: CouponData; error?: string }> {
    if (!couponCode || !userId) {
      return { valid: false, error: "Invalid input" };
    }

    // Create a unique key for this validation request
    const requestKey = `${couponCode}_${userId}_${orderAmount}`;

    // If there's already a pending validation for this exact request, return it
    if (this.pendingValidations.has(requestKey)) {
      console.log(`🔄 Using pending validation for ${requestKey}`);
      return this.pendingValidations.get(requestKey)!;
    }

    // Create the validation promise
    const validationPromise = this.performValidation(couponCode, userId, orderAmount);

    // Store it to prevent duplicates
    this.pendingValidations.set(requestKey, validationPromise);

    // Clean up after completion
    validationPromise.finally(() => {
      this.pendingValidations.delete(requestKey);
    });

    return validationPromise;
  }

  private async performValidation(
    couponCode: string,
    userId: string,
    orderAmount: number = 0
  ): Promise<{ valid: boolean; coupon?: CouponData; error?: string }> {
    // Check API health first
    const isApiHealthy = await this.checkApiHealth();
    if (!isApiHealthy) {
      console.log('🏥 Coupon API unhealthy, using local validation');
      return this.validateCoupon(couponCode, userId, orderAmount);
    }

    try {
      const requestBody = JSON.stringify({
        couponCode,
        userId,
        orderAmount,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('❌ Coupon validation failed:', response.status, response.statusText);
        return this.validateCoupon(couponCode, userId, orderAmount);
      }

      const result = await response.json();
      return {
        valid: result.success,
        coupon: result.coupon,
        error: result.success ? undefined : result.message
      };
    } catch (error) {
      console.error('❌ Error validating coupon:', error);
      // Fallback to local validation if backend is unavailable
      return this.validateCoupon(couponCode, userId, orderAmount);
    }
  }

  /**
   * Get coupon usage history for a user
   */
  getCouponUsageHistory(userId: string): CouponUsage[] {
    if (!userId) return [];
    
    return JSON.parse(
      localStorage.getItem(`used_coupons_${userId}`) || "[]",
    ) as CouponUsage[];
  }

  /**
   * Clear all coupon usage data (for testing)
   */
  clearCouponUsageData(userId: string): void {
    if (!userId) return;
    
    localStorage.removeItem(`used_coupons_${userId}`);
    console.log(`🧹 Cleared coupon usage data for user ${userId}`);
  }
}
