import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Plus, Edit3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';

interface LaundryVendor {
  _id: string;
  vendor_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  services?: string[];
  is_active: boolean;
}

const AdminLaundryVendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<LaundryVendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<LaundryVendor | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ vendor_id: string; temp_password: string; name?: string } | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    password: '',
    services: '',
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<{ vendors: LaundryVendor[] }>('/admin/laundry-vendors');
      if (response.data?.vendors) {
        setVendors(response.data.vendors);
      } else {
        toast.error(response.error || 'Failed to fetch vendors');
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vendor_id: '',
      name: '',
      phone: '',
      email: '',
      address: '',
      password: '',
      services: '',
    });
    setShowPassword(false);
  };

  const handleAddVendor = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }

    try {
      const response = await apiClient.adminRequest('/admin/laundry-vendors', {
        method: 'POST',
        body: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          address: formData.address || undefined,
          services: formData.services.split(',').map(s => s.trim()).filter(s => s),
        },
      });

      if (response.data?.vendor) {
        const vendor = response.data.vendor;
        toast.success(`Vendor created!`);
        setVendors([vendor as LaundryVendor, ...vendors]);
        setIsAddDialogOpen(false);
        resetForm();
        // Show generated credentials modal
        setGeneratedCredentials({
          vendor_id: vendor.vendor_id,
          temp_password: vendor.temp_password,
        });
      } else {
        toast.error(response.error || 'Failed to add vendor');
      }
    } catch (error) {
      console.error('Error adding vendor:', error);
      toast.error('Error adding vendor');
    }
  };

  const handleUpdateVendor = async () => {
    if (!editingVendor) return;
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }

    try {
      const updateBody: any = {
        vendor_id: formData.vendor_id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
        services: formData.services.split(',').map(s => s.trim()).filter(s => s),
      };

      if (formData.password) {
        updateBody.password = formData.password;
      }

      const response = await apiClient.adminRequest(`/admin/laundry-vendors/${editingVendor._id}`, {
        method: 'PUT',
        body: updateBody,
      });

      if (response.data?.vendor) {
        setVendors(vendors.map(v => v._id === editingVendor._id ? response.data.vendor as LaundryVendor : v));
        toast.success('Vendor updated successfully');
        setIsEditDialogOpen(false);
        setEditingVendor(null);
        resetForm();
      } else {
        toast.error(response.error || 'Failed to update vendor');
      }
    } catch (error) {
      console.error('Error updating vendor:', error);
      toast.error('Error updating vendor');
    }
  };

  const handleGenerateCredentials = async (vendor: LaundryVendor) => {
    try {
      setCredentialsLoading(true);
      const response = await apiClient.adminRequest(`/admin/laundry-vendors/${vendor._id}/generate-credentials`, {
        method: 'POST',
      });

      if (response.data?.credentials) {
        setGeneratedCredentials(response.data.credentials);
        toast.success('New credentials generated!');
      } else {
        toast.error(response.error || 'Failed to generate credentials');
      }
    } catch (error) {
      console.error('Error generating credentials:', error);
      toast.error('Error generating credentials');
    } finally {
      setCredentialsLoading(false);
    }
  };

  const openEditDialog = (vendor: LaundryVendor) => {
    setEditingVendor(vendor);
    setFormData({
      vendor_id: vendor.vendor_id,
      name: vendor.name,
      phone: vendor.phone,
      email: vendor.email || '',
      address: vendor.address || '',
      password: '',
      services: vendor.services?.join(', ') || '',
    });
    setShowPassword(false);
    setIsEditDialogOpen(true);
  };

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.vendor_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-gray-600">Loading vendors...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vendor Management</CardTitle>
              <CardDescription>Create and manage laundry vendor portal access</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Vendor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Vendor Account</DialogTitle>
                  <DialogDescription>Add new laundry vendor with auto-generated credentials</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="add-name">Vendor Name *</Label>
                    <Input
                      id="add-name"
                      placeholder="e.g., Local Dry Cleaners"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-phone">Phone *</Label>
                    <Input
                      id="add-phone"
                      placeholder="+91 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-email">Email</Label>
                    <Input
                      id="add-email"
                      type="email"
                      placeholder="vendor@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-address">Address</Label>
                    <Input
                      id="add-address"
                      placeholder="Shop address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-services">Services</Label>
                    <Input
                      id="add-services"
                      placeholder="Dry Cleaning, Laundry, Ironing"
                      value={formData.services}
                      onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddVendor} className="flex-1">Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, ID, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Vendors List */}
      <div className="space-y-3">
        {filteredVendors.length > 0 ? (
          filteredVendors.map((vendor) => (
            <Card key={vendor._id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {/* Vendor Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-base">{vendor.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{vendor.vendor_id}</code>
                        <Badge variant="secondary" className="text-xs">
                          {vendor.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateCredentials(vendor)}
                        disabled={credentialsLoading}
                        className="gap-1"
                      >
                        {credentialsLoading ? '...' : '🔑'} Credentials
                      </Button>
                      <Dialog open={isEditDialogOpen && editingVendor?._id === vendor._id} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(vendor)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Edit Vendor</DialogTitle>
                          </DialogHeader>
                          {editingVendor && (
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="edit-vendor-id">Vendor ID</Label>
                                <Input
                                  id="edit-vendor-id"
                                  value={formData.vendor_id}
                                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                  placeholder="V123456ABC"
                                />
                                <p className="text-xs text-gray-500 mt-1">Vendor uses this to login</p>
                              </div>
                              <div>
                                <Label htmlFor="edit-password">Password</Label>
                                <div className="relative">
                                  <Input
                                    id="edit-password"
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Leave blank to keep current password"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm"
                                  >
                                    {showPassword ? "Hide" : "Show"}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Set new password or leave blank</p>
                              </div>
                              <div>
                                <Label htmlFor="edit-name">Name *</Label>
                                <Input
                                  id="edit-name"
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-phone">Phone *</Label>
                                <Input
                                  id="edit-phone"
                                  value={formData.phone}
                                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                  id="edit-email"
                                  type="email"
                                  value={formData.email}
                                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-address">Address</Label>
                                <Input
                                  id="edit-address"
                                  value={formData.address}
                                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-services">Services</Label>
                                <Input
                                  id="edit-services"
                                  value={formData.services}
                                  onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                                />
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleUpdateVendor} className="flex-1">Save</Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Vendor Details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Phone</span>
                      <p className="font-medium">{vendor.phone}</p>
                    </div>
                    {vendor.email && (
                      <div>
                        <span className="text-gray-600">Email</span>
                        <p className="font-medium text-sm">{vendor.email}</p>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Address</span>
                        <p className="font-medium text-sm">{vendor.address}</p>
                      </div>
                    )}
                    {vendor.services && vendor.services.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Services</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {vendor.services.map((service, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-600">No vendors found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Credentials Display Modal */}
      <Dialog open={!!generatedCredentials} onOpenChange={(open) => !open && setGeneratedCredentials(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔑 {generatedCredentials?.name || 'Vendor'} Credentials</DialogTitle>
            <DialogDescription>Share these credentials with the vendor for portal access</DialogDescription>
          </DialogHeader>
          {generatedCredentials && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Vendor ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-200 font-mono text-sm">
                      {generatedCredentials.vendor_id}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials.vendor_id);
                        toast.success('Vendor ID copied!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-200 font-mono text-sm">
                      {generatedCredentials.temp_password}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials.temp_password);
                        toast.success('Password copied!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-2">
                ⚠️ Save these credentials securely. The password will not be shown again.
              </p>
              <Button onClick={() => setGeneratedCredentials(null)} className="w-full">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLaundryVendorManagement;
