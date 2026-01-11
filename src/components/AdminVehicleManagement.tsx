import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  User,
  Phone,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface Vehicle {
  _id: string;
  name: string;
  number_plate: string;
  vehicle_type: "bike" | "auto" | "van" | "car" | "truck";
  assigned_vendor_id?: string;
  assigned_vendor_name?: string;
  driver_name?: string;
  driver_phone?: string;
  current_location?: { lat: number; lng: number; last_updated_at: string };
  is_active: boolean;
  status: "available" | "on_route" | "busy" | "maintenance";
  current_orders_count: number;
  max_orders_per_trip: number;
  availability_slots?: Array<{
    start_time: string;
    end_time: string;
    is_available: boolean;
    assigned_orders_count: number;
  }>;
  today_orders?: Array<any>;
}

interface VendorOption {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
}

const AdminVehicleManagement: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const [vehicleOrders, setVehicleOrders] = useState<{ [key: string]: any[] }>({});
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    number_plate: "",
    vehicle_type: "auto" as const,
    driver_name: "",
    driver_phone: "",
  });

  const [selectedVendor, setSelectedVendor] = useState<string>("");

  useEffect(() => {
    fetchVehicles();
    fetchVendors();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<{ vehicles: Vehicle[] }>("/admin/vehicles");
      if (response.data?.vehicles) {
        setVehicles(response.data.vehicles);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast.error("Failed to fetch vehicles");
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      // Fetch laundry vendors from the admin vendor management
      const response = await apiClient.adminRequest<{ vendors: VendorOption[] }>("/admin/laundry-vendors");
      if (response.data?.vendors) {
        // Map vendor data to match VendorOption interface
        const formattedVendors = response.data.vendors.map((vendor: any) => ({
          _id: vendor._id,
          name: vendor.name,
          phone: vendor.phone,
          email: vendor.email,
        }));
        setVendors(formattedVendors);
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
      toast.error("Failed to fetch vendors");
    }
  };

  const handleCreateVehicle = async () => {
    if (!formData.name || !formData.number_plate) {
      toast.error("Vehicle name and number plate are required");
      return;
    }

    try {
      const response = await apiClient.adminRequest<{ vehicle: Vehicle }>("/admin/vehicles", {
        method: "POST",
        body: formData,
      });

      if (response.data?.vehicle) {
        toast.success("Vehicle created successfully");
        setVehicles([...vehicles, response.data.vehicle]);
        setFormData({ name: "", number_plate: "", vehicle_type: "auto", driver_name: "", driver_phone: "" });
        setShowCreateDialog(false);
      }
    } catch (error) {
      console.error("Error creating vehicle:", error);
      toast.error("Failed to create vehicle");
    }
  };

  const handleAssignVendor = async () => {
    if (!selectedVehicle || !selectedVendor) {
      toast.error("Please select a vendor");
      return;
    }

    try {
      const response = await apiClient.adminRequest<{ vehicle: Vehicle }>(
        `/admin/vehicles/${selectedVehicle._id}/assign-vendor`,
        {
          method: "POST",
          body: { vendor_id: selectedVendor },
        }
      );

      if (response.data?.vehicle) {
        toast.success("Vendor assigned successfully");
        setVehicles(vehicles.map((v) => (v._id === selectedVehicle._id ? response.data.vehicle : v)));
        setShowVendorDialog(false);
        setSelectedVendor("");
      }
    } catch (error) {
      console.error("Error assigning vendor:", error);
      toast.error("Failed to assign vendor");
    }
  };

  const handleUnassignVendor = async (vehicleId: string) => {
    try {
      const response = await apiClient.adminRequest<{ vehicle: Vehicle }>(
        `/admin/vehicles/${vehicleId}/unassign-vendor`,
        {
          method: "POST",
        }
      );

      if (response.data?.vehicle) {
        toast.success("Vendor unassigned successfully");
        setVehicles(vehicles.map((v) => (v._id === vehicleId ? response.data.vehicle : v)));
      }
    } catch (error) {
      console.error("Error unassigning vendor:", error);
      toast.error("Failed to unassign vendor");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "on_route":
        return "bg-blue-100 text-blue-800";
      case "busy":
        return "bg-yellow-100 text-yellow-800";
      case "maintenance":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Truck className="h-8 w-8 text-blue-600" />
            Vehicle Management
          </h1>
          <p className="text-gray-600 mt-1">Manage vehicles, assign vendors, and monitor routes</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Vehicle
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{vehicles.length}</div>
              <p className="text-sm text-gray-600">Total Vehicles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{vehicles.filter((v) => v.status === "available").length}</div>
              <p className="text-sm text-gray-600">Available</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{vehicles.filter((v) => v.status === "on_route").length}</div>
              <p className="text-sm text-gray-600">On Route</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{vehicles.filter((v) => !v.is_active).length}</div>
              <p className="text-sm text-gray-600">Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicles List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            All Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading vehicles...</div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600">No vehicles added yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((vehicle) => (
                <div key={vehicle._id} className="border rounded-lg p-5 hover:shadow-md transition-shadow">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
                    {/* Vehicle Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-semibold">{vehicle.name}</p>
                          <p className="text-sm text-gray-600">{vehicle.number_plate}</p>
                        </div>
                      </div>
                    </div>

                    {/* Vendor */}
                    <div>
                      <Label className="text-xs text-gray-500">Assigned Vendor</Label>
                      {vehicle.assigned_vendor_name ? (
                        <div className="flex items-center justify-between mt-1">
                          <p className="font-medium text-sm">{vehicle.assigned_vendor_name}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnassignVendor(vehicle._id)}
                            className="text-red-600 hover:text-red-700 h-6"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedVehicle(vehicle);
                            setShowVendorDialog(true);
                          }}
                          className="mt-1 text-xs"
                        >
                          Assign Vendor
                        </Button>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <Label className="text-xs text-gray-500">Status</Label>
                      <Badge className={`mt-1 ${getStatusColor(vehicle.status)}`}>{vehicle.status}</Badge>
                    </div>

                    {/* Orders */}
                    <div>
                      <Label className="text-xs text-gray-500">Orders Today</Label>
                      <p className="text-lg font-semibold mt-1">
                        {vehicle.current_orders_count}/{vehicle.max_orders_per_trip}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedVehicle(vehicle);
                          setShowRouteDialog(true);
                        }}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        View Route
                      </Button>
                    </div>
                  </div>

                  {/* Location Info */}
                  {vehicle.current_location?.lat && (
                    <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>
                          📍 {vehicle.current_location.lat.toFixed(4)}, {vehicle.current_location.lng.toFixed(4)}
                        </span>
                        <span className="text-xs">
                          Updated: {new Date(vehicle.current_location.last_updated_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Vehicle Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Vehicle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vehicle Name *</Label>
              <Input
                placeholder="e.g., Vehicle 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Number Plate *</Label>
              <Input
                placeholder="e.g., DL01AB1234"
                value={formData.number_plate}
                onChange={(e) => setFormData({ ...formData, number_plate: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label>Vehicle Type</Label>
              <Select value={formData.vehicle_type} onValueChange={(value: any) => setFormData({ ...formData, vehicle_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bike">Bike</SelectItem>
                  <SelectItem value="auto">Auto Rickshaw</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Driver Name</Label>
              <Input
                placeholder="Driver name (optional)"
                value={formData.driver_name}
                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Driver Phone</Label>
              <Input
                placeholder="Driver phone (optional)"
                value={formData.driver_phone}
                onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateVehicle}>Create Vehicle</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Vendor Dialog */}
      <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Vendor to {selectedVehicle?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Vendor</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor._id} value={vendor._id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowVendorDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignVendor}>Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Route View Dialog */}
      {selectedVehicle && (
        <VehicleRouteViewer vehicle={selectedVehicle} isOpen={showRouteDialog} onClose={() => setShowRouteDialog(false)} />
      )}
    </div>
  );
};

// Vehicle Route Viewer Component
interface VehicleRouteViewerProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
}

const VehicleRouteViewer: React.FC<VehicleRouteViewerProps> = ({ vehicle, isOpen, onClose }) => {
  const [route, setRoute] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && vehicle) {
      fetchRoute();
    }
  }, [isOpen, vehicle]);

  const fetchRoute = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<any>(`/vehicle/route/${vehicle._id}`);
      if (response.data) {
        setRoute(response.data);
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      toast.error("Failed to fetch route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Route for {vehicle.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading route...</div>
        ) : !route ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No route data available</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* Map Placeholder */}
            <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-gray-300">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Google Maps integration will show live vehicle location and optimized route</p>
              </div>
            </div>

            {/* Smart Suggestions */}
            {route.route?.suggestions && route.route.suggestions.length > 0 && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>Smart Suggestions:</strong>
                  {route.route.suggestions.map((suggestion: any, idx: number) => (
                    <div key={idx} className="mt-2">
                      💡 {suggestion.suggestion} ({suggestion.distance_km} km apart)
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* Orders List */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Today's Orders ({route.route?.total_orders || 0})
              </h3>
              <div className="space-y-3">
                {route.route?.orders?.map((order: any, idx: number) => (
                  <div key={order._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold">
                          {idx + 1}. {order.custom_order_id} - {order.customer_name}
                        </div>
                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {order.customer_phone}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {order.address}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Pickup: {order.scheduled_time} | Delivery: {order.delivery_time}
                          </div>
                          {order.special_instructions && (
                            <div className="text-sm text-blue-600">📝 {order.special_instructions}</div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <Badge className={order.status === "pickup_completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminVehicleManagement;
