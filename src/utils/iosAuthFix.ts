/**
 * iOS-specific authentication fixes for OTP and session management
 */

export const clearIosAuthState = (): void => {
  try {
    // Only clear auth-related keys, preserve cart and other user data
    const keysToRemove = [
      "current_user",
      "cleancare_user",
      "cleancare_auth_token",
      "auth_token",
    ];

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });

    // Clear sessionStorage completely for iOS
    sessionStorage.clear();

    // Clear any cached form data in iOS Safari
    const forms = document.querySelectorAll("form");
    forms.forEach((form) => {
      if (form instanceof HTMLFormElement) {
        form.reset();
      }
    });

    // Clear input fields that might be cached
    const inputs = document.querySelectorAll(
      'input[type="tel"], input[type="text"]',
    );
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
    });

    console.log("✅ iOS auth state cleared (explicit logout)");
  } catch (error) {
    console.error("❌ Error clearing iOS auth state:", error);
  }
};

export const addIosNoCacheHeaders = (
  fetchOptions: RequestInit = {},
): RequestInit => {
  return {
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  };
};

export const isIosDevice = (): boolean => {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

export const isPWAMode = (): boolean => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://") ||
    window.location.search.includes("pwa=true")
  );
};

export const isIosPWA = (): boolean => {
  return isIosDevice() && isPWAMode();
};

export const addIosOtpDelay = async (): Promise<void> => {
  if (isIosDevice()) {
    // Add 2-3 second delay for iOS to prevent DVHosting rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
};

// Global flags to prevent multiple interval creation
let iosIntervalsSetup = false;
let iosPreservationInterval: NodeJS.Timeout | null = null;
let iosMonitoringInterval: NodeJS.Timeout | null = null;

/**
 * iPhone-specific session persistence to prevent auto logout
 */
export const preventIosAutoLogout = (): void => {
  if (!isIosDevice() || iosIntervalsSetup) return;

  iosIntervalsSetup = true;

  const mode = isPWAMode() ? "PWA" : "Safari";
  console.log(
    `🍎 Initializing iPhone-specific auth persistence for ${mode} mode`,
  );

  // PWA launch detection - immediate auth check
  if (isPWAMode()) {
    console.log("🍎📱 PWA mode detected - performing immediate auth check");
    setTimeout(async () => {
      const user =
        localStorage.getItem("current_user") ||
        localStorage.getItem("cleancare_user");
      const token =
        localStorage.getItem("auth_token") ||
        localStorage.getItem("cleancare_auth_token");

      if (!user || !token) {
        console.log("🍎📱 PWA launch - no auth found, attempting restoration");
        const restored = await restoreIosAuth();
        if (restored) {
          console.log("🍎📱 PWA launch - auth restored successfully");
          window.dispatchEvent(
            new CustomEvent("ios-session-restored", {
              detail: {
                user: JSON.parse(localStorage.getItem("current_user") || "{}"),
                restored: true,
                mode: "pwa",
                trigger: "launch",
              },
            }),
          );
        }
      } else {
        console.log("🍎📱 PWA launch - auth found, preserving state");
        // Ensure auth is preserved
        try {
          const userObj = JSON.parse(user);
          await saveIosAuthToIndexedDB(userObj, token);
        } catch (e) {
          console.warn("🍎📱 PWA launch - failed to save to IndexedDB:", e);
        }
      }
    }, 1000); // Wait 1 second after launch
  }

  // Handle iOS PWA state changes that can clear localStorage
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // User returned to the app - ensure auth is preserved
      const user =
        localStorage.getItem("current_user") ||
        localStorage.getItem("cleancare_user");
      const token =
        localStorage.getItem("auth_token") ||
        localStorage.getItem("cleancare_auth_token");

      if (user && token) {
        console.log("🍎 iPhone visibility change - auth preserved");
        // Trigger a storage event to sync auth state
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "auth_heartbeat",
            newValue: Date.now().toString(),
            storageArea: localStorage,
          }),
        );
      }
    }
  });

  // Handle iOS Safari memory pressure that can clear localStorage
  window.addEventListener("pagehide", () => {
    const user =
      localStorage.getItem("current_user") ||
      localStorage.getItem("cleancare_user");
    const token =
      localStorage.getItem("auth_token") ||
      localStorage.getItem("cleancare_auth_token");

    if (user && token) {
      // Double-write auth data to multiple keys for redundancy
      localStorage.setItem("ios_backup_user", user);
      localStorage.setItem("ios_backup_token", token);
      localStorage.setItem("ios_auth_timestamp", Date.now().toString());
      console.log("🍎 iPhone pagehide - created auth backup");
    }
  });

  // Handle iOS app resume/focus
  window.addEventListener("pageshow", async (event) => {
    if (event.persisted) {
      // Page was restored from cache - check auth state
      const user =
        localStorage.getItem("current_user") ||
        localStorage.getItem("cleancare_user");
      const token =
        localStorage.getItem("auth_token") ||
        localStorage.getItem("cleancare_auth_token");

      if (!user || !token) {
        console.log(
          `🍎 ${isPWAMode() ? "PWA" : "Safari"} pageshow - auth missing, attempting restoration`,
        );
        // Try comprehensive restoration for PWA mode
        const restored = await restoreIosAuth();
        if (restored) {
          console.log(
            `🍎 ${isPWAMode() ? "PWA" : "Safari"} pageshow - auth restored`,
          );
          // Trigger auth restoration event
          window.dispatchEvent(
            new CustomEvent("ios-auth-restored", {
              detail: {
                user: JSON.parse(localStorage.getItem("current_user") || "{}"),
                mode: isPWAMode() ? "pwa" : "safari",
              },
            }),
          );
        }
      }
    }
  });

  // PWA-specific: Handle app focus/blur events
  if (isPWAMode()) {
    window.addEventListener("focus", async () => {
      console.log("🍎📱 PWA focus - checking auth state");
      const user =
        localStorage.getItem("current_user") ||
        localStorage.getItem("cleancare_user");
      const token =
        localStorage.getItem("auth_token") ||
        localStorage.getItem("cleancare_auth_token");

      if (!user || !token) {
        console.log("🍎📱 PWA focus - auth missing, attempting restoration");
        const restored = await restoreIosAuth();
        if (restored) {
          console.log("🍎📱 PWA focus - auth restored");
          window.dispatchEvent(
            new CustomEvent("ios-session-restored", {
              detail: {
                user: JSON.parse(localStorage.getItem("current_user") || "{}"),
                restored: true,
                mode: "pwa",
                trigger: "focus",
              },
            }),
          );
        }
      }
    });

    window.addEventListener("blur", () => {
      console.log("🍎📱 PWA blur - preserving auth state");
      preserveAuth();
    });
  }

  // Prevent iOS from clearing localStorage when memory is low
  const preserveAuth = async () => {
    const user =
      localStorage.getItem("current_user") ||
      localStorage.getItem("cleancare_user");
    const token =
      localStorage.getItem("auth_token") ||
      localStorage.getItem("cleancare_auth_token");

    if (user && token) {
      // Create multiple backup copies
      sessionStorage.setItem("ios_session_user", user);
      sessionStorage.setItem("ios_session_token", token);

      // Use a more persistent storage method
      try {
        document.cookie = `ios_auth_backup=${encodeURIComponent(user)}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Strict`;
      } catch (e) {
        // Cookie storage failed, continue
      }

      // Save to IndexedDB (most persistent)
      try {
        const userObj = JSON.parse(user);
        await saveIosAuthToIndexedDB(userObj, token);
      } catch (e) {
        // IndexedDB save failed, continue
      }
    }
  };

  // Different intervals for PWA vs Safari
  const preservationInterval = isPWAMode() ? 15000 : 30000; // PWA: every 15s, Safari: every 30s
  const monitoringInterval = isPWAMode() ? 5000 : 10000; // PWA: every 5s, Safari: every 10s

  console.log(
    `🍎 ${isPWAMode() ? "PWA" : "Safari"} mode detected - using ${preservationInterval / 1000}s preservation interval`,
  );

  // Run preservation more frequently for PWA - with cleanup protection
  if (iosPreservationInterval) {
    clearInterval(iosPreservationInterval);
  }
  iosPreservationInterval = setInterval(preserveAuth, preservationInterval);

  // Run initial preservation
  preserveAuth();

  // Aggressive session monitoring for iPhone - more frequent for PWA
  if (iosMonitoringInterval) {
    clearInterval(iosMonitoringInterval);
  }
  iosMonitoringInterval = setInterval(async () => {
    const user =
      localStorage.getItem("current_user") ||
      localStorage.getItem("cleancare_user");
    const token =
      localStorage.getItem("auth_token") ||
      localStorage.getItem("cleancare_auth_token");

    if (!user || !token) {
      console.log(
        `🍎🚨 iPhone ${isPWAMode() ? "PWA" : "Safari"} session lost detected - attempting restoration`,
      );
      const restored = await restoreIosAuth();
      if (restored) {
        console.log(
          `🍎✅ iPhone ${isPWAMode() ? "PWA" : "Safari"} session successfully restored`,
        );
        // Trigger a custom event to notify the app
        window.dispatchEvent(
          new CustomEvent("ios-session-restored", {
            detail: {
              user: JSON.parse(localStorage.getItem("current_user") || "{}"),
              restored: true,
              mode: isPWAMode() ? "pwa" : "safari",
            },
          }),
        );
      } else {
        console.log(
          `🍎❌ iPhone ${isPWAMode() ? "PWA" : "Safari"} session restoration failed`,
        );
      }
    }
  }, monitoringInterval);
};

/**
 * Cleanup iOS intervals (useful for testing or memory cleanup)
 */
export const cleanupIosIntervals = (): void => {
  if (iosPreservationInterval) {
    clearInterval(iosPreservationInterval);
    iosPreservationInterval = null;
  }
  if (iosMonitoringInterval) {
    clearInterval(iosMonitoringInterval);
    iosMonitoringInterval = null;
  }
  iosIntervalsSetup = false;
  console.log('🍎 iOS auth intervals cleaned up');
};

/**
 * Restore auth from various iPhone backup locations
 */
export const restoreIosAuth = async (): Promise<boolean> => {
  if (!isIosDevice()) return false;

  const user =
    localStorage.getItem("current_user") ||
    localStorage.getItem("cleancare_user");
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("cleancare_auth_token");

  if (user && token) {
    return true; // Auth already exists
  }

  // Try IndexedDB first (most persistent)
  const indexedDBRestored = await restoreIosAuthFromIndexedDB();
  if (indexedDBRestored) {
    return true;
  }

  // Try to restore from backups
  const backupUser =
    localStorage.getItem("ios_backup_user") ||
    sessionStorage.getItem("ios_session_user");
  const backupToken =
    localStorage.getItem("ios_backup_token") ||
    sessionStorage.getItem("ios_session_token");

  if (backupUser && backupToken) {
    localStorage.setItem("current_user", backupUser);
    localStorage.setItem("cleancare_user", backupUser);
    localStorage.setItem("auth_token", backupToken);
    localStorage.setItem("cleancare_auth_token", backupToken);
    console.log("🍎 Restored iPhone auth from backup storage");
    return true;
  }

  // Try to restore from cookie backup
  try {
    const cookies = document.cookie.split(";");
    const authCookie = cookies.find((c) =>
      c.trim().startsWith("ios_auth_backup="),
    );

    if (authCookie) {
      const cookieUser = decodeURIComponent(authCookie.split("=")[1]);
      // Parse user to get phone and create proper token
      try {
        const user = JSON.parse(cookieUser);
        const phone = user.phone || user.mobile || user.id;
        const persistentToken = `user_token_${phone}_persistent`;

        localStorage.setItem("current_user", cookieUser);
        localStorage.setItem("cleancare_user", cookieUser);
        localStorage.setItem("auth_token", persistentToken);
        localStorage.setItem("cleancare_auth_token", persistentToken);
        console.log("🍎 Restored iPhone auth from cookie backup with token");
        return true;
      } catch (e) {
        // Fallback without token
        localStorage.setItem("current_user", cookieUser);
        localStorage.setItem("cleancare_user", cookieUser);
        console.log("🍎 Restored iPhone auth from cookie backup (no token)");
        return true;
      }
    }
  } catch (e) {
    // Cookie restore failed
  }

  return false;
};

/**
 * IndexedDB persistence for iPhone auth (most persistent storage)
 */
const IOS_AUTH_DB = "ios_auth_backup";
const IOS_AUTH_STORE = "auth_data";

const openIosAuthDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IOS_AUTH_DB, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IOS_AUTH_STORE)) {
        db.createObjectStore(IOS_AUTH_STORE, { keyPath: "id" });
      }
    };
  });
};

export const saveIosAuthToIndexedDB = async (
  user: any,
  token: string,
): Promise<void> => {
  if (!isIosDevice()) return;

  try {
    const db = await openIosAuthDB();
    const transaction = db.transaction([IOS_AUTH_STORE], "readwrite");
    const store = transaction.objectStore(IOS_AUTH_STORE);

    await store.put({
      id: "ios_auth",
      user: JSON.stringify(user),
      token: token,
      timestamp: Date.now(),
    });

    console.log("🍎📱 Saved iPhone auth to IndexedDB");
  } catch (error) {
    console.warn("🍎⚠️ Failed to save to IndexedDB:", error);
  }
};

export const restoreIosAuthFromIndexedDB = async (): Promise<boolean> => {
  if (!isIosDevice()) return false;

  try {
    const db = await openIosAuthDB();
    const transaction = db.transaction([IOS_AUTH_STORE], "readonly");
    const store = transaction.objectStore(IOS_AUTH_STORE);

    return new Promise((resolve) => {
      const request = store.get("ios_auth");

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.user && result.token) {
          // Check if data is not too old (30 days for PWA, 7 days for Safari)
          const maxAge = isPWAMode()
            ? 30 * 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;
          const age = Date.now() - result.timestamp;
          if (age < maxAge) {
            localStorage.setItem("current_user", result.user);
            localStorage.setItem("cleancare_user", result.user);
            localStorage.setItem("auth_token", result.token);
            localStorage.setItem("cleancare_auth_token", result.token);
            console.log(
              `🍎📱 Restored iPhone auth from IndexedDB (${isPWAMode() ? "PWA" : "Safari"} mode)`,
            );
            resolve(true);
            return;
          } else {
            console.log(
              `🍎⏰ IndexedDB auth data too old (${Math.round(age / (24 * 60 * 60 * 1000))} days), skipping restore`,
            );
          }
        }
        resolve(false);
      };

      request.onerror = () => resolve(false);
    });
  } catch (error) {
    console.warn("🍎⚠️ Failed to restore from IndexedDB:", error);
    return false;
  }
};
