import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  MapPin,
  Edit3,
  Trash2,
  Search,
  Building,
  Hash,
  Tag,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface ServiceLocation {
  _id?: string;
  id?: string;
  name: string;
  type: "sector" | "pincode" | "keyword" | "area";
  value: string;
  description?: string;
  is_active: boolean;
  priority: number;
  created_at?: string;
  updated_at?: string;
}

const AdminServiceLocations: React.FC = () => {
  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<ServiceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ServiceLocation | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const [newLocation, setNewLocation] = useState<ServiceLocation>({
    name: "",
    type: "sector",
    value: "",
    description: "",
    is_active: true,
    priority: 1,
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    filterLocations();
  }, [locations, searchTerm, filterType]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      // Since we don't have a dedicated service locations API, we'll simulate with localStorage
      const savedLocations = localStorage.getItem("admin_service_locations");
      if (savedLocations) {
        const parsed = JSON.parse(savedLocations);
        setLocations(parsed);
      } else {
        // Initialize with some default locations
        const defaultLocations: ServiceLocation[] = [
          {
            id: "1",
            name: "Sector 1",
            type: "sector",
            value: "sector-1",
            description: "Prime residential area",
            is_active: true,
            priority: 1,
            created_at: new Date().toISOString(),
          },
          {
            id: "2",
            name: "Sector 5",
            type: "sector",
            value: "sector-5",
            description: "Commercial and residential mix",
            is_active: true,
            priority: 2,
            created_at: new Date().toISOString(),
          },
          {
            id: "3",
            name: "122001",
            type: "pincode",
            value: "122001",
            description: "Gurgaon Sector 1-10",
            is_active: true,
            priority: 1,
            created_at: new Date().toISOString(),
          },
          {
            id: "4",
            name: "DLF",
            type: "keyword",
            value: "dlf",
            description: "DLF areas and complexes",
            is_active: true,
            priority: 3,
            created_at: new Date().toISOString(),
          },
          {
            id: "5",
            name: "Golf Course Road",
            type: "area",
            value: "golf-course-road",
            description: "Golf Course Road vicinity",
            is_active: true,
            priority: 2,
            created_at: new Date().toISOString(),
          },
        ];
        setLocations(defaultLocations);
        localStorage.setItem("admin_service_locations", JSON.stringify(defaultLocations));
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Error fetching service locations");
    } finally {
      setLoading(false);
    }
  };

  const filterLocations = () => {
    let filtered = locations;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (location) =>
          location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          location.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
          location.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((location) => location.type === filterType);
    }

    setFilteredLocations(filtered);
  };

  const saveLocations = (updatedLocations: ServiceLocation[]) => {
    localStorage.setItem("admin_service_locations", JSON.stringify(updatedLocations));
    setLocations(updatedLocations);
  };

  const addLocation = () => {
    if (!newLocation.name.trim() || !newLocation.value.trim()) {
      toast.error("Name and value are required");
      return;
    }

    const location: ServiceLocation = {
      ...newLocation,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedLocations = [...locations, location];
    saveLocations(updatedLocations);
    
    setNewLocation({
      name: "",
      type: "sector",
      value: "",
      description: "",
      is_active: true,
      priority: 1,
    });
    
    setShowAddDialog(false);
    toast.success("Service location added successfully");
  };

  const updateLocation = () => {
    if (!editingLocation) return;

    const updatedLocations = locations.map((loc) =>
      (loc.id || loc._id) === (editingLocation.id || editingLocation._id)
        ? { ...editingLocation, updated_at: new Date().toISOString() }
        : loc
    );

    saveLocations(updatedLocations);
    setEditingLocation(null);
    setShowEditDialog(false);
    toast.success("Service location updated successfully");
  };

  const deleteLocation = (locationId: string) => {
    const updatedLocations = locations.filter(
      (loc) => (loc.id || loc._id) !== locationId
    );
    saveLocations(updatedLocations);
    toast.success("Service location deleted successfully");
  };

  const toggleLocationStatus = (locationId: string) => {
    const updatedLocations = locations.map((loc) =>
      (loc.id || loc._id) === locationId
        ? { ...loc, is_active: !loc.is_active, updated_at: new Date().toISOString() }
        : loc
    );
    saveLocations(updatedLocations);
    toast.success("Location status updated");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sector":
        return <Building className="h-4 w-4" />;
      case "pincode":
        return <Hash className="h-4 w-4" />;
      case "keyword":
        return <Tag className="h-4 w-4" />;
      case "area":
        return <MapPin className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "sector":
        return "bg-blue-100 text-blue-800";
      case "pincode":
        return "bg-green-100 text-green-800";
      case "keyword":
        return "bg-purple-100 text-purple-800";
      case "area":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading service locations...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Locations</h2>
          <p className="text-gray-600">
            Manage service availability by sectors, pin codes, keywords, and areas
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchLocations} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Service Location</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-name">Location Name</Label>
                  <Input
                    id="new-name"
                    placeholder="e.g., Sector 15, DLF Phase 1"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="new-type">Type</Label>
                  <select
                    id="new-type"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={newLocation.type}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, type: e.target.value as any })
                    }
                  >
                    <option value="sector">Sector</option>
                    <option value="pincode">Pin Code</option>
                    <option value="keyword">Keyword</option>
                    <option value="area">Area</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="new-value">Value</Label>
                  <Input
                    id="new-value"
                    placeholder="e.g., sector-15, 122001, dlf, golf-course-road"
                    value={newLocation.value}
                    onChange={(e) => setNewLocation({ ...newLocation, value: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="new-priority">Priority (1-10)</Label>
                  <Input
                    id="new-priority"
                    type="number"
                    min="1"
                    max="10"
                    value={newLocation.priority}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, priority: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="new-description">Description (Optional)</Label>
                  <Textarea
                    id="new-description"
                    placeholder="Brief description of the location"
                    value={newLocation.description}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, description: e.target.value })
                    }
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="new-active"
                    checked={newLocation.is_active}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, is_active: e.target.checked })
                    }
                  />
                  <Label htmlFor="new-active">Active</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addLocation}>Add Location</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Locations</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name, value, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="md:w-48">
              <Label htmlFor="type-filter">Filter by Type</Label>
              <select
                id="type-filter"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="sector">Sector</option>
                <option value="pincode">Pin Code</option>
                <option value="keyword">Keyword</option>
                <option value="area">Area</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {locations.filter((l) => l.type === "sector").length}
            </div>
            <div className="text-sm text-gray-600">Sectors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {locations.filter((l) => l.type === "pincode").length}
            </div>
            <div className="text-sm text-gray-600">Pin Codes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {locations.filter((l) => l.type === "keyword").length}
            </div>
            <div className="text-sm text-gray-600">Keywords</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {locations.filter((l) => l.type === "area").length}
            </div>
            <div className="text-sm text-gray-600">Areas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {locations.filter((l) => l.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </CardContent>
        </Card>
      </div>

      {/* Locations List */}
      <div className="space-y-4">
        {filteredLocations.map((location) => (
          <Card key={location.id || location._id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(location.type)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">{location.name}</h3>
                        <Badge className={getTypeColor(location.type)}>
                          {location.type}
                        </Badge>
                        {location.is_active ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {location.value}
                        </span>
                        {location.description && (
                          <span className="ml-2">{location.description}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Priority: {location.priority} • Created:{" "}
                        {location.created_at
                          ? new Date(location.created_at).toLocaleDateString()
                          : "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleLocationStatus(location.id || location._id!)}
                  >
                    {location.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingLocation({ ...location });
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this location?")) {
                        deleteLocation(location.id || location._id!);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredLocations.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No locations found</h3>
              <p className="text-gray-600">
                {searchTerm || filterType !== "all"
                  ? "Try adjusting your search criteria"
                  : "Add your first service location to get started"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Location Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service Location</DialogTitle>
          </DialogHeader>
          {editingLocation && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Location Name</Label>
                <Input
                  id="edit-name"
                  value={editingLocation.name}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, name: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-type">Type</Label>
                <select
                  id="edit-type"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={editingLocation.type}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, type: e.target.value as any })
                  }
                >
                  <option value="sector">Sector</option>
                  <option value="pincode">Pin Code</option>
                  <option value="keyword">Keyword</option>
                  <option value="area">Area</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-value">Value</Label>
                <Input
                  id="edit-value"
                  value={editingLocation.value}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, value: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-priority">Priority (1-10)</Label>
                <Input
                  id="edit-priority"
                  type="number"
                  min="1"
                  max="10"
                  value={editingLocation.priority}
                  onChange={(e) =>
                    setEditingLocation({
                      ...editingLocation,
                      priority: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description (Optional)</Label>
                <Textarea
                  id="edit-description"
                  value={editingLocation.description || ""}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, description: e.target.value })
                  }
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editingLocation.is_active}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, is_active: e.target.checked })
                  }
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={updateLocation}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminServiceLocations;
