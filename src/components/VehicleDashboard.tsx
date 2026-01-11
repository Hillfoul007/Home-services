import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Truck,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Navigation,
  Lightbulb,
  Package,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface Order {
  _id: string;
  custom_order_id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  scheduled_time: string;
  delivery_time: string;
  status: string;
  special_instructions?: string;
}

interface VehicleRoute {
  vehicle: {
    _id: string;
    name: string;
    number_plate: string;
    current_location?: { lat: number; lng: number };
    status: string;
  };
  route: {
    total_orders: number;
    orders: Order[];
    suggestions: Array<{
      order1_id: string;
      order1_name: string;
      order2_id: string;
      order2_name: string;
      distance_km: string;
      suggestion: string;
    }>;
  };
}

interface VehicleDashboardProps {
  vehicleId?: string;
}

const VehicleDashboard: React.FC<VehicleDashboardProps> = ({ vehicleId: propVehicleId }) => {
  const [vehicleId, setVehicleId] = useState(propVehicleId || localStorage.getItem("vehicleId") || "");
  const [route, setRoute] = useState<VehicleRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [completedOrders, setCompletedOrders] = useState<Set<string>>(new Set());

  // Live location tracking
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      localStorage.setItem("vehicleId", vehicleId);
      fetchRoute();
      startLocationTracking();
    }
  }, [vehicleId]);

  // Fetch route
  const fetchRoute = async () => {
    if (!vehicleId) return;

    try {
      setLoading(true);
      const response = await apiClient.adminRequest<VehicleRoute>(`/vehicle/route/${vehicleId}`);
      if (response.data) {
        setRoute(response.data);
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      toast.error("Failed to load route");
    } finally {
      setLoading(false);
    }
  };

  // Start live location tracking
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    setLocationTracking(true);

    // Get initial location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateLocation(latitude, longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Could not access location");
      }
    );

    // Watch location changes every 30 seconds
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateLocation(latitude, longitude);
      },
      (error) => console.error("Location watch error:", error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  };

  // Update vehicle location
  const updateLocation = async (lat: number, lng: number) => {
    setLocation({ lat, lng });

    if (!vehicleId) return;

    try {
      await apiClient.adminRequest(`/vehicle/update-location/${vehicleId}`, {
        method: "POST",
        body: { lat, lng },
      });
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  // Mark order as pickup complete
  const handlePickupComplete = async (orderId: string) => {
    try {
      const response = await apiClient.adminRequest(`/vehicle/order-status/${orderId}`, {
        method: "POST",
        body: { status: "pickup_completed", vehicle_id: vehicleId },
      });

      if (response.data) {
        setCompletedOrders((prev) => new Set([...prev, orderId]));
        toast.success("Pickup marked complete");
        refreshRoute();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  // Mark order as delivery complete
  const handleDeliveryComplete = async (orderId: string) => {
    try {
      const response = await apiClient.adminRequest(`/vehicle/order-status/${orderId}`, {
        method: "POST",
        body: { status: "delivered", vehicle_id: vehicleId },
      });

      if (response.data) {
        setCompletedOrders((prev) => new Set([...prev, orderId]));
        toast.success("Delivery marked complete");
        refreshRoute();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  // Refresh route
  const refreshRoute = async () => {
    setRefreshing(true);
    await fetchRoute();
    setRefreshing(false);
  };

  if (!vehicleId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Vehicle Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Enter Vehicle ID</label>
                <input
                  type="text"
                  placeholder="Paste vehicle ID..."
                  className="w-full px-4 py-2 border rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      setVehicleId((e.target as HTMLInputElement).value);
                    }
                  }}
                />
              </div>
              <Button
                onClick={(e) => {
                  const input = (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement);
                  if (input?.value) {
                    setVehicleId(input.value);
                  }
                }}
                className="w-full"
              >
                Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Truck className="h-8 w-8 text-blue-600" />
              Vehicle Route Dashboard
            </h1>
            {route?.vehicle && <p className="text-gray-600 mt-1">{route.vehicle.name} ({route.vehicle.number_plate})</p>}
          </div>
          <Button
            onClick={refreshRoute}
            disabled={refreshing}
            variant="outline"
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-gray-600">Loading your route...</p>
            </CardContent>
          </Card>
        ) : !route ? (
          <Card>
            <CardContent className="pt-6 text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No route data available</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Current Location Status */}
            {location && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div>
                        <p className="font-semibold">📍 Live Location Active</p>
                        <p className="text-sm text-gray-600">
                          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-600">Tracking</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Smart Suggestions */}
            {route.route.suggestions && route.route.suggestions.length > 0 && (
              <Alert className="border-orange-200 bg-orange-50">
                <Lightbulb className="h-5 w-5 text-orange-600" />
                <AlertDescription className="text-orange-900 space-y-2">
                  <strong className="block">💡 Smart Collection Suggestions</strong>
                  {route.route.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="text-sm">
                      {suggestion.suggestion} - Orders {suggestion.order1_name} & {suggestion.order2_name} are only {suggestion.distance_km} km apart!
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* Map Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Live Route Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-96 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center border-2 border-gray-300">
                  <div className="text-center">
                    <Navigation className="h-16 w-16 text-gray-500 mx-auto mb-3 animate-bounce" />
                    <p className="text-gray-700 font-semibold">Google Maps will display here</p>
                    <p className="text-sm text-gray-600 mt-1">Showing optimized route with all pickup locations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orders List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Today's Orders ({route.route.total_orders})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {route.route.orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p>All deliveries completed for today! ✨</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {route.route.orders.map((order, idx) => {
                      const isCompleted = completedOrders.has(order._id);
                      const isPicked = order.status === "pickup_completed";
                      const isDelivered = order.status === "delivered";

                      return (
                        <div
                          key={order._id}
                          className={`border rounded-xl p-5 transition-all ${
                            isDelivered
                              ? "border-green-200 bg-green-50"
                              : isPicked
                                ? "border-blue-200 bg-blue-50"
                                : "border-gray-200 hover:shadow-lg"
                          }`}
                        >
                          {/* Order Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-semibold text-sm">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="font-bold text-lg">{order.custom_order_id}</p>
                                  <p className="text-sm text-gray-600">{order.customer_name}</p>
                                </div>
                              </div>
                            </div>
                            <Badge
                              className={
                                isDelivered
                                  ? "bg-green-600"
                                  : isPicked
                                    ? "bg-blue-600"
                                    : "bg-yellow-600"
                              }
                            >
                              {isDelivered ? "✓ Delivered" : isPicked ? "✓ Picked Up" : "⏱ Pending"}
                            </Badge>
                          </div>

                          {/* Contact & Time */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-500" />
                              <a href={`tel:${order.customer_phone}`} className="text-blue-600 hover:underline">
                                {order.customer_phone}
                              </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span>Pickup: {order.scheduled_time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span>Delivery: {order.delivery_time}</span>
                            </div>
                          </div>

                          {/* Address */}
                          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                            <div className="flex gap-2">
                              <MapPin className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium text-gray-900">{order.address}</p>
                                {order.coordinates && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    📍 {order.coordinates.lat.toFixed(4)}, {order.coordinates.lng.toFixed(4)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Special Instructions */}
                          {order.special_instructions && (
                            <div className="mb-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                              <p className="text-sm text-blue-900">
                                <span className="font-semibold">📝 Special Instructions:</span> {order.special_instructions}
                              </p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          {!isDelivered && (
                            <div className="flex gap-2">
                              {!isPicked && (
                                <Button
                                  onClick={() => handlePickupComplete(order._id)}
                                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Pickup Complete
                                </Button>
                              )}
                              {isPicked && (
                                <Button
                                  onClick={() => handleDeliveryComplete(order._id)}
                                  className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Delivery Complete
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-blue-600">{route.route.total_orders}</p>
                  <p className="text-sm text-gray-600">Total Orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {route.route.orders.filter((o) => o.status === "pickup_completed" || o.status === "delivered").length}
                  </p>
                  <p className="text-sm text-gray-600">Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-yellow-600">
                    {route.route.orders.filter((o) => o.status !== "pickup_completed" && o.status !== "delivered").length}
                  </p>
                  <p className="text-sm text-gray-600">Remaining</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VehicleDashboard;
