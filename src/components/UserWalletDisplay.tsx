import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, Wallet, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { walletService, type WalletTransaction } from "@/services/walletService";
import { getUserId } from "@/utils/authUtils";
import { toast } from "sonner";
import { formatDateTimeIST } from "@/utils/timeUtils";

interface UserWalletDisplayProps {
  userId?: string;
  compact?: boolean;
  showTransactions?: boolean;
}

const UserWalletDisplay: React.FC<UserWalletDisplayProps> = ({
  userId: propUserId,
  compact = false,
  showTransactions = true,
}) => {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Get user ID from props or auth utils
  const userId = propUserId || getUserId();

  useEffect(() => {
    if (userId) {
      loadWalletData();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadWalletData = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Fetch wallet balance
      const balanceResult = await walletService.getWalletBalance(userId);
      if (balanceResult.success && balanceResult.wallet_balance !== undefined) {
        setWalletBalance(balanceResult.wallet_balance);
      }

      // Fetch transactions if showing detailed view
      if (showTransactions) {
        const transResult = await walletService.getWalletTransactions(userId);
        if (transResult.success && transResult.transactions) {
          setTransactions(transResult.transactions);
        }
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error loading wallet data:", error);
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadWalletData();
  };

  if (!userId) {
    return null; // Don't show wallet if user is not authenticated
  }

  if (loading) {
    return (
      <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin">
            <RefreshCw className="h-5 w-5 text-green-600" />
          </div>
        </div>
      </Card>
    );
  }

  const recentTransactions = transactions.slice(0, 5);

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-600 rounded-lg">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">My Wallet</h3>
              <p className="text-xs text-gray-500">Cashback available</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8 w-8 p-0"
          >
            <ChevronDown
              className={`h-4 w-4 text-gray-600 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Balance Section */}
      <div className="p-4 border-b border-green-200 bg-white/50">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-gray-600 mb-1">Current Balance</p>
            <p className="text-3xl font-bold text-green-600">
              ₹{walletBalance.toFixed(2)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-green-300 text-green-700 hover:bg-green-100"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
        {lastRefresh && (
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Transactions Section */}
      {expanded && showTransactions && transactions.length > 0 && (
        <div className="p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Recent Transactions
          </h4>
          <div className="space-y-2">
            {recentTransactions.map((transaction, index) => (
              <div
                key={`${transaction.created_at}-${index}`}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`p-2 rounded-lg ${
                      transaction.type === "credit"
                        ? "bg-green-100"
                        : "bg-red-100"
                    }`}
                  >
                    {transaction.type === "credit" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.created_at).toLocaleString(
                        "en-IN",
                        {
                          timeZone: "Asia/Kolkata",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold ml-2 ${
                    transaction.type === "credit"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {transaction.type === "credit" ? "+" : "-"}₹
                  {transaction.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {transactions.length > 5 && (
            <p className="text-xs text-gray-500 text-center mt-3">
              +{transactions.length - 5} more transactions
            </p>
          )}
        </div>
      )}

      {/* No Transactions */}
      {expanded && showTransactions && transactions.length === 0 && (
        <div className="p-4 text-center">
          <p className="text-sm text-gray-500">
            No transactions yet. Start ordering to earn cashback!
          </p>
        </div>
      )}

      {/* Compact Mode Info */}
      {compact && (
        <div className="p-3 text-center text-xs text-gray-600">
          Click to expand and see transactions
        </div>
      )}
    </Card>
  );
};

export default UserWalletDisplay;
