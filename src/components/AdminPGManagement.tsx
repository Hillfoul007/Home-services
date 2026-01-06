import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Phone,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface PG {
  _id: string;
  name: string;
  city: string;
  address: string;
  phone_number: string;
  assignedVendor?: string;
  assignedVendorName?: string;
  price_per_item: number;
  min_items: number;
  is_active: boolean;
}

interface Vendor {
  _id: string;
  name: string;
  phone: string;
  address: string;
}

interface FormData {
  name: string;
  city: string;
  address: string;
  phone_number: string;
  contact_person: string;
  assignedVendor: string;
  price_per_item: number;
  min_items: number;
}

const AdminPGManagement: React.FC = () => {
  const [pgs, setPGs] = useState<PG[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPG, setEditingPG] = useState<PG | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    city: "",
    address: "",
    phone_number: "",
    contact_person: "",
    assignedVendor: "",
    price_per_item: 25,
    min_items: 4,
  });

  const [submitting, setSubmitting] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadPGs();
    loadVendors();
  }, []);

  const loadPGs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<any>("/pg-management");

      if (response.error) {
        throw new Error(response.error);
      }

      // Handle nested data structure: { data: { success: true, data: [...] } }
      const pgsData = response.data?.data || response.data || [];

      if (Array.isArray(pgsData)) {
        setPGs(pgsData);
        // Extract unique cities from loaded PGs
        const uniqueCities = [...new Set(pgsData.map((pg: PG) => pg.city))];
        setCities(uniqueCities.sort());
      } else {
        console.warn("Invalid PGs response format:", response.data);
        setPGs([]);
        setCities([]);
      }
    } catch (error) {
      console.error("Error loading PGs:", error);
      toast.error("Failed to load PGs");
      setPGs([]);
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await apiClient.adminRequest<any>(
        "/pg-management/vendors/available"
      );

      if (response.error) {
        console.warn("Failed to load vendors:", response.error);
        return;
      }

      // Handle nested data structure: { data: { success: true, data: [...] } }
      const vendorsData = response.data?.data || response.data || [];

      if (Array.isArray(vendorsData)) {
        setVendors(vendorsData);
      }
    } catch (error) {
      console.error("Error loading vendors:", error);
      // Don't show error for vendors as it's optional
    }
  };

  const filteredPGs = pgs.filter((pg) => {
    const matchSearch =
      pg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pg.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pg.city.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCity = !selectedCity || pg.city === selectedCity;

    return matchSearch && matchCity;
  });

  const handleOpenAdd = () => {
    setEditingPG(null);
    setFormData({
      name: "",
      city: "",
      address: "",
      phone_number: "",
      contact_person: "",
      assignedVendor: "",
      price_per_item: 25,
      min_items: 4,
    });
    setShowAddDialog(true);
  };

  const handleOpenEdit = (pg: PG) => {
    setEditingPG(pg);
    setFormData({
      name: pg.name,
      city: pg.city,
      address: pg.address,
      phone_number: pg.phone_number,
      contact_person: pg.contact_person || "",
      assignedVendor: pg.assignedVendor || "",
      price_per_item: pg.price_per_item,
      min_items: pg.min_items,
    });
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.city || !formData.address || !formData.phone_number) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);

      if (editingPG) {
        // Update PG
        const response = await apiClient.adminRequest<any>(
          `/pg-management/${editingPG._id}`,
          {
            method: "PATCH",
            body: formData,
          }
        );

        if (response.data) {
          toast.success("PG updated successfully");
          loadPGs();
          setShowAddDialog(false);
        }
      } else {
        // Create new PG
        const response = await apiClient.adminRequest<any>("/pg-management", {
          method: "POST",
          body: formData,
        });

        if (response.data) {
          toast.success("PG created successfully");
          loadPGs();
          setShowAddDialog(false);
        }
      }
    } catch (error) {
      console.error("Error saving PG:", error);
      toast.error("Failed to save PG");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pgId: string) => {
    if (!confirm("Are you sure you want to deactivate this PG?")) {
      return;
    }

    try {
      const response = await apiClient.adminRequest<any>(`/pg-management/${pgId}`, {
        method: "DELETE",
      });

      if (response.data) {
        toast.success("PG deactivated successfully");
        loadPGs();
      }
    } catch (error) {
      console.error("Error deleting PG:", error);
      toast.error("Failed to deactivate PG");
    }
  };

  const handleAssignVendor = async (pgId: string, vendorId: string) => {
    try {
      const vendor = vendors.find((v) => v._id === vendorId);
      if (!vendor) {
        toast.error("Vendor not found");
        return;
      }

      const response = await apiClient.adminRequest<any>(
        `/pg-management/${pgId}/assign-vendor`,
        {
          method: "POST",
          body: { vendorId },
        }
      );

      if (response.data) {
        toast.success("Vendor assigned successfully");
        loadPGs();
      }
    } catch (error) {
      console.error("Error assigning vendor:", error);
      toast.error("Failed to assign vendor");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">PG Management</h2>
          <p className="text-gray-600 mt-1">
            Manage PG locations, vendors, and pricing
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          className="bg-laundrify-purple hover:bg-laundrify-purple/90 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New PG
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search PGs by name, address, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-2 border-laundrify-mint"
              />
            </div>
            <Select value={selectedCity || "all-cities"} onValueChange={(value) => setSelectedCity(value === "all-cities" ? "" : value)}>
              <SelectTrigger className="w-full md:w-48 border-2 border-laundrify-mint">
                <SelectValue placeholder="Filter by city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-cities">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PGs List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin">
            <div className="w-8 h-8 border-4 border-laundrify-mint border-t-laundrify-purple rounded-full"></div>
          </div>
        </div>
      ) : filteredPGs.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No PGs found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPGs.map((pg) => (
            <Card key={pg._id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {pg.name}
                    </h3>
                    <p className="text-sm text-gray-600">{pg.city}</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-laundrify-purple flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{pg.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-laundrify-purple flex-shrink-0" />
                      <span className="text-gray-600">{pg.phone_number}</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 text-sm">
                    <p className="text-gray-700">
                      <span className="font-semibold">₹{pg.price_per_item}</span>
                      {" "}per item | Min {pg.min_items}
                    </p>
                    {pg.assignedVendorName && (
                      <p className="text-gray-600 mt-1">
                        Vendor: {pg.assignedVendorName}
                      </p>
                    )}
                  </div>

                  {!pg.assignedVendor && vendors.length > 0 && (
                    <div className="border-t pt-3">
                      <Select
                        onValueChange={(vendorId) =>
                          handleAssignVendor(pg._id, vendorId)
                        }
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Assign vendor..." />
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
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(pg)}
                      className="flex-1 text-laundrify-blue border-laundrify-purple hover:bg-laundrify-purple/10"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(pg._id)}
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPG ? "Edit PG" : "Add New PG"}
            </DialogTitle>
            <DialogDescription>
              {editingPG
                ? "Update PG details and vendor assignment"
                : "Create a new paying guest (PG) location"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  PG Name *
                </label>
                <Input
                  placeholder="e.g., Paradise Hostel"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="border-2 border-laundrify-mint"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  City *
                </label>
                <Input
                  placeholder="e.g., Delhi"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  className="border-2 border-laundrify-mint"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Address *
              </label>
              <Input
                placeholder="Full address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="border-2 border-laundrify-mint"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Phone Number *
                </label>
                <Input
                  placeholder="Phone"
                  value={formData.phone_number}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone_number: e.target.value,
                    })
                  }
                  className="border-2 border-laundrify-mint"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Contact Person
                </label>
                <Input
                  placeholder="Contact person name"
                  value={formData.contact_person}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contact_person: e.target.value,
                    })
                  }
                  className="border-2 border-laundrify-mint"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Price per Item
                </label>
                <Input
                  type="number"
                  placeholder="25"
                  value={formData.price_per_item}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_per_item: parseInt(e.target.value) || 25,
                    })
                  }
                  className="border-2 border-laundrify-mint"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Minimum Items
                </label>
                <Input
                  type="number"
                  placeholder="4"
                  value={formData.min_items}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_items: parseInt(e.target.value) || 4,
                    })
                  }
                  className="border-2 border-laundrify-mint"
                />
              </div>
            </div>

            {vendors.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Assign Vendor
                </label>
                <Select
                  value={formData.assignedVendor}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assignedVendor: value })
                  }
                >
                  <SelectTrigger className="border-2 border-laundrify-mint">
                    <SelectValue placeholder="Select vendor..." />
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
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={submitting}
              className="bg-laundrify-purple hover:bg-laundrify-purple/90"
            >
              {submitting ? "Saving..." : editingPG ? "Update PG" : "Create PG"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPGManagement;
