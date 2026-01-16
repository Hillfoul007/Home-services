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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  GripVertical,
  ExternalLink,
  Loader,
} from "lucide-react";
import { toast } from "sonner";

interface Banner {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  redirectUrl: string;
  duration: number;
  position: number;
  isActive: boolean;
  clicks: number;
  impressions: number;
  createdAt: string;
}

interface BannerFormData {
  title: string;
  description: string;
  imageUrl: string;
  redirectUrl: string;
  duration: number;
}

const AdminBannerManagement: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);
  const [formData, setFormData] = useState<BannerFormData>({
    title: "",
    description: "",
    imageUrl: "",
    redirectUrl: "",
    duration: 3000,
  });
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Fetch banners
  const fetchBanners = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/banners");
      if (response.ok) {
        const data = await response.json();
        setBanners(data.banners || []);
      }
    } catch (error) {
      console.error("Error fetching banners:", error);
      toast.error("Failed to fetch banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  // Handle form input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "duration") {
      setFormData({
        ...formData,
        [name]: Math.max(1000, parseInt(value) || 1000),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      imageUrl: "",
      redirectUrl: "",
      duration: 3000,
    });
    setEditingBanner(null);
  };

  // Handle create/edit banner
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.redirectUrl) {
      toast.error("Title and Redirect URL are required");
      return;
    }

    try {
      setSubmitting(true);

      const url = editingBanner
        ? `/api/banners/${editingBanner._id}`
        : "/api/banners";
      const method = editingBanner ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          editingBanner ? "Banner updated successfully" : "Banner created successfully"
        );
        setIsDialogOpen(false);
        resetForm();
        fetchBanners();
      } else {
        toast.error("Failed to save banner");
      }
    } catch (error) {
      console.error("Error saving banner:", error);
      toast.error("Error saving banner");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit banner
  const handleEditBanner = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || "",
      imageUrl: banner.imageUrl || "",
      redirectUrl: banner.redirectUrl,
      duration: banner.duration,
    });
    setIsDialogOpen(true);
  };

  // Handle delete banner
  const handleDeleteBanner = (banner: Banner) => {
    setBannerToDelete(banner);
    setIsDeleteAlertOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!bannerToDelete) return;

    try {
      const response = await fetch(`/api/banners/${bannerToDelete._id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Banner deleted successfully");
        setIsDeleteAlertOpen(false);
        setBannerToDelete(null);
        fetchBanners();
      } else {
        toast.error("Failed to delete banner");
      }
    } catch (error) {
      console.error("Error deleting banner:", error);
      toast.error("Error deleting banner");
    }
  };

  // Toggle banner status
  const toggleBannerStatus = async (banner: Banner) => {
    try {
      const response = await fetch(`/api/banners/${banner._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...banner,
          isActive: !banner.isActive,
        }),
      });

      if (response.ok) {
        toast.success(
          banner.isActive ? "Banner disabled" : "Banner enabled"
        );
        fetchBanners();
      }
    } catch (error) {
      console.error("Error toggling banner:", error);
      toast.error("Error updating banner status");
    }
  };

  // Open new banner dialog
  const handleOpenNewBannerDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Banner Management</h2>
          <p className="text-gray-600 mt-1">
            Create and manage banners displayed on your website
          </p>
        </div>
        <Button
          onClick={handleOpenNewBannerDialog}
          className="bg-laundrify-purple hover:bg-laundrify-purple/90 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Banner
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Banners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{banners.length}</div>
            <p className="text-xs text-muted-foreground">
              {banners.filter((b) => b.isActive).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {banners.reduce((sum, b) => sum + b.clicks, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all banners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {banners.reduce((sum, b) => sum + b.impressions, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Times displayed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Banners List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading banners...</span>
          </CardContent>
        </Card>
      ) : banners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ExternalLink className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-600 text-center">No banners yet</p>
            <p className="text-gray-400 text-sm text-center mt-2">
              Create your first banner to get started
            </p>
            <Button
              onClick={handleOpenNewBannerDialog}
              className="mt-6 bg-laundrify-purple hover:bg-laundrify-purple/90 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((banner, index) => (
            <Card
              key={banner._id}
              className={`${
                !banner.isActive ? "opacity-50" : ""
              } hover:shadow-md transition-shadow`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-6">
                  {/* Drag Handle */}
                  <div className="flex-shrink-0 pt-1">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                  </div>

                  {/* Banner Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900 truncate">
                            {banner.title}
                          </h3>
                          {banner.isActive ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800 text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>

                        {banner.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                            {banner.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Duration:</span>
                            <span className="font-medium text-gray-900 ml-2">
                              {(banner.duration / 1000).toFixed(1)}s
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Clicks:</span>
                            <span className="font-medium text-gray-900 ml-2">
                              {banner.clicks}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Impressions:</span>
                            <span className="font-medium text-gray-900 ml-2">
                              {banner.impressions}
                            </span>
                          </div>
                          {banner.impressions > 0 && (
                            <div>
                              <span className="text-gray-500">CTR:</span>
                              <span className="font-medium text-gray-900 ml-2">
                                {(
                                  ((banner.clicks / banner.impressions) * 100).toFixed(2)
                                )}
                                %
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-3">
                          <a
                            href={banner.redirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-laundrify-purple hover:underline flex items-center gap-1 w-fit"
                          >
                            {banner.redirectUrl.replace(/^https?:\/\//, "")}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>

                      {/* Image Preview */}
                      {banner.imageUrl && (
                        <div className="flex-shrink-0">
                          <img
                            src={banner.imageUrl}
                            alt={banner.title}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleBannerStatus(banner)}
                      title={banner.isActive ? "Disable" : "Enable"}
                    >
                      {banner.isActive ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditBanner(banner)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteBanner(banner)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? "Edit Banner" : "Create New Banner"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Banner Title *
              </label>
              <Input
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Instagram Follow Us"
                className="w-full"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Optional description for the banner"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-laundrify-purple focus:border-transparent"
                rows={2}
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <Input
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleInputChange}
                placeholder="https://example.com/image.jpg"
                type="url"
                className="w-full"
              />
              {formData.imageUrl && (
                <div className="mt-2">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="max-h-32 rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Redirect URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Redirect URL *
              </label>
              <Input
                name="redirectUrl"
                value={formData.redirectUrl}
                onChange={handleInputChange}
                placeholder="https://example.com"
                type="url"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Where users will be redirected when clicking the banner
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Duration (seconds)
              </label>
              <Input
                name="duration"
                type="number"
                value={formData.duration / 1000}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration: Math.max(1, parseInt(e.target.value) || 1) * 1000,
                  })
                }
                placeholder="3"
                min="1"
                max="300"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                How long the banner displays before rotating (1-300 seconds)
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-laundrify-purple hover:bg-laundrify-purple/90 text-white"
              >
                {submitting ? "Saving..." : editingBanner ? "Update Banner" : "Create Banner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Banner?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{bannerToDelete?.title}"? This
            action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBannerManagement;
