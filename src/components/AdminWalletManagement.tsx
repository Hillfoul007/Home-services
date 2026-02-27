import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { walletService, type UserWallet } from "@/services/walletService";
import { Search, Plus, Minus, Mail } from "lucide-react";

const AdminWalletManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [operationMode, setOperationMode] = useState<"add" | "deduct">("add");
  
  // Single user state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserWallet[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWallet | null>(null);
  const [singleAmount, setSingleAmount] = useState("");
  const [singleDescription, setSingleDescription] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSingle, setLoadingSingle] = useState(false);

  // Bulk state
  const [bulkUserIds, setBulkUserIds] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkDescription, setBulkDescription] = useState("");
  const [loadingBulk, setLoadingBulk] = useState(false);
  const [bulkMode, setBulkMode] = useState<"specific" | "all">("specific");

  // Search users
  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      toast.error("Please enter at least 2 characters");
      return;
    }

    setLoadingSearch(true);
    try {
      const result = await walletService.searchUsers(searchQuery);
      if (result.success) {
        setSearchResults(result.users || []);
        if (result.users && result.users.length === 0) {
          toast.info("No users found");
        }
      } else {
        toast.error(result.error || "Failed to search users");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to search users");
    } finally {
      setLoadingSearch(false);
    }
  };

  // Add cashback to single user
  const handleAddSingleCashback = async () => {
    if (!selectedUser || !singleAmount) {
      toast.error("Please select a user and enter amount");
      return;
    }

    const amount = parseFloat(singleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoadingSingle(true);
    try {
      const result = await walletService.adminAddCashback(
        selectedUser._id,
        amount,
        singleDescription || `Added wallet cashback of ₹${amount}`
      );

      if (result.success) {
        toast.success(`Cashback added! New balance: ₹${result.wallet_balance}`);
        setSingleAmount("");
        setSingleDescription("");
        setSelectedUser(null);
        setSearchResults([]);
        setSearchQuery("");
      } else {
        toast.error(result.error || "Failed to add cashback");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to add cashback");
    } finally {
      setLoadingSingle(false);
    }
  };

  // Deduct amount from single user
  const handleDeductSingleAmount = async () => {
    if (!selectedUser || !singleAmount) {
      toast.error("Please select a user and enter amount");
      return;
    }

    const amount = parseFloat(singleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if ((selectedUser.wallet_balance || 0) < amount) {
      toast.error(`Insufficient balance. Current balance: ₹${selectedUser.wallet_balance || 0}`);
      return;
    }

    setLoadingSingle(true);
    try {
      const result = await walletService.adminDeductAmount(
        selectedUser._id,
        amount,
        singleDescription || `Deducted wallet amount of ₹${amount}`
      );

      if (result.success) {
        toast.success(`Amount deducted! New balance: ₹${result.wallet_balance}`);
        setSingleAmount("");
        setSingleDescription("");
        setSelectedUser(null);
        setSearchResults([]);
        setSearchQuery("");
      } else {
        toast.error(result.error || "Failed to deduct amount");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to deduct amount");
    } finally {
      setLoadingSingle(false);
    }
  };

  // Add cashback to multiple users
  const handleAddBulkCashback = async () => {
    const amount = parseFloat(bulkAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (bulkMode === "specific") {
      if (!bulkUserIds.trim()) {
        toast.error("Please enter user IDs");
        return;
      }

      const userIds = bulkUserIds
        .split(",")
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (userIds.length === 0) {
        toast.error("Please enter at least one user ID");
        return;
      }

      setLoadingBulk(true);
      try {
        const result = await walletService.adminBulkAddCashback(
          userIds,
          amount,
          bulkDescription || `Bulk wallet cashback of ₹${amount}`
        );

        if (result.success) {
          toast.success(
            `Successfully added cashback to ${result.results.success} users`
          );
          if (result.results.failed > 0) {
            toast.warning(`Failed for ${result.results.failed} users`);
          }
          setBulkUserIds("");
          setBulkAmount("");
          setBulkDescription("");
        } else {
          toast.error(result.error || "Failed to add bulk cashback");
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to add bulk cashback");
      } finally {
        setLoadingBulk(false);
      }
    } else {
      setLoadingBulk(true);
      try {
        const result = await walletService.adminBulkAddCashbackToAllUsers(
          amount,
          bulkDescription || `Bulk wallet cashback of ₹${amount}`
        );

        if (result.success) {
          toast.success(
            `Successfully added cashback to ${result.results.success} users`
          );
          if (result.results.failed > 0) {
            toast.warning(`Failed for ${result.results.failed} users`);
          }
          setBulkAmount("");
          setBulkDescription("");
        } else {
          toast.error(result.error || "Failed to add bulk cashback");
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to add bulk cashback");
      } finally {
        setLoadingBulk(false);
      }
    }
  };

  // Deduct amount from multiple users
  const handleDeductBulkAmount = async () => {
    const amount = parseFloat(bulkAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (bulkMode === "specific") {
      if (!bulkUserIds.trim()) {
        toast.error("Please enter user IDs");
        return;
      }

      const userIds = bulkUserIds
        .split(",")
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (userIds.length === 0) {
        toast.error("Please enter at least one user ID");
        return;
      }

      setLoadingBulk(true);
      try {
        const result = await walletService.adminBulkDeductAmount(
          userIds,
          amount,
          bulkDescription || `Bulk deducted amount of ₹${amount}`
        );

        if (result.success) {
          toast.success(
            `Successfully deducted amount from ${result.results.success} users`
          );
          if (result.results.failed > 0) {
            toast.warning(`Failed for ${result.results.failed} users (insufficient balance or other errors)`);
          }
          setBulkUserIds("");
          setBulkAmount("");
          setBulkDescription("");
        } else {
          toast.error(result.error || "Failed to deduct bulk amount");
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to deduct bulk amount");
      } finally {
        setLoadingBulk(false);
      }
    } else {
      setLoadingBulk(true);
      try {
        const result = await walletService.adminBulkDeductFromAllUsers(
          amount,
          bulkDescription || `Bulk deducted amount of ₹${amount}`
        );

        if (result.success) {
          toast.success(
            `Successfully deducted amount from ${result.results.success} users`
          );
          if (result.results.failed > 0) {
            toast.warning(`Failed for ${result.results.failed} users (insufficient balance or other errors)`);
          }
          setBulkAmount("");
          setBulkDescription("");
        } else {
          toast.error(result.error || "Failed to deduct bulk amount");
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to deduct bulk amount");
      } finally {
        setLoadingBulk(false);
      }
    }
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            💰 Wallet Management
          </h1>
          <p className="text-gray-600">
            Add or deduct wallet amounts for users
          </p>
        </div>

        {/* Operation Mode Toggle */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setOperationMode("add")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              operationMode === "add"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <Plus className="inline mr-2 h-4 w-4" />
            Add Amount
          </button>
          <button
            onClick={() => setOperationMode("deduct")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              operationMode === "deduct"
                ? "bg-red-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <Minus className="inline mr-2 h-4 w-4" />
            Deduct Amount
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("single")}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === "single"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Mail className="inline mr-2 h-4 w-4" />
            Single User
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === "bulk"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Mail className="inline mr-2 h-4 w-4" />
            Bulk Operation
          </button>
        </div>

        {/* Single User Tab */}
        {activeTab === "single" && (
          <Card className="p-6">
            <div className="space-y-6">
              {/* Search Users */}
              <div>
                <Label className="text-lg font-semibold mb-4 block">
                  Search User
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name, phone, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={loadingSearch}
                    className="flex items-center gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {loadingSearch ? "Searching..." : "Search"}
                  </Button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div>
                  <Label className="text-lg font-semibold mb-3 block">
                    Select User
                  </Label>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div
                        key={user._id}
                        onClick={() => setSelectedUser(user)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedUser?._id === user._id
                            ? "bg-blue-50 border-blue-300 shadow-md"
                            : "bg-white border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {user.name || user.full_name}
                            </div>
                            <div className="text-sm text-gray-600">
                              📱 {user.phone}
                            </div>
                            <div className="text-sm text-gray-600">
                              📧 {user.email || "N/A"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">
                              Current Balance
                            </div>
                            <div className="text-xl font-bold text-green-600">
                              ₹{(user.wallet_balance || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount and Description */}
              {selectedUser && (
                <div className={`p-4 rounded-lg border ${
                  operationMode === "add"
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="mb-4">
                    <p className={`text-sm font-semibold ${
                      operationMode === "add"
                        ? "text-green-900"
                        : "text-red-900"
                    }`}>
                      Selected User: {selectedUser.name || selectedUser.full_name}
                    </p>
                    <p className={`text-sm ${
                      operationMode === "add"
                        ? "text-green-700"
                        : "text-red-700"
                    }`}>
                      Current Wallet: ₹{(selectedUser.wallet_balance || 0).toFixed(2)}
                    </p>
                  </div>

                  {operationMode === "deduct" && (
                    <div className="bg-red-100 p-3 rounded mb-4 border border-red-300">
                      <p className="text-sm text-red-900 font-semibold">
                        ⚠️ Warning: You are about to deduct amount from this user's wallet.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <Label>Amount to {operationMode === "add" ? "Add" : "Deduct"} (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Enter amount"
                        value={singleAmount}
                        onChange={(e) => setSingleAmount(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Description (Optional)</Label>
                      <Input
                        placeholder={operationMode === "add"
                          ? "e.g., Welcome bonus, referral reward"
                          : "e.g., Adjustment, refund, penalty"}
                        value={singleDescription}
                        onChange={(e) => setSingleDescription(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={operationMode === "add" ? handleAddSingleCashback : handleDeductSingleAmount}
                      disabled={loadingSingle}
                      className={operationMode === "add" ? "w-full bg-green-600 hover:bg-green-700" : "w-full bg-red-600 hover:bg-red-700"}
                    >
                      {operationMode === "add" ? (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          {loadingSingle ? "Adding..." : "Add Amount"}
                        </>
                      ) : (
                        <>
                          <Minus className="h-4 w-4 mr-2" />
                          {loadingSingle ? "Deducting..." : "Deduct Amount"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Bulk Operation Tab */}
        {activeTab === "bulk" && (
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-semibold mb-4 block">
                  Bulk {operationMode === "add" ? "Add" : "Deduct"} Mode
                </Label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setBulkMode("specific")}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      bulkMode === "specific"
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-semibold"
                        : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                    }`}
                  >
                    Specific Users
                  </button>
                  <button
                    onClick={() => setBulkMode("all")}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      bulkMode === "all"
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-semibold"
                        : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                    }`}
                  >
                    All Users
                  </button>
                </div>
              </div>

              {bulkMode === "specific" && (
                <div>
                  <Label className="text-lg font-semibold mb-2 block">
                    User IDs (comma-separated)
                  </Label>
                  <textarea
                    placeholder="e.g., user_id_1, user_id_2, user_id_3"
                    value={bulkUserIds}
                    onChange={(e) => setBulkUserIds(e.target.value)}
                    className="w-full p-3 border rounded-lg font-mono text-sm min-h-32"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Enter MongoDB ObjectIDs separated by commas
                  </p>
                </div>
              )}

              {bulkMode === "all" && (
                <div className={`p-4 rounded-lg border ${
                  operationMode === "add"
                    ? "bg-amber-50 border-amber-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <p className={`text-sm font-semibold ${
                    operationMode === "add"
                      ? "text-amber-900"
                      : "text-red-900"
                  }`}>
                    <strong>⚠️ Warning:</strong> This will {operationMode === "add" ? "add cashback to" : "deduct amount from"} <strong>ALL users</strong> in the system. Please ensure this is what you intend.
                  </p>
                </div>
              )}

              <div>
                <Label>Amount to {operationMode === "add" ? "Add to" : "Deduct from"} Each User (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                />
              </div>

              <div>
                <Label>Description (Optional)</Label>
                <Input
                  placeholder={operationMode === "add"
                    ? "e.g., Diwali promo cashback"
                    : "e.g., Adjustment, refund, penalty"}
                  value={bulkDescription}
                  onChange={(e) => setBulkDescription(e.target.value)}
                />
              </div>

              <Button
                onClick={operationMode === "add" ? handleAddBulkCashback : handleDeductBulkAmount}
                disabled={loadingBulk}
                className={operationMode === "add" ? "w-full bg-green-600 hover:bg-green-700" : "w-full bg-red-600 hover:bg-red-700"}
              >
                {operationMode === "add" ? (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {loadingBulk ? "Adding..." : `Add Cashback ${bulkMode === "all" ? "to All Users" : "to Selected Users"}`}
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 mr-2" />
                    {loadingBulk ? "Deducting..." : `Deduct Amount ${bulkMode === "all" ? "from All Users" : "from Selected Users"}`}
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminWalletManagement;
