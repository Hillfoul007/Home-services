import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Settings,
  Upload,
} from "lucide-react";
import DynamicServicesService from "@/services/dynamicServicesService";
import type {
  DynamicServiceCategory,
  DynamicLaundryService,
} from "@/services/dynamicServicesService";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  createSuccessNotification,
  createErrorNotification,
  createWarningNotification,
} from "@/utils/notificationUtils";

interface AdminServicesManagerProps {
  onClose: () => void;
}

const AdminServicesManager: React.FC<AdminServicesManagerProps> = ({
  onClose,
}) => {
  const { addNotification } = useNotifications();
  const [services, setServices] = useState<DynamicServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingService, setEditingService] =
    useState<DynamicLaundryService | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const dynamicServicesService = DynamicServicesService.getInstance();

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setIsLoading(true);
      const loadedServices = await dynamicServicesService.getServices();
      setServices(loadedServices);
      setLastUpdate(new Date().toLocaleString());
    } catch (error) {
      console.error("Failed to load services:", error);
      addNotification(
        createErrorNotification(
          "Failed to Load Services",
          "Could not load services from the backend.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const refreshServices = async () => {
    try {
      setIsRefreshing(true);
      const refreshedServices = await dynamicServicesService.refreshServices();
      setServices(refreshedServices);
      setLastUpdate(new Date().toLocaleString());
      addNotification(
        createSuccessNotification(
          "Services Refreshed",
          "Services have been updated.",
        ),
      );
    } catch (error) {
      console.error("Failed to refresh services:", error);
      addNotification(
        createErrorNotification(
          "Refresh Failed",
          "Could not refresh services.",
        ),
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEditService = (service: DynamicLaundryService) => {
    setEditingService({ ...service });
  };

  const handleSaveService = async () => {
    if (!editingService) return;

    try {
      const success = await dynamicServicesService.updateService(
        editingService.id,
        editingService,
      );

      if (success) {
        await loadServices();
        setEditingService(null);
        addNotification(
          createSuccessNotification(
            "Service Updated",
            "Service has been updated successfully.",
          ),
        );
      } else {
        addNotification(
          createWarningNotification(
            "Update Pending",
            "Service update request sent.",
          ),
        );
      }
    } catch (error) {
      console.error("Failed to update service:", error);
      addNotification(
        createErrorNotification(
          "Update Failed",
          "Could not update the service.",
        ),
      );
    }
  };

  const handleCancelEdit = () => {
    setEditingService(null);
  };

  // Google Sheets integration removed

  const setupInitialSheet = async () => {
    try {
      const backendUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
      const response = await fetch(`${backendUrl}/api/services/setup-sheet`);
      const result = await response.json();

      if (result.success) {
        addNotification(
          createSuccessNotification(
            "Sheet Setup Complete",
            `${result.rowsWritten} rows written to Google Sheets.`,
          ),
        );
        await refreshServices();
      } else {
        addNotification(
          createErrorNotification(
            "Setup Failed",
            result.error || "Failed to setup services.",
          ),
        );
      }
    } catch (error) {
      console.error("Failed to setup sheet:", error);
      addNotification(
        createErrorNotification(
          "Setup Error",
          "Could not initialize services.",
        ),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading services...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Services Management
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Last updated: {lastUpdate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Google Sheets integration removed */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshServices}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={setupInitialSheet}>
              <Upload className="h-4 w-4 mr-2" />
              Setup Sheet
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Help Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 mb-1">
                  How to manage services:
                </p>
                <ul className="text-blue-700 space-y-1">
                  <li>• Use "Refresh" to reload services</li>
                  <li>• Services are managed in static configuration</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Services by Category */}
          {services.map((category) => (
            <Card key={category.id} className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-2xl">{category.icon}</span>
                  <span>{category.name}</span>
                  <Badge
                    variant={
                      category.enabled !== false ? "default" : "secondary"
                    }
                  >
                    {category.enabled !== false ? "Enabled" : "Disabled"}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-600">{category.description}</p>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {category.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{service.name}</span>
                          <Badge
                            variant={service.popular ? "default" : "outline"}
                            className="text-xs"
                          >
                            {service.popular ? "Popular" : "Regular"}
                          </Badge>
                          <Badge
                            variant={
                              service.enabled !== false
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {service.enabled !== false ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-semibold text-green-600">
                            ₹{service.price}
                          </span>
                          <span className="mx-2">•</span>
                          <span>{service.unit}</span>
                          {service.description && (
                            <>
                              <span className="mx-2">•</span>
                              <span>{service.description}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditService(service)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {category.services.length === 0 && (
                    <p className="text-gray-500 text-center py-4">
                      No services in this category
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {services.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Services Found
                </h3>
                <p className="text-gray-600 mb-4">
                  No services were loaded. This could be due to:
                </p>
                <ul className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-1">
                  <li>• Services integration not configured</li>
                  <li>• Service permissions not set</li>
                  <li>• Network connectivity issues</li>
                </ul>
                <div className="mt-6 space-x-4">
                  <Button onClick={setupInitialSheet} variant="outline">
                    Setup Initial Services
                  </Button>
                  <Button onClick={refreshServices}>Retry Loading</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="serviceName">Service Name</Label>
                <Input
                  id="serviceName"
                  value={editingService.name}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="servicePrice">Price (₹)</Label>
                <Input
                  id="servicePrice"
                  type="number"
                  value={editingService.price}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      price: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="serviceUnit">Unit</Label>
                <Input
                  id="serviceUnit"
                  value={editingService.unit}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      unit: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="serviceDescription">Description</Label>
                <Textarea
                  id="serviceDescription"
                  value={editingService.description || ""}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="popular"
                  checked={editingService.popular || false}
                  onCheckedChange={(checked) =>
                    setEditingService({ ...editingService, popular: checked })
                  }
                />
                <Label htmlFor="popular">Popular Service</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={editingService.enabled !== false}
                  onCheckedChange={(checked) =>
                    setEditingService({ ...editingService, enabled: checked })
                  }
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveService} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                Note: Changes may require system restart
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminServicesManager;
