import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Plus, Edit3, Trash2, Eye, EyeOff, Copy, RotateCcw } from 'lucide-react';
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
  created_at?: string;
  assigned_orders_count?: number;
}

interface CreateVendorResponse {
  success: boolean;
  vendor?: {
    _id: string;
    vendor_id: string;
    name: string;
    phone: string;
    email?: string;
    temp_password?: string;
  };
  error?: string;
}

const AdminLaundryVendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<LaundryVendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<LaundryVendor | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState<string | null>(null);
  const [passwordResetDialog, setPasswordResetDialog] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
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
        console.log(`✅ Loaded ${response.data.vendors.length} laundry vendors`);
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
        toast.success(`Vendor created! Vendor ID: ${response.data.vendor.vendor_id}, Password: ${response.data.vendor.temp_password}`);
        setVendors([response.data.vendor as LaundryVendor, ...vendors]);
        setIsAddDialogOpen(false);
        resetForm();
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
      const response = await apiClient.adminRequest(`/admin/laundry-vendors/${editingVendor._id}`, {
        method: 'PUT',
        body: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          address: formData.address || undefined,
          services: formData.services.split(',').map(s => s.trim()).filter(s => s),
        },
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

  const handleResetPassword = async () => {
    if (!passwordResetDialog || !newPassword) {
      toast.error('Password is required');
      return;
    }

    try {
      const response = await apiClient.adminRequest(`/admin/laundry-vendors/${passwordResetDialog}/password`, {
        method: 'PUT',
        body: { new_password: newPassword },
      });

      if (response.data?.success) {
        toast.success('Password updated successfully');
        setPasswordResetDialog(null);
        setNewPassword('');
      } else {
        toast.error(response.error || 'Failed to update password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Error resetting password');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      services: '',
    });
  };

  const openEditDialog = (vendor: LaundryVendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      phone: vendor.phone,
      email: vendor.email || '',
      address: vendor.address || '',
      services: vendor.services?.join(', ') || '',
    });
    setIsEditDialogOpen(true);
  };

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.vendor_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.phone.includes(searchTerm)
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-gray-600">Loading laundry vendors...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Laundry Vendor Management</CardTitle>
              <CardDescription>Manage vendor portal credentials and assignments</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Vendor Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Vendor Account</DialogTitle>
                  <DialogDescription>Create a new laundry vendor account with auto-generated credentials</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vendor-name">Vendor Name *</Label>
                    <Input
                      id="vendor-name"
                      placeholder="e.g., Priya Dry Cleaners"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendor-phone">Phone Number *</Label>
                    <Input
                      id="vendor-phone"
                      placeholder="+91 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendor-email">Email</Label>
                    <Input
                      id="vendor-email"
                      type="email"
                      placeholder="vendor@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendor-address">Address</Label>
                    <Input
                      id="vendor-address"
                      placeholder="Shop address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendor-services">Services (comma-separated)</Label>
                    <Input
                      id="vendor-services"
                      placeholder="e.g., Dry Cleaning, Laundry, Ironing"
                      value={formData.services}
                      onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddVendor}>Create Vendor</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search by name, vendor ID, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {filteredVendors.length > 0 ? (
          filteredVendors.map((vendor) => (
            <Card key={vendor._id} className="transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <h3 className="font-semibold text-lg">{vendor.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={vendor.is_active ? 'default' : 'secondary'}>
                          {vendor.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{vendor.vendor_id}</code>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <p className="font-medium">{vendor.phone}</p>
                    </div>
                    {vendor.email && (
                      <div>
                        <span className="text-gray-600">Email:</span>
                        <p className="font-medium">{vendor.email}</p>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Address:</span>
                        <p className="font-medium text-sm">{vendor.address}</p>
                      </div>
                    )}
                    {vendor.services && vendor.services.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Services:</span>
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

                  <div className="flex gap-2 flex-wrap">
                    <Dialog open={isEditDialogOpen && editingVendor?._id === vendor._id} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(vendor)} className="gap-2">
                          <Edit3 className="h-4 w-4" />
                          Edit Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Vendor</DialogTitle>
                        </DialogHeader>
                        {editingVendor && (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="edit-vendor-name">Vendor Name *</Label>
                              <Input
                                id="edit-vendor-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-vendor-phone">Phone *</Label>
                              <Input
                                id="edit-vendor-phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-vendor-email">Email</Label>
                              <Input
                                id="edit-vendor-email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-vendor-address">Address</Label>
                              <Input
                                id="edit-vendor-address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-vendor-services">Services</Label>
                              <Input
                                id="edit-vendor-services"
                                value={formData.services}
                                onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleUpdateVendor}>Update</Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Dialog open={passwordResetDialog === vendor._id} onOpenChange={(open) => {
                      if (!open) {
                        setPasswordResetDialog(null);
                        setNewPassword('');
                        setShowNewPassword(false);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setPasswordResetDialog(vendor._id)} className="gap-2">
                          <RotateCcw className="h-4 w-4" />
                          Reset Password
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Reset Password</DialogTitle>
                          <DialogDescription>Set a new password for {vendor.name}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="new-password">New Password</Label>
                            <div className="flex gap-2">
                              <Input
                                id="new-password"
                                type={showNewPassword ? 'text' : 'password'}
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                              >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setPasswordResetDialog(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleResetPassword}>Reset Password</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-gray-600">No vendors found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminLaundryVendorManagement;
