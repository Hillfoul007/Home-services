import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, MapPin, Phone } from "lucide-react";
import { createSuccessNotification, createErrorNotification } from "@/utils/notificationUtils";

interface PG {
  _id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  status: "active" | "inactive";
  assignedVendor?: {
    _id: string;
    name: string;
    phone: string;
  };
}

interface Vendor {
  _id: string;
  name: string;
  phone: string;
}

const AdminPGManagement: React.FC = () => {
  const [pgs, setPGs] = useState<PG[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPG, setEditingPG] = useState<PG | null>(null);
  const [selectedPGForVendor, setSelectedPGForVendor] = useState<PG | null>(null);
  const [selectedVendor, setSelectedVendor] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    city: "",
    address: "",
    phone: "",
  });

  useEffect(() => {
    fetchPGs();
    fetchVendors();
  }, []);

  const fetchPGs = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/pg-admin/");
      const data = await response.json();

      if (data.success) {
        setPGs(data.pgs);
      }
    } catch (error) {
      console.error("Error fetching PGs:", error);
      createErrorNotification("Error", "Failed to fetch PGs");
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/pg-admin/vendors/list");
      const data = await response.json();

      if (data.success) {
        setVendors(data.vendors);
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const handleAddPG = async () => {
    if (!formData.name || !formData.city || !formData.address || !formData.phone) {
      createErrorNotification("Error", "All fields are required");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/pg-admin/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        createSuccessNotification("Success", "PG added successfully");
        setFormData({ name: "", city: "", address: "", phone: "" });
        setShowAddDialog(false);
        fetchPGs();
      } else {
        createErrorNotification("Error", data.message || "Failed to add PG");
      }
    } catch (error) {
      console.error("Error adding PG:", error);
      createErrorNotification("Error", "Failed to add PG");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePG = async () => {
    if (!editingPG) return;

    if (!formData.name || !formData.city || !formData.address || !formData.phone) {
      createErrorNotification("Error", "All fields are required");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/pg-admin/${editingPG._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        createSuccessNotification("Success", "PG updated successfully");
        setFormData({ name: "", city: "", address: "", phone: "" });
        setEditingPG(null);
        setShowAddDialog(false);
        fetchPGs();
      } else {
        createErrorNotification("Error", data.message || "Failed to update PG");
      }
    } catch (error) {
      console.error("Error updating PG:", error);
      createErrorNotification("Error", "Failed to update PG");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignVendor = async () => {
    if (!selectedPGForVendor || !selectedVendor) {
      createErrorNotification("Error", "Please select both PG and vendor");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/pg-admin/${selectedPGForVendor._id}/assign-vendor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: selectedVendor }),
      });

      const data = await response.json();

      if (data.success) {
        createSuccessNotification("Success", "Vendor assigned successfully");
        setSelectedPGForVendor(null);
        setSelectedVendor("");
        fetchPGs();
      } else {
        createErrorNotification("Error", data.message || "Failed to assign vendor");
      }
    } catch (error) {
      console.error("Error assigning vendor:", error);
      createErrorNotification("Error", "Failed to assign vendor");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (pg: PG) => {
    setEditingPG(pg);
    setFormData({
      name: pg.name,
      city: pg.city,
      address: pg.address,
      phone: pg.phone,
    });
    setShowAddDialog(true);
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setEditingPG(null);
    setFormData({ name: "", city: "", address: "", phone: "" });
  };

  const groupedPGs = pgs.reduce(
    (acc, pg) => {
      if (!acc[pg.city]) {
        acc[pg.city] = [];
      }
      acc[pg.city].push(pg);
      return acc;
    },
    {} as Record<string, PG[]>
  );

  return (
    <div className="space-y-6">
      {/* Add PG Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">PG Management</h2>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => closeDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add New PG
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPG ? "Edit PG" : "Add New PG"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">PG Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Paradise"
                />
              </div>
              <div>
                <label className="text-sm font-medium">City</label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g., Mumbai"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Contact phone"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={editingPG ? handleUpdatePG : handleAddPG}
                  className="flex-1 bg-blue-600"
                  disabled={loading}
                >
                  {loading ? "Processing..." : editingPG ? "Update PG" : "Add PG"}
                </Button>
                <Button onClick={closeDialog} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* PGs by City */}
      <div className="space-y-6">
        {Object.entries(groupedPGs).map(([city, cityPGs]) => (
          <Card key={city}>
            <CardHeader className="bg-gray-50">
              <CardTitle className="text-lg">{city}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {cityPGs.map((pg) => (
                  <div key={pg._id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{pg.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <MapPin className="h-4 w-4" />
                          {pg.address}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <Phone className="h-4 w-4" />
                          {pg.phone}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openEditDialog(pg)}
                          size="sm"
                          variant="outline"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Vendor Assignment */}
                    <div className="bg-blue-50 p-3 rounded-lg mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Assigned Vendor</p>
                      {pg.assignedVendor ? (
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">
                              {pg.assignedVendor.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {pg.assignedVendor.phone}
                            </p>
                          </div>
                          <Badge className="bg-green-600">Assigned</Badge>
                        </div>
                      ) : (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              onClick={() => setSelectedPGForVendor(pg)}
                              size="sm"
                              variant="default"
                            >
                              Assign Vendor
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign Vendor to {pg.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Select Vendor</label>
                                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a vendor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {vendors.map((vendor) => (
                                      <SelectItem key={vendor._id} value={vendor._id}>
                                        {vendor.name} ({vendor.phone})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={handleAssignVendor}
                                  className="flex-1 bg-green-600"
                                  disabled={loading}
                                >
                                  {loading ? "Assigning..." : "Assign Vendor"}
                                </Button>
                                <Button
                                  onClick={() => setSelectedPGForVendor(null)}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pgs.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-gray-500 mb-4">No PGs added yet</p>
            <Button className="bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First PG
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminPGManagement;
