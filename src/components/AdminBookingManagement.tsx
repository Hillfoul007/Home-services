import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  Edit3,
  Trash2,
  Eye,
  RefreshCw,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Package,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface Booking {
  _id: string;
  custom_order_id: string;
  name: string;
  phone: string;
  customer_id: any;
  service: string;
  services: string[];
  scheduled_date: string;
  scheduled_time: string;
  delivery_date: string;
  delivery_time: string;
  address: string;
  status: string; // support extended statuses
  total_price: number;
  final_amount: number;
  created_at: string;
  updated_at: string;
  payment_status?: string;
  item_prices?: any[];
  rider?: string | null;
  vendor?: string | null;
}

const AdminBookingManagement: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);

  // Simple rider/vendor lists (admin can select by name)
  const riderList = Array.from({ length: 10 }).map((_, i) => `Rider ${i + 1}`);
  const vendorList = Array.from({ length: 10 }).map((_, i) => `Vendor ${i + 1}`);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [bookings, searchTerm, statusFilter]);

  const fetchBookings = async () => {
    try {
      setLoading(true);

      // Try admin endpoint first, fallback to regular bookings
      const response = await apiClient.adminRequest<{bookings: Booking[]}>("/admin/bookings?limit=100");

      if (response.data) {
        // Process bookings to handle populated customer data
        const processedBookings = (response.data.bookings || []).map((booking: any) => {
          // Handle populated customer_id object vs direct fields
          const customer = booking.customer_id || {};
          const customerName = booking.customerName ||
                              booking.name ||
                              customer.full_name ||
                              customer.name ||
                              'Unknown Customer';
          const customerPhone = booking.customerPhone ||
                               booking.phone ||
                               customer.phone ||
                               'No phone';

          return {
            ...booking,
            // Customer information from populated data
            name: customerName, // Ensure name is available
            phone: customerPhone, // Ensure phone is available
          };
        });

        setBookings(processedBookings);
      } else if (response.error) {
        // Fallback to regular bookings endpoint
        console.log("Admin endpoint failed, trying regular bookings...");
        const fallbackResponse = await apiClient.request<{bookings: Booking[]}>("/bookings?limit=100");

        if (fallbackResponse.data) {
          // Process fallback bookings as well
          const processedFallbackBookings = (fallbackResponse.data.bookings || []).map((booking: any) => {
            const customer = booking.customer_id || {};
            const customerName = booking.customerName ||
                                booking.name ||
                                customer.full_name ||
                                customer.name ||
                                'Unknown Customer';
            const customerPhone = booking.customerPhone ||
                                 booking.phone ||
                                 customer.phone ||
                                 'No phone';

            return {
              ...booking,
              name: customerName,
              phone: customerPhone,
            };
          });

          setBookings(processedFallbackBookings);
          toast.info("Using regular bookings API (admin endpoint not available)");
        } else {
          toast.error(response.error);
        }
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Error fetching bookings");
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = bookings;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (booking) =>
          booking.custom_order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.phone?.includes(searchTerm) ||
          booking.service?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((booking) => booking.status === statusFilter);
    }

    setFilteredBookings(filtered);
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const response = await apiClient.updateBookingStatus(bookingId, newStatus);

      if (response.data) {
        toast.success(`Booking status updated to ${newStatus}`);
        fetchBookings();
      } else {
        toast.error(response.error || "Failed to update booking status");
      }
    } catch (error) {
      console.error("Error updating booking status:", error);
      toast.error("Error updating booking status");
    }
  };

  const saveEditedBooking = async () => {
    if (!editingBooking) return;

    try {
      // Prepare payload; include rider/vendor and item_prices if present
      const payload: any = {
        status: editingBooking.status,
        final_amount: editingBooking.final_amount,
        scheduled_date: editingBooking.scheduled_date,
        scheduled_time: editingBooking.scheduled_time,
        address: editingBooking.address,
        rider: editingBooking.rider,
        vendor: editingBooking.vendor,
      };

      if (editingBooking.item_prices) payload.item_prices = editingBooking.item_prices;

      const response = await apiClient.adminRequest<{booking: Booking}>(`/admin/bookings/${editingBooking._id}`, {
        method: "PUT",
        body: payload,
      });

      if (response.data) {
        toast.success("Booking updated successfully");
        setShowEditDialog(false);
        setEditingBooking(null);
        fetchBookings();
      } else {
        toast.error(response.error || "Failed to update booking");
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      toast.error("Error updating booking");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "created":
        return "bg-yellow-100 text-yellow-800";
      case "pickup_assigned":
        return "bg-orange-100 text-orange-800";
      case "pickup_completed":
        return "bg-purple-100 text-purple-800";
      case "delivered_to_vendor":
        return "bg-indigo-100 text-indigo-800";
      case "ready_for_delivery":
        return "bg-sky-100 text-sky-800";
      case "delivery_assigned":
        return "bg-amber-100 text-amber-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "created":
        return <AlertCircle className="h-4 w-4" />;
      case "pickup_assigned":
        return <MapPin className="h-4 w-4" />;
      case "pickup_completed":
        return <CheckCircle className="h-4 w-4" />;
      case "delivered_to_vendor":
        return <Package className="h-4 w-4" />;
      case "ready_for_delivery":
        return <Clock className="h-4 w-4" />;
      case "delivery_assigned":
        return <MapPin className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading bookings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Booking Management</h2>
          <p className="text-gray-600">
            Manage and edit customer bookings ({filteredBookings.length} total)
          </p>
        </div>
        <Button onClick={fetchBookings} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Bookings</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by order ID, name, phone, or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="md:w-48">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="pickup_assigned">Pickup Assigned</SelectItem>
                  <SelectItem value="pickup_completed">Pick up Completed</SelectItem>
                  <SelectItem value="delivered_to_vendor">Delivered to Vendor</SelectItem>
                  <SelectItem value="ready_for_delivery">Ready for Delivery</SelectItem>
                  <SelectItem value="delivery_assigned">Delivery Assigned</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.map((booking) => (
          <Card key={booking._id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Order Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">#{booking.custom_order_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{booking.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{booking.phone}</span>
                  </div>
                </div>

                {/* Service & Schedule */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">
                    {booking.service}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    {formatDate(booking.scheduled_date)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    {booking.scheduled_time}
                  </div>
                </div>

                {/* Status & Amount */}
                <div className="space-y-2">
                  <Badge className={getStatusColor(booking.status)}>
                    {getStatusIcon(booking.status)}
                    <span className="ml-1 capitalize">{booking.status.replace("_", " ")}</span>
                  </Badge>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-medium">₹{booking.final_amount}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(booking.created_at)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setViewingBooking(booking);
                        setShowViewDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingBooking({ ...booking });
                        setShowEditDialog(true);
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Quick Status Updates */}
                  <div className="flex gap-1">
                    {booking.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => updateBookingStatus(booking._id, "confirmed")}
                      >
                        Confirm
                      </Button>
                    )}
                    {booking.status === "confirmed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => updateBookingStatus(booking._id, "in_progress")}
                      >
                        Start
                      </Button>
                    )}
                    {booking.status === "in_progress" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => updateBookingStatus(booking._id, "completed")}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredBookings.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search criteria"
                  : "No bookings available"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Booking Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {viewingBooking && (
            <div className="space-y-6">
              {/* Basic Order Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order ID</Label>
                  <p className="font-medium">#{viewingBooking.custom_order_id}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={getStatusColor(viewingBooking.status)}>
                    {viewingBooking.status.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <Label>Customer Name</Label>
                  <p className="font-medium">{viewingBooking.name}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${viewingBooking.phone}`} className="text-blue-600 hover:underline">
                      {viewingBooking.phone}
                    </a>
                  </div>
                </div>
                <div>
                  <Label>Customer ID</Label>
                  <p className="text-sm text-gray-600">
                    {typeof viewingBooking.customer_id === 'object' && viewingBooking.customer_id?._id
                      ? viewingBooking.customer_id._id
                      : viewingBooking.customer_id}
                  </p>
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Badge variant={viewingBooking.payment_status === 'paid' ? 'default' : 'secondary'}>
                    {viewingBooking.payment_status || 'pending'}
                  </Badge>
                </div>

                <div>
                  <Label>Assigned Rider</Label>
                  <p className="text-sm">{viewingBooking.rider || 'Not assigned'}</p>
                </div>
                <div>
                  <Label>Assigned Vendor</Label>
                  <p className="text-sm">{viewingBooking.vendor || 'Not assigned'}</p>
                </div>
              </div>

              {/* Scheduling Information */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Pickup Date</Label>
                    <p className="font-medium">{formatDate(viewingBooking.scheduled_date)}</p>
                  </div>
                  <div>
                    <Label>Pickup Time</Label>
                    <p className="font-medium">{viewingBooking.scheduled_time}</p>
                  </div>
                  {viewingBooking.delivery_date && (
                    <div>
                      <Label>Delivery Date</Label>
                      <p>{formatDate(viewingBooking.delivery_date)}</p>
                    </div>
                  )}
                  {viewingBooking.delivery_time && (
                    <div>
                      <Label>Delivery Time</Label>
                      <p>{viewingBooking.delivery_time}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Address Information */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  Address Details
                </h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-900">{viewingBooking.address}</p>
                  {viewingBooking.address_details && (
                    <div className="mt-2 text-sm text-gray-600">
                      {viewingBooking.address_details.flatNo && <span>Flat: {viewingBooking.address_details.flatNo} • </span>}
                      {viewingBooking.address_details.landmark && <span>Landmark: {viewingBooking.address_details.landmark} • </span>}
                      {viewingBooking.address_details.type && <span>Type: {viewingBooking.address_details.type}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Services Information */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Service Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label>Primary Service</Label>
                    <p className="font-medium">{viewingBooking.service}</p>
                    {viewingBooking.service_type && (
                      <p className="text-sm text-gray-600">Type: {viewingBooking.service_type}</p>
                    )}
                  </div>

                  {viewingBooking.services && viewingBooking.services.length > 0 && (
                    <div>
                      <Label>Additional Services</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {viewingBooking.services.map((service, index) => (
                          <Badge key={index} variant="outline">
                            {typeof service === "string" ? service : service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detailed Service Breakdown */}
                  {viewingBooking.item_prices && viewingBooking.item_prices.length > 0 && (
                    <div>
                      <Label>Service Breakdown</Label>
                      <div className="mt-2 space-y-2">
                        {viewingBooking.item_prices.map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium">{item.service_name}</p>
                              <p className="text-sm text-gray-600">Qty: {item.quantity} × ₹{item.unit_price}</p>
                            </div>
                            <p className="font-semibold">₹{item.total_price}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Information */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Pricing Details
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Total Price:</span>
                    <span className="font-medium">₹{viewingBooking.total_price}</span>
                  </div>
                  {viewingBooking.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>-₹{viewingBooking.discount_amount}</span>
                    </div>
                  )}
                  {viewingBooking.coupon_code && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Coupon Applied:</span>
                      <span>{viewingBooking.coupon_code}</span>
                    </div>
                  )}

                  {/* Charges Breakdown */}
                  {viewingBooking.charges_breakdown && (
                    <div className="border-t pt-2 mt-2">
                      {viewingBooking.charges_breakdown.base_price > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Base Price:</span>
                          <span>₹{viewingBooking.charges_breakdown.base_price}</span>
                        </div>
                      )}
                      {viewingBooking.charges_breakdown.tax_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Tax:</span>
                          <span>₹{viewingBooking.charges_breakdown.tax_amount}</span>
                        </div>
                      )}
                      {viewingBooking.charges_breakdown.service_fee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Service Fee:</span>
                          <span>₹{viewingBooking.charges_breakdown.service_fee}</span>
                        </div>
                      )}
                      {viewingBooking.charges_breakdown.delivery_fee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Delivery Fee:</span>
                          <span>₹{viewingBooking.charges_breakdown.delivery_fee}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Final Amount:</span>
                    <span>₹{viewingBooking.final_amount}</span>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              {(viewingBooking.special_instructions || viewingBooking.additional_details) && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Additional Information</h4>
                  {viewingBooking.special_instructions && (
                    <div className="mb-2">
                      <Label>Special Instructions</Label>
                      <p className="text-gray-700">{viewingBooking.special_instructions}</p>
                    </div>
                  )}
                  {viewingBooking.additional_details && (
                    <div>
                      <Label>Additional Details</Label>
                      <p className="text-gray-700">{viewingBooking.additional_details}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Order Timeline</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Created At</Label>
                    <p>{formatDate(viewingBooking.created_at)}</p>
                  </div>
                  <div>
                    <Label>Updated At</Label>
                    <p>{formatDate(viewingBooking.updated_at)}</p>
                  </div>
                  {viewingBooking.completed_at && (
                    <div>
                      <Label>Completed At</Label>
                      <p>{formatDate(viewingBooking.completed_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          {editingBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editingBooking.status}
                    onValueChange={(value) =>
                      setEditingBooking({ ...editingBooking, status: value as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created">Created</SelectItem>
                      <SelectItem value="pickup_assigned">Pickup Assigned</SelectItem>
                      <SelectItem value="pickup_completed">Pick up Completed</SelectItem>
                      <SelectItem value="delivered_to_vendor">Delivered to Vendor</SelectItem>
                      <SelectItem value="ready_for_delivery">Ready for Delivery</SelectItem>
                      <SelectItem value="delivery_assigned">Delivery Assigned</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-amount">Final Amount</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    value={editingBooking.final_amount}
                    onChange={(e) =>
                      setEditingBooking({
                        ...editingBooking,
                        final_amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-date">Scheduled Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editingBooking.scheduled_date}
                    onChange={(e) =>
                      setEditingBooking({ ...editingBooking, scheduled_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-time">Scheduled Time</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={editingBooking.scheduled_time}
                    onChange={(e) =>
                      setEditingBooking({ ...editingBooking, scheduled_time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label>Assign Rider</Label>
                  <Select value={editingBooking.rider || ''} onValueChange={(val) => setEditingBooking({...editingBooking, rider: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {riderList.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assign Vendor</Label>
                  <Select value={editingBooking.vendor || ''} onValueChange={(val) => setEditingBooking({...editingBooking, vendor: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {vendorList.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-address">Address</Label>
                <Textarea
                  id="edit-address"
                  value={editingBooking.address}
                  onChange={(e) =>
                    setEditingBooking({ ...editingBooking, address: e.target.value })
                  }
                  rows={3}
                />
              </div>

              {/* Cart / Item Prices Editor */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Edit Cart / Items</h4>
                <div className="space-y-2">
                  {(editingBooking.item_prices && editingBooking.item_prices.length > 0) ? (
                    (editingBooking.item_prices as any[]).map((item: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                        <Input value={item.service_name || item.name} onChange={(e) => {
                          const updated = { ...editingBooking } as any;
                          updated.item_prices[idx].service_name = e.target.value;
                          setEditingBooking(updated);
                        }} />
                        <Input type="number" value={item.quantity} onChange={(e) => {
                          const q = parseInt(e.target.value) || 0;
                          const updated = { ...editingBooking } as any;
                          updated.item_prices[idx].quantity = q;
                          updated.item_prices[idx].total_price = q * (updated.item_prices[idx].unit_price || updated.item_prices[idx].price || 0);
                          setEditingBooking(updated);
                        }} />
                        <Input type="number" value={item.unit_price || item.price} onChange={(e) => {
                          const p = parseFloat(e.target.value) || 0;
                          const updated = { ...editingBooking } as any;
                          updated.item_prices[idx].unit_price = p;
                          updated.item_prices[idx].total_price = (updated.item_prices[idx].quantity || 0) * p;
                          setEditingBooking(updated);
                        }} />
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No itemized prices available for this order.</div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEditedBooking}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBookingManagement;
