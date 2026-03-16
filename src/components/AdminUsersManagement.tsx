import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Trash2,
  AlertCircle,
  RefreshCw,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { adminApi } from "@/lib/api";

interface User {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

const AdminUsersManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Package assignment state
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [assigningUser, setAssigningUser] = useState<User | null>(null);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<any>("/users");

      if (response.error) {
        throw new Error(response.error);
      }

      const usersData = response.data?.data || response.data || [];

      if (Array.isArray(usersData)) {
        setUsers(usersData);
      } else {
        console.warn("Invalid users response format:", response.data);
        setUsers([]);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
    toast.success("Users refreshed");
  };

  const loadPackages = async () => {
    try {
      const response: any = await adminApi.getPackages();
      if (response.data?.success) {
         // Only show active packages
        setAvailablePackages(response.data.packages.filter((p: any) => p.is_active));
      }
    } catch (error) {
      console.error("Failed to load packages for assignment:", error);
    }
  };

  const handleOpenPackageDialog = (user: User) => {
    setAssigningUser(user);
    setSelectedPackageId("");
    setShowPackageDialog(true);
    if (availablePackages.length === 0) {
      loadPackages();
    }
  };

  const handleAssignPackage = async () => {
    if (!assigningUser || !selectedPackageId) return;

    try {
      setIsAssigning(true);
      const response: any = await adminApi.assignPackage(assigningUser._id, selectedPackageId);
      
      if (response.data?.success) {
        toast.success(`Package assigned to ${assigningUser.name || 'user'}`);
        setShowPackageDialog(false);
        setAssigningUser(null);
      } else {
        toast.error(response.data?.error || "Failed to assign package");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error assigning package");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenDeleteDialog = (user: User) => {
    setDeletingUser(user);
    setShowDeleteDialog(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      const response = await apiClient.adminRequest<any>(
        `/users/${deletingUser._id}`,
        {
          method: "DELETE",
        }
      );

      if (response.data?.success) {
        toast.success("User deleted successfully");
        loadUsers();
        setShowDeleteDialog(false);
        setDeletingUser(null);
      } else {
        toast.error(response.data?.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchSearch =
      (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (user.phone?.includes(searchQuery) || false);

    return matchSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Users Management</h2>
        <p className="text-gray-600 mt-1">
          View and manage customer accounts
        </p>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-2 border-gray-200"
                />
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="border-2 border-gray-200"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No users found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-100">
                <TableRow className="border-gray-200">
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="font-bold">Phone</TableHead>
                  <TableHead className="font-bold">Created</TableHead>
                  <TableHead className="font-bold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow
                    key={user._id}
                    className="border-gray-200 hover:bg-gray-50"
                  >
                    <TableCell className="font-medium">
                      {user.name || "N/A"}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {user.email || "N/A"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {user.phone || "N/A"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-IN")
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPackageDialog(user)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Package className="h-4 w-4 mr-1" />
                        Package
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDeleteDialog(user)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user account? This action cannot be undone and all associated bookings will also be deleted.
            </DialogDescription>
          </DialogHeader>

          {deletingUser && (
            <div className="space-y-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-700">User Details:</p>
                <p className="text-sm text-gray-600">Name: {deletingUser.name || "N/A"}</p>
                <p className="text-sm text-gray-600">Email: {deletingUser.email || "N/A"}</p>
                <p className="text-sm text-gray-600">Phone: {deletingUser.phone || "N/A"}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Package Assignment Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Subscription Package</DialogTitle>
            <DialogDescription>
              Select a package to assign to {assigningUser?.name || "this user"}. This will credit their package balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Package</label>
              <select
                className="w-full border-gray-300 rounded-md shadow-sm p-2 text-sm border focus:ring-blue-500 focus:border-blue-500"
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
              >
                <option value="" disabled>-- Choose a package --</option>
                {availablePackages.map((pkg) => (
                  <option key={pkg._id} value={pkg._id}>
                    {pkg.name} (₹{pkg.price} for ₹{pkg.wallet_amount} credit)
                  </option>
                ))}
              </select>
            </div>
            {selectedPackageId && (
              <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm">
                The user will receive wallet credits that expire based on the package validity rules.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignPackage}
              disabled={!selectedPackageId || isAssigning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isAssigning ? "Assigning..." : "Assign Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersManagement;
