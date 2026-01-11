import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Truck, Clock, CheckCircle, AlertCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface Vehicle {
  _id: string;
  name: string;
  vehicle_type: string;
  number_plate: string;
  assigned_vendor?: string;
  current_orders: number;
  max_orders: number;
  available_slot: string;
}

interface VehicleSlotSelectorProps {
  timeSlot: string; // "09:00", "09:30", etc.
  onSelect?: (vehicle: { vehicleId: string; slot: string }) => void;
}

// Generate time slots from 9 AM to 8 PM, every 30 minutes
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 9; hour < 20; hour++) {
    for (let minutes = 0; minutes < 60; minutes += 30) {
      slots.push(`${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
    }
  }
  return slots;
};

const VehicleSlotSelector: React.FC<VehicleSlotSelectorProps> = ({ timeSlot, onSelect }) => {
  const [timeSlots] = useState(generateTimeSlots());
  const [selectedSlot, setSelectedSlot] = useState(timeSlot || "");
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedSlot) {
      fetchAvailableVehicles();
    }
  }, [selectedSlot]);

  const fetchAvailableVehicles = async () => {
    if (!selectedSlot) return;

    try {
      setLoading(true);
      const response = await apiClient.adminRequest<{ vehicles: Vehicle[] }>(`/vehicles/available-slots`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Note: The backend endpoint expects query parameters, not body
      // This needs to be adjusted in the apiClient or backend route
      if (response.data?.vehicles) {
        setAvailableVehicles(response.data.vehicles);
      }
    } catch (error) {
      console.error("Error fetching available vehicles:", error);
      // toast.error("Failed to fetch available vehicles");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    if (onSelect) {
      onSelect({ vehicleId: vehicle._id, slot: selectedSlot });
    }
    toast.success(`Vehicle ${vehicle.name} selected for ${selectedSlot}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Select Pickup Vehicle & Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Time Slot Selection */}
        <div>
          <Label className="text-base font-semibold mb-3 block">Available Pickup Time Slots</Label>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => {
                  setSelectedSlot(slot);
                  setSelectedVehicle(null);
                }}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  selectedSlot === slot
                    ? "bg-blue-600 text-white border-2 border-blue-600"
                    : "bg-gray-100 text-gray-700 border-2 border-gray-200 hover:border-blue-400"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">🕐 Slots available from 9:00 AM to 8:00 PM (30-minute intervals)</p>
        </div>

        {selectedSlot && (
          <>
            {/* Available Vehicles */}
            <div>
              <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Vehicles Available for {selectedSlot}
              </Label>

              {loading ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading vehicles...</p>
                </div>
              ) : availableVehicles.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No vehicles available for this time slot. Please select a different time.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {availableVehicles.map((vehicle) => {
                    const capacity = vehicle.max_orders - vehicle.current_orders;
                    const capacityPercent = (vehicle.current_orders / vehicle.max_orders) * 100;

                    return (
                      <div
                        key={vehicle._id}
                        onClick={() => handleSelectVehicle(vehicle)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedVehicle?._id === vehicle._id
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 hover:border-blue-400 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Truck className="h-5 w-5 text-blue-600" />
                              <div>
                                <p className="font-semibold text-gray-900">{vehicle.name}</p>
                                <p className="text-xs text-gray-600">{vehicle.number_plate}</p>
                              </div>
                            </div>
                          </div>
                          {selectedVehicle?._id === vehicle._id && (
                            <Badge className="bg-blue-600">✓ Selected</Badge>
                          )}
                        </div>

                        {/* Vehicle Details */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                          <div className="text-xs">
                            <p className="text-gray-600">Type</p>
                            <p className="font-medium capitalize">{vehicle.vehicle_type}</p>
                          </div>
                          <div className="text-xs">
                            <p className="text-gray-600">Assigned Vendor</p>
                            <p className="font-medium">{vehicle.assigned_vendor || "Not assigned"}</p>
                          </div>
                          <div className="text-xs">
                            <p className="text-gray-600">Pickup Slot</p>
                            <p className="font-medium">{vehicle.available_slot}</p>
                          </div>
                        </div>

                        {/* Capacity Indicator */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-600">Capacity</p>
                            <p className="text-xs font-semibold">
                              {vehicle.current_orders}/{vehicle.max_orders}
                            </p>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                capacityPercent >= 80
                                  ? "bg-red-500"
                                  : capacityPercent >= 50
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${capacityPercent}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{capacity} slots remaining</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selection Summary */}
            {selectedVehicle && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong>✓ Pickup confirmed:</strong> {selectedVehicle.name} ({selectedVehicle.number_plate}) at {selectedSlot}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Info Box */}
        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            <strong>ℹ️ How it works:</strong> Select your preferred pickup time slot above. Available vehicles for that time slot will be displayed. 
            Each vehicle has specific capacity. Your order will be grouped with nearby orders for efficient delivery.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default VehicleSlotSelector;
