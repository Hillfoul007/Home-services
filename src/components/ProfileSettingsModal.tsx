import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  Edit,
  Save,
  X,
  LogOut,
  Gift,
  Copy,
  MapPin,
  Wallet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Loader,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import UserService from "@/services/userService";
import SavedAddressesModal from "./SavedAddressesModal";
import { walletService, type WalletTransaction } from "@/services/walletService";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUpdateProfile: (updatedUser: any) => void;
  onLogout?: () => void;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
  });
  const { toast } = useToast();
  const userService = UserService.getInstance();

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
    } finally {
      setWalletLoading(false);
    }
  };

  const handleRefreshWallet = async () => {
    await loadWalletData();
    toast({
      title: "Success",
      description: "Wallet updated",
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedUser = await userService.updateUser(
        currentUser.phone,
        formData,
      );
      if (updatedUser) {
        onUpdateProfile(updatedUser);
        setIsEditing(false);
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setFormData({
      name: currentUser?.name || "",
      email: currentUser?.email || "",
      phone: currentUser?.phone || "",
    });
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-[95vw] mx-4 sm:mx-auto border-0 shadow-2xl rounded-3xl overflow-hidden bg-gradient-to-br from-white via-gray-50/50 to-green-50/30 animate-in zoom-in-95 duration-300 fade-in-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2 shrink-0">
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Account Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 shrink-0 mx-1">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="wallet">
              <Wallet className="h-4 w-4 mr-2" />
              Wallet
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="flex-1 overflow-y-auto">
            <div className="space-y-6 p-3 max-h-[calc(90vh-180px)]">
              {/* Profile Picture */}
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="h-24 w-24 shadow-xl ring-4 ring-green-100 ring-offset-4 ring-offset-white transition-all duration-300 hover:ring-green-200 hover:shadow-2xl">
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white text-2xl font-bold">
                      {getInitials(formData.name || "User")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-8 w-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white">
                    <Edit className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-5">
                <div className="group">
                  <Label
                    htmlFor="name"
                    className="text-sm font-semibold text-gray-700 mb-2 block"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    disabled={!isEditing}
                    className={`transition-all duration-200 rounded-xl border-2 ${
                      !isEditing
                        ? "bg-gray-50/80 border-gray-200 text-gray-600"
                        : "bg-white border-green-200 focus:border-green-400 focus:ring-green-400/20 shadow-sm hover:shadow-md"
                    }`}
                  />
                </div>

                <div className="group">
                  <Label
                    htmlFor="phone"
                    className="text-sm font-semibold text-gray-700 mb-2 block"
                  >
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    disabled={true}
                    className="bg-gray-50/80 border-2 border-gray-200 text-gray-600 rounded-xl"
                  />
                  <p className="text-xs text-gray-500 mt-2 ml-1 flex items-center">
                    <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                    Phone number cannot be changed
                  </p>
                </div>

                <div className="group">
                  <Label
                    htmlFor="email"
                    className="text-sm font-semibold text-gray-700 mb-2 block"
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter your email address"
                    className={`transition-all duration-200 rounded-xl border-2 ${
                      !isEditing
                        ? "bg-gray-50/80 border-gray-200 text-gray-600"
                        : "bg-white border-green-200 focus:border-green-400 focus:ring-green-400/20 shadow-sm hover:shadow-md"
                    }`}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSave}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-800 font-semibold py-3 rounded-xl shadow-sm hover:shadow-md transform hover:scale-[1.02] transition-all duration-200"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}

              {/* Logout Button */}
              {onLogout && (
                <div className="pt-6 border-t border-gradient-to-r from-transparent via-gray-200 to-transparent">
                  <Button
                    onClick={() => {
                      import("../utils/iosAuthFix").then(
                        ({ clearIosAuthState }) => {
                          clearIosAuthState();
                        },
                      );
                      onLogout();
                      onClose();
                    }}
                    variant="outline"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-2 border-red-200 hover:border-red-300 font-semibold py-3 rounded-xl shadow-sm hover:shadow-md transform hover:scale-[1.02] transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log Out
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-3 max-h-[calc(90vh-180px)]">
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
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Address Management Modal */}
      <SavedAddressesModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        currentUser={currentUser}
      />
    </Dialog>
  );
};

export default ProfileSettingsModal;
