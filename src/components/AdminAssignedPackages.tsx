import React, { useState, useEffect, useRef } from "react";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Search, RefreshCw, AlertCircle, Plus, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { adminApi, packageApi, apiClient } from "@/lib/api";
import { toast } from "sonner";

interface UserPackageType {
  _id: string;
  user_id: {
    _id: string;
    name: string;
    email: string;
    phone: string;
  };
  package_id: {
    _id: string;
    name: string;
    validity_days: number;
  };
  amount_credited: number;
  validity_start: string;
  validity_end: string;
  created_at: string;
}

interface PackageType {
  _id: string;
  name: string;
  price: number;
  validity_days: number;
  wallet_amount: number;
}

const AdminAssignedPackages: React.FC = () => {
  const [assignedPackages, setAssignedPackages] = useState<UserPackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Assign Package Dialog State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [activePackages, setActivePackages] = useState<PackageType[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAssignedPackages = async () => {
    try {
      setLoading(true);
      const response: any = await adminApi.getAllUserPackages();
      if (response.data?.success) {
        setAssignedPackages(response.data.packages || []);
      } else {
        toast.error("Failed to load assigned packages");
      }
    } catch (error) {
      console.error("Error fetching assigned packages:", error);
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  const fetchActivePackages = async () => {
    try {
      const response: any = await packageApi.getPackages();
      if (response.data?.success) {
        setActivePackages(response.data.packages || []);
      }
    } catch (error) {
      console.error("Error fetching active packages:", error);
    }
  };

  useEffect(() => {
    fetchAssignedPackages();
    fetchActivePackages();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssignedPackages();
    setRefreshing(false);
    toast.success("List refreshed");
  };

  // Search users with debounce
  useEffect(() => {
    if (!userSearchTerm || userSearchTerm.length < 2) {
      setUserSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearchingUsers(true);
        // Use apiClient temporarily to bypass type limitations in adminApi
        const response: any = await apiClient['request'](`/admin/users/search?q=${encodeURIComponent(userSearchTerm)}`);
        if (response.data && response.data.users) {
          setUserSearchResults(response.data.users);
        }
      } catch (error) {
        console.error("Failed to search users", error);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [userSearchTerm]);

  const handleAssignPackage = async () => {
    if (!selectedUser) {
      toast.error("Please select a user");
      return;
    }
    if (!selectedPackageId) {
      toast.error("Please select a package");
      return;
    }

    try {
      setIsAssigning(true);
      const response: any = await adminApi.assignPackage(selectedUser._id, selectedPackageId);
      
      if (response.data?.success) {
        toast.success("Package assigned successfully");
        setIsAssignOpen(false);
        resetAssignForm();
        fetchAssignedPackages();
      } else {
        toast.error(response.data?.error || "Failed to assign package");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "An error occurred");
    } finally {
      setIsAssigning(false);
    }
  };

  const resetAssignForm = () => {
    setSelectedUser(null);
    setUserSearchTerm("");
    setUserSearchResults([]);
    setSelectedPackageId("");
  };

  const filteredPackages = assignedPackages.filter((pkg) => {
    if (!pkg.user_id) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      (pkg.user_id.name || "").toLowerCase().includes(searchLower) ||
      (pkg.user_id.email || "").toLowerCase().includes(searchLower) ||
      (pkg.user_id.phone || "").includes(searchLower) ||
      (pkg.package_id?.name || "").toLowerCase().includes(searchLower)
    );
  });

  const isExpired = (endDateString: string) => {
    return new Date(endDateString) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Assigned Packages</h2>
          <p className="text-gray-600 mt-1">
            View all packages currently or previously assigned to users.
          </p>
        </div>

        <Dialog open={isAssignOpen} onOpenChange={(open) => {
          setIsAssignOpen(open);
          if (!open) resetAssignForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Assign Package
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Assign Package to User</DialogTitle>
              <DialogDescription>
                Manually assign a package to a user's account. This simulates a package purchase.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Find User</Label>
                {selectedUser ? (
                  <div className="flex items-center justify-between p-3 border rounded-md bg-blue-50 border-blue-200">
                    <div className="flex items-center">
                      <UserIcon className="h-4 w-4 mr-2 text-blue-600" />
                      <div>
                        <div className="font-medium text-sm text-blue-900">{selectedUser.name || selectedUser.full_name}</div>
                        <div className="text-xs text-blue-700">{selectedUser.phone}</div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-blue-700 hover:bg-blue-100"
                      onClick={() => setSelectedUser(null)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, phone or email..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="pl-9"
                      autoComplete="off"
                    />
                    {isSearchingUsers && (
                      <div className="absolute right-3 top-3">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    
                    {userSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                        {userSearchResults.map((u, i) => (
                          <div 
                            key={i} 
                            className="p-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-0"
                            onClick={() => {
                              setSelectedUser(u);
                              setUserSearchResults([]);
                              setUserSearchTerm("");
                            }}
                          >
                            <div className="font-medium">{u.name || u.full_name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">{u.phone} {u.email ? `• ${u.email}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {userSearchTerm.length >= 2 && userSearchResults.length === 0 && !isSearchingUsers && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3 text-center text-sm text-gray-500">
                        No users found
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="package-select">Select Package</Label>
                <select
                  id="package-select"
                  className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  disabled={activePackages.length === 0}
                >
                  <option value="" disabled>-- Choose a package --</option>
                  {activePackages.map((pkg) => (
                    <option key={pkg._id} value={pkg._id}>
                      {pkg.name} (Valid {pkg.validity_days} days) - ₹{pkg.price}
                    </option>
                  ))}
                </select>
                {activePackages.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">No active packages found. Please create one first.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAssignOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssignPackage} 
                disabled={!selectedUser || !selectedPackageId || isAssigning}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isAssigning ? "Assigning..." : "Assign Package"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by user name, phone, or package..."
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredPackages.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Packages Assigned</h3>
            <p className="text-gray-500 mt-1">No users have been assigned any packages yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-100">
                <TableRow className="border-gray-200">
                  <TableHead className="font-bold">User</TableHead>
                  <TableHead className="font-bold">Package Name</TableHead>
                  <TableHead className="font-bold">Amount Credited</TableHead>
                  <TableHead className="font-bold">Assignment Date</TableHead>
                  <TableHead className="font-bold">Expiry Date</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => {
                  const expired = isExpired(pkg.validity_end);
                  return (
                    <TableRow key={pkg._id} className="border-gray-200 hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium text-gray-900">{pkg.user_id?.name || 'Unknown User'}</div>
                        <div className="text-sm text-gray-500">{pkg.user_id?.phone || pkg.user_id?.email}</div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {pkg.package_id?.name || 'Deleted Package'}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        ₹{pkg.amount_credited}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(pkg.created_at || pkg.validity_start).toLocaleDateString('en-IN', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(pkg.validity_end).toLocaleDateString('en-IN', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={expired ? "destructive" : "default"}
                          className={expired ? "" : "bg-green-500 hover:bg-green-600"}
                        >
                          {expired ? "Expired" : "Active"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminAssignedPackages;

