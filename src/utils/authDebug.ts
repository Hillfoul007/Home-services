/**
 * Authentication debug utility to help troubleshoot auth persistence issues
 */

import { DVHostingSmsService } from "@/services/dvhostingSmsService";

export const debugAuthState = () => {
  const authService = DVHostingSmsService.getInstance();

  console.group("🔍 Authentication Debug Information");

  // Check all storage keys
  const storageKeys = [
    "auth_token",
    "cleancare_auth_token",
    "current_user",
    "cleancare_user",
  ];

  console.log("📱 LocalStorage contents:");
  storageKeys.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value) {
      if (key.includes("user")) {
        try {
          const parsed = JSON.parse(value);
          console.log(`  ${key}:`, {
            phone: parsed.phone,
            name: parsed.name,
            isVerified: parsed.isVerified,
            id: parsed._id || parsed.id,
          });
        } catch {
          console.log(`  ${key}: (corrupted JSON)`);
        }
      } else {
        console.log(`  ${key}:`, value.substring(0, 30) + "...");
      }
    } else {
      console.log(`  ${key}: (not found)`);
    }
  });

  // Check auth service state
  console.log("🔐 Auth Service State:");
  console.log("  isAuthenticated():", authService.isAuthenticated());
  console.log("  getCurrentUser():", authService.getCurrentUser());

  // Check browser/environment info
  console.log("🌐 Environment Info:");
  console.log("  User Agent:", navigator.userAgent);
  console.log("  Hostname:", window.location.hostname);
  console.log("  Protocol:", window.location.protocol);

  console.groupEnd();
};

// Make debug function available globally in development
if (import.meta.env.DEV) {
  (window as any).debugAuth = debugAuthState;
  console.log("🔧 Debug function available: debugAuth()");
}

export const validateAuthConsistency = (): boolean => {
  const authService = DVHostingSmsService.getInstance();

  // Check if all auth storage keys are consistent
  const token1 = localStorage.getItem("auth_token");
  const token2 = localStorage.getItem("cleancare_auth_token");
  const user1 = localStorage.getItem("current_user");
  const user2 = localStorage.getItem("cleancare_user");

  // At least one token and one user should exist
  const hasToken = !!(token1 || token2);
  const hasUser = !!(user1 || user2);

  if (!hasToken || !hasUser) {
    console.warn("⚠️ Inconsistent auth state: missing token or user data");
    return false;
  }

  // If both tokens exist, they should match
  if (token1 && token2 && token1 !== token2) {
    console.warn("⚠️ Token mismatch detected, syncing...");
    // Use the newer/longer token
    const preferredToken = token1.length > token2.length ? token1 : token2;
    localStorage.setItem("auth_token", preferredToken);
    localStorage.setItem("cleancare_auth_token", preferredToken);
  }

  // If both users exist, they should match
  if (user1 && user2) {
    try {
      const parsedUser1 = JSON.parse(user1);
      const parsedUser2 = JSON.parse(user2);

      if (parsedUser1.phone !== parsedUser2.phone) {
        console.warn("⚠️ User data mismatch detected, syncing...");
        // Use the user with more complete data
        const preferredUser =
          Object.keys(parsedUser1).length >= Object.keys(parsedUser2).length
            ? user1
            : user2;
        localStorage.setItem("current_user", preferredUser);
        localStorage.setItem("cleancare_user", preferredUser);
      }
    } catch (error) {
      console.error("❌ Error parsing user data:", error);
      return false;
    }
  }

  console.log("✅ Auth state consistency validated");
  return true;
};
