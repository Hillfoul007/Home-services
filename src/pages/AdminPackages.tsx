import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Plus, Edit2, Package, Check, X, Calendar } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";

interface PackageType {
  _id: string;
  name: string;
  description: string;
  price: number;
  wallet_amount: number;
  validity_days: number;
  is_active: boolean;
  created_at: string;
}

const AdminPackages: React.FC = () => {
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    wallet_amount: "",
    validity_days: "30",
    is_active: true,
  });

  const fetchPackages = async () => {
    try {
      setIsLoading(true);
      const response: any = await adminApi.getPackages();
      if (response.data?.success) {
        setPackages(response.data.packages);
      } else {
        toast.error("Failed to load packages");
      }
    } catch (error) {
      console.error("Error fetching packages:", error);
      toast.error("Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      wallet_amount: "",
      validity_days: "30",
      is_active: true,
    });
  };

  const handleEdit = (pkg: PackageType) => {
    setEditingId(pkg._id);
    setFormData({
      name: pkg.name,
      description: pkg.description,
      price: pkg.price.toString(),
      wallet_amount: pkg.wallet_amount.toString(),
      validity_days: pkg.validity_days.toString(),
      is_active: pkg.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price || !formData.wallet_amount || !formData.validity_days) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        wallet_amount: Number(formData.wallet_amount),
        validity_days: Number(formData.validity_days),
        is_active: formData.is_active,
      };

      if (editingId) {
        const response: any = await adminApi.updatePackage(editingId, payload);
        if (response.data?.success) {
          toast.success("Package updated successfully");
          fetchPackages();
          setIsDialogOpen(false);
          resetForm();
        } else {
          toast.error(response.data?.error || response.error || "Failed to update package");
        }
      } else {
        const response: any = await adminApi.createPackage(payload);
        if (response.data?.success) {
          toast.success("Package created successfully");
          fetchPackages();
          setIsDialogOpen(false);
          resetForm();
        } else {
          toast.error(response.data?.error || response.error || "Failed to create package");
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (pkg: PackageType) => {
    try {
      const payload = { is_active: !pkg.is_active };
      const response: any = await adminApi.updatePackage(pkg._id, payload);
      if (response.data?.success) {
        toast.success(`Package marked as ${payload.is_active ? 'Active' : 'Inactive'}`);
        fetchPackages();
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subscription Packages</h2>
          <p className="text-muted-foreground">
            Manage packages that customers can purchase to get wallet credits.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Add Package
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Package" : "Create New Package"}</DialogTitle>
              <DialogDescription>
                Define a new subscription package for your customers.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Package Name *</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. 30 Days Laundry Supreme" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  placeholder="Quick details about what this includes" 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹) *</Label>
                  <Input 
                    id="price" 
                    type="number"
                    min="0"
                    placeholder="Cost to customer" 
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet_amount">Wallet Credit (₹) *</Label>
                  <Input 
                    id="wallet_amount" 
                    type="number"
                    min="0"
                    placeholder="Amount to give" 
                    value={formData.wallet_amount}
                    onChange={(e) => setFormData({...formData, wallet_amount: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="validity_days">Validity (Days) *</Label>
                <Input 
                  id="validity_days" 
                  type="number"
                  min="1"
                  placeholder="e.g. 30" 
                  value={formData.validity_days}
                  onChange={(e) => setFormData({...formData, validity_days: e.target.value})}
                  required
                />
                <p className="text-xs text-muted-foreground">The wallet amount will expire after these many days.</p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="checkbox" 
                  id="is_active" 
                  className="rounded border-gray-300"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                />
                <Label htmlFor="is_active" className="cursor-pointer">Active (Customers can buy this)</Label>
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? "Saving..." : editingId ? "Update Package" : "Create Package"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No packages</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new package.</p>
          <div className="mt-6">
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> New Package
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card key={pkg._id} className={`overflow-hidden transition-all ${!pkg.is_active ? 'opacity-70' : ''}`}>
              <div className={`h-2 ${pkg.is_active ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{pkg.name}</CardTitle>
                    {pkg.description && (
                      <CardDescription className="mt-2 line-clamp-2 min-h-10">
                        {pkg.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 border-t border-b border-gray-100 py-4 my-2">
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <span className="text-gray-500 block mb-1">Price</span>
                    <span className="font-bold text-lg text-gray-900">₹{pkg.price}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Wallet Credit</span>
                    <span className="font-bold text-lg text-green-600">₹{pkg.wallet_amount}</span>
                  </div>
                  <div className="col-span-2 mt-2 flex items-center bg-blue-50 text-blue-700 p-2 rounded-md">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span className="font-medium">Valid for {pkg.validity_days} days</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-3 pb-4 flex justify-between">
                <Button 
                  variant={pkg.is_active ? "outline" : "secondary"} 
                  size="sm"
                  onClick={() => toggleStatus(pkg)}
                  className={pkg.is_active ? "text-red-600 hover:text-red-700 hover:bg-red-50" : ""}
                >
                  {pkg.is_active ? (
                    <><X className="mr-1 h-4 w-4" /> Deactivate</>
                  ) : (
                    <><Check className="mr-1 h-4 w-4" /> Activate</>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(pkg)}
                >
                  <Edit2 className="mr-1 h-4 w-4" /> Edit
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPackages;
