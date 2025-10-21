import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Activity,
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  Navigation,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import RiderLayout from '@/components/rider/RiderLayout';
import RiderNotifications from '@/components/rider/RiderNotifications';
import { getRiderApiUrl } from '@/lib/riderApi';
import OrderCard from '@/components/rider/OrderCard';
import TrainingVideo from '@/components/rider/TrainingVideo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [rider, setRider] = useState<any>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);
  const [upcomingOrders, setUpcomingOrders] = useState<any[]>([]);
  const [allAssignedOrders, setAllAssignedOrders] = useState<any[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [locationWatcher, setLocationWatcher] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);

  useEffect(() => {
    // Load rider data
    const riderData = localStorage.getItem('riderAuth');
    if (riderData) {
      const riderInfo = JSON.parse(riderData);
      setRider(riderInfo);
      setIsActive(riderInfo.isActive || false);
    }

    // Load assigned orders
    fetchAssignedOrders();

    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      setLastFetchError(null);
      // Retry fetching data when coming back online
      fetchAssignedOrders();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail || {};
        const { orderId, status } = detail;
        if (!orderId) return;
        if (status === 'approved') {
          fetchAssignedOrders();
          toast.success('Verification approved — refreshed orders');
        } else if (status === 'rejected') {
          fetchAssignedOrders();
          toast.error('Verification rejected — order may need attention');
        }
      } catch (err) {
        console.warn('Error handling global verification event', err);
      }
    };

    window.addEventListener('globalVerificationStatusChanged', handler as EventListener);
    return () => window.removeEventListener('globalVerificationStatusChanged', handler as EventListener);
  }, []);

  useEffect(() => {
    if (isActive) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    return () => {
      if (locationWatcher) {
        navigator.geolocation.clearWatch(locationWatcher);
      }
    };
  }, [isActive]);

  const startLocationTracking = () => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(location);
          // Send location to backend
          updateLocationOnServer(location);
        },
        (error) => {
          console.error('Location error:', error);
          toast.error('Location access required for active status');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
      setLocationWatcher(watchId);
    }
  };

  const stopLocationTracking = () => {
    if (locationWatcher) {
      navigator.geolocation.clearWatch(locationWatcher);
      setLocationWatcher(null);
    }
  };


  const updateLocationOnServer = async (location: {lat: number, lng: number}) => {
    try {
      const token = localStorage.getItem('riderToken');

      if (!token || !rider) {
        console.log('No token or rider data, skipping location update');
        return;
      }

      // Skip if offline
      if (!navigator.onLine) {
        console.log('Offline - location update will be retried when online');
        return;
      }

      const apiUrl = getRiderApiUrl('/location');
      console.log('🔍 Updating location:', apiUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          riderId: rider._id,
          location,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('Location update failed:', response.status, response.statusText);
      }
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        console.warn('Location update timed out');
      } else {
        console.error('Failed to update location:', error);
      }
      // Don't show error to user for location updates as they're background operations
    }
  };

  const toggleActiveStatus = async () => {
    if (!isActive && !currentLocation) {
      // Request location permission first
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      } catch (error) {
        toast.error('Location access is required to go active');
        return;
      }
    }

    try {
      const token = localStorage.getItem('riderToken');
      const apiUrl = getRiderApiUrl('/toggle-status');
      console.log('🔍 Toggling status:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          riderId: rider?._id,
          isActive: !isActive,
          location: currentLocation
        })
      });

      if (response.ok) {
        setIsActive(!isActive);
        const updatedRider = { ...rider, isActive: !isActive };
        setRider(updatedRider);
        localStorage.setItem('riderAuth', JSON.stringify(updatedRider));
        
        toast.success(`You are now ${!isActive ? 'active' : 'inactive'}`);
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const fetchAssignedOrders = async () => {
    try {
      const token = localStorage.getItem('riderToken');

      if (!token) {
        console.log('No rider token, using demo orders');
        setDemoOrders();
        return;
      }

      const apiUrl = getRiderApiUrl('/orders');
      console.log('🔍 Fetching assigned orders from:', apiUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const orders = await response.json();
        const list = Array.isArray(orders) ? orders : [];
        // Sort newest first by assignedAt or created_at
        const sorted = list.slice().sort((a: any, b: any) => {
          const aTime = new Date(a.assignedAt || a.created_at || a.createdAt || 0).getTime();
          const bTime = new Date(b.assignedAt || b.created_at || b.createdAt || 0).getTime();
          return bTime - aTime;
        });

        setAllAssignedOrders(sorted);

        // Smart filtering: show only active/relevant orders to rider to reduce clutter
        const visible = sorted.filter((o: any) => {
          const s = (o.riderStatus || 'assigned').toLowerCase();
          return ['assigned','accepted','on_the_way','picked_up','pending'].includes(s);
        });

        // If we have current location, prioritize by proximity to pickup
        const computeCoords = (o: any) => {
          if (o.coordinates && typeof o.coordinates.lat === 'number' && typeof o.coordinates.lng === 'number') return { lat: o.coordinates.lat, lng: o.coordinates.lng };
          const m = typeof o.address === 'string' ? o.address.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/) : null;
          if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
          return null;
        };

        const toMeters = (a: {lat:number,lng:number}, b: {lat:number,lng:number}) => {
          const toRad = (v:number) => v * Math.PI / 180;
          const R = 6371000; // meters
          const dLat = toRad(b.lat - a.lat);
          const dLon = toRad(b.lng - a.lng);
          const lat1 = toRad(a.lat);
          const lat2 = toRad(b.lat);
          const sinDlat = Math.sin(dLat/2);
          const sinDlon = Math.sin(dLon/2);
          const aHarv = sinDlat*sinDlat + sinDlon*sinDlon * Math.cos(lat1) * Math.cos(lat2);
          const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1-aHarv));
          return R * c;
        };

        let finalVisible = visible;
        if (currentLocation) {
          try {
            finalVisible = visible.slice().sort((a: any, b: any) => {
              const ac = computeCoords(a);
              const bc = computeCoords(b);
              if (!ac && !bc) return 0;
              if (!ac) return 1;
              if (!bc) return -1;
              const da = toMeters(currentLocation, ac);
              const db = toMeters(currentLocation, bc);
              return da - db;
            });
          } catch (e) {
            console.warn('Failed to sort by proximity', e);
          }
        }

        setAssignedOrders(finalVisible);
        setLastFetchError(null); // Clear any previous errors

        // Compute upcoming orders within next 2 hours
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000;
        const upcoming = sorted.filter((o: any) => {
          const timeStr = o.pickupTimeISO || o.scheduledAt || o.pickup_time || o.pickupTime || o.assignedAt;
          let t = null;
          if (typeof timeStr === 'string') {
            const parsed = Date.parse(timeStr);
            if (!isNaN(parsed)) t = parsed;
          }
          if (!t && o.assignedAt) {
            const parsed = Date.parse(o.assignedAt);
            if (!isNaN(parsed)) t = parsed;
          }
          if (!t) return false;
          return t >= now && t <= (now + twoHours);
        });

        setUpcomingOrders(upcoming);

      } else {
        console.warn('Failed to fetch assigned orders:', response.status, response.statusText);
        setLastFetchError(`Server error: ${response.status}`);
        setDemoOrders();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('Order fetch timed out');
        setLastFetchError('Request timed out - please check your connection');
      } else {
        console.error('Failed to fetch assigned orders:', error);
        setLastFetchError('Unable to connect to server');
      }
      setDemoOrders();
    }
  };

  const setDemoOrders = () => {
    const demoOrders = [
      {
        _id: 'demo_order_1',
        bookingId: 'LAU-001',
        customerName: 'John Doe',
        customerPhone: '+91 9876543210',
        address: 'D62, Extension, Chhawla, New Delhi, Delhi, 122101',
        pickupTime: '2:00 PM - 4:00 PM',
        type: 'Regular',
        riderStatus: 'assigned',
        assignedAt: new Date().toISOString(),
        coordinates: null
      },
      {
        _id: 'quick_pickup_demo',
        bookingId: 'QP-002',
        customerName: 'Sarah Johnson',
        customerPhone: '+91 9876543211',
        address: 'A-45, Sector 12, Noida, Uttar Pradesh, 201301',
        pickupTime: '3:00 PM - 5:00 PM',
        type: 'Quick Pickup',
        riderStatus: 'assigned',
        assignedAt: new Date().toISOString(),
        coordinates: null
      }
    ];
    setAssignedOrders(demoOrders);
  };

  const openGoogleMapsNavigation = (order: any) => {
    if (!currentLocation) {
      toast.error('Current location not available. Please enable location services.');
      return;
    }

    const destination = encodeURIComponent(order.address);
    const origin = `${currentLocation.lat},${currentLocation.lng}`;

    // Create Google Maps URL for navigation with driving directions
    const mapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}/@${currentLocation.lat},${currentLocation.lng},15z/data=!3m1!4b1!4m2!4m1!3e0`;

    // Show loading toast
    toast.loading('Opening navigation...', { id: 'navigation' });

    // Open in new tab/window
    window.open(mapsUrl, '_blank');

    // Success feedback
    setTimeout(() => {
      toast.dismiss('navigation');
      toast.success(`🗺️ Navigation opened to ${order.customerName}'s location`, {
        description: order.address,
        duration: 4000
      });
    }, 500);
  };

  const openOptimizedRoute = (orders: any[]) => {
    if (!currentLocation) {
      toast.error('Current location not available. Please enable location services.');
      return;
    }

    const validOrders = (orders || []).filter(o => o && (o.address || (o.coordinates && o.coordinates.lat)));
    if (validOrders.length < 2) {
      toast.error('Need at least 2 orders with addresses to optimize route');
      return;
    }

    const parseCoords = (o: any) => {
      if (o.coordinates && typeof o.coordinates.lat === 'number' && typeof o.coordinates.lng === 'number') return { lat: o.coordinates.lat, lng: o.coordinates.lng, address: o.address };
      const m = typeof o.address === 'string' ? o.address.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/) : null;
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), address: o.address };
      return null;
    };

    const points = validOrders.map(o => ({ order: o, coords: parseCoords(o) }));

    const haversine = (a: {lat:number,lng:number}, b: {lat:number,lng:number}) => {
      const toRad = (v:number) => v * Math.PI / 180;
      const R = 6371; // km
      const dLat = toRad(b.lat - a.lat);
      const dLon = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const sinDlat = Math.sin(dLat/2);
      const sinDlon = Math.sin(dLon/2);
      const aHarv = sinDlat*sinDlat + sinDlon*sinDlon * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1-aHarv));
      return R * c;
    };

    const withCoords = points.filter(p => p.coords !== null);
    const withoutCoords = points.filter(p => p.coords === null);

    const route: any[] = [];
    let current = { lat: currentLocation.lat, lng: currentLocation.lng };
    const remaining = [...withCoords];
    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const c = remaining[i].coords as any;
        const dist = haversine(current as any, c);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      const picked = remaining.splice(bestIndex, 1)[0];
      route.push(picked.order);
      current = picked.coords as any;
    }

    withoutCoords.forEach(p => route.push(p.order));

    const waypointLimit = 8;
    const encodedWaypoints = route.slice(0, waypointLimit + 1).map(o => encodeURIComponent(o.address || `${o.coordinates?.lat},${o.coordinates?.lng}`));
    const originStr = `${currentLocation.lat},${currentLocation.lng}`;
    const destination = encodedWaypoints[encodedWaypoints.length - 1];
    const intermediate = encodedWaypoints.slice(0, encodedWaypoints.length - 1).join('|');
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destination}&travelmode=driving${intermediate ? `&waypoints=${intermediate}` : ''}`;

    toast.loading('Opening optimized route...', { id: 'optimize' });
    window.open(mapsUrl, '_blank');
    setTimeout(() => {
      toast.dismiss('optimize');
      toast.success('Optimized route opened in Google Maps');
    }, 600);
  };

  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpOrderId, setOtpOrderId] = useState<string | null>(null);
  const [otpType, setOtpType] = useState<'pickup'|'delivery'>('pickup');
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const DISABLE_CUSTOMER_OTP = true;
  const [resendCountdown, setResendCountdown] = useState<number>(0);
  const resendTimerRef = React.useRef<number | null>(null);

  const startResendCountdown = (seconds: number = 30) => {
    setResendCountdown(seconds);
    if (resendTimerRef.current) window.clearInterval(resendTimerRef.current);
    resendTimerRef.current = window.setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) {
          if (resendTimerRef.current) {
            window.clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) {
        window.clearInterval(resendTimerRef.current);
      }
    };
  }, []);

  const handleOrderAction = async (orderId: string, action: 'start' | 'complete') => {
    try {
      if (!rider) {
        toast.error('Rider information not found. Please login again.');
        return;
      }

      if (rider.status !== 'approved') {
        toast.error('Only approved riders can perform this action. Your status: ' + rider.status);
        return;
      }

      const token = localStorage.getItem('riderToken');
      if (!token) {
        toast.error('Authentication token not found. Please login again.');
        return;
      }

      const apiUrl = getRiderApiUrl('/order-action');
      console.log('🔍 Order action:', action, 'for order:', orderId, 'API URL:', apiUrl);

      toast.loading(`${action === 'start' ? 'Processing pickup...' : 'Processing delivery...'}`, { id: `order-action-${orderId}` });
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId,
          action: action === 'start' ? 'start' : 'complete',
          riderId: rider?._id,
          location: currentLocation,
          timestamp: new Date().toISOString()
        })
      });

      toast.dismiss(`order-action-${orderId}`);

      if (response.ok) {
        toast.success(`Order ${action === 'start' ? 'picked up' : 'delivered'} successfully!`);
        if (action === 'start') {
          const currentOrder = assignedOrders.find(o => o._id === orderId);
          if (currentOrder) setTimeout(() => openGoogleMapsNavigation(currentOrder), 500);
        }
        await fetchAssignedOrders();
      } else {
        const text = await response.text().catch(() => '');
        toast.error(text || `Failed to ${action === 'start' ? 'pickup' : 'deliver'} order`);
      }
    } catch (error) {
      console.error('Order action error:', error);
      toast.error('Network error. Please check your connection and try again.');
    }
  };

  const verifyCustomerOTPInline = async () => {
    if (!otpOrderId) return toast.error('No order selected for OTP verification');
    if (!otpValue) return toast.error('Enter OTP');
    try {
      setOtpLoading(true);
      const token = localStorage.getItem('riderToken');
      const apiUrl = getRiderApiUrl(`/orders/${otpOrderId}/verify-customer-otp`);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ otp: otpValue, type: otpType })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('OTP verified');
        setOtpModalOpen(false);
        setOtpValue('');
        setOtpOrderId(null);
        await fetchAssignedOrders();
        try {
          if (otpOrderId && (window as any).globalVerificationManager) {
            (window as any).globalVerificationManager.setVerificationStatus(otpOrderId, 'approved');
          }
          window.dispatchEvent(new CustomEvent('globalVerificationStatusChanged', { detail: { orderId: otpOrderId, status: 'approved' } }));
        } catch (e) {
          console.warn('Failed to notify global manager after inline OTP verify', e);
        }
      } else {
        toast.error(data.message || 'OTP verification failed');
      }
    } catch (err) {
      console.error('Inline OTP verify error', err);
      toast.error('OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleEditCart = (order: any) => {
    try {
      navigate(`/rider/orders/${order._id}`, { state: { editCart: true } });
    } catch (err) {
      console.error('Navigation error (edit cart):', err);
      toast.error('Unable to open order editor. Please try again.');
    }
  };

  if (!rider) {
    return <div>Loading...</div>;
  }

  return (
    <RiderLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Assigned Orders</h2>
              <div className="text-sm text-muted-foreground">Tap an order to view details or start delivery workflow</div>
            </div>
            <div className="ml-4">
              <Button size="sm" variant="ghost" onClick={() => navigate('/rider/history')}>Order History</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => openOptimizedRoute(assignedOrders)} disabled={!currentLocation || assignedOrders.length < 2}>
                Optimize Route
              </Button>
            </div>
          </div>

          {/* Upcoming orders within next 2 hours */}
          <div className="mb-3">
            <h3 className="text-md font-medium">Upcoming (next 2 hours)</h3>
            {upcomingOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground">No upcoming orders in the next 2 hours.</div>
            ) : (
              upcomingOrders.map((o) => (
                <OrderCard
                  key={`up_${o._id}`}
                  order={o}
                  currentLocation={currentLocation}
                  onPickup={(id) => handleOrderAction(id, 'start')}
                  onDeliver={(id) => handleOrderAction(id, 'complete')}
                  onNavigate={(order) => openGoogleMapsNavigation(order)}
                />
              ))
            )}
          </div>

          {/* Smart assigned orders (prioritized by proximity when possible) */}
          <div>
            <h3 className="text-md font-medium">Active Orders</h3>
            {assignedOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active orders right now.</div>
            ) : (
              assignedOrders.map((o) => (
                <OrderCard
                  key={`all_${o._id}`}
                  order={o}
                  currentLocation={currentLocation}
                  onPickup={(id) => handleOrderAction(id, 'start')}
                  onDeliver={(id) => handleOrderAction(id, 'complete')}
                  onNavigate={(order) => openGoogleMapsNavigation(order)}
                />
              ))
            )}
          </div>
        </div>

        <aside className="lg:col-span-1">
          <TrainingVideo videoUrl={undefined} />
        </aside>
      </div>

      {/* Inline OTP verification dialog */}
      <Dialog open={otpModalOpen} onOpenChange={(open) => setOtpModalOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter Customer OTP</DialogTitle>
            <DialogDescription>Please enter the OTP sent to the customer to proceed.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-sm">OTP</Label>
              <Input value={otpValue} onChange={(e) => setOtpValue((e.target as HTMLInputElement).value)} placeholder="Enter OTP" />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Sent to: {otpOrderId ? (assignedOrders.find(o => o._id === otpOrderId)?.customerPhone || 'Customer') : 'Customer'}
              </div>
              <div>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!otpOrderId) return;
                  try {
                    const token = localStorage.getItem('riderToken');
                    const url = getRiderApiUrl(`/orders/${otpOrderId}/request-customer-otp`);
                    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ type: otpType }) });
                    const d = await res.json().catch(() => ({}));
                    if (res.ok) {
                      toast.success('OTP resent to customer');
                      startResendCountdown(30);
                    } else {
                      toast.error(d.message || 'Failed to resend OTP');
                    }
                  } catch (err) {
                    console.error('Resend OTP error', err);
                    toast.error('Failed to resend OTP');
                  }
                }} disabled={resendCountdown > 0}>
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
                </Button>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => { setOtpModalOpen(false); setOtpValue(''); setOtpOrderId(null); }}>
                Cancel
              </Button>
              <Button onClick={verifyCustomerOTPInline} disabled={otpLoading}>
                {otpLoading ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </RiderLayout>
  );
}
