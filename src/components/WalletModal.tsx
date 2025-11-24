import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Loader } from "lucide-react";
import { walletService, WalletTransaction } from "@/services/walletService";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { formatDateTimeIST } from "@/utils/timeUtils";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadWalletData();
    }
  }, [isOpen, currentUser]);

  const loadWalletData = async () => {
    if (!currentUser) return;

    try {
      setWalletLoading(true);
      const userId = currentUser._id || currentUser.phone;

      const balanceResult = await walletService.getWalletBalance(userId);
      if (balanceResult.success && balanceResult.wallet_balance !== undefined) {
        setWalletBalance(balanceResult.wallet_balance);
      }

      const transResult = await walletService.getWalletTransactions(userId);
      if (transResult.success && transResult.transactions) {
        setWalletTransactions(transResult.transactions);
      }
    } catch (error) {
      console.error("Error loading wallet data:", error);
      toast.error("Failed to load wallet data");
    } finally {
      setWalletLoading(false);
    }
  };

  const handleRefreshWallet = async () => {
    await loadWalletData();
    toast.success("Wallet updated");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            My Wallet
          </DialogTitle>
          <DialogDescription>
            Manage your wallet balance and view transaction history
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {walletLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-6 w-6 animate-spin text-green-600" />
            </div>
          ) : (
            <>
              {/* Wallet Balance Card */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <Wallet className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Wallet Balance</p>
                      <p className="text-2xl font-bold text-green-600">
                        ₹{walletBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshWallet}
                    className="text-green-700 hover:bg-green-100"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-600">
                  Available for cashback and discounts
                </p>
              </Card>

              {/* Transaction History */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Transaction History
                </h3>
                {walletTransactions.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {walletTransactions.map((transaction, index) => (
                      <div
                        key={`${transaction.created_at}-${index}`}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className={`p-2 rounded-lg flex-shrink-0 ${
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
                              {formatDateTimeIST(transaction.created_at)}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`text-sm font-semibold ml-2 flex-shrink-0 ${
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
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No transactions yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Start ordering to earn cashback!
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletModal;
