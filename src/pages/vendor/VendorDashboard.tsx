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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Vendor Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <h2 className="font-medium mb-2">Pickup / Vendor Flow</h2>
          <div className="space-y-3">
            {bucketA.map(order => (
              <Card key={order._id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm text-gray-600">#{order.custom_order_id || order._id}</div>
                    <div className="font-medium">{order.name} • {order.phone}</div>
                    <div className="text-sm text-gray-500">{order.service}</div>
                    <div className="text-xs text-gray-500 mt-1">{formatDateOnlyIST(order.scheduled_date)}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {order.status === 'vendor_assigned' && (
                    <>
                      <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                      <Button onClick={() => handleUploadAndMark(order._id)} disabled={uploadingFor === order._id}>{uploadingFor === order._id ? 'Uploading...' : 'Upload & Mark Pickup Complete'}</Button>
                    </>
                  )}

                  {order.status === 'pickup_completed' && (
                    <Button onClick={() => changeStatus(order._id, 'processing')}>Mark Processing</Button>
                  )}

                  {order.status === 'processing' && (
                    <Button onClick={() => changeStatus(order._id, 'ready_for_delivery')}>Mark Ready to Dispatch</Button>
                  )}
                </div>
              </Card>
            ))}
            {bucketA.length === 0 && <div className="text-sm text-gray-500">No orders in this bucket</div>}
          </div>
        </div>

        <div>
          <h2 className="font-medium mb-2">Ready for Delivery</h2>
          <div className="space-y-3">
            {bucketB.map(order => (
              <Card key={order._id} className="p-4">
                <div>
                  <div className="text-sm text-gray-600">#{order.custom_order_id || order._id}</div>
                  <div className="font-medium">{order.name} • {order.phone}</div>
                  <div className="text-sm text-gray-500">{order.service}</div>
                </div>
                <div className="mt-3">
                  <Button onClick={() => changeStatus(order._id, 'delivered')}>Mark Delivered</Button>
                </div>
              </Card>
            ))}
            {bucketB.length === 0 && <div className="text-sm text-gray-500">No orders ready for delivery</div>}
          </div>
        </div>

        <div>
          <h2 className="font-medium mb-2">Completed</h2>
          <div className="space-y-3">
            {completed.map(order => (
              <Card key={order._id} className="p-4">
                <div>
                  <div className="text-sm text-gray-600">#{order.custom_order_id || order._id}</div>
                  <div className="font-medium">{order.name} • {order.phone}</div>
                  <div className="text-sm text-gray-500">{order.service}</div>
                </div>
              </Card>
            ))}
            {completed.length === 0 && <div className="text-sm text-gray-500">No completed orders</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
