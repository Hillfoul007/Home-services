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
  Package,
  DollarSign,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { laundryServices, serviceCategories, getCategoryDisplay } from "@/data/laundryServices";
import { apiClient } from "@/lib/apiClient";

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
    discount_amount: 0,
  });

  const [newService, setNewService] = useState<ServiceItem>({
    id: "",
    name: "",
    quantity: 1,
    price: 0,
    unit: "PC",
    category: "",
  });

  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // New user inline form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserAddress, setNewUserAddress] = useState("");

  const isValidObjectId = (v: string | undefined | null) => !!v && /^[a-fA-F0-9]{24}$/.test(v);

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

  const selectUser = (user: User) => {
    setSelectedUser(user);
    setSearchTerm("");
    setUsers([]);
  };

  const addService = () => {
    if (newService.name && newService.quantity > 0 && newService.price > 0) {
      setBookingData({
        ...bookingData,
        services: [...bookingData.services, { ...newService }],
      });
      setNewService({ id: "", name: "", quantity: 1, price: 0, unit: "PC", category: "" });
    }
  };

  const removeService = (index: number) => {
    setBookingData({
      ...bookingData,
      services: bookingData.services.filter((_, i) => i !== index),
    });
  };

  const calculateTotal = () => {
    return bookingData.services.reduce(
      (total, service) => total + service.price * service.quantity,
      0
    );
  };

  const calculateFinalAmount = () => {
    return Math.max(0, calculateTotal() - bookingData.discount_amount);
  };

  const selectServiceFromList = (service: typeof laundryServices[0]) => {
    setNewService({
      id: service.id,
      name: service.name,
      price: service.price,
      quantity: 1,
      unit: service.unit,
      category: service.category,
    });
  };

  const submitBooking = async () => {
    if (!selectedUser) {
      toast.error("Please select a user first");
      return;
    }

    // Allow proceeding without services; defaults will be applied

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

      const hasServices = bookingData.services.length > 0;
      const servicesList = hasServices
        ? bookingData.services.map(service => `${service.name} x${service.quantity} (₹${service.price}/${service.unit})`)
        : ["Unspecified (to be updated later)"];
      const subtotal = hasServices ? calculateTotal() : 0;
      const finalAmt = Math.max(0, subtotal - (bookingData.discount_amount || 0));

      const bookingPayload = {
        customer_id: finalCustomerId,
        name: finalUserName,
        phone: finalUserPhone,
        service: bookingData.service || bookingData.services[0]?.name || "Unspecified",
        service_type: "laundry",
        services: servicesList,
        scheduled_date: bookingData.scheduled_date,
        scheduled_time: bookingData.scheduled_time,
        delivery_date: bookingData.delivery_date || bookingData.scheduled_date,
        delivery_time: bookingData.delivery_time || bookingData.scheduled_time,
        provider_name: "Laundrify",
        address: bookingData.address,
        additional_details: bookingData.special_instructions,
        total_price: subtotal,
        discount_amount: bookingData.discount_amount || 0,
        final_amount: finalAmt,
        special_instructions: bookingData.special_instructions,
        created_by_admin: true,
        status: "pending",
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
        setBookingData({
          service: "",
          services: [],
          scheduled_date: "",
          scheduled_time: "",
          delivery_date: "",
          delivery_time: "",
          address: "",
          special_instructions: "",
          discount_amount: 0,
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
                              📞 {user.phone}
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

        {/* Service Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Service Category Filter */}
            <div>
              <Label>Service Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {serviceCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Service Selection */}
            <div>
              <Label>Quick Add Services</Label>
              <div className="grid grid-cols-1 gap-2 mt-2 max-h-60 overflow-y-auto">
                {laundryServices
                  .filter(service => selectedCategory === "all" || service.category === selectedCategory)
                  .map((service) => (
                    <Button
                      key={service.id}
                      variant="outline"
                      size="sm"
                      className="text-xs justify-between h-auto py-2 px-3"
                      onClick={() => selectServiceFromList(service)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{service.name}</span>
                        <span className="text-xs text-gray-500">{getCategoryDisplay(service.category)}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">₹{service.price}</div>
                        <div className="text-xs text-gray-500">per {service.unit}</div>
                      </div>
                    </Button>
                  ))}
              </div>
            </div>

            {/* Custom Service Addition */}
            <div className="border-t pt-4 space-y-3">
              <Label>Add Custom Service</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Service name"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Price (₹)"
                  value={newService.price || ""}
                  onChange={(e) =>
                    setNewService({ ...newService, price: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Qty"
                  value={newService.quantity || ""}
                  onChange={(e) =>
                    setNewService({ ...newService, quantity: parseInt(e.target.value) || 1 })
                  }
                  className="w-20"
                />
                <Select
                  value={newService.unit}
                  onValueChange={(value) => setNewService({ ...newService, unit: value })}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PC">PC</SelectItem>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="SET">SET</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addService} className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>
            </div>

            {/* Added Services */}
            {bookingData.services.length > 0 && (
              <div className="border-t pt-4">
                <Label>Selected Services</Label>
                <div className="space-y-2 mt-2">
                  {bookingData.services.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-gray-600">
                          {service.quantity} {service.unit} × ₹{service.price} = ₹{service.quantity * service.price}
                        </div>
                        {service.category && (
                          <div className="text-xs text-gray-500">{getCategoryDisplay(service.category)}</div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeService(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex justify-between font-medium">
                    <span>Subtotal:</span>
                    <span>₹{calculateTotal()}</span>
                  </div>
                  {bookingData.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>-₹{bookingData.discount_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-blue-600 border-t pt-2 mt-2">
                    <span>Total:</span>
                    <span>₹{calculateFinalAmount()}</span>
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

              <div className="md:col-span-2">
                <Label htmlFor="discount">Discount Amount (₹)</Label>
                <Input
                  id="discount"
                  type="number"
                  placeholder="0"
                  value={bookingData.discount_amount || ""}
                  onChange={(e) =>
                    setBookingData({
                      ...bookingData,
                      discount_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Pickup Address</Label>
              <Textarea
                id="address"
                placeholder="Enter complete pickup address..."
                value={bookingData.address}
                onChange={(e) =>
                  setBookingData({ ...bookingData, address: e.target.value })
                }
                rows={3}
              />
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
