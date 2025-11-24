import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { User, Phone, Edit3, Save, X, Wallet, RefreshCw, TrendingUp, TrendingDown, Loader } from "lucide-react";
import { DVHostingSmsService } from "@/services/dvhostingSmsService";
import { walletService, type WalletTransaction } from "@/services/walletService";
import { toast } from "sonner";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUserUpdate: (updatedUser: any) => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState({
    name: currentUser?.name || currentUser?.full_name || "",
    phone: currentUser?.phone || "",
  });

  // Load wallet data when modal opens
  useEffect(() => {
    if (isOpen && currentUser) {
      loadWalletData();
    }
  }, [isOpen, currentUser?._id, currentUser?.phone]);

  const loadWalletData = async () => {
    if (!currentUser) return;

    try {
      setWalletLoading(true);
      const userId = currentUser._id || currentUser.phone;

      // Fetch wallet balance
      const balanceResult = await walletService.getWalletBalance(userId);
      if (balanceResult.success && balanceResult.wallet_balance !== undefined) {
        setWalletBalance(balanceResult.wallet_balance);
      }

      // Fetch transactions
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

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      const authService = DVHostingSmsService.getInstance();
      const updatedUser = {
        ...currentUser,
        name: formData.name.trim(),
        full_name: formData.name.trim(),
      };

      // Update in localStorage
      authService.setCurrentUser(updatedUser);

      // Try to update in backend if available
      try {
        const response = await fetch("/api/auth/save-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: currentUser.phone,
            full_name: formData.name.trim(),
            name: formData.name.trim(),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.user) {
            authService.setCurrentUser(result.user);
            onUserUpdate(result.user);
          }
        }
      } catch (error) {
        console.warn("Backend update failed:", error);
      }

      onUserUpdate(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: currentUser?.name || currentUser?.full_name || "",
      phone: currentUser?.phone || "",
    });
    setIsEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            User Profile
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="wallet">
              <Wallet className="h-4 w-4 mr-2" />
              Wallet
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              {isEditing ? (
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter your full name"
                  required
                />
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span className="font-medium">
                    {currentUser?.name || currentUser?.full_name || "Not set"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="p-2"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex items-center p-3 bg-gray-50 rounded-md">
                <Phone className="h-4 w-4 text-gray-500 mr-2" />
                <span className="font-mono">+91 {currentUser?.phone}</span>
                <span className="ml-auto text-xs text-gray-500">Verified</span>
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isLoading || !formData.name.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}

            {!isEditing && (
              <div className="pt-4">
                <Button variant="outline" onClick={onClose} className="w-full">
                  Close
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="space-y-4 mt-4">
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
                  <p className="text-xs text-gray-600">Available for cashback and discounts</p>
                </Card>

                {/* Transaction History */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Transaction History</h3>
                  {walletTransactions.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                                {new Date(transaction.created_at).toLocaleString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
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

                <Button variant="outline" onClick={onClose} className="w-full mt-4">
                  Close
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;
