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
import { X } from "lucide-react";
import { parseGoogleMapsLink, isGoogleMapsUrl } from "@/utils/mapsLinkParser";
import { locationService } from "@/services/locationService";

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
    mapsLink: "",
    coordinates: null as { lat: number; lng: number } | null,
  });

  // Vendor management state
  const [vendors, setVendors] = useState<VendorWithDistance[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorWithDistance | null>(null);

  // New user inline form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserAddress, setNewUserAddress] = useState("");

  // Service selection state
  const [availableServices] = useState<ServiceItem[]>([
    { id: "1", name: "Regular Iron", category: "Ironing", quantity: 1, price: 20, unit: "PC" },
    { id: "2", name: "Men's Suit", category: "Premium", quantity: 1, price: 150, unit: "SET" },
    { id: "3", name: "Lehenga", category: "Premium", quantity: 1, price: 200, unit: "SET" },
    { id: "4", name: "Heavy Dresses", category: "Premium", quantity: 1, price: 150, unit: "SET" },
    { id: "5", name: "Shirt", category: "Regular", quantity: 1, price: 40, unit: "PC" },
    { id: "6", name: "T-Shirt", category: "Regular", quantity: 1, price: 30, unit: "PC" },
    { id: "7", name: "Pants", category: "Regular", quantity: 1, price: 50, unit: "PC" },
    { id: "8", name: "Saree", category: "Premium", quantity: 1, price: 100, unit: "PC" },
    { id: "9", name: "Bedsheet", category: "Household", quantity: 1, price: 60, unit: "PC" },
    { id: "10", name: "Curtains", category: "Household", quantity: 1, price: 80, unit: "SET" },
  ]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedServiceQuantity, setSelectedServiceQuantity] = useState(1);

  const isValidObjectId = (v: string | undefined | null) => !!v && /^[a-fA-F0-9]{24}$/.test(v);

  // Helper function to decode HTML entities
  const decodeHtmlEntities = (text: string): string => {
    if (!text) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  // Add service to booking
  const addServiceToBooking = () => {
    if (!selectedServiceId) {
      toast.error("Please select a service");
      return;
    }

    const service = availableServices.find(s => s.id === selectedServiceId);
    if (!service) {
      toast.error("Service not found");
      return;
    }

    // Check if service already exists
    const existingService = bookingData.services.find(s => s.id === service.id);
    if (existingService) {
      // Update quantity
      setBookingData(prev => ({
        ...prev,
        services: prev.services.map(s =>
          s.id === service.id
            ? { ...s, quantity: s.quantity + selectedServiceQuantity }
            : s
        ),
      }));
    } else {
      // Add new service
      setBookingData(prev => ({
        ...prev,
        services: [
          ...prev.services,
          { ...service, quantity: selectedServiceQuantity },
        ],
      }));
    }

    // Reset selection
    setSelectedServiceId("");
    setSelectedServiceQuantity(1);
    toast.success("Service added to booking");
  };

  // Remove service from booking
  const removeServiceFromBooking = (serviceId: string) => {
    setBookingData(prev => ({
      ...prev,
      services: prev.services.filter(s => s.id !== serviceId),
    }));
  };

  // Fetch vendors based on address, with optional coordinates from Google Maps link
  const fetchVendorsForAddress = async (address: string, coordinates?: { lat: number; lng: number } | null) => {
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
        // Filter active vendors
        const vendorsList = response.data.vendors.filter((v: any) => v.is_active !== false);

        // Set vendors in the vendorService to use its distance calculation
        vendorService.setVendors(
          vendorsList.map((v: any) => ({
            id: v._id || v.id,
            name: v.name,
            address: v.address,
            coordinates: v.coordinates || { lat: 28.4595, lng: 77.0266 },
            services: v.services || [],
            contactPhone: v.phone || v.contactPhone,
            isActive: v.is_active !== false,
          }))
        );

        // Get vendor recommendations with distance using vendorService
        // If coordinates are provided from Google Maps link, use them for more accurate distance calculation
        const vendorsWithDistance = await vendorService.getVendorRecommendations(
          address,
          coordinates // Pass coordinates if available for precise location
        );

        // Convert to component format with all needed info
        const enrichedVendors = vendorsWithDistance.map((vendor) => ({
          id: vendor.id,
          _id: vendor.id,
          name: decodeHtmlEntities(vendor.name),
          address: decodeHtmlEntities(vendor.address),
          phone: vendor.contactPhone,
          coordinates: vendor.coordinates,
          distance: vendor.distance,
          estimatedTime: vendor.estimatedTime,
          isActive: vendor.isActive !== false,
        })).sort((a, b) => a.distance - b.distance).slice(0, 10);

        setVendors(enrichedVendors);

        // Auto-select nearest vendor
        if (enrichedVendors.length > 0) {
          setSelectedVendor(enrichedVendors[0]);
          setBookingData(prev => ({
            ...prev,
            assignedVendor: decodeHtmlEntities(enrichedVendors[0].name),
            assignedVendorId: enrichedVendors[0].id
          }));
        }
      } else {
        toast.error('Failed to fetch vendors');
        setVendors([]);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Error fetching vendors for address');
      setVendors([]);
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
          setBookingData((prev) => ({ ...prev, address: finalAddress, mapsLink: "", coordinates: null }));
          // Fetch vendors for this address
          await fetchVendorsForAddress(finalAddress, null);
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

    if (!selectedVendor) {
      toast.error("Please select a vendor for this booking");
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

      // Validate services are added
      if (bookingData.services.length === 0) {
        toast.error("Please add at least one service to the booking");
        setSubmitting(false);
        return;
      }

      const bookingPayload: any = {
        customer_id: finalCustomerId,
        name: finalUserName,
        phone: finalUserPhone,
        service: bookingData.services[0]?.name || "Laundry Service",
        service_type: "laundry",
        services: bookingData.services.map(service => `${service.name} x${service.quantity} (₹${service.price}/${service.unit})`),
        item_prices: bookingData.services.map((service) => ({
          service_name: service.name,
          quantity: service.quantity,
          unit_price: service.price,
          total_price: service.quantity * service.price,
        })),
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
        assignedVendor: selectedVendor ? decodeHtmlEntities(selectedVendor.name) : "",
        assignedVendorId: selectedVendor?.id || "",
        assignedVendorDetails: selectedVendor ? {
          name: decodeHtmlEntities(selectedVendor.name),
          address: decodeHtmlEntities(selectedVendor.address),
          phone: selectedVendor.phone,
          distance: selectedVendor.distance,
          estimatedTime: selectedVendor.estimatedTime,
        } : undefined,
        status: selectedVendor ? "vendor_assigned" : "created",
      };

      // Include coordinates if extracted from Google Maps link
      if (bookingData.coordinates) {
        bookingPayload.coordinates = bookingData.coordinates;
      }

      // Include mapsLink if available (custom or auto-generated)
      if (bookingData.mapsLink) {
        bookingPayload.mapsLink = bookingData.mapsLink;
      }

      console.log("🔍 Submitting booking with services:", {
        services: bookingPayload.services,
        item_prices: bookingPayload.item_prices,
        total_price: bookingPayload.total_price,
        final_amount: bookingPayload.final_amount,
      });

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
          mapsLink: "",
          coordinates: null,
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
                
                <div className="space-y-3">
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
                        onClick={() => {
                          setSelectedUser(null);
                          setVendors([]);
                          setSelectedVendor(null);
                          setBookingData(prev => ({ ...prev, address: "", assignedVendor: "", mapsLink: "", coordinates: null }));
                        }}
                      >
                        Change User
                      </Button>
                    </div>
                  </div>

                  {selectedVendor && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="font-medium text-green-900 mb-3">Assigned Vendor</div>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-medium">{selectedVendor.name}</span>
                        </div>
                        <div className="text-xs text-gray-700">
                          📍 {selectedVendor.address}
                        </div>
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-green-200">
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            {selectedVendor.distance.toFixed(2)}km away
                          </Badge>
                          {selectedVendor.estimatedTime && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              ~{selectedVendor.estimatedTime}m
                            </Badge>
                          )}
                          {selectedVendor.phone && (
                            <span className="text-xs text-gray-600">
                              📞 {selectedVendor.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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
                  // Fetch vendors when address changes (use existing coordinates if available)
                  if (newAddress.trim().length > 5) {
                    fetchVendorsForAddress(newAddress, bookingData.coordinates);
                  }
                }}
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">💡 Tip: Paste a Google Maps link below to auto-fill this address with precise coordinates</p>
            </div>

            {/* Google Maps Link for Precise Location */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
              <div>
                <Label htmlFor="maps-link" className="text-blue-900 font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Google Maps Link (Extracts Coordinates & Auto-Fills Address)
                </Label>
                <Input
                  id="maps-link"
                  placeholder="Paste Google Maps link here (e.g., https://maps.google.com/...)"
                  value={bookingData.mapsLink}
                  onChange={(e) => {
                    const newLink = e.target.value;
                    setBookingData(prev => ({ ...prev, mapsLink: newLink }));
                  }}
                  onBlur={async (e) => {
                    const mapsLink = e.target.value.trim();
                    if (mapsLink && isGoogleMapsUrl(mapsLink)) {
                      const parsed = parseGoogleMapsLink(mapsLink);

                      if (parsed.coordinates) {
                        setBookingData(prev => ({
                          ...prev,
                          coordinates: parsed.coordinates,
                        }));

                        // Reverse geocode to get human-readable address
                        try {
                          const reversedAddress = await locationService.reverseGeocode({
                            lat: parsed.coordinates.lat,
                            lng: parsed.coordinates.lng,
                          });

                          // Auto-fill the address field
                          setBookingData(prev => ({
                            ...prev,
                            address: reversedAddress || prev.address,
                          }));

                          toast.success("✅ Location coordinates and address extracted!");

                          // Refetch vendors with both address and coordinates
                          if (reversedAddress && reversedAddress.trim().length > 5) {
                            await fetchVendorsForAddress(reversedAddress, parsed.coordinates);
                          } else if (bookingData.address.trim().length > 5) {
                            // Use existing address if reverse geocoding fails
                            await fetchVendorsForAddress(bookingData.address, parsed.coordinates);
                          }
                        } catch (error) {
                          console.error("Reverse geocoding error:", error);
                          toast.warning("✅ Coordinates extracted but could not auto-fill address. You can enter it manually.");

                          // Still refetch vendors with coordinates even if address lookup fails
                          if (bookingData.address.trim().length > 5) {
                            await fetchVendorsForAddress(bookingData.address, parsed.coordinates);
                          }
                        }
                      } else if (parsed.error) {
                        toast.error(`❌ ${parsed.error}`);
                        setBookingData(prev => ({ ...prev, coordinates: null }));
                      }
                    } else if (mapsLink.length > 0) {
                      toast.error("❌ Invalid Google Maps link. Please paste a valid maps URL or coordinates.");
                      setBookingData(prev => ({ ...prev, coordinates: null }));
                    }
                  }}
                  className="mt-2"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Paste a Google Maps link and we'll automatically extract coordinates and fill the address field. You can edit the address afterward if needed.
                </p>
              </div>

              {bookingData.coordinates && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Label className="text-green-900 font-semibold text-sm block mb-2">✅ Location Data Extracted</Label>
                      <p className="text-xs text-green-700 mb-2">The address field above has been auto-filled with the coordinates from your Maps link</p>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Latitude:</span> <span className="font-mono font-semibold">{bookingData.coordinates.lat.toFixed(6)}</span>
                        </p>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Longitude:</span> <span className="font-mono font-semibold">{bookingData.coordinates.lng.toFixed(6)}</span>
                        </p>
                      </div>
                      <a
                        href={`https://maps.google.com/@${bookingData.coordinates.lat},${bookingData.coordinates.lng},17z`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:text-green-700 underline mt-2 inline-block"
                      >
                        Open in Google Maps →
                      </a>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBookingData(prev => ({ ...prev, coordinates: null, mapsLink: "" }));
                        toast.info("Location cleared");
                      }}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
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

            {/* Services Selection */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-4 block">Select Services</Label>

              <div className="space-y-4">
                {/* Add Service Section */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="service-select">Select Service</Label>
                      <Select
                        value={selectedServiceId}
                        onValueChange={setSelectedServiceId}
                      >
                        <SelectTrigger id="service-select">
                          <SelectValue placeholder="Choose a service..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableServices.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name} (₹{service.price}/{service.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={selectedServiceQuantity}
                        onChange={(e) => setSelectedServiceQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        onClick={addServiceToBooking}
                        className="w-full"
                        variant="outline"
                      >
                        Add to Booking
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Added Services List */}
                {bookingData.services.length > 0 && (
                  <div className="space-y-2">
                    <Label className="font-semibold">Added Services ({bookingData.services.length})</Label>
                    <div className="space-y-2">
                      {bookingData.services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {service.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              Qty: {service.quantity} × ₹{service.price}/{service.unit} = ₹{(service.quantity * service.price).toFixed(2)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeServiceFromBooking(service.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {bookingData.services.length === 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  ⚠️ At least one service must be added to create a booking. Please select services above.
                </AlertDescription>
              </Alert>
            )}

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
                disabled={submitting || bookingData.services.length === 0}
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
