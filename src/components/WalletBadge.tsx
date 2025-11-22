import React, { useState, useEffect } from "react";
import { Wallet, RefreshCw } from "lucide-react";
import { walletService } from "@/services/walletService";
import { getUserId } from "@/utils/authUtils";
import { toast } from "sonner";

interface WalletBadgeProps {
  onClick?: () => void;
  showRefresh?: boolean;
}

const WalletBadge: React.FC<WalletBadgeProps> = ({ onClick, showRefresh = true }) => {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userId = getUserId();

  useEffect(() => {
    if (userId) {
      loadWalletBalance();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadWalletBalance = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const result = await walletService.getWalletBalance(userId);
      if (result.success && result.wallet_balance !== undefined) {
        setWalletBalance(result.wallet_balance);
      }
    } catch (error) {
      console.error("Error loading wallet balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      await loadWalletBalance();
      toast.success("Wallet updated");
    } catch (error) {
      toast.error("Failed to update wallet");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg"
    >
      <Wallet className="h-4 w-4 text-white" />
      <span className="text-sm font-semibold text-white">
        {loading ? "..." : `₹${walletBalance.toFixed(0)}`}
      </span>
      {showRefresh && (
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ml-1 p-0.5 hover:bg-white/20 rounded transition-colors disabled:opacity-50"
          title="Refresh wallet balance"
        >
          <RefreshCw className={`h-3 w-3 text-white ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
};

export default WalletBadge;
