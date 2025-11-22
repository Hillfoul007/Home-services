import { useEffect, useState, useRef, useCallback } from "react";
import { walletService } from "@/services/walletService";
import { useNotifications } from "@/contexts/NotificationContext";
import { createSuccessNotification } from "@/utils/notificationUtils";

interface WalletPollingOptions {
  userId: string | null | undefined;
  enabled?: boolean;
  pollInterval?: number; // milliseconds
  onBalanceChange?: (oldBalance: number, newBalance: number) => void;
}

const DEFAULT_POLL_INTERVAL = 30000; // 30 seconds

export const useWalletPolling = ({
  userId,
  enabled = true,
  pollInterval = DEFAULT_POLL_INTERVAL,
  onBalanceChange,
}: WalletPollingOptions) => {
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousBalanceRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { addNotification } = useNotifications();

  const fetchBalance = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await walletService.getWalletBalance(userId as string);

      if (result.success && result.wallet_balance !== undefined) {
        const newBalance = result.wallet_balance;

        // Check if balance has increased
        if (previousBalanceRef.current !== null && newBalance > previousBalanceRef.current) {
          const difference = newBalance - previousBalanceRef.current;

          // Show notification
          addNotification(
            createSuccessNotification(
              "💰 Wallet Updated!",
              `You received ₹${difference.toFixed(2)} cashback! New balance: ₹${newBalance.toFixed(2)}`
            )
          );

          // Call callback if provided
          if (onBalanceChange) {
            onBalanceChange(previousBalanceRef.current, newBalance);
          }
        }

        previousBalanceRef.current = newBalance;
        setCurrentBalance(newBalance);
      } else {
        setError(result.error || "Failed to fetch wallet balance");
      }
    } catch (err) {
      console.error("Error polling wallet balance:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId, addNotification, onBalanceChange]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !userId) {
      // Clear interval if disabled or no user
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Fetch balance immediately on mount
    fetchBalance();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(() => {
      fetchBalance();
    }, pollInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [enabled, userId, pollInterval, fetchBalance]);

  const manualRefresh = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  return {
    currentBalance,
    loading,
    error,
    refresh: manualRefresh,
  };
};

export default useWalletPolling;
