import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  Search,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  X,
  Loader,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface Vehicle {
  _id: string;
  name: string;
  number_plate: string;
  vehicle_type: string;
  status: string;
  current_orders_count: number;
  max_orders_per_trip: number;
  assigned_vendor_name?: string;
  availability_slots: Array<{
    start_time: string;
    end_time: string;
    is_available: boolean;
    assigned_orders_count: number;
  }>;
  today_orders?: string[];
}

interface Order {
  _id: string;
  custom_order_id: string;
  name: string;
  phone: string;
  address: string;
  scheduled_date: string;
  scheduled_time: string;
  delivery_date?: string;
  delivery_time?: string;
  status: string;
  assignedVendor: string;
  assigned_vehicle_id?: string;
  vehicle_time_slot?: string;
  coordinates?: { lat: number; lng: number };
  total_price: number;
  final_amount: number;
  created_at: string;
}

interface AllocationData {
  unallocatedOrders: Order[];
  allocatedOrders: Order[];
  vendorVehicles: { [key: string]: Vehicle[] };
  vendors: string[];
}

const AdminOrderAllocation: React.FC = () => {
  const [allocationData, setAllocationData] = useState<AllocationData>({
    unallocatedOrders: [],
    allocatedOrders: [],
    vendorVehicles: {},
    vendors: [],
  });

  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllocationDialog, setShowAllocationDialog] = useState(false);

  useEffect(() => {
    fetchAllocationData();
  }, [selectedVendor]);

  const fetchAllocationData = async () => {
    try {
      setLoading(true);
      const params = selectedVendor && selectedVendor !== "__all__" ? { vendor_id: selectedVendor } : {};
      const response = await apiClient.adminRequest<AllocationData>(
        "/admin/order-allocation",
        { query: params }
      );

      if (response.data) {
        setAllocationData(response.data);
      }
    } catch (error) {
      console.error("Error fetching allocation data:", error);
      toast.error("Failed to fetch allocation data");
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateOrder = async () => {
    if (!selectedOrder || !selectedVehicle) {
      toast.error("Please select an order and vehicle");
      return;
    }

    try {
      setAllocating(true);
      const response = await apiClient.adminRequest("/admin/order-allocation/allocate", {
        method: "POST",
        body: {
          booking_id: selectedOrder._id,
          vehicle_id: selectedVehicle._id,
          slot_start_time: selectedSlot || null,
        },
      });

      if (response.data?.success) {
        toast.success("Order allocated to vehicle successfully");
        setShowAllocationDialog(false);
        setSelectedOrder(null);
        setSelectedVehicle(null);
        setSelectedSlot("");
        await fetchAllocationData();
      }
    } catch (error) {
      console.error("Error allocating order:", error);
      toast.error("Failed to allocate order");
    } finally {
      setAllocating(false);
    }
  };

  const handleDeallocate = async (orderId: string) => {
    try {
      const response = await apiClient.adminRequest("/admin/order-allocation/deallocate", {
        method: "POST",
        body: { booking_id: orderId },
      });

      if (response.data?.success) {
        toast.success("Order deallocated successfully");
        await fetchAllocationData();
      }
    } catch (error) {
      console.error("Error deallocating order:", error);
      toast.error("Failed to deallocate order");
    }
  };

  const getAvailableVehicles = () => {
    if (!selectedVendor) return [];
    return allocationData.vendorVehicles[selectedVendor] || [];
  };

  const getFilteredUnallocatedOrders = () => {
    let orders = allocationData.unallocatedOrders;

    if (selectedVendor) {
      orders = orders.filter(o => o.assignedVendor === selectedVendor);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      orders = orders.filter(
        o =>
          o.custom_order_id.toLowerCase().includes(query) ||
          o.name.toLowerCase().includes(query) ||
          o.phone.includes(query) ||
          o.address.toLowerCase().includes(query)
      );
    }

    return orders;
  };

  const getFilteredAllocatedOrders = () => {
    let orders = allocationData.allocatedOrders;

    if (selectedVendor) {
      orders = orders.filter(o => o.assignedVendor === selectedVendor);
    }

    return orders;
  };

  const unallocatedOrders = getFilteredUnallocatedOrders();
  const allocatedOrders = getFilteredAllocatedOrders();
  const availableVehicles = getAvailableVehicles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Vehicle Order Allocation</h2>
          <p className="text-muted-foreground mt-1">Manage and optimize order allocation to vehicles</p>
        </div>
        <Button onClick={fetchAllocationData} disabled={loading} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{unallocatedOrders.length}</div>
            <p className="text-sm text-muted-foreground">Unallocated Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{allocatedOrders.length}</div>
            <p className="text-sm text-muted-foreground">Allocated Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{allocationData.vendors.length}</div>
            <p className="text-sm text-muted-foreground">Total Vendors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{availableVehicles.length}</div>
            <p className="text-sm text-muted-foreground">Vehicles for Vendor</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-select">Filter by Vendor</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger id="vendor-select">
                  <SelectValue placeholder="Select a vendor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Vendors</SelectItem>
                  {allocationData.vendors.map(vendor => (
                    <SelectItem key={vendor} value={vendor}>
                      {vendor || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">Search Orders</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by order ID, name, phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="unallocated" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="unallocated">
            Unallocated ({unallocatedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="allocated">
            Allocated ({allocatedOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unallocated" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Loader className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p className="text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          ) : unallocatedOrders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-muted-foreground">
                  {selectedVendor ? "No unallocated orders for this vendor" : "No unallocated orders"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {unallocatedOrders.map(order => (
                <Card key={order._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Order</p>
                        <p className="text-lg font-bold">{order.custom_order_id}</p>
                        <p className="text-sm text-muted-foreground">{order.name}</p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Scheduled</p>
                        <p className="text-sm">{order.scheduled_date} at {order.scheduled_time}</p>
                        <p className="text-sm text-muted-foreground">{order.address}</p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Vendor & Amount</p>
                        <p className="text-sm">{order.assignedVendor || "Unknown"}</p>
                        <p className="text-lg font-bold text-green-600">₹{order.final_amount}</p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Contact</p>
                        <p className="flex items-center gap-2 text-sm">
                          <Phone className="w-3 h-3" />
                          {order.phone}
                        </p>
                      </div>

                      <div className="md:col-span-2 lg:col-span-1 flex justify-end">
                        <Button
                          onClick={() => {
                            setSelectedOrder(order);
                            setSelectedVehicle(null);
                            setSelectedSlot("");
                            setShowAllocationDialog(true);
                          }}
                          className="w-full"
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          Allocate to Vehicle
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="allocated" className="space-y-4">
          {allocatedOrders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {selectedVendor ? "No allocated orders for this vendor" : "No allocated orders"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {allocatedOrders.map(order => (
                <Card key={order._id} className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Order</p>
                        <p className="text-lg font-bold">{order.custom_order_id}</p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Scheduled</p>
                        <p className="text-sm">{order.scheduled_date} at {order.scheduled_time}</p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Vehicle Slot</p>
                        <p className="text-sm font-mono">{order.vehicle_time_slot || "—"}</p>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleDeallocate(order._id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Deallocate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showAllocationDialog} onOpenChange={setShowAllocationDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allocate Order to Vehicle</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Order Details</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-mono font-semibold">{selectedOrder.custom_order_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span>{selectedOrder.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scheduled:</span>
                    <span>{selectedOrder.scheduled_date} at {selectedOrder.scheduled_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-bold text-green-600">₹{selectedOrder.final_amount}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle-select">Select Vehicle</Label>
                {availableVehicles.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {selectedVendor
                        ? "No active vehicles assigned to this vendor"
                        : "Please select a vendor first"}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select
                    value={selectedVehicle?._id || ""}
                    onValueChange={vehicleId => {
                      const vehicle = availableVehicles.find(v => v._id === vehicleId);
                      setSelectedVehicle(vehicle || null);
                      setSelectedSlot("");
                    }}
                  >
                    <SelectTrigger id="vehicle-select">
                      <SelectValue placeholder="Select a vehicle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehicles.map(vehicle => (
                        <SelectItem key={vehicle._id} value={vehicle._id}>
                          <div className="flex items-center gap-2">
                            <Truck className="w-3 h-3" />
                            <span>
                              {vehicle.name} ({vehicle.number_plate}) - {vehicle.current_orders_count}/
                              {vehicle.max_orders_per_trip}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedVehicle && (
                <div className="space-y-2">
                  <Label htmlFor="slot-select">Select Time Slot (Optional)</Label>
                  <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                    <SelectTrigger id="slot-select">
                      <SelectValue placeholder="Select a slot or leave empty..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No Specific Slot</SelectItem>
                      {selectedVehicle.availability_slots.map(slot => (
                        <SelectItem
                          key={slot.start_time}
                          value={slot.start_time}
                          disabled={!slot.is_available || slot.assigned_orders_count >= selectedVehicle.max_orders_per_trip}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>
                              {slot.start_time} - {slot.end_time} ({slot.assigned_orders_count}/
                              {selectedVehicle.max_orders_per_trip})
                            </span>
                            {!slot.is_available || slot.assigned_orders_count >= selectedVehicle.max_orders_per_trip ? (
                              <Badge variant="destructive" className="ml-2">
                                Full
                              </Badge>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedVehicle && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-semibold">Selected Vehicle:</span> {selectedVehicle.name} ({selectedVehicle.number_plate})
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold">Current Capacity:</span> {selectedVehicle.current_orders_count}/
                    {selectedVehicle.max_orders_per_trip}
                  </p>
                  {selectedSlot && (
                    <p className="text-muted-foreground">
                      <span className="font-semibold">Time Slot:</span> {selectedSlot}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleAllocateOrder}
                  disabled={!selectedVehicle || allocating}
                  className="flex-1"
                >
                  {allocating ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Allocating...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Allocate Order
                    </>
                  )}
                </Button>
                <Button onClick={() => setShowAllocationDialog(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrderAllocation;
