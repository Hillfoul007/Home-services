import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { walletService, type WalletTransaction } from "@/services/walletService";
import { ChevronDown, Wallet, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

interface UserWalletDisplayProps {
  userId?: string;
  onWalletUpdate?: (balance: number) => void;
}

const UserWalletDisplay: React.FC<UserWalletDisplayProps> = ({
  userId,
  onWalletUpdate,
}) => {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWalletData();
  }, [userId]);

  const loadWalletData = async () => {
    if (!userId) {
      setError("User ID not found");
      return;
    }

    setIsLoading(true);
    try {
      const balanceResult = await walletService.getWalletBalance(userId);
      if (balanceResult.success) {
        setWalletBalance(balanceResult.wallet_balance || 0);
        setError(null);
        if (onWalletUpdate) {
          onWalletUpdate(balanceResult.wallet_balance || 0);
        }
      } else {
        setError(balanceResult.error || "Failed to load wallet");
      }

      const transactionsResult = await walletService.getWalletTransactions(userId);
      if (transactionsResult.success) {
        setTransactions(transactionsResult.transactions || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load wallet");
      console.error("Error loading wallet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadWalletData();
    toast.success("Wallet updated");
  };

  return (
    <Card className="w-full bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
      <div className="p-4">
        {/* Wallet Header */}
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">My Wallet Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{walletBalance.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className={`p-2 hover:bg-white/50 rounded-lg transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            <ChevronDown className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Error Display */}
        {error && !isLoading && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Wallet Info Note */}
        {!error && !isLoading && walletBalance > 0 && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-700 font-medium">
              You can use ₹{walletBalance.toFixed(2)} cashback on your next order
            </p>
          </div>
        )}

        {/* Expanded Section */}
        {isExpanded && (
          <div className="mt-4 border-t border-purple-200 pt-4">
            {/* Refresh Button */}
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
              className="w-full mb-4 text-xs"
            >
              {isLoading ? "Loading..." : "Refresh Wallet"}
            </Button>

            {/* Transaction History */}
            <div>
              <h3 className="font-semibold text-sm text-gray-900 mb-3">
                Recent Transactions
              </h3>

              {transactions.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-gray-600">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transactions.map((txn, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        txn.type === "credit"
                          ? "bg-green-50 border border-green-200"
                          : "bg-red-50 border border-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`p-2 rounded-lg ${
                            txn.type === "credit"
                              ? "bg-green-200"
                              : "bg-red-200"
                          }`}
                        >
                          {txn.type === "credit" ? (
                            <ArrowDown className="h-4 w-4 text-green-700" />
                          ) : (
                            <ArrowUp className="h-4 w-4 text-red-700" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {txn.description}
                          </p>
                          <p className="text-xs text-gray-600">
                            {new Date(txn.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`text-xs font-bold whitespace-nowrap ml-2 ${
                          txn.type === "credit"
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {txn.type === "credit" ? "+" : "-"}₹{txn.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default UserWalletDisplay;
