import React, { useState, useEffect } from "react";
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
import { Package, Search, RefreshCw, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api";
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

const AdminAssignedPackages: React.FC = () => {
  const [assignedPackages, setAssignedPackages] = useState<UserPackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchAssignedPackages();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssignedPackages();
    setRefreshing(false);
    toast.success("List refreshed");
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
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Assigned Packages</h2>
        <p className="text-gray-600 mt-1">
          View all packages currently or previously assigned to users.
        </p>
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
