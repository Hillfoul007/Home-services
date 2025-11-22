import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { vendorService } from "@/services/vendorService";

interface User {
  _id: string;
  name?: string;
  full_name?: string;
  phone: string;
  email?: string;
  user_type: string;
}

interface ServiceItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  category: string;
}

interface VendorWithDistance {
  id: string;
  _id: string;
  name: string;
  address: string;
  phone?: string;
  coordinates: { lat: number; lng: number };
  distance: number;
  estimatedTime?: number;
  isActive?: boolean;
}

const AdminUserBooking: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [bookingData, setBookingData] = useState({
    service: "",
    services: [] as ServiceItem[],
    scheduled_date: "",
    scheduled_time: "",
    delivery_date: "",
    delivery_time: "",
    address: "",
    special_instructions: "",
    is_quick_pickup: false,
    assignedVendor: "",
  });

  // Vendor management state
  const [vendors, setVendors] = useState<VendorWithDistance[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorWithDistance | null>(null);

  // New user inline form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserAddress, setNewUserAddress] = useState("");

  const isValidObjectId = (v: string | undefined | null) => !!v && /^[a-fA-F0-9]{24}$/.test(v);

  // Fetch vendors based on address
  const fetchVendorsForAddress = async (address: string) => {
    if (!address.trim()) {
      setVendors([]);
      setSelectedVendor(null);
      return;
    }

    try {
      setVendorsLoading(true);

      // Fetch all vendors from API
      const response = await apiClient.adminRequest<{ vendors: any[] }>('/admin/vendors');

      if (response.data && Array.isArray(response.data.vendors)) {
        // Convert to VendorWithDistance format
        const vendorsList = response.data.vendors.filter((v: any) => v.is_active !== false);

        // Get vendor recommendations with distance using vendorService
        const vendorsWithDistance = await vendorService.getVendorRecommendations(address);

        // Merge vendor details with distance info
        const enrichedVendors = vendorsList.map((vendor: any) => {
          const withDistance = vendorsWithDistance.find(
            v => v.id === vendor._id || v.id === vendor.id
          );
          return {
            id: vendor._id || vendor.id,
            _id: vendor._id,
            name: vendor.name,
            address: vendor.address,
            phone: vendor.phone || vendor.contactPhone,
            coordinates: vendor.coordinates || { lat: 0, lng: 0 },
            distance: withDistance?.distance || 0,
            estimatedTime: withDistance?.estimatedTime,
            isActive: vendor.is_active !== false,
          };
        }).sort((a, b) => a.distance - b.distance);

        setVendors(enrichedVendors);

        // Auto-select nearest vendor
        if (enrichedVendors.length > 0) {
          setSelectedVendor(enrichedVendors[0]);
          setBookingData(prev => ({ ...prev, assignedVendor: enrichedVendors[0].id }));
        }
      } else {
        toast.error('Failed to fetch vendors');
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Error fetching vendors for address');
    } finally {
      setVendorsLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.length >= 3) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchTerm]);

  const searchUsers = async () => {
    try {
      setLoading(true);

      // Use the real API client with admin authentication
      const response = await apiClient.adminRequest<{users: User[]}>(`/admin/users/search?q=${encodeURIComponent(searchTerm)}`);

      if (response.data) {
        setUsers(response.data.users || []);
      } else if (response.error) {
        // Fallback: simulate users based on search term for phone numbers
        if (searchTerm.match(/^\d{10}$/)) {
          setUsers([
            {
              _id: `user_${searchTerm}`,
              name: `User ${searchTerm.slice(-4)}`,
              phone: searchTerm,
              email: `user${searchTerm.slice(-4)}@example.com`,
              user_type: "customer",
            },
          ]);
          toast.info("Using fallback user data (API not available)");
        } else {
          setUsers([]);
          toast.error(response.error);
        }
      }
    } catch (error) {
      console.error("Error searching users:", error);
      // Fallback for network errors
      if (searchTerm.match(/^\d{10}$/)) {
        setUsers([
          {
            _id: `user_${searchTerm}`,
            name: `User ${searchTerm.slice(-4)}`,
            phone: searchTerm,
            email: `user${searchTerm.slice(-4)}@example.com`,
            user_type: "customer",
          },
        ]);
        toast.info("Using fallback user data (Network error)");
      } else {
        toast.error("Error searching users");
      }
    } finally {
      setLoading(false);
    }
  };

  const selectUser = async (user: User) => {
    setSearchTerm("");
    setUsers([]);
    setSelectedUser(user);

    try {
      const resp = await apiClient.adminRequest<any>(`/admin/users/${encodeURIComponent(user._id)}`);
      if (resp.data && resp.data.user) {
        const fetchedUser = resp.data.user;
        setSelectedUser(fetchedUser as User);

        // Autofill latest/default address into booking form
        const defaultAddress = resp.data.defaultAddress || (Array.isArray(resp.data.addresses) && resp.data.addresses[0]);
        const finalAddress = (defaultAddress && defaultAddress.full_address) || fetchedUser.address;

        if (finalAddress) {
          console.log("✅ Autofilling address:", finalAddress);
          setBookingData((prev) => ({ ...prev, address: finalAddress }));
          // Fetch vendors for this address
          await fetchVendorsForAddress(finalAddress);
        } else {
          console.warn("⚠️ No address found for user. Please enter address manually.");
          setVendors([]);
          setSelectedVendor(null);
        }

        return;
      }
    } catch (error) {
      console.warn('Failed to fetch user details for autofill', error);
    }
  };


  const calculateTotal = () => {
    return bookingData.services.reduce(
      (total, service) => total + service.price * service.quantity,
      0
    );
  };

  const calculateFinalAmount = () => {
    return calculateTotal();
  };


  const submitBooking = async () => {
    if (!selectedUser) {
      toast.error("Please select a user first");
      return;
    }

    if (!bookingData.scheduled_date || !bookingData.scheduled_time) {
      toast.error("Please select pickup date and time");
      return;
    }

    if (!bookingData.address.trim()) {
      toast.error("Please enter the pickup address");
      return;
    }

    try {
      setSubmitting(true);

      // Determine final customer id; create user if needed
      let finalCustomerId = selectedUser._id;
      let finalUserName = selectedUser.name || selectedUser.full_name || newUserName || "Admin Customer";
      let finalUserPhone = selectedUser.phone || searchTerm;

      if (!isValidObjectId(finalCustomerId)) {
        try {
          if (!finalUserName || finalUserName.trim().length < 2) {
            toast.error('Enter full name (min 2 chars)');
            setSubmitting(false);
            return;
          }
          if (!finalUserPhone.match(/^\d{10}$/)) {
            toast.error('Enter valid 10 digit phone number');
            setSubmitting(false);
            return;
          }
          const payload = {
            name: finalUserName.trim(),
            phone: finalUserPhone,
            user_type: 'customer',
            address: newUserAddress?.trim?.()
          };
          const resp = await apiClient.adminRequest<{user:any}>('/admin/users', { method: 'POST', body: payload });
          if (resp.data && (resp.data as any).user) {
            const created = (resp.data as any).user;
            setSelectedUser(created);
            finalCustomerId = created._id;
            finalUserName = created.name || created.full_name || finalUserName;
            finalUserPhone = created.phone || finalUserPhone;
          } else {
            toast.error(resp.error || 'Failed to create user');
            setSubmitting(false);
            return;
          }
        } catch (e) {
          console.error('Auto-create user failed', e);
          toast.error('Failed to create user');
          setSubmitting(false);
          return;
        }
      }

      const bookingPayload = {
        customer_id: finalCustomerId,
        name: finalUserName,
        phone: finalUserPhone,
        service: bookingData.service || bookingData.services[0]?.name || "",
        service_type: "laundry",
        services: bookingData.services.map(service => `${service.name} x${service.quantity} (₹${service.price}/${service.unit})`),
        scheduled_date: bookingData.scheduled_date,
        scheduled_time: bookingData.scheduled_time,
        delivery_date: bookingData.delivery_date || bookingData.scheduled_date,
        delivery_time: bookingData.delivery_time || bookingData.scheduled_time,
        provider_name: "Laundrify",
        address: bookingData.address,
        additional_details: bookingData.special_instructions,
        total_price: calculateTotal(),
        final_amount: calculateFinalAmount(),
        special_instructions: bookingData.special_instructions,
        created_by_admin: true,
        is_quick_pickup: bookingData.is_quick_pickup || false,
        quick_pickup_tag: bookingData.is_quick_pickup ? `QP_${Date.now()}` : null,
        assignedVendor: selectedVendor?.id || "",
        assignedVendorDetails: selectedVendor ? {
          name: selectedVendor.name,
          address: selectedVendor.address,
          phone: selectedVendor.phone,
          distance: selectedVendor.distance,
          estimatedTime: selectedVendor.estimatedTime,
        } : undefined,
      };

      console.log("Submitting booking:", bookingPayload);

      // Use real API client with admin authentication
      const response = await apiClient.adminRequest<{booking: any}>("/admin/bookings", {
        method: "POST",
        body: bookingPayload,
      });

      if (response.data) {
        toast.success(`Booking created successfully! Order ID: ${response.data.booking?.custom_order_id}`);

        // Reset form
        setSelectedUser(null);
        setNewUserName("");
        setNewUserAddress("");
        setVendors([]);
        setSelectedVendor(null);
        setBookingData({
          service: "",
          services: [],
          scheduled_date: "",
          scheduled_time: "",
          delivery_date: "",
          delivery_time: "",
          address: "",
          special_instructions: "",
          is_quick_pickup: false,
          assignedVendor: "",
        });
      } else {
        toast.error(`Failed to create booking: ${response.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.error("Error creating booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Book Service for User</h2>
        <p className="text-gray-600">
          Create bookings on behalf of registered users
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Select Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedUser ? (
              <>
                <div>
                  <Label htmlFor="user-search">Search by Phone Number or Name</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="user-search"
                      placeholder="Enter phone number or name (min 3 chars)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {loading && (
                  <div className="text-center py-4 text-gray-500">
                    Searching users...
                  </div>
                )}

                {users.length > 0 && (
                  <div className="space-y-2">
                    <Label>Search Results</Label>
                    {users.map((user) => (
                      <div
                        key={user._id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                        onClick={() => selectUser(user)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {user.name || user.full_name || "Unnamed User"}
                            </div>
                            <div className="text-sm text-gray-600">
                              �� {user.phone}
                            </div>
                            {user.email && (
                              <div className="text-sm text-gray-600">
                                ✉️ {user.email}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline">{user.user_type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchTerm.length >= 3 && users.length === 0 && !loading && (
                  <div className="space-y-3">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No users found. You can create a user here and continue booking.
                      </AlertDescription>
                    </Alert>

                    {/* Inline Create User Form */}
                    <div className="p-3 border rounded-md bg-white">
                      <Label>Create New User</Label>
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        <Input placeholder="Full name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                        <Input placeholder="Phone number" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        <Input placeholder="Address (optional)" value={newUserAddress} onChange={(e) => setNewUserAddress(e.target.value)} />
                        <div className="flex justify-end">
                          <Button onClick={async () => {
                            // Create user via admin API
                            if (!searchTerm.match(/^\d{10}$/)) {
                              toast.error('Please enter a valid 10 digit phone number');
                              return;
                            }
                            try {
                              setLoading(true);
                              if (!newUserName || newUserName.trim().length < 2) {
                                toast.error('Enter full name (min 2 chars)');
                                return;
                              }
                              const payload = { name: newUserName.trim(), phone: searchTerm, user_type: 'customer', address: newUserAddress?.trim?.() };
                              const resp = await apiClient.adminRequest('/admin/users', { method: 'POST', body: payload });
                              if (resp.data && resp.data.user) {
                                toast.success('User created');
                                setSelectedUser(resp.data.user as any);
                                setUsers([]);
                              } else if (resp.error) {
                                toast.error(resp.error);
                              } else {
                                toast.error('User creation failed (API not available)');
                              }
                            } catch (err) {
                              console.error('Create user error', err);
                              toast.error('Failed to create user');
                            } finally {
                              setLoading(false);
                            }
                          }}>Create & Select</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>Customer selected successfully!</AlertDescription>
                </Alert>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {selectedUser.name || selectedUser.full_name || "Unnamed User"}
                      </div>
                      <div className="text-sm text-gray-600">
                        📞 {selectedUser.phone}
                      </div>
                      {selectedUser.email && (
                        <div className="text-sm text-gray-600">
                          ✉️ {selectedUser.email}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUser(null)}
                    >
                      Change User
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Booking Details */}
      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Booking Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pickup-date">Pickup Date</Label>
                <Input
                  id="pickup-date"
                  type="date"
                  value={bookingData.scheduled_date}
                  onChange={(e) =>
                    setBookingData({ ...bookingData, scheduled_date: e.target.value })
                  }
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              
              <div>
                <Label htmlFor="pickup-time">Pickup Time</Label>
                <Select
                  value={bookingData.scheduled_time}
                  onValueChange={(value) =>
                    setBookingData({ ...bookingData, scheduled_time: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09:00">09:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="11:00">11:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="13:00">01:00 PM</SelectItem>
                    <SelectItem value="14:00">02:00 PM</SelectItem>
                    <SelectItem value="15:00">03:00 PM</SelectItem>
                    <SelectItem value="16:00">04:00 PM</SelectItem>
                    <SelectItem value="17:00">05:00 PM</SelectItem>
                    <SelectItem value="18:00">06:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="delivery-date">Delivery Date (Optional)</Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={bookingData.delivery_date}
                  onChange={(e) =>
                    setBookingData({ ...bookingData, delivery_date: e.target.value })
                  }
                  min={bookingData.scheduled_date || new Date().toISOString().split("T")[0]}
                />
              </div>

              <div>
                <Label htmlFor="delivery-time">Delivery Time (Optional)</Label>
                <Select
                  value={bookingData.delivery_time}
                  onValueChange={(value) =>
                    setBookingData({ ...bookingData, delivery_time: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09:00">09:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="11:00">11:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="13:00">01:00 PM</SelectItem>
                    <SelectItem value="14:00">02:00 PM</SelectItem>
                    <SelectItem value="15:00">03:00 PM</SelectItem>
                    <SelectItem value="16:00">04:00 PM</SelectItem>
                    <SelectItem value="17:00">05:00 PM</SelectItem>
                    <SelectItem value="18:00">06:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>


              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="quick-pickup"
                  type="checkbox"
                  checked={bookingData.is_quick_pickup}
                  onChange={(e) =>
                    setBookingData({
                      ...bookingData,
                      is_quick_pickup: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="quick-pickup" className="mb-0 cursor-pointer">
                  Mark as Quick Pickup Order 🚀
                </Label>
              </div>
            </div>

            <div>
              <Label htmlFor="address">Pickup Address</Label>
              <Textarea
                id="address"
                placeholder="Enter complete pickup address..."
                value={bookingData.address}
                onChange={(e) => {
                  const newAddress = e.target.value;
                  setBookingData({ ...bookingData, address: newAddress });
                  // Fetch vendors when address changes
                  if (newAddress.trim().length > 5) {
                    fetchVendorsForAddress(newAddress);
                  }
                }}
                rows={3}
              />
            </div>

            {/* Vendor Selection */}
            <div>
              <Label htmlFor="vendor-select">Assign Vendor (Allotment)</Label>
              {vendorsLoading && (
                <div className="text-sm text-gray-500 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    Loading vendors...
                  </div>
                </div>
              )}

              {!vendorsLoading && vendors.length > 0 ? (
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {vendors.map((vendor) => (
                      <div
                        key={vendor.id}
                        onClick={() => {
                          setSelectedVendor(vendor);
                          setBookingData(prev => ({ ...prev, assignedVendor: vendor.id }));
                        }}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedVendor?.id === vendor.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">{vendor.name}</div>
                              <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                📍 {vendor.address}
                              </div>
                            </div>
                            {selectedVendor?.id === vendor.id && (
                              <div className="ml-2">
                                <CheckCircle className="h-5 w-5 text-blue-600" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Navigation className="h-3 w-3" />
                              {vendor.distance.toFixed(2)}km
                            </Badge>
                            {vendor.estimatedTime && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {vendor.estimatedTime}m
                              </Badge>
                            )}
                            {vendor.phone && (
                              <Badge variant="outline" className="text-xs">
                                📞 {vendor.phone}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !vendorsLoading && bookingData.address.trim().length > 0 ? (
                <Alert className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No vendors found for this location. Please enter a different address or check vendor availability.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="text-sm text-gray-500 py-3 text-center">
                  Enter a pickup address to see available vendors
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="instructions">Special Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                placeholder="Any special instructions or notes..."
                value={bookingData.special_instructions}
                onChange={(e) =>
                  setBookingData({ ...bookingData, special_instructions: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={submitBooking}
                disabled={submitting}
                className="min-w-32"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </div>
                ) : (
                  "Create Booking"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminUserBooking;
