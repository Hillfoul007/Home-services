import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  MapPin,
  Phone,
  Edit,
  RefreshCw,
  Send,
  AlertCircle,
  CheckCircle,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { formatDateOnlyIST } from "@/utils/timeUtils";

interface PGOrder {
  _id: string;
  custom_order_id: string;
  pg_name: string;
  city: string;
  no_of_items: number;
  final_amount: number;
  status: string;
  assignedVendor?: string;
  assignedVendorDetails?: {
    name: string;
    phone: string;
  };
  created_at: string;
  name: string;
  phone: string;
}

interface Vendor {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

const statusOptions = [
  "created",
  "vendor_assigned",
  "pending",
  "confirmed",
  "pickup_assigned",
  "pickup_completed",
  "ready_for_delivery",
  "delivery_assigned",
  "delivered",
  "completed",
  "cancelled",
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "created":
      return "bg-gray-100 text-gray-800";
    case "vendor_assigned":
      return "bg-blue-100 text-blue-800";
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-orange-100 text-orange-800";
  }
};

const AdminPGOrdersManagement: React.FC = () => {
  const [orders, setOrders] = useState<PGOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Dialog states
  const [editingOrder, setEditingOrder] = useState<PGOrder | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [editVendorId, setEditVendorId] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messagingOrder, setMessagingOrder] = useState<PGOrder | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState(false);

  // Vendor assignment dialog states
  const [showVendorAssignDialog, setShowVendorAssignDialog] = useState(false);
  const [vendorAssignOrder, setVendorAssignOrder] = useState<PGOrder | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [assigningVendor, setAssigningVendor] = useState(false);

  useEffect(() => {
    loadOrders();
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const response = await apiClient.adminRequest<any>("/pg-management/vendors/available");

      if (response.error) {
        console.warn("Failed to load vendors:", response.error);
        return;
      }

      const vendorsList = response.data?.data || response.data || [];
      if (Array.isArray(vendorsList)) {
        setVendors(vendorsList);
      }
    } catch (error) {
      console.warn("Error loading vendors:", error);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.adminRequest<any>("/pg-orders");

      if (response.error) {
        throw new Error(response.error);
      }

      // Handle nested data structure: { data: { success: true, data: [...] } }
      const orders = response.data?.data || response.data || [];

      if (!Array.isArray(orders)) {
        console.warn("Invalid response format:", response.data);
        throw new Error("Invalid data format from server");
      }

      setOrders(orders);
      // Extract unique cities
      const uniqueCities = [...new Set(orders.map((o: PGOrder) => o.city))];
      setCities(uniqueCities.sort());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load PG orders";
      console.error("Error loading PG orders:", { error, errorMessage });
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
    toast.success("Orders refreshed");
  };

  const filteredOrders = orders.filter((order) => {
    const matchSearch =
      order.custom_order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.pg_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCity = !selectedCity || order.city === selectedCity;
    const matchStatus = !selectedStatus || order.status === selectedStatus;

    return matchSearch && matchCity && matchStatus;
  });

  const handleOpenEditDialog = (order: PGOrder) => {
    setEditingOrder(order);
    setNewStatus(order.status);
    setEditVendorId(order.assignedVendor || "");
    setShowEditDialog(true);
  };

  const handleUpdateStatus = async () => {
    if (!editingOrder) return;

    setUpdatingOrder(true);
    try {
      // Update status
      if (newStatus !== editingOrder.status) {
        const statusResponse = await apiClient.adminRequest<any>(
          `/pg-orders/${editingOrder._id}/status`,
          {
            method: "PATCH",
            body: { status: newStatus, changed_by: "admin" },
          }
        );

        if (!statusResponse.data) {
          toast.error("Failed to update order status");
          setUpdatingOrder(false);
          return;
        }
      }

      // Update vendor if changed
      if (editVendorId && editVendorId !== (editingOrder.assignedVendor || "")) {
        const selectedVendor = vendors.find(v => v._id === editVendorId);
        if (!selectedVendor) {
          toast.error("Selected vendor not found");
          setUpdatingOrder(false);
          return;
        }

        const vendorResponse = await apiClient.adminRequest<any>(
          `/pg-orders/${editingOrder._id}/assign-vendor`,
          {
            method: "POST",
            body: {
              vendorId: editVendorId,
              vendorName: selectedVendor.name,
              vendorPhone: selectedVendor.phone,
            },
          }
        );

        if (!vendorResponse.data) {
          toast.error("Failed to assign vendor");
          setUpdatingOrder(false);
          return;
        }
      }

      toast.success("Order updated successfully");
      loadOrders();
      setShowEditDialog(false);
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
    } finally {
      setUpdatingOrder(false);
    }
  };

  const handleOpenMessageDialog = (order: PGOrder) => {
    setMessagingOrder(order);
    setWhatsappMessage(
      `Order ${order.custom_order_id} - ${order.pg_name} (${order.no_of_items} items) - ₹${order.final_amount}`
    );
    setShowMessageDialog(true);
  };

  const handleSendMessage = async () => {
    if (!messagingOrder || !messagingOrder.assignedVendorDetails?.phone) {
      toast.error("No vendor phone number available");
      return;
    }

    try {
      // In a real app, this would send a WhatsApp message via API
      console.log(
        `📱 Sending WhatsApp to ${messagingOrder.assignedVendorDetails.phone}: ${whatsappMessage}`
      );
      toast.success("WhatsApp message sent to vendor");
      setShowMessageDialog(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleOpenVendorAssignDialog = (order: PGOrder) => {
    setVendorAssignOrder(order);
    setSelectedVendorId("");
    setShowVendorAssignDialog(true);
  };

  const handleAssignVendor = async () => {
    if (!vendorAssignOrder || !selectedVendorId) {
      toast.error("Please select a vendor");
      return;
    }

    const selectedVendor = vendors.find(v => v._id === selectedVendorId);
    if (!selectedVendor) {
      toast.error("Vendor not found");
      return;
    }

    setAssigningVendor(true);
    try {
      const response = await apiClient.adminRequest<any>(
        `/pg-orders/${vendorAssignOrder._id}/assign-vendor`,
        {
          method: "POST",
          body: {
            vendorId: selectedVendorId,
            vendorName: selectedVendor.name,
            vendorPhone: selectedVendor.phone,
          },
        }
      );

      if (response.data) {
        toast.success(`Order assigned to ${selectedVendor.name} successfully`);
        loadOrders();
        setShowVendorAssignDialog(false);
      } else {
        toast.error(response.error || "Failed to assign vendor");
      }
    } catch (error) {
      console.error("Error assigning vendor:", error);
      toast.error("Failed to assign vendor to order");
    } finally {
      setAssigningVendor(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">PG Orders Management</h2>
        <p className="text-gray-600 mt-1">
          Manage PG orders, update status, and communicate with vendors
        </p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Search Order
              </label>
              <Input
                placeholder="Search by Order ID, PG name, or customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-2 border-laundrify-mint"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                City
              </label>
              <Select value={selectedCity || "all-cities"} onValueChange={(value) => setSelectedCity(value === "all-cities" ? "" : value)}>
                <SelectTrigger className="w-full md:w-48 border-2 border-laundrify-mint">
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-cities">All Cities</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Status
              </label>
              <Select value={selectedStatus || "all-statuses"} onValueChange={(value) => setSelectedStatus(value === "all-statuses" ? "" : value)}>
                <SelectTrigger className="w-full md:w-48 border-2 border-laundrify-mint">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-statuses">All Statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="border-2 border-laundrify-purple text-laundrify-purple hover:bg-laundrify-purple/10"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-0 shadow-md border-l-4 border-l-red-500 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Failed to Load Orders</h3>
                <p className="text-red-800 text-sm mt-1">{error}</p>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  size="sm"
                  className="mt-3 bg-red-600 hover:bg-red-700 text-white"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin">
            <div className="w-8 h-8 border-4 border-laundrify-mint border-t-laundrify-purple rounded-full"></div>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No PG orders found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-laundrify-mint/10">
                <TableRow className="border-laundrify-mint/20">
                  <TableHead className="font-bold">Order ID</TableHead>
                  <TableHead className="font-bold">PG Name</TableHead>
                  <TableHead className="font-bold">Customer</TableHead>
                  <TableHead className="font-bold">Items</TableHead>
                  <TableHead className="font-bold">Amount</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Vendor</TableHead>
                  <TableHead className="font-bold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow
                    key={order._id}
                    className="border-gray-200 hover:bg-gray-50"
                  >
                    <TableCell className="font-mono font-semibold text-laundrify-blue">
                      {order.custom_order_id}
                    </TableCell>
                    <TableCell className="font-medium">{order.pg_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">{order.name}</p>
                        <p className="text-gray-600">{order.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {order.no_of_items}
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      ₹{order.final_amount}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(order.status)} border-0`}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.assignedVendorDetails ? (
                        <div>
                          <p className="font-medium">{order.assignedVendorDetails.name}</p>
                          <p className="text-gray-600">
                            {order.assignedVendorDetails.phone}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditDialog(order)}
                          className="text-laundrify-blue border-laundrify-purple hover:bg-laundrify-purple/10"
                          title="Edit order status"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!order.assignedVendorDetails && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenVendorAssignDialog(order)}
                            className="text-orange-600 border-orange-200 hover:bg-orange-50"
                            title="Assign vendor to order"
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {order.assignedVendorDetails?.phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenMessageDialog(order)}
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            title="Send message to vendor"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Edit Status & Vendor Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>
              Order: {editingOrder?.custom_order_id} | PG: {editingOrder?.pg_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Status
              </label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="border-2 border-laundrify-mint">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Assigned Vendor
              </label>
              {vendors.length > 0 ? (
                <Select value={editVendorId} onValueChange={setEditVendorId}>
                  <SelectTrigger className="border-2 border-laundrify-mint">
                    <SelectValue placeholder="Select vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No vendor (Unassigned)</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor._id} value={vendor._id}>
                        {vendor.name} ({vendor.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-gray-600">No vendors available</p>
              )}
              {editingOrder?.assignedVendorDetails && (
                <p className="text-xs text-gray-600 mt-2">
                  Current: {editingOrder.assignedVendorDetails.name}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={updatingOrder}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={updatingOrder}
              className="bg-laundrify-purple hover:bg-laundrify-purple/90"
            >
              {updatingOrder ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Updating...
                </>
              ) : (
                "Update Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp Message to Vendor</DialogTitle>
            <DialogDescription>
              Order: {messagingOrder?.custom_order_id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Vendor: {messagingOrder?.assignedVendorDetails?.name}
              </label>
              <p className="text-sm text-gray-600">
                {messagingOrder?.assignedVendorDetails?.phone}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Message
              </label>
              <textarea
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                className="w-full h-32 p-3 border-2 border-laundrify-mint rounded-lg focus:outline-none focus:border-laundrify-purple"
                placeholder="Type your message..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMessageDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Assignment Dialog */}
      <Dialog open={showVendorAssignDialog} onOpenChange={setShowVendorAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Vendor to Order</DialogTitle>
            <DialogDescription>
              Order: {vendorAssignOrder?.custom_order_id} | PG: {vendorAssignOrder?.pg_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Select Vendor
              </label>
              {vendors.length > 0 ? (
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger className="border-2 border-laundrify-mint">
                    <SelectValue placeholder="Choose a vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor._id} value={vendor._id}>
                        <div>
                          <span className="font-medium">{vendor.name}</span>
                          <span className="text-gray-600 ml-2">{vendor.phone}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-gray-600">No vendors available</p>
              )}
            </div>

            {selectedVendorId && vendors.find(v => v._id === selectedVendorId) && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-900">
                  <strong>Vendor:</strong> {vendors.find(v => v._id === selectedVendorId)?.name}
                </p>
                <p className="text-sm text-blue-900">
                  <strong>Phone:</strong> {vendors.find(v => v._id === selectedVendorId)?.phone}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVendorAssignDialog(false)}
              disabled={assigningVendor}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignVendor}
              disabled={assigningVendor || !selectedVendorId}
              className="bg-laundrify-purple hover:bg-laundrify-purple/90"
            >
              {assigningVendor ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Vendor
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPGOrdersManagement;
