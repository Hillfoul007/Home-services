import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Plus, Edit3, Trash2, Phone, MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';

interface RiderDetails {
  _id?: string;
  name: string;
  phone: string;
  live_location_link?: string;
  isActive: boolean;
  rating?: number;
  completedOrders?: number;
}

interface FormData {
  name: string;
  phone: string;
  live_location_link: string;
}

const AdminRiderManagement: React.FC = () => {
  const [riders, setRiders] = useState<RiderDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRider, setEditingRider] = useState<RiderDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    live_location_link: '',
  });

  useEffect(() => {
    fetchRiders();
  }, []);

  const fetchRiders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<{ riders: RiderDetails[] }>('/admin/riders');
      if (response.data?.riders) {
        setRiders(response.data.riders);
      } else {
        setRiders([]);
      }
    } catch (error) {
      console.error('Error fetching riders:', error);
      toast.error('Failed to fetch riders');
      setRiders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRider = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const newRider: RiderDetails = {
        name: formData.name,
        phone: formData.phone,
        live_location_link: formData.live_location_link || undefined,
        isActive: true,
      };

      const response = await apiClient.adminRequest('/admin/riders', {
        method: 'POST',
        body: newRider,
      });

      if (response.data) {
        setRiders([...riders, response.data.rider]);
        toast.success('Rider added successfully');
        setIsAddDialogOpen(false);
        resetForm();
      } else {
        toast.error(response.error || 'Failed to add rider');
      }
    } catch (error) {
      console.error('Error adding rider:', error);
      toast.error('Error adding rider');
    }
  };

  const handleUpdateRider = async () => {
    if (!editingRider || !formData.name || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    const riderId = editingRider._id;
    if (!riderId) {
      toast.error('Rider ID is missing');
      return;
    }

    try {
      const updatedRider: RiderDetails = {
        ...editingRider,
        name: formData.name,
        phone: formData.phone,
        live_location_link: formData.live_location_link || undefined,
      };

      const response = await apiClient.adminRequest(`/admin/riders/${riderId}`, {
        method: 'PUT',
        body: updatedRider,
      });

      if (response.data) {
        setRiders(riders.map((r) => (r._id === riderId ? response.data.rider : r)));
        toast.success('Rider updated successfully');
        setIsEditDialogOpen(false);
        setEditingRider(null);
        resetForm();
      } else {
        toast.error(response.error || 'Failed to update rider');
      }
    } catch (error) {
      console.error('Error updating rider:', error);
      toast.error('Error updating rider');
    }
  };

  const handleDeleteRider = async (riderId: string) => {
    if (!confirm('Are you sure you want to delete this rider?')) {
      return;
    }

    try {
      const response = await apiClient.adminRequest(`/admin/riders/${riderId}`, {
        method: 'DELETE',
      });

      if (response.data || response.data === null) {
        setRiders(riders.filter((r) => r._id !== riderId));
        toast.success('Rider deleted successfully');
      } else {
        toast.error(response.error || 'Failed to delete rider');
      }
    } catch (error) {
      console.error('Error deleting rider:', error);
      toast.error('Error deleting rider');
    }
  };

  const openEditDialog = (rider: RiderDetails) => {
    setEditingRider(rider);
    setFormData({
      name: rider.name,
      phone: rider.phone,
      live_location_link: rider.live_location_link || '',
    });
    setIsEditDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setEditingRider(null);
    setIsAddDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      live_location_link: '',
    });
  };

  const filteredRiders = riders.filter(
    (rider) =>
      rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-600">Loading riders...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Rider Management</CardTitle>
            <CardDescription>Add and manage delivery riders</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Rider
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Rider</DialogTitle>
                <DialogDescription>Add a new delivery rider to the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Rider Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    placeholder="e.g., +91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="location">Live Location Link</Label>
                  <Input
                    id="location"
                    placeholder="e.g., https://maps.google.com/..."
                    value={formData.live_location_link}
                    onChange={(e) => setFormData({ ...formData, live_location_link: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Link to live location for tracking rider</p>
                </div>
                <Button onClick={handleAddRider} className="w-full">
                  Add Rider
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          <div className="mb-4">
            <Label htmlFor="search">Search Riders</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <Input
                id="search"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredRiders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No riders found
              </div>
            ) : (
              filteredRiders.map((rider) => (
                <div key={rider._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold text-sm">{rider.name}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Phone className="h-3 w-3" />
                            {rider.phone}
                          </div>
                          {rider.live_location_link && (
                            <a 
                              href={rider.live_location_link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <MapPin className="h-3 w-3" />
                              Live Location
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant={rider.isActive ? 'secondary' : 'destructive'}>
                      {rider.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Dialog open={isEditDialogOpen && editingRider?._id === rider._id} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openEditDialog(rider)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      {editingRider?._id === rider._id && (
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Rider</DialogTitle>
                            <DialogDescription>Update rider information</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="edit-name">Rider Name *</Label>
                              <Input
                                id="edit-name"
                                placeholder="e.g., John Doe"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-phone">Phone Number *</Label>
                              <Input
                                id="edit-phone"
                                placeholder="e.g., +91 9876543210"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-location">Live Location Link</Label>
                              <Input
                                id="edit-location"
                                placeholder="e.g., https://maps.google.com/..."
                                value={formData.live_location_link}
                                onChange={(e) => setFormData({ ...formData, live_location_link: e.target.value })}
                              />
                            </div>
                            <Button onClick={handleUpdateRider} className="w-full">
                              Update Rider
                            </Button>
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => rider._id && handleDeleteRider(rider._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRiderManagement;
