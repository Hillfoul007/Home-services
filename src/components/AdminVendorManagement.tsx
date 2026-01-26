import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  MapPin,
  Phone,
  Star,
  Plus,
  Edit3,
  Trash2,
  Eye,
  RefreshCw,
  Navigation,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService, type VendorDetails } from "@/services/vendorService";
import { parseGoogleMapsLink, generateGoogleMapsLink } from "@/utils/googleMapsParser";

const AdminVendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<VendorDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVendor, setEditingVendor] = useState<VendorDetails | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<VendorDetails | null>(null);
  const [userAddressForDistance, setUserAddressForDistance] = useState("");
  const [calculatedDistance, setCalculatedDistance] = useState<{
    vendorId: string;
    distance: number;
    estimatedTime: number;
  } | null>(null);
  const [loadingDistance, setLoadingDistance] = useState(false);

  // Form state for new vendor
  const [newVendorForm, setNewVendorForm] = useState<Partial<VendorDetails>>({
    name: "",
    address: "",
    contactPhone: "",
    rating: 4.0,
    isActive: true,
    services: [],
    coordinates: { lat: 28.4595, lng: 77.0266 },
    googleMapsLink: "",
    whatsappLink: "",
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = () => {
    setLoading(true);
    const allVendors = vendorService.getAllVendors();
    setVendors(allVendors);
    console.log("📋 Vendors loaded:", allVendors);
    setLoading(false);
  };

  const handleAddVendor = () => {
    // Validate required fields
    if (!newVendorForm.name || !newVendorForm.address || !newVendorForm.coordinates) {
      toast.error("Please fill in all required fields");
      return;
    }

    const vendor: VendorDetails = {
      id: `vendor_${Date.now()}`,
      name: newVendorForm.name,
      address: newVendorForm.address,
      coordinates: newVendorForm.coordinates,
      services: newVendorForm.services || [],
      contactPhone: newVendorForm.contactPhone,
      rating: newVendorForm.rating || 4.0,
      isActive: newVendorForm.isActive !== false,
      googleMapsLink: newVendorForm.googleMapsLink,
      whatsappLink: newVendorForm.whatsappLink,
    };

    vendorService.addVendor(vendor);
    loadVendors();
    setNewVendorForm({
      name: "",
      address: "",
      contactPhone: "",
      rating: 4.0,
      isActive: true,
      services: [],
      coordinates: { lat: 28.4595, lng: 77.0266 },
      googleMapsLink: "",
      whatsappLink: "",
    });
    toast.success("Vendor added successfully");
  };

  const handleUpdateVendor = () => {
    if (!editingVendor) return;

    if (!editingVendor.name || !editingVendor.address) {
      toast.error("Please fill in all required fields");
      return;
    }

    vendorService.updateVendor(editingVendor.id, editingVendor);
    loadVendors();
    setShowEditDialog(false);
    setEditingVendor(null);
    toast.success("Vendor updated successfully");
  };

  const handleDeleteVendor = (vendorId: string) => {
    if (window.confirm("Are you sure you want to delete this vendor?")) {
      vendorService.deleteVendor(vendorId);
      loadVendors();
      toast.success("Vendor deleted successfully");
    }
  };

  const handleGoogleMapsLinkChange = (
    link: string,
    isNewVendor: boolean = false
  ) => {
    const coordinates = parseGoogleMapsLink(link);

    if (coordinates) {
      if (isNewVendor) {
        setNewVendorForm({
          ...newVendorForm,
          googleMapsLink: link,
          coordinates,
        });
      } else if (editingVendor) {
        setEditingVendor({
          ...editingVendor,
          googleMapsLink: link,
          coordinates,
        });
      }
      toast.success("✅ Coordinates extracted from Google Maps link");
    } else {
      toast.error("❌ Could not extract coordinates from this link. Please ensure it's a valid Google Maps URL.");
    }
  };

  const calculateDistanceFromAddress = async (vendorId: string) => {
    if (!userAddressForDistance.trim()) {
      toast.error("Please enter a user address");
      return;
    }

    setLoadingDistance(true);
    try {
      const result = await vendorService.getVendorDistanceFromAddress(
        vendorId,
        userAddressForDistance
      );

      if (result) {
        setCalculatedDistance({
          vendorId,
          distance: result.distance,
          estimatedTime: result.estimatedTime,
        });
        toast.success(
          `Distance: ${result.distance}km | Estimated Time: ${vendorService.formatEstimatedTime(result.estimatedTime)}`
        );
      } else {
        toast.error("Could not calculate distance");
      }
    } finally {
      setLoadingDistance(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading vendors...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vendor Management</h2>
          <p className="text-gray-600">
            Manage vendors and their service locations ({vendors.length} total)
          </p>
        </div>
        <Button onClick={loadVendors} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Add New Vendor Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            Add New Vendor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vendor-name">Vendor Name *</Label>
                <Input
                  id="vendor-name"
                  value={newVendorForm.name || ""}
                  onChange={(e) =>
                    setNewVendorForm({ ...newVendorForm, name: e.target.value })
                  }
                  placeholder="e.g., Priya Dry Cleaners"
                />
              </div>
              <div>
                <Label htmlFor="vendor-phone">Contact Phone</Label>
                <Input
                  id="vendor-phone"
                  value={newVendorForm.contactPhone || ""}
                  onChange={(e) =>
                    setNewVendorForm({
                      ...newVendorForm,
                      contactPhone: e.target.value,
                    })
                  }
                  placeholder="e.g., +91 9876543210"
                />
              </div>
              <div>
                <Label htmlFor="vendor-address">Address *</Label>
                <Input
                  id="vendor-address"
                  value={newVendorForm.address || ""}
                  onChange={(e) =>
                    setNewVendorForm({
                      ...newVendorForm,
                      address: e.target.value,
                    })
                  }
                  placeholder="Complete address"
                />
              </div>
              <div>
                <Label htmlFor="vendor-rating">Rating (0-5)</Label>
                <Input
                  id="vendor-rating"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={newVendorForm.rating || 4.0}
                  onChange={(e) =>
                    setNewVendorForm({
                      ...newVendorForm,
                      rating: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="vendor-lat">Latitude</Label>
                <Input
                  id="vendor-lat"
                  type="number"
                  value={newVendorForm.coordinates?.lat || ""}
                  onChange={(e) =>
                    setNewVendorForm({
                      ...newVendorForm,
                      coordinates: {
                        ...newVendorForm.coordinates!,
                        lat: parseFloat(e.target.value),
                      },
                    })
                  }
                  placeholder="28.3984"
                />
              </div>
              <div>
                <Label htmlFor="vendor-lng">Longitude</Label>
                <Input
                  id="vendor-lng"
                  type="number"
                  value={newVendorForm.coordinates?.lng || ""}
                  onChange={(e) =>
                    setNewVendorForm({
                      ...newVendorForm,
                      coordinates: {
                        ...newVendorForm.coordinates!,
                        lng: parseFloat(e.target.value),
                      },
                    })
                  }
                  placeholder="77.0648"
                />
              </div>
            </div>

            {/* Google Maps Link Section */}
            <div className="border-t pt-4">
              <Label htmlFor="vendor-gmaps">Google Maps Link</Label>
              <p className="text-sm text-gray-600 mb-2">
                Paste a Google Maps link to automatically extract coordinates
              </p>
              <div className="flex gap-2">
                <Input
                  id="vendor-gmaps"
                  value={newVendorForm.googleMapsLink || ""}
                  onChange={(e) =>
                    setNewVendorForm({
                      ...newVendorForm,
                      googleMapsLink: e.target.value,
                    })
                  }
                  placeholder="https://www.google.com/maps/search/..."
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    handleGoogleMapsLinkChange(newVendorForm.googleMapsLink || "", true)
                  }
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Extract
                </Button>
              </div>
              {newVendorForm.googleMapsLink && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.open(newVendorForm.googleMapsLink, "_blank")}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open in Google Maps
                </Button>
              )}
            </div>

            {/* Services and WhatsApp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vendor-services">Services (comma-separated)</Label>
                <Input
                  id="vendor-services"
                  value={newVendorForm.services?.join(", ") || ""}
                  onChange={(e) =>
                    setNewVendorForm({
                      ...newVendorForm,
                      services: e.target.value.split(",").map((s) => s.trim()),
                    })
                  }
                  placeholder="Dry Cleaning, Laundry, Ironing"
                />
              </div>
              <div>
                <Label htmlFor="vendor-whatsapp">WhatsApp Group Link</Label>
                <Input
                  id="vendor-whatsapp"
                  value={newVendorForm.whatsappLink || ""}
                  onChange={(e) =>
                    setNewVendorForm({
                      ...newVendorForm,
                      whatsappLink: e.target.value,
                    })
                  }
                  placeholder="https://chat.whatsapp.com/..."
                />
              </div>
            </div>

            <Button onClick={handleAddVendor} className="w-full bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Distance Calculator */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-green-600" />
            Calculate Distance from User Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={userAddressForDistance}
              onChange={(e) => setUserAddressForDistance(e.target.value)}
              placeholder="Enter customer/user address..."
              className="flex-1"
            />
            <Button
              onClick={() => {
                if (selectedVendorForDistance) {
                  calculateDistanceFromAddress(selectedVendorForDistance);
                } else {
                  toast.error("Please select a vendor first");
                }
              }}
              disabled={loadingDistance}
              variant="outline"
            >
              {loadingDistance ? "Calculating..." : "Calculate Distance"}
            </Button>
          </div>

          {calculatedDistance && (
            <div className="mt-4 p-4 bg-white border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Distance Calculated</p>
                  <p className="text-sm text-gray-600">
                    Distance: {calculatedDistance.distance}km | Estimated Time: {vendorService.formatEstimatedTime(calculatedDistance.estimatedTime)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendors List */}
      <div className="space-y-4">
        {vendors.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No vendors found</h3>
              <p className="text-gray-600">Add a new vendor to get started</p>
            </CardContent>
          </Card>
        ) : (
          vendors.map((vendor) => (
            <Card key={vendor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Vendor Info */}
                  <div className="space-y-2">
                    <div className="font-medium text-gray-900">{vendor.name}</div>
                    {vendor.contactPhone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${vendor.contactPhone}`} className="text-blue-600 hover:underline">
                          {vendor.contactPhone}
                        </a>
                      </div>
                    )}
                    {vendor.rating && (
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span>{vendor.rating}</span>
                      </div>
                    )}
                    <Badge variant={vendor.isActive ? "default" : "secondary"}>
                      {vendor.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {/* Address & Coordinates */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900 font-medium">Location</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p className="line-clamp-2">{vendor.address}</p>
                      <p className="font-mono text-gray-500">
                        {vendor.coordinates.lat.toFixed(4)}, {vendor.coordinates.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900 font-medium">Services</p>
                    <div className="flex flex-wrap gap-1">
                      {vendor.services?.slice(0, 3).map((service, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                      {vendor.services && vendor.services.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{vendor.services.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Links */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900 font-medium">Links</p>
                    <div className="flex flex-col gap-1">
                      {vendor.googleMapsLink && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start text-xs"
                          onClick={() => window.open(vendor.googleMapsLink, "_blank")}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          Google Maps
                        </Button>
                      )}
                      {vendor.whatsappLink && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start text-xs"
                          onClick={() => window.open(vendor.whatsappLink, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 justify-between">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setViewingVendor(vendor);
                        setShowViewDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingVendor({ ...vendor });
                        setShowEditDialog(true);
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteVendor(vendor.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* View Vendor Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
          </DialogHeader>
          {viewingVendor && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vendor Name</Label>
                  <p className="font-medium">{viewingVendor.name}</p>
                </div>
                <div>
                  <Label>Rating</Label>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium">{viewingVendor.rating || 0}</span>
                  </div>
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <p className="text-sm">{viewingVendor.contactPhone || "Not provided"}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={viewingVendor.isActive ? "default" : "secondary"}>
                    {viewingVendor.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label>Address</Label>
                <p className="text-sm text-gray-700 mt-2">{viewingVendor.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Latitude</Label>
                  <p className="font-mono text-sm">{viewingVendor.coordinates.lat}</p>
                </div>
                <div>
                  <Label>Longitude</Label>
                  <p className="font-mono text-sm">{viewingVendor.coordinates.lng}</p>
                </div>
              </div>

              {viewingVendor.services && viewingVendor.services.length > 0 && (
                <div className="border-t pt-4">
                  <Label>Services</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {viewingVendor.services.map((service, idx) => (
                      <Badge key={idx} variant="outline">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewingVendor.googleMapsLink && (
                <div className="border-t pt-4">
                  <Label>Google Maps Link</Label>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => window.open(viewingVendor.googleMapsLink, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Location
                  </Button>
                </div>
              )}

              {viewingVendor.whatsappLink && (
                <div className="border-t pt-4">
                  <Label>WhatsApp Group</Label>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => window.open(viewingVendor.whatsappLink, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Join Group
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          {editingVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vendor Name *</Label>
                  <Input
                    value={editingVendor.name}
                    onChange={(e) =>
                      setEditingVendor({ ...editingVendor, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input
                    value={editingVendor.contactPhone || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        contactPhone: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Rating</Label>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={editingVendor.rating || 0}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        rating: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    value={editingVendor.coordinates.lat}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        coordinates: {
                          ...editingVendor.coordinates,
                          lat: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    value={editingVendor.coordinates.lng}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        coordinates: {
                          ...editingVendor.coordinates,
                          lng: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Address *</Label>
                <Textarea
                  value={editingVendor.address}
                  onChange={(e) =>
                    setEditingVendor({ ...editingVendor, address: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="border-t pt-4">
                <Label>Google Maps Link</Label>
                <p className="text-sm text-gray-600 mb-2">
                  Paste a Google Maps link to automatically extract coordinates
                </p>
                <div className="flex gap-2">
                  <Input
                    value={editingVendor.googleMapsLink || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        googleMapsLink: e.target.value,
                      })
                    }
                    placeholder="https://www.google.com/maps/search/..."
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleGoogleMapsLinkChange(editingVendor.googleMapsLink || "", false)
                    }
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Extract
                  </Button>
                </div>
                {editingVendor.googleMapsLink && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2"
                    onClick={() => window.open(editingVendor.googleMapsLink, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open in Google Maps
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Services (comma-separated)</Label>
                  <Input
                    value={editingVendor.services?.join(", ") || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        services: e.target.value.split(",").map((s) => s.trim()),
                      })
                    }
                    placeholder="Dry Cleaning, Laundry, Ironing"
                  />
                </div>
                <div>
                  <Label>WhatsApp Group Link</Label>
                  <Input
                    value={editingVendor.whatsappLink || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        whatsappLink: e.target.value,
                      })
                    }
                    placeholder="https://chat.whatsapp.com/..."
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleUpdateVendor}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

let selectedVendorForDistance: string | null = null;

export default AdminVendorManagement;
