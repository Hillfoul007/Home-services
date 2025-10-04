import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, MapPin, Settings, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AvailableLocation {
  id: string;
  city: string;
  area: string;
  pincode?: string;
  isActive: boolean;
  addedAt: string;
}

const LocationConfigManager: React.FC = () => {
  const [availableLocations, setAvailableLocations] = useState<
    AvailableLocation[]
  >([
    {
      id: "1",
      city: "Gurgaon",
      area: "Sector 69",
      pincode: "122018",
      isActive: true,
      addedAt: new Date().toISOString(),
    },
    {
      id: "2",
      city: "Gurugram",
      area: "Sector 69",
      pincode: "122018",
      isActive: true,
      addedAt: new Date().toISOString(),
    },
  ]);

  const [newLocation, setNewLocation] = useState({
    city: "",
    area: "",
    pincode: "",
  });

  const { toast } = useToast();

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("availableLocations");
    if (saved) {
      try {
        setAvailableLocations(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to load saved locations:", error);
      }
    }
  }, []);

  // Save to localStorage whenever locations change
  useEffect(() => {
    localStorage.setItem(
      "availableLocations",
      JSON.stringify(availableLocations),
    );
  }, [availableLocations]);

  const addLocation = () => {
    if (!newLocation.city.trim() || !newLocation.area.trim()) {
      toast({
        title: "Error",
        description: "City and area are required",
        variant: "destructive",
      });
      return;
    }

    const location: AvailableLocation = {
      id: Date.now().toString(),
      city: newLocation.city.trim(),
      area: newLocation.area.trim(),
      pincode: newLocation.pincode.trim(),
      isActive: true,
      addedAt: new Date().toISOString(),
    };

    setAvailableLocations([...availableLocations, location]);
    setNewLocation({ city: "", area: "", pincode: "" });

    toast({
      title: "Success",
      description: "Location added successfully",
    });
  };

  const removeLocation = (id: string) => {
    setAvailableLocations(availableLocations.filter((loc) => loc.id !== id));
    toast({
      title: "Success",
      description: "Location removed successfully",
    });
  };

  const toggleLocationStatus = (id: string) => {
    setAvailableLocations(
      availableLocations.map((loc) =>
        loc.id === id ? { ...loc, isActive: !loc.isActive } : loc,
      ),
    );
  };

  const exportConfig = () => {
    const config = {
      availableLocations,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `location-config-${new Date().toISOString().split("T")[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Configuration exported successfully",
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Location Configuration
            </h1>
            <p className="text-gray-600">
              Manage areas where your service is available
            </p>
          </div>
        </div>
        <Button onClick={exportConfig} variant="outline" className="gap-2">
          <Save className="h-4 w-4" />
          Export Config
        </Button>
      </div>

      {/* Add New Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-600" />
            Add New Service Area
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={newLocation.city}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, city: e.target.value })
                }
                placeholder="e.g., Gurgaon"
              />
            </div>
            <div>
              <Label htmlFor="area">Area/Sector *</Label>
              <Input
                id="area"
                value={newLocation.area}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, area: e.target.value })
                }
                placeholder="e.g., Sector 69"
              />
            </div>
            <div>
              <Label htmlFor="pincode">Pincode (Optional)</Label>
              <Input
                id="pincode"
                value={newLocation.pincode}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, pincode: e.target.value })
                }
                placeholder="e.g., 122018"
              />
            </div>
          </div>
          <Button
            onClick={addLocation}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </CardContent>
      </Card>

      {/* Current Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              Available Service Areas ({availableLocations.length})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availableLocations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No service areas configured</p>
              <p className="text-sm">Add your first location above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableLocations.map((location) => (
                <div
                  key={location.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    location.isActive
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin
                        className={`h-5 w-5 ${
                          location.isActive ? "text-green-600" : "text-gray-400"
                        }`}
                      />
                      <div>
                        <div className="font-semibold text-gray-900">
                          {location.area}, {location.city}
                        </div>
                        <div className="text-sm text-gray-600">
                          {location.pincode &&
                            `Pincode: ${location.pincode} • `}
                          Added:{" "}
                          {new Date(location.addedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={location.isActive ? "default" : "secondary"}
                      className={
                        location.isActive
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : ""
                      }
                    >
                      {location.isActive ? "Active" : "Inactive"}
                    </Badge>

                    <Button
                      onClick={() => toggleLocationStatus(location.id)}
                      variant="outline"
                      size="sm"
                    >
                      {location.isActive ? "Disable" : "Enable"}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Location</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove "{location.area},{" "}
                            {location.city}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeLocation(location.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 How it works</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • Users' detected locations are checked against these configured
              areas
            </li>
            <li>• The system matches city names and area/sector patterns</li>
            <li>
              • If no match is found, the "Service Not Available" popup is shown
            </li>
            <li>• You can temporarily disable areas without removing them</li>
            <li>
              • Configuration is saved locally and can be exported as backup
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationConfigManager;
