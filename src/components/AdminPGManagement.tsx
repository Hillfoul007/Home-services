import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  User,
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface PG {
  _id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  contact_person?: string;
  email?: string;
  item_price: number;
  min_items: number;
  services_offered: string[];
  assigned_vendor?: {
    _id: string;
    name: string;
    phone: string;
  };
  is_active: boolean;
  created_at: string;
}

interface PGOrder {
  _id: string;
  order_id: string;
  pg_name: string;
  customer_name: string;
  customer_phone: string;
  number_of_items: number;
  final_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  vendor_details?: {
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
  const [activeTab, setActiveTab] = useState<"pgs" | "orders">("pgs");
  const [pgs, setPGs] = useState<PG[]>([]);
  const [pgOrders, setPGOrders] = useState<PGOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPG, setEditingPG] = useState<PG | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    address: "",
    phone: "",
    contact_person: "",
    email: "",
    item_price: 25,
    min_items: 4,
  });

  useEffect(() => {
    if (activeTab === "pgs") {
      fetchPGs();
    } else {
      fetchPGOrders();
    }
  }, [activeTab]);

  const fetchPGs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<any>("/pg");
      if (response.data.success) {
        setPGs(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching PGs:", error);
      toast.error("Failed to load PGs");
    } finally {
      setLoading(false);
    }
  };

  const fetchPGOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<any>("/pg/orders/all");
      if (response.data.success) {
        setPGOrders(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching PG orders:", error);
      toast.error("Failed to load PG orders");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPG = async () => {
    if (!formData.name || !formData.city || !formData.address || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.adminRequest<any>("/pg", "POST", formData);

      if (response.data.success) {
        toast.success("PG added successfully");
        fetchPGs();
        setShowAddForm(false);
        resetForm();
      } else {
        toast.error(response.data.message || "Failed to add PG");
      }
    } catch (error: any) {
      console.error("Error adding PG:", error);
      toast.error(error.message || "Failed to add PG");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePG = async (pgId: string) => {
    if (!formData.name || !formData.city || !formData.address || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.adminRequest<any>(
        `/pg/${pgId}`,
        "PUT",
        formData
      );

      if (response.data.success) {
        toast.success("PG updated successfully");
        fetchPGs();
        setEditingPG(null);
        resetForm();
      } else {
        toast.error(response.data.message || "Failed to update PG");
      }
    } catch (error: any) {
      console.error("Error updating PG:", error);
      toast.error(error.message || "Failed to update PG");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePG = async (pgId: string, pgName: string) => {
    if (!confirm(`Are you sure you want to delete "${pgName}"?`)) {
      return;
    }

    try {
      const response = await apiClient.adminRequest<any>(
        `/pg/${pgId}`,
        "DELETE"
      );

      if (response.data.success) {
        toast.success("PG deleted successfully");
        fetchPGs();
      } else {
        toast.error(response.data.message || "Failed to delete PG");
      }
    } catch (error: any) {
      console.error("Error deleting PG:", error);
      toast.error(error.message || "Failed to delete PG");
    }
  };

  const handleToggleActive = async (pgId: string, currentStatus: boolean) => {
    try {
      const response = await apiClient.adminRequest<any>(
        `/pg/${pgId}/toggle-active`,
        "PUT"
      );

      if (response.data.success) {
        toast.success(
          response.data.message || "PG status updated"
        );
        fetchPGs();
      }
    } catch (error: any) {
      console.error("Error toggling PG status:", error);
      toast.error("Failed to update PG status");
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await apiClient.adminRequest<any>(
        `/pg/orders/${orderId}/status`,
        "PUT",
        { status: newStatus }
      );

      if (response.data.success) {
        toast.success("Order status updated");
        fetchPGOrders();
      }
    } catch (error: any) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      city: "",
      address: "",
      phone: "",
      contact_person: "",
      email: "",
      item_price: 25,
      min_items: 4,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "created":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
        return "bg-purple-100 text-purple-800";
      case "vendor_assigned":
        return "bg-indigo-100 text-indigo-800";
      case "picked_up":
        return "bg-yellow-100 text-yellow-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pgs">Manage PGs</TabsTrigger>
          <TabsTrigger value="orders">PG Orders</TabsTrigger>
        </TabsList>

        {/* PGs Tab */}
        <TabsContent value="pgs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Paying Guest Locations</h2>
            <Button
              onClick={() => {
                setShowAddForm(!showAddForm);
                resetForm();
                setEditingPG(null);
              }}
              className="bg-laundrify-purple"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add PG
            </Button>
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingPG) && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle>
                  {editingPG ? "Edit PG" : "Add New PG"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="PG Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Full Address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="md:col-span-2"
                  />
                  <Input
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Contact Person"
                    value={formData.contact_person}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_person: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Price per Item (₹)"
                    type="number"
                    value={formData.item_price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        item_price: parseInt(e.target.value) || 25,
                      })
                    }
                  />
                  <Input
                    placeholder="Minimum Items"
                    type="number"
                    value={formData.min_items}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_items: parseInt(e.target.value) || 4,
                      })
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (editingPG) {
                        handleUpdatePG(editingPG._id);
                      } else {
                        handleAddPG();
                      }
                    }}
                    disabled={loading}
                    className="flex-1 bg-laundrify-purple"
                  >
                    {loading ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingPG(null);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PGs List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-laundrify-purple" />
            </div>
          ) : pgs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No PGs added yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pgs.map((pg) => (
                <Card key={pg._id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{pg.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{pg.city}</p>
                      </div>
                      <Badge
                        className={pg.is_active ? "bg-green-500" : "bg-gray-400"}
                      >
                        {pg.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2 text-gray-700">
                        <MapPin className="h-4 w-4" />
                        {pg.address}
                      </p>
                      <p className="flex items-center gap-2 text-gray-700">
                        <Phone className="h-4 w-4" />
                        {pg.phone}
                      </p>
                      {pg.contact_person && (
                        <p className="flex items-center gap-2 text-gray-700">
                          <User className="h-4 w-4" />
                          {pg.contact_person}
                        </p>
                      )}
                    </div>

                    <div className="border-t pt-3">
                      <p className="text-sm text-gray-600 mb-2">
                        ₹{pg.item_price} per item • Min {pg.min_items} items
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {pg.services_offered?.map((service) => (
                          <Badge key={service} variant="secondary" className="text-xs">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {pg.assigned_vendor && (
                      <div className="bg-purple-50 p-2 rounded text-sm">
                        <p className="text-gray-600">
                          <strong>Vendor:</strong> {pg.assigned_vendor.name}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingPG(pg);
                          setFormData({
                            name: pg.name,
                            city: pg.city,
                            address: pg.address,
                            phone: pg.phone,
                            contact_person: pg.contact_person || "",
                            email: pg.email || "",
                            item_price: pg.item_price,
                            min_items: pg.min_items,
                          });
                          setShowAddForm(false);
                        }}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleToggleActive(pg._id, pg.is_active)
                        }
                      >
                        {pg.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeletePG(pg._id, pg.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <h2 className="text-xl font-bold">PG Orders</h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-laundrify-purple" />
            </div>
          ) : pgOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No PG orders yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="bg-gray-50">
                    <th className="text-left p-3">Order ID</th>
                    <th className="text-left p-3">PG</th>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Items</th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pgOrders.map((order) => (
                    <tr key={order._id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-semibold text-laundrify-purple">
                        {order.order_id}
                      </td>
                      <td className="p-3">{order.pg_name}</td>
                      <td className="p-3">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-xs text-gray-600">
                          {order.customer_phone}
                        </p>
                      </td>
                      <td className="p-3">{order.number_of_items}</td>
                      <td className="p-3 font-semibold">₹{order.final_amount}</td>
                      <td className="p-3">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <select
                          onChange={(e) =>
                            handleUpdateOrderStatus(order._id, e.target.value)
                          }
                          defaultValue={order.status}
                          className="text-xs p-1 border rounded"
                        >
                          <option value="created">Created</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="vendor_assigned">Vendor Assigned</option>
                          <option value="picked_up">Picked Up</option>
                          <option value="ready_for_delivery">
                            Ready for Delivery
                          </option>
                          <option value="delivered">Delivered</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPGManagement;
