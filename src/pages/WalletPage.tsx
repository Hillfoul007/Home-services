import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
  Loader,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { formatDateTimeIST } from "@/utils/timeUtils";

interface WalletBalance {
  balance: number;
  total_earned: number;
  total_used: number;
  last_transaction_at: string | null;
}

interface Transaction {
  _id: string;
  type: "credit" | "debit";
  amount: number;
  source: "cashback" | "refund" | "bonus" | "reward" | "manual" | "order_use";
  booking_id?: string;
  description: string;
  balance_after: number;
  created_at: string;
}

const getSourceBadgeColor = (source: string) => {
  switch (source) {
    case "cashback":
      return "bg-green-100 text-green-800";
    case "refund":
      return "bg-blue-100 text-blue-800";
    case "bonus":
      return "bg-purple-100 text-purple-800";
    case "reward":
      return "bg-orange-100 text-orange-800";
    case "manual":
      return "bg-gray-100 text-gray-800";
    case "order_use":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getSourceIcon = (type: "credit" | "debit") => {
  return type === "credit" ? (
    <ArrowDownLeft className="h-4 w-4 text-green-600" />
  ) : (
    <ArrowUpRight className="h-4 w-4 text-red-600" />
  );
};

const WalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  const loadWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.request<{
        success: boolean;
        wallet: WalletBalance;
      }>("/wallet/balance");

      if (response.success && response.data?.wallet) {
        setWallet(response.data.wallet);
      } else {
        setError("Failed to load wallet information");
      }
    } catch (err: any) {
      console.error("Error loading wallet:", err);
      setError(err?.message || "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (pageOffset: number = 0) => {
    try {
      if (pageOffset === 0) {
        setLoadingMore(true);
      }

      const response = await apiClient.request<{
        success: boolean;
        transactions: Transaction[];
        total: number;
      }>(`/wallet/transactions?limit=20&offset=${pageOffset}`);

      if (response.success && response.data?.transactions) {
        if (pageOffset === 0) {
          setTransactions(response.data.transactions);
        } else {
          setTransactions((prev) => [...prev, ...response.data.transactions]);
        }
        setTotalTransactions(response.data.total);
      }
    } catch (err: any) {
      console.error("Error loading transactions:", err);
      toast.error("Failed to load transaction history");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadWallet();
    loadTransactions(0);
  }, []);

  const handleLoadMore = () => {
    const newOffset = offset + 20;
    setOffset(newOffset);
    loadTransactions(newOffset);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">My Wallet</h1>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Wallet Balance Card */}
        {wallet && (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-2">
                    Available Balance
                  </p>
                  <p className="text-5xl font-bold">₹{wallet.balance.toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-400">
                  <div>
                    <p className="text-blue-100 text-sm flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4" />
                      Total Earned
                    </p>
                    <p className="text-2xl font-semibold">₹{wallet.total_earned.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm flex items-center gap-2 mb-1">
                      <TrendingDown className="h-4 w-4" />
                      Total Used
                    </p>
                    <p className="text-2xl font-semibold">₹{wallet.total_used.toFixed(2)}</p>
                  </div>
                </div>

                {wallet.last_transaction_at && (
                  <div className="pt-4 border-t border-blue-400">
                    <p className="text-blue-100 text-xs">
                      Last transaction: {formatDateTimeIST(wallet.last_transaction_at)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Earning Tips Card */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="h-5 w-5 text-amber-600" />
              How to Earn Wallet Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="font-semibold text-amber-600 flex-shrink-0">●</span>
                <span>Get cashback rewards on every order completion</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-amber-600 flex-shrink-0">●</span>
                <span>Receive referral bonuses when friends use your code</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-amber-600 flex-shrink-0">●</span>
                <span>Get promotional rewards and special offers</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-amber-600 flex-shrink-0">●</span>
                <span>Instant refunds credited to wallet on cancellations</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Transaction History
          </h2>

          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <Card key={transaction._id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          {getSourceIcon(transaction.type)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {transaction.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getSourceBadgeColor(transaction.source)}>
                              {transaction.source.charAt(0).toUpperCase() +
                                transaction.source.slice(1)}
                            </Badge>
                            <p className="text-xs text-gray-500">
                              {formatDateTimeIST(transaction.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            transaction.type === "credit"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {transaction.type === "credit" ? "+" : "-"}₹
                          {transaction.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Balance: ₹{transaction.balance_after.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {transactions.length < totalTransactions && (
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="w-full"
                >
                  {loadingMore ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    `Load More (${transactions.length} of ${totalTransactions})`
                  )}
                </Button>
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium mb-2">No transactions yet</p>
                <p className="text-sm text-gray-400">
                  Start earning wallet credits from your orders!
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Info Footer */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-sm text-gray-700">
            <p className="mb-2">
              <strong>💡 Tip:</strong> Wallet credits are automatically added when
              your orders are completed and can be used towards future orders or
              requested as refunds.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WalletPage;
