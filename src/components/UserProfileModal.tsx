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
import { User, Phone, Edit3, Save, X, Wallet, RefreshCw, TrendingUp, TrendingDown, Loader, CheckCircle } from "lucide-react";
import { DVHostingSmsService } from "@/services/dvhostingSmsService";
import { walletService, type WalletTransaction } from "@/services/walletService";
import { toast } from "sonner";
import { formatDateTimeIST } from "@/utils/timeUtils";
import { getApiUrl } from "@/config/env";

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

  // Reset form data when modal opens with new user
  useEffect(() => {
    if (isOpen && currentUser) {
      setFormData({
        name: currentUser?.name || currentUser?.full_name || "",
        phone: currentUser?.phone || "",
      });
      setIsEditing(false);
      setActiveTab("profile");
    }
  }, [isOpen, currentUser?._id, currentUser?.phone]);

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
      toast.error("Please enter your name");
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
        const response = await fetch(`${getApiUrl()}/auth/save-user`, {
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
      toast.success("Profile updated!");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update profile. Please try again.");
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

  const displayName = currentUser?.name || currentUser?.full_name || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden p-0 rounded-2xl">
        {/* Profile Header with Avatar */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 px-6 pt-8 pb-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{displayName}</h2>
              <div className="flex items-center gap-1.5 text-white/80 text-sm">
                <Phone className="h-3.5 w-3.5" />
                <span>+91 {currentUser?.phone}</span>
                <CheckCircle className="h-3.5 w-3.5 text-green-300 ml-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="overflow-y-auto max-h-[calc(85vh-140px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-gray-50 h-11">
              <TabsTrigger value="profile" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">
                Profile
              </TabsTrigger>
              <TabsTrigger value="wallet" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">
                <Wallet className="h-4 w-4 mr-1.5" />
                Wallet
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="p-5 space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter your full name"
                    className="h-11"
                    autoFocus
                    required
                  />
                ) : (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-800">
                        {displayName}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <Phone className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="font-mono text-gray-800">+91 {currentUser?.phone}</span>
                  <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </span>
                </div>
              </div>

              {isEditing ? (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isLoading || !formData.name.trim()}
                    className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
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
                    className="h-11"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="pt-2">
                  <Button variant="outline" onClick={onClose} className="w-full h-11">
                    Close
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Wallet Tab */}
            <TabsContent value="wallet" className="p-5 space-y-4 mt-0">
              {walletLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-green-600" />
                </div>
              ) : (
                <>
                  {/* Wallet Balance Card */}
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-600 rounded-xl">
                          <Wallet className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Wallet Balance</p>
                          <p className="text-2xl font-bold text-green-600">
                            ₹{walletBalance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefreshWallet}
                        className="text-green-700 hover:bg-green-100 rounded-lg"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Available for cashback and discounts</p>
                  </Card>

                  {/* Transaction History */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900">Transaction History</h3>
                    {walletTransactions.length > 0 ? (
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {walletTransactions.map((transaction, index) => (
                          <div
                            key={`${transaction.created_at}-${index}`}
                            className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg"
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
                      <div className="text-center py-8 text-gray-500">
                        <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium">No transactions yet</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Start ordering to earn cashback!
                        </p>
                      </div>
                    )}
                  </div>

                  <Button variant="outline" onClick={onClose} className="w-full h-11 mt-2">
                    Close
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;
