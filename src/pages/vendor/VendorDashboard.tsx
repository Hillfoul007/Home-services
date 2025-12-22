import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { vendorAuthService } from "@/services/vendorAuthService";
import { soundNotificationService, SoundNotificationSettings } from "@/services/soundNotificationService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateOnlyIST } from "@/utils/timeUtils";
import { toast } from "sonner";
import { Volume2, VolumeX } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

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
  address?: string;
  final_amount?: number;
  total_price?: number;
  isPGOrder?: boolean;
  pg_name?: string;
  no_of_items?: number;
}

const getScheduledDateTime = (order: Order): Date => {
  try {
    const dateStr = order.scheduled_date || '';
    const timeStr = order.scheduled_time || '00:00';

    if (!dateStr) return new Date(0);

    const [hours, minutes] = timeStr.split(':').map(Number);
    const dateObj = new Date(dateStr);
    dateObj.setHours(hours || 0, minutes || 0, 0, 0);
    return dateObj;
  } catch (e) {
    return new Date(0);
  }
};

const formatScheduledDateTime = (order: Order): string => {
  try {
    const dateStr = order.scheduled_date || '';
    const timeStr = order.scheduled_time || '00:00';

    if (!dateStr) return 'N/A';

    const dateObj = new Date(dateStr);
    const [hours, minutes] = timeStr.split(':').map(Number);

    const dayMonth = dateObj.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    if (!timeStr || timeStr === '00:00') {
      return dayMonth;
    }

    const timeFormatted = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hours, minutes)
      .toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

    return `${dayMonth}, ${timeFormatted}`;
  } catch (e) {
    return formatDateOnlyIST(order.scheduled_date);
  }
};

type FilterType = 'all' | 'regular' | 'pg';

const VendorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [soundSettings, setSoundSettings] = useState<SoundNotificationSettings>(soundNotificationService.getSettings());
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await vendorAuthService.fetchAssignedOrders();
      let allOrders: Order[] = [];

      if (res && res.success && res.orders) {
        allOrders = res.orders;
      }

      // Load PG orders assigned to this vendor
      try {
        const vendorAuth = vendorAuthService.getVendorAuth();
        console.log("🔍 Vendor Auth:", vendorAuth);

        if (vendorAuth?.vendor_id) {
          console.log(`📍 Fetching PG orders for vendor ID: ${vendorAuth.vendor_id}`);
          const pgResponse = await apiClient.request<any>(
            `/pg-orders/vendor/${vendorAuth.vendor_id}`
          );
          console.log("📦 PG Orders Response:", pgResponse);

          // Backend returns { success: true, data: [...] }, so extract the actual array
          const pgOrdersArray = Array.isArray(pgResponse.data)
            ? pgResponse.data
            : (pgResponse.data?.data || []);

          console.log(`✅ Found ${pgOrdersArray?.length || 0} PG orders`);

          if (pgOrdersArray && Array.isArray(pgOrdersArray) && pgOrdersArray.length > 0) {
            const pgOrders: Order[] = pgOrdersArray.map((pgOrder: any) => ({
              _id: pgOrder._id,
              custom_order_id: pgOrder.custom_order_id,
              name: pgOrder.name,
              phone: pgOrder.phone,
              service: "Laundry and Iron",
              status: pgOrder.status,
              scheduled_date: pgOrder.created_at?.split('T')[0],
              address: `${pgOrder.pg_name}, ${pgOrder.city}`,
              final_amount: pgOrder.final_amount,
              total_price: pgOrder.total_price,
              isPGOrder: true,
              pg_name: pgOrder.pg_name,
              no_of_items: pgOrder.no_of_items,
            }));
            allOrders = [...allOrders, ...pgOrders];
            console.log("✅ PG Orders merged into allOrders");
          }
        } else {
          console.warn("⚠️ No vendor auth found");
        }
      } catch (pgError) {
        console.error("❌ Could not load PG orders:", pgError);
      }

      // Detect new orders and play notification
      setOrders(prevOrders => {
        if (prevOrders.length > 0 && allOrders.length > prevOrders.length) {
          // Find new orders
          const prevOrderIds = new Set(prevOrders.map(o => o._id));
          const newOrderIds = allOrders.filter(o => !prevOrderIds.has(o._id));

          if (newOrderIds.length > 0) {
            // Play notification for each new order
            newOrderIds.forEach(async () => {
              soundNotificationService.playNotification();
            });

            toast.success(`${newOrderIds.length} new order(s) received! 🎉`);
          }
        }

        return allOrders;
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);

    // Resume audio context on user interaction (browser requirement)
    const handleInteraction = () => {
      soundNotificationService.resumeAudioContext();
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    return () => {
      clearInterval(interval);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
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

      // After upload, mark pickup as complete (auto-transitions to in_progress)
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

  const changeStatus = async (orderId: string, status: string, isPGOrder: boolean = false) => {
    try {
      let res;

      if (isPGOrder) {
        // For PG orders, use the PG orders API
        res = await apiClient.request<any>(
          `/pg-orders/${orderId}/status`,
          {
            method: "PATCH",
            body: { status, changed_by: "vendor" },
          }
        );
      } else {
        // For regular orders, use the vendor auth service
        res = await vendorAuthService.updateOrderStatus(orderId, status);
      }

      if (!res || !res.success) {
        toast.error(res?.error || "Failed to update status");
        return;
      }
      toast.success("Status updated");
      load();
    } catch (error: any) {
      toast.error(error?.message || "Update failed");
    }
  };

  const handlePGOrderResponse = async (orderId: string, action: 'accept' | 'reject') => {
    try {
      const res = await apiClient.request<any>(
        `/pg-orders/${orderId}/vendor-response`,
        {
          method: "POST",
          body: { action },
        }
      );

      if (!res || !res.success) {
        toast.error(res?.error || "Failed to process response");
        return;
      }

      toast.success(action === 'accept' ? "Order accepted! ✅" : "Order rejected ❌");
      load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to process response");
    }
  };

  const handleLogout = () => {
    vendorAuthService.logout();
    navigate("/vendor/login");
  };

  const handleToggleSound = () => {
    const newEnabled = !soundSettings.enabled;
    soundNotificationService.toggleEnabled(newEnabled);
    setSoundSettings(soundNotificationService.getSettings());
    toast.success(newEnabled ? "Sound notifications enabled" : "Sound notifications disabled");
  };

  const handleTestSound = async () => {
    soundNotificationService.resumeAudioContext();
    await soundNotificationService.playNotification();
    toast.success("Test sound played!");
  };

  const handleChangeSoundType = (type: 'beep' | 'bell' | 'chime') => {
    soundNotificationService.setSoundType(type);
    setSoundSettings(soundNotificationService.getSettings());
    toast.success(`Sound type changed to ${type}`);
  };

  const handleVolumeChange = (volume: number) => {
    soundNotificationService.setVolume(volume);
    setSoundSettings(soundNotificationService.getSettings());
  };

  const handleCallCustomer = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleNavigateToAddress = (address: string) => {
    if (!address) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const encodedAddress = encodeURIComponent(address);
          const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodedAddress}`;
          window.open(googleMapsUrl, '_blank');
        },
        (error) => {
          // If geolocation fails, just open with the address
          console.log('Geolocation error:', error);
          const encodedAddress = encodeURIComponent(address);
          const googleMapsUrl = `https://www.google.com/maps/search/${encodedAddress}`;
          window.open(googleMapsUrl, '_blank');
        }
      );
    } else {
      // Fallback if geolocation is not supported
      const encodedAddress = encodeURIComponent(address);
      const googleMapsUrl = `https://www.google.com/maps/search/${encodedAddress}`;
      window.open(googleMapsUrl, '_blank');
    }
  };

  const sortOrdersByTime = (ordersToSort: Order[]): Order[] => {
    return [...ordersToSort].sort((a, b) => {
      const dateA = getScheduledDateTime(a);
      const dateB = getScheduledDateTime(b);
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Apply filter based on filterType
  const getFilteredOrders = (ordersToFilter: Order[]): Order[] => {
    if (filterType === 'all') return ordersToFilter;
    if (filterType === 'regular') return ordersToFilter.filter(o => !o.isPGOrder);
    if (filterType === 'pg') return ordersToFilter.filter(o => o.isPGOrder);
    return ordersToFilter;
  };

  const filteredOrders = getFilteredOrders(orders);

  const bucketA = sortOrdersByTime(filteredOrders.filter(o => o.status !== 'ready_for_delivery' && o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled'));
  const bucketB = sortOrdersByTime(filteredOrders.filter(o => o.status === 'ready_for_delivery'));
  const completed = sortOrdersByTime(filteredOrders.filter(o => (o.status === 'completed' || o.status === 'delivered') && o.status !== 'cancelled'));

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
    <div className="p-3 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-semibold">Vendor Dashboard</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSoundMenu(!showSoundMenu)}
              className="flex items-center gap-2"
              title={soundSettings.enabled ? "Sound notifications enabled" : "Sound notifications disabled"}
            >
              {soundSettings.enabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span className="text-xs">Sound</span>
            </Button>

            {showSoundMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Notification Sound</label>
                    <div className="space-y-2">
                      {['beep', 'bell', 'chime'].map((type) => (
                        <button
                          key={type}
                          onClick={() => handleChangeSoundType(type as 'beep' | 'bell' | 'chime')}
                          className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${
                            soundSettings.soundType === type
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold mb-2 block">Volume</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={soundSettings.volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{soundSettings.volume}%</div>
                  </div>

                  <button
                    onClick={handleTestSound}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    🔊 Test Sound
                  </button>

                  <button
                    onClick={handleToggleSound}
                    className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                      soundSettings.enabled
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {soundSettings.enabled ? 'Disable Notifications' : 'Enable Notifications'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" onClick={handleLogout}>Logout</Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('all')}
          className="text-xs md:text-sm"
        >
          All Orders ({orders.length})
        </Button>
        <Button
          variant={filterType === 'regular' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('regular')}
          className="text-xs md:text-sm"
        >
          Regular Orders ({orders.filter(o => !o.isPGOrder).length})
        </Button>
        <Button
          variant={filterType === 'pg' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('pg')}
          className="text-xs md:text-sm"
        >
          🏠 PG Orders ({orders.filter(o => o.isPGOrder).length})
        </Button>
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
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-700 truncate">#{order.custom_order_id || order._id}</div>
                    <div className="font-medium text-sm md:text-base truncate">{order.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-sm text-gray-600 truncate flex-1">{order.phone}</div>
                      {order.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCallCustomer(order.phone!)}
                          className="flex-shrink-0 px-2 py-1 h-auto"
                          title="Call customer"
                        >
                          ☎️
                        </Button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {order.isPGOrder ? '🏠 PG Service' : order.service}
                    </div>
                    {order.isPGOrder ? (
                      <div className="text-xs text-blue-600 mt-1 font-semibold">📍 {order.pg_name}</div>
                    ) : (
                      <div className="text-xs text-gray-500 mt-1">Pickup: {formatScheduledDateTime(order)}</div>
                    )}
                    {order.delivery_date && (
                      <div className="text-xs text-gray-500">Delivery: {formatScheduledDateTime({...order, scheduled_date: order.delivery_date, scheduled_time: order.delivery_time || '00:00'} as Order)}</div>
                    )}
                    {order.address && (
                      <button
                        onClick={() => handleNavigateToAddress(order.address!)}
                        className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-pointer w-full text-left"
                        title="Open in Google Maps"
                      >
                        📍 {order.address}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${order.isPGOrder ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{order.isPGOrder ? '🏠 ' : ''}{order.status}</span>
                    <div className="flex gap-1">
                      {order.address && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigateToAddress(order.address!)}
                          className="text-xs whitespace-nowrap px-2 py-1 h-auto"
                          title="Navigate to address"
                        >
                          🗺️ Navigate
                        </Button>
                      )}
                      {order.items_images && order.items_images.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}
                          className="text-xs whitespace-nowrap"
                        >
                          {expandedOrderId === order._id ? 'Hide' : `View (${order.items_images.length})`}
                        </Button>
                      )}
                    </div>
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
                  {order.isPGOrder && order.status === 'vendor_assigned' && (
                    <>
                      <div className="text-xs text-gray-600 font-semibold bg-yellow-50 p-2 rounded border border-yellow-200">
                        ⏳ PG Order Awaiting Confirmation - {order.no_of_items} items @ ₹25 per piece
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handlePGOrderResponse(order._id, 'reject')}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-xs md:text-sm"
                          size="sm"
                        >
                          ❌ Reject
                        </Button>
                        <Button
                          onClick={() => handlePGOrderResponse(order._id, 'accept')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-xs md:text-sm"
                          size="sm"
                        >
                          ✅ Accept
                        </Button>
                      </div>
                    </>
                  )}

                  {!order.isPGOrder && order.status === 'vendor_assigned' && (
                    <>
                      <div className="text-xs text-gray-600 font-semibold">📸 Upload items list image</div>
                      <div className="flex flex-col md:flex-row gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="text-xs flex-1 min-w-0"
                        />
                        <Button
                          onClick={() => handleUploadAndMark(order._id)}
                          disabled={uploadingFor === order._id}
                          className="whitespace-nowrap text-xs md:text-sm"
                          size="sm"
                        >
                          {uploadingFor === order._id ? 'Uploading...' : 'Upload & Complete'}
                        </Button>
                      </div>
                    </>
                  )}

                  {order.status === 'in_progress' && (
                    <Button onClick={() => changeStatus(order._id, 'ready_for_delivery')} className="w-full bg-green-600 hover:bg-green-700 text-xs md:text-sm" size="sm">
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
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-700 truncate">#{order.custom_order_id || order._id}</div>
                    <div className="font-medium text-sm md:text-base truncate">{order.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-sm text-gray-600 truncate flex-1">{order.phone}</div>
                      {order.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCallCustomer(order.phone!)}
                          className="flex-shrink-0 px-2 py-1 h-auto"
                          title="Call customer"
                        >
                          ☎️
                        </Button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {order.isPGOrder ? '🏠 PG Service' : order.service}
                    </div>
                    {order.isPGOrder ? (
                      <div className="text-xs text-blue-600 mt-1 font-semibold">📍 {order.pg_name}</div>
                    ) : (
                      <div className="text-xs text-gray-500 mt-1">Pickup: {formatScheduledDateTime(order)}</div>
                    )}
                    {order.delivery_date && (
                      <div className="text-xs text-orange-600 mt-1 font-semibold">
                        Delivery: {formatScheduledDateTime({...order, scheduled_date: order.delivery_date, scheduled_time: order.delivery_time || '00:00'} as Order)}
                      </div>
                    )}
                    {order.address && (
                      <button
                        onClick={() => handleNavigateToAddress(order.address!)}
                        className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-pointer w-full text-left"
                        title="Open in Google Maps"
                      >
                        📍 {order.address}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${order.isPGOrder ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'}`}>Ready</span>
                    <div className="text-sm font-bold text-orange-700">₹{order.final_amount ?? order.total_price}</div>
                    <div className="flex gap-1">
                      {order.address && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigateToAddress(order.address!)}
                          className="text-xs whitespace-nowrap px-2 py-1 h-auto"
                          title="Navigate to address"
                        >
                          🗺️ Navigate
                        </Button>
                      )}
                      {order.items_images && order.items_images.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}
                          className="text-xs whitespace-nowrap"
                        >
                          {expandedOrderId === order._id ? 'Hide' : `View (${order.items_images.length})`}
                        </Button>
                      )}
                    </div>
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
                  <Button onClick={() => changeStatus(order._id, 'delivered')} className="w-full bg-green-600 hover:bg-green-700 text-xs md:text-sm" size="sm">
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
                <div className="flex justify-between items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-700 truncate">#{order.custom_order_id || order._id}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">Ready</span>
                    <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">₹{order.final_amount ?? order.total_price}</div>
                  </div>
                </div>
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
