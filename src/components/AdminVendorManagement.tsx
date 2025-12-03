import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Edit3, Trash2, MapPin, Phone, Star } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';

interface VendorDetails {
  id?: string;
  _id?: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  services: string[];
  contactPhone?: string;
  rating?: number;
  whatsapp_group_invite_link?: string;
  isActive: boolean;
}

// Helper to get vendor ID (handle both id and _id from database)
const getVendorId = (vendor: VendorDetails): string => {
  return vendor.id || (vendor._id as string) || '';
};

interface FormData {
  name: string;
  address: string;
  contactPhone: string;
  lat: string;
  lng: string;
  services: string;
  rating: string;
  whatsapp_group_invite_link: string;
}

const AVAILABLE_SERVICES = [
  'Dry Cleaning',
  'Laundry',
  'Ironing',
  'Stain Removal',
  'Premium Care',
  'Express Service',
  'Alterations',
  'Garment Repair'
];

const AdminVendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<VendorDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ vendor_id: string; temp_password: string; name?: string } | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    contactPhone: '',
    lat: '',
    lng: '',
    services: '',
    rating: '4.5',
    whatsapp_group_invite_link: '',
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<{ vendors: VendorDetails[] }>('/admin/vendors');
      if (response.data?.vendors) {
        // Normalize vendors to have both id and _id for compatibility
        const normalizedVendors = response.data.vendors.map((v: any) => ({
          ...v,
          id: v.id || v._id,
          _id: v._id || v.id,
        }));
        setVendors(normalizedVendors);
      } else {
        // Fallback: use local vendor data if API doesn't return anything
        setVendors([
          {
            id: 'vendor1',
            name: 'Priya Dry Cleaners',
            address: 'Shop n.155, Spaze corporate park, 1sf, Sector 69, Gurugram, Haryana 122101',
            coordinates: { lat: 28.3984, lng: 77.0648 },
            services: ['Dry Cleaning', 'Laundry', 'Ironing', 'Stain Removal'],
            contactPhone: '+91 9876543210',
            rating: 4.5,
            isActive: true,
          },
          {
            id: 'vendor2',
            name: 'White Tiger Dry Cleaning',
            address: 'Shop No. 153, First Floor, Spaze Corporate Park, Sector 69, Gurugram, Haryana 122101',
            coordinates: { lat: 28.3982, lng: 77.0650 },
            services: ['Dry Cleaning', 'Premium Care', 'Express Service', 'Alterations'],
            contactPhone: '+91 9876543211',
            rating: 4.3,
            isActive: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to fetch vendors');
      // Set default vendors on error
      setVendors([
        {
          id: 'vendor1',
          name: 'Priya Dry Cleaners',
          address: 'Shop n.155, Spaze corporate park, 1sf, Sector 69, Gurugram, Haryana 122101',
          coordinates: { lat: 28.3984, lng: 77.0648 },
          services: ['Dry Cleaning', 'Laundry', 'Ironing', 'Stain Removal'],
          contactPhone: '+91 9876543210',
          rating: 4.5,
          isActive: true,
        },
        {
          id: 'vendor2',
          name: 'White Tiger Dry Cleaning',
          address: 'Shop No. 153, First Floor, Spaze Corporate Park, Sector 69, Gurugram, Haryana 122101',
          coordinates: { lat: 28.3982, lng: 77.0650 },
          services: ['Dry Cleaning', 'Premium Care', 'Express Service', 'Alterations'],
          contactPhone: '+91 9876543211',
          rating: 4.3,
          isActive: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVendor = async () => {
    if (!formData.name || !formData.address || !formData.lat || !formData.lng) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const newVendor: VendorDetails = {
        id: `vendor_${Date.now()}`,
        name: formData.name,
        address: formData.address,
        contactPhone: formData.contactPhone,
        coordinates: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        },
        services: formData.services
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s),
        rating: parseFloat(formData.rating),
        whatsapp_group_invite_link: formData.whatsapp_group_invite_link,
        isActive: true,
      };

      const response = await apiClient.adminRequest('/admin/vendors', {
        method: 'POST',
        body: newVendor,
      });

      if (response.data) {
        setVendors([...vendors, newVendor]);
        toast.success('Vendor added successfully');
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
    if (!editingVendor || !formData.name || !formData.address || !formData.lat || !formData.lng) {
      toast.error('Please fill in all required fields');
      return;
    }

    const vendorId = getVendorId(editingVendor);
    if (!vendorId) {
      toast.error('Vendor ID is missing');
      return;
    }

    try {
      const updatedVendor: VendorDetails = {
        ...editingVendor,
        name: formData.name,
        address: formData.address,
        contactPhone: formData.contactPhone,
        coordinates: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        },
        services: formData.services
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s),
        rating: parseFloat(formData.rating),
      };

      const response = await apiClient.adminRequest(`/admin/vendors/${vendorId}`, {
        method: 'PUT',
        body: updatedVendor,
      });

      if (response.data) {
        setVendors(vendors.map((v) => (getVendorId(v) === vendorId ? updatedVendor : v)));
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

  const handleDeleteVendor = async (vendor: VendorDetails) => {
    const vendorId = getVendorId(vendor);
    if (!vendorId) {
      toast.error('Vendor ID is missing');
      return;
    }

    if (!confirm('Are you sure you want to delete this vendor?')) {
      return;
    }

    try {
      const response = await apiClient.adminRequest(`/admin/vendors/${vendorId}`, {
        method: 'DELETE',
      });

      if (response.data) {
        setVendors(vendors.filter((v) => getVendorId(v) !== vendorId));
        toast.success('Vendor deleted successfully');
      } else {
        toast.error(response.error || 'Failed to delete vendor');
      }
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast.error('Error deleting vendor');
    }
  };

  const handleGenerateCredentials = async (vendor: VendorDetails) => {
    try {
      setCredentialsLoading(true);
      const vendorId = getVendorId(vendor);
      const response = await apiClient.adminRequest(`/admin/vendors/${vendorId}/generate-credentials`, {
        method: 'POST',
      });

      if (response.data?.credentials) {
        setGeneratedCredentials(response.data.credentials);
        const message = response.data.message
          ? 'Existing credentials retrieved'
          : 'New credentials generated!';
        toast.success(message);
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

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      contactPhone: '',
      lat: '',
      lng: '',
      services: '',
      rating: '4.5',
    });
  };

  const openEditDialog = (vendor: VendorDetails) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      address: vendor.address,
      contactPhone: vendor.contactPhone || '',
      lat: vendor.coordinates.lat.toString(),
      lng: vendor.coordinates.lng.toString(),
      services: vendor.services.join(', '),
      rating: (vendor.rating || 4.5).toString(),
    });
    setIsEditDialogOpen(true);
  };

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.address.toLowerCase().includes(searchTerm.toLowerCase())
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vendor Management</CardTitle>
              <CardDescription>Manage all vendors and their services</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Vendor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Vendor</DialogTitle>
                  <DialogDescription>Enter the vendor details below</DialogDescription>
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
                    <Label htmlFor="vendor-address">Address *</Label>
                    <Textarea
                      id="vendor-address"
                      placeholder="Enter full address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vendor-phone">Contact Phone</Label>
                      <Input
                        id="vendor-phone"
                        placeholder="+91 9876543210"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="vendor-rating">Rating</Label>
                      <Input
                        id="vendor-rating"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={formData.rating}
                        onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vendor-lat">Latitude *</Label>
                      <Input
                        id="vendor-lat"
                        type="number"
                        step="0.0001"
                        placeholder="28.3984"
                        value={formData.lat}
                        onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="vendor-lng">Longitude *</Label>
                      <Input
                        id="vendor-lng"
                        type="number"
                        step="0.0001"
                        placeholder="77.0648"
                        value={formData.lng}
                        onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                      />
                    </div>
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
                    <Button onClick={handleAddVendor}>Add Vendor</Button>
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
              placeholder="Search vendors by name or address..."
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
            <Card key={vendor.id} className="transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">{vendor.name}</h3>
                    <Badge variant={vendor.isActive ? 'default' : 'secondary'}>
                      {vendor.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-700">{vendor.address}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {vendor.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{vendor.contactPhone}</span>
                      </div>
                    )}
                    {vendor.rating && (
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">{vendor.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">Services</div>
                    <div className="flex flex-wrap gap-1">
                      {vendor.services.map((service, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateCredentials(vendor)}
                      disabled={credentialsLoading}
                      className="gap-2"
                    >
                      {credentialsLoading ? '...' : '🔑'} Credentials
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(vendor)}
                      className="gap-2"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteVendor(vendor)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
            <DialogDescription>Update the vendor details</DialogDescription>
          </DialogHeader>
          {editingVendor && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-vendor-name">Vendor Name *</Label>
                <Input
                  id="edit-vendor-name"
                  placeholder="e.g., Priya Dry Cleaners"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-vendor-address">Address *</Label>
                <Textarea
                  id="edit-vendor-address"
                  placeholder="Enter full address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-vendor-phone">Contact Phone</Label>
                  <Input
                    id="edit-vendor-phone"
                    placeholder="+91 9876543210"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-vendor-rating">Rating</Label>
                  <Input
                    id="edit-vendor-rating"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-vendor-lat">Latitude *</Label>
                  <Input
                    id="edit-vendor-lat"
                    type="number"
                    step="0.0001"
                    placeholder="28.3984"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-vendor-lng">Longitude *</Label>
                  <Input
                    id="edit-vendor-lng"
                    type="number"
                    step="0.0001"
                    placeholder="77.0648"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-vendor-services">Services (comma-separated)</Label>
                <Input
                  id="edit-vendor-services"
                  placeholder="e.g., Dry Cleaning, Laundry, Ironing"
                  value={formData.services}
                  onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateVendor}>Update Vendor</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credentials Display Dialog */}
      <Dialog open={!!generatedCredentials} onOpenChange={(open) => !open && setGeneratedCredentials(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔐 {generatedCredentials?.name || 'Vendor'} Login Credentials</DialogTitle>
            <DialogDescription>These are the permanent login credentials for this vendor</DialogDescription>
          </DialogHeader>
          {generatedCredentials && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Vendor ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-white border rounded px-3 py-2 font-mono text-sm break-all">
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
                    <code className="flex-1 bg-white border rounded px-3 py-2 font-mono text-sm break-all">
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900">
                  <strong>✓ Important:</strong> Share these credentials securely with the vendor. They can use the Vendor ID and password to login to their vendor portal. These credentials are saved and will not change unless regenerated.
                </p>
              </div>
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

export default AdminVendorManagement;
