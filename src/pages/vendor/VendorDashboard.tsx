import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { vendorAuthService } from "@/services/vendorAuthService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateOnlyIST } from "@/utils/timeUtils";
import { toast } from "sonner";

interface Order {
  _id: string;
  custom_order_id?: string;
  name?: string;
  phone?: string;
  service?: string;
  status?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  items_images?: any[];
  delivery_date?: string;
  delivery_time?: string;
}

const VendorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await vendorAuthService.fetchAssignedOrders();
      if (res && res.success && res.orders) {
        setOrders(res.orders);
      } else {
        toast.error(res.error || "Failed to fetch orders");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleUploadAndMark = async (orderId: string) => {
    if (!selectedFile) {
      toast.error("Please select an image to upload");
      return;
    }

    setUploadingFor(orderId);
    try {
      const uploadRes = await vendorAuthService.uploadItemsImage(orderId, selectedFile);
      if (!uploadRes || !uploadRes.success) {
        toast.error(uploadRes.error || "Upload failed");
        setUploadingFor(null);
        return;
      }

      // After upload, mark pickup_completed
      const statusRes = await vendorAuthService.updateOrderStatus(orderId, "pickup_completed");
      if (!statusRes || !statusRes.success) {
        toast.error(statusRes.error || "Failed to update status");
        setUploadingFor(null);
        return;
      }

      toast.success("Pickup marked complete");
      setSelectedFile(null);
      setUploadingFor(null);
      load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload");
      setUploadingFor(null);
    }
  };

  const changeStatus = async (orderId: string, status: string) => {
    try {
      const res = await vendorAuthService.updateOrderStatus(orderId, status);
      if (!res || !res.success) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      toast.success("Status updated");
      load();
    } catch (error: any) {
      toast.error(error?.message || "Update failed");
    }
  };

  const handleLogout = () => {
    vendorAuthService.logout();
    navigate("/vendor/login");
  };

  const bucketA = orders.filter(o => o.status !== 'ready_for_delivery' && o.status !== 'delivered' && o.status !== 'completed');
  const bucketB = orders.filter(o => o.status === 'ready_for_delivery');
  const completed = orders.filter(o => o.status === 'completed' || o.status === 'delivered');

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading vendor dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Vendor Dashboard</h1>
        <Button variant="outline" onClick={handleLogout}>Logout</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <div className="mb-4">
            <h2 className="font-bold text-lg text-blue-600">Assigned Orders</h2>
            <p className="text-xs text-gray-500">Assigned → Pickup Complete → Processing → Ready to Dispatch</p>
          </div>
          <div className="space-y-3">
            {bucketA.map(order => (
              <Card key={order._id} className="p-4 border-l-4 border-l-blue-500">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-700">#{order.custom_order_id || order._id}</div>
                    <div className="font-medium text-base">{order.name}</div>
                    <div className="text-sm text-gray-600">{order.phone}</div>
                    <div className="text-sm text-gray-500 mt-1">{order.service}</div>
                    <div className="text-xs text-gray-500 mt-1">Pickup: {formatDateOnlyIST(order.scheduled_date)}</div>
                    {order.delivery_date && (
                      <div className="text-xs text-gray-500">Delivery: {formatDateOnlyIST(order.delivery_date)}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{order.status}</span>
                    {order.items_images && order.items_images.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}
                        className="text-xs"
                      >
                        {expandedOrderId === order._id ? 'Hide Photos' : `View Photos (${order.items_images.length})`}
                      </Button>
                    )}
                  </div>
                </div>

                {expandedOrderId === order._id && order.items_images && order.items_images.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      {order.items_images.map((image: any, idx: number) => (
                        <div key={idx} className="relative bg-gray-100 rounded overflow-hidden aspect-square">
                          <img
                            src={`/api/vendor/orders/orders/${order._id}/items-image/${image.file_id}`}
                            alt={`Items ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext x="50" y="50" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%239ca3af"%3EFailed to load%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                            {new Date(image.uploaded_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-2">
                  {order.status === 'vendor_assigned' && (
                    <>
                      <div className="text-xs text-gray-600 font-semibold">📸 Upload items list image</div>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="text-xs flex-1"
                        />
                        <Button
                          onClick={() => handleUploadAndMark(order._id)}
                          disabled={uploadingFor === order._id}
                          className="whitespace-nowrap"
                        >
                          {uploadingFor === order._id ? 'Uploading...' : 'Upload & Pickup Complete'}
                        </Button>
                      </div>
                    </>
                  )}

                  {order.status === 'pickup_completed' && (
                    <Button onClick={() => changeStatus(order._id, 'in_progress')} className="w-full">
                      Mark as Processing
                    </Button>
                  )}

                  {order.status === 'in_progress' && (
                    <Button onClick={() => changeStatus(order._id, 'ready_for_delivery')} className="w-full bg-green-600 hover:bg-green-700">
                      Ready to Dispatch
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            {bucketA.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No assigned orders</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="font-bold text-lg text-orange-600">Ready for Delivery</h2>
            <p className="text-xs text-gray-500">Waiting for admin delivery confirmation</p>
          </div>
          <div className="space-y-3">
            {bucketB.map(order => (
              <Card key={order._id} className="p-4 border-l-4 border-l-orange-500">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-700">#{order.custom_order_id || order._id}</div>
                    <div className="font-medium text-base">{order.name}</div>
                    <div className="text-sm text-gray-600">{order.phone}</div>
                    <div className="text-sm text-gray-500 mt-1">{order.service}</div>
                    {order.delivery_date && (
                      <div className="text-xs text-orange-600 mt-1 font-semibold">
                        📅 {formatDateOnlyIST(order.delivery_date)} at {order.delivery_time}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">Ready for Delivery</span>
                    {order.items_images && order.items_images.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}
                        className="text-xs"
                      >
                        {expandedOrderId === order._id ? 'Hide Photos' : `View Photos (${order.items_images.length})`}
                      </Button>
                    )}
                  </div>
                </div>

                {expandedOrderId === order._id && order.items_images && order.items_images.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      {order.items_images.map((image: any, idx: number) => (
                        <div key={idx} className="relative bg-gray-100 rounded overflow-hidden aspect-square">
                          <img
                            src={`/api/vendor/orders/orders/${order._id}/items-image/${image.file_id}`}
                            alt={`Items ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext x="50" y="50" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%239ca3af"%3EFailed to load%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                            {new Date(image.uploaded_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <Button onClick={() => changeStatus(order._id, 'delivered')} className="w-full bg-green-600 hover:bg-green-700">
                    Mark as Delivered
                  </Button>
                </div>
              </Card>
            ))}
            {bucketB.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No orders ready for delivery</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="font-bold text-lg text-green-600">Completed</h2>
            <p className="text-xs text-gray-500">All deliveries done</p>
          </div>
          <div className="space-y-3">
            {completed.map(order => (
              <Card key={order._id} className="p-4 border-l-4 border-l-green-500 bg-green-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-700">#{order.custom_order_id || order._id}</div>
                    <div className="font-medium text-base">{order.name}</div>
                    <div className="text-sm text-gray-600">{order.phone}</div>
                    <div className="text-sm text-gray-500 mt-1">{order.service}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">✓ Completed</span>
                    {order.items_images && order.items_images.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}
                        className="text-xs"
                      >
                        {expandedOrderId === order._id ? 'Hide Photos' : `View Photos (${order.items_images.length})`}
                      </Button>
                    )}
                  </div>
                </div>

                {expandedOrderId === order._id && order.items_images && order.items_images.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      {order.items_images.map((image: any, idx: number) => (
                        <div key={idx} className="relative bg-gray-100 rounded overflow-hidden aspect-square">
                          <img
                            src={`/api/vendor/orders/orders/${order._id}/items-image/${image.file_id}`}
                            alt={`Items ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext x="50" y="50" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%239ca3af"%3EFailed to load%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                            {new Date(image.uploaded_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
            {completed.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No completed orders</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
