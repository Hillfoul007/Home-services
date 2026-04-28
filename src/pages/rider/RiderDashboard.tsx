import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { useRiderLocation } from '@/contexts/RiderLocationContext';
import { showLocalNotification } from '@/utils/nativeNotification';
import OrderCard from '@/components/rider/OrderCard';
import TrainingVideo from '@/components/rider/TrainingVideo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// ─── ETA helpers ───────────────────────────────────────────────────────────────
interface ETAResult { durationText: string; distanceText: string; fetchedAt: number }
const etaCache = new Map<string, ETAResult>();
const ETA_TTL_MS = 2 * 60 * 1000; // refresh every 2 min

async function fetchETA(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  apiKey: string
): Promise<{ durationText: string; distanceText: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 8000);
    const res  = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.length) return null;
    const leg = data.routes[0].legs[0];
    const duration = leg.duration_in_traffic || leg.duration;
    return {
      durationText: duration.text,
      distanceText: leg.distance.text,
    };
  } catch {
    return null;
  }
}

export default function RiderDashboard() {
  const navigate = useNavigate();
  const { currentLocation, locationError, signalLost, lastLocationAt } = useRiderLocation();
  const [rider, setRider] = useState<any>(null);
  const [isActive, setIsActive] = useState(false);
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);
  const [upcomingOrders, setUpcomingOrders] = useState<any[]>([]);
  const [allAssignedOrders, setAllAssignedOrders] = useState<any[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const [etaMap, setEtaMap] = useState<Map<string, { durationText: string; distanceText: string }>>(new Map());
  const prevOrderCount = useRef<number>(0);
  const etaFetchingRef = useRef<Set<string>>(new Set()); // prevent concurrent fetches for same order
  const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    // Load rider data
    const riderData = localStorage.getItem('riderAuth');
    if (riderData) {
      const riderInfo = JSON.parse(riderData);
      setRider(riderInfo);
      setIsActive(riderInfo.isActive || false);

      // Initialize mobile push notifications for rider
      import('@/services/MobilePushService').then((mod) => {
        mod.MobilePushService.getInstance().initialize(undefined, { riderId: riderInfo._id || riderInfo.id });
      }).catch(() => {});
    }

    // Load assigned orders
    fetchAssignedOrders();

    // Auto-poll every 30 seconds for new/updated orders
    const pollInterval = setInterval(() => {
      if (navigator.onLine) fetchAssignedOrders();
    }, 30000);

    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      setLastFetchError(null);
      fetchAssignedOrders();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(pollInterval);
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

  // Instant new-order notification via socket (no 30s poll delay)
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail || {};
        console.log('⚡ Instant new order from socket:', detail);
        fetchAssignedOrders();
        toast.success('New order assigned!', { duration: 8000 });
      } catch (err) {
        console.warn('riderNewOrder event error', err);
      }
    };
    window.addEventListener('riderNewOrder', handler as EventListener);
    return () => window.removeEventListener('riderNewOrder', handler as EventListener);
  }, []);

  // ETA refresh: fetch Google Maps traffic ETA for every active order with coordinates
  useEffect(() => {
    if (!MAPS_API_KEY || !currentLocation) return;

    const activeOrders = assignedOrders.filter((o: any) => {
      const s = (o.status || '').toLowerCase();
      return (
        s === 'pickup_assigned' || s === 'created' || s === 'vendor_assigned' ||
        s === 'delivery_assigned' || s === 'in_transit' || s === 'ready_for_delivery'
      );
    });

    activeOrders.forEach(async (order: any) => {
      const dest =
        order.coordinates?.lat != null && order.coordinates?.lng != null
          ? { lat: order.coordinates.lat, lng: order.coordinates.lng }
          : null;
      if (!dest) return;

      const key = `${order._id}`;
      const cached = etaCache.get(key);
      if (cached && Date.now() - cached.fetchedAt < ETA_TTL_MS) return;
      if (etaFetchingRef.current.has(key)) return;

      etaFetchingRef.current.add(key);
      try {
        const result = await fetchETA(currentLocation, dest, MAPS_API_KEY);
        if (result) {
          etaCache.set(key, { ...result, fetchedAt: Date.now() });
          setEtaMap(prev => {
            const next = new Map(prev);
            next.set(key, result);
            return next;
          });
        }
      } finally {
        etaFetchingRef.current.delete(key);
      }
    });
  // Re-run when orders or location changes meaningfully (every ~2 min via lastLocationAt tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedOrders, currentLocation?.lat, currentLocation?.lng, MAPS_API_KEY]);

  // Location tracking is now handled globally by RiderLocationContext
  // GPS runs from login until logout, regardless of active/inactive status

  const toggleActiveStatus = async () => {
    if (!isActive && !currentLocation) {
      toast.error('Waiting for GPS location. Please ensure location is enabled.');
      return;
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

        // Show all assigned orders (active + today's completed) — backend now controls the 30-day window
        const visible = sorted.filter((o: any) => {
          const s = (o.riderStatus || 'assigned').toLowerCase();
          return s !== 'cancelled';
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

        // Notify rider of new order assignments
        const activeOrders = finalVisible.filter((o: any) => {
          const s = (o.status || '').toLowerCase();
          return s === 'pickup_assigned' || s === 'created' || s === 'vendor_assigned';
        });
        const newCount = activeOrders.length;
        if (prevOrderCount.current > 0 && newCount > prevOrderCount.current) {
          const diff = newCount - prevOrderCount.current;
          // Find the newest orders
          const newOrders = activeOrders.slice(0, diff);
          const isPickup = newOrders.some((o: any) => {
            const s = (o.status || '').toLowerCase();
            return s === 'pickup_assigned' || s === 'created' || s === 'vendor_assigned';
          });
          const taskType = isPickup ? 'pickup' : 'delivery';

          toast.success(`🆕 ${diff} new ${taskType} order${diff > 1 ? 's' : ''} assigned!`, {
            duration: 10000,
            description: newOrders.map((o: any) => `${o.custom_order_id || o.bookingId || ''} - ${o.customerName || 'Customer'}`).join(', ')
          });

          // Play attention-grabbing notification sound (3 beeps)
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            for (let i = 0; i < 3; i++) {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(880, ctx.currentTime + i * 0.3);
              osc.frequency.setValueAtTime(1100, ctx.currentTime + i * 0.3 + 0.1);
              gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.3);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.3 + 0.25);
              osc.start(ctx.currentTime + i * 0.3);
              osc.stop(ctx.currentTime + i * 0.3 + 0.25);
            }
          } catch { /* audio not supported */ }

          // Show native or browser notification
          try {
            showLocalNotification(
              `New ${taskType} order${diff > 1 ? 's' : ''}!`,
              newOrders.map((o: any) => `${o.custom_order_id || o.bookingId || ''} - ${o.customerName || ''}`).join(', ')
            );
          } catch { /* notifications not supported */ }
        }
        prevOrderCount.current = newCount;

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
    } finally {
      setInitialLoading(false);
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
    // Only use orders with valid lat/lng coordinates for accurate routing
    const parseCoords = (o: any): { lat: number; lng: number } | null => {
      if (o.coordinates && typeof o.coordinates.lat === 'number' && typeof o.coordinates.lng === 'number') {
        return { lat: o.coordinates.lat, lng: o.coordinates.lng };
      }
      const m = typeof o.address === 'string' ? o.address.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/) : null;
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
      return null;
    };

    const ordersWithCoords = (orders || [])
      .map(o => ({ order: o, coords: parseCoords(o) }))
      .filter(p => p.coords !== null) as { order: any; coords: { lat: number; lng: number } }[];

    if (ordersWithCoords.length < 2) {
      toast.error('Need at least 2 orders with GPS coordinates to optimize route');
      return;
    }

    const haversine = (a: {lat:number,lng:number}, b: {lat:number,lng:number}) => {
      const toRad = (v:number) => v * Math.PI / 180;
      const R = 6371;
      const dLat = toRad(b.lat - a.lat);
      const dLon = toRad(b.lng - a.lng);
      const aHarv = Math.sin(dLat/2)**2 + Math.sin(dLon/2)**2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
      return R * 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1-aHarv));
    };

    // Nearest-neighbour sort starting from current location if available
    const startCoord = currentLocation
      ? { lat: currentLocation.lat, lng: currentLocation.lng }
      : ordersWithCoords[0].coords;

    const route: { order: any; coords: { lat: number; lng: number } }[] = [];
    let current = startCoord;
    const remaining = [...ordersWithCoords];
    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const dist = haversine(current, remaining[i].coords);
        if (dist < bestDist) { bestDist = dist; bestIndex = i; }
      }
      const picked = remaining.splice(bestIndex, 1)[0];
      route.push(picked);
      current = picked.coords;
    }

    // Build Google Maps URL — use raw lat,lng (no encoding of commas) for proper parsing
    // Waypoints separated by %7C (encoded pipe) as required by Google Maps
    const waypointLimit = 8;
    const routeSlice = route.slice(0, waypointLimit + 1);
    const latLngStr = (c: { lat: number; lng: number }) => `${c.lat},${c.lng}`;

    const destination = latLngStr(routeSlice[routeSlice.length - 1].coords);
    const intermediateStops = routeSlice.slice(0, routeSlice.length - 1).map(r => latLngStr(r.coords));

    let mapsUrl: string;
    if (currentLocation) {
      const originStr = `${currentLocation.lat},${currentLocation.lng}`;
      const waypointsParam = intermediateStops.length > 0 ? `&waypoints=${intermediateStops.join('%7C')}` : '';
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destination}&travelmode=driving${waypointsParam}`;
    } else {
      // No current location — use first stop as origin, last as destination
      const originStr = latLngStr(routeSlice[0].coords);
      const midStops = routeSlice.slice(1, routeSlice.length - 1).map(r => latLngStr(r.coords));
      const waypointsParam = midStops.length > 0 ? `&waypoints=${midStops.join('%7C')}` : '';
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destination}&travelmode=driving${waypointsParam}`;
    }

    toast.loading('Opening optimized route...', { id: 'optimize' });
    window.open(mapsUrl, '_blank');
    setTimeout(() => {
      toast.dismiss('optimize');
      toast.success(`Route opened — ${routeSlice.length} stops`);
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
      {/* GPS signal lost — shown when no fix for >30s (app was backgrounded/sleeping) */}
      {signalLost && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm font-medium flex items-center gap-2 animate-pulse">
          <span>⚠️</span>
          <span>GPS signal lost — bring the app to the foreground to resume tracking</span>
        </div>
      )}
      {locationError && !signalLost && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium flex items-center gap-2">
          <span>📍</span>
          <span>{locationError}</span>
        </div>
      )}
      {initialLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading your orders…</p>
        </div>
      )}
      {!initialLoading && <><div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Assigned Orders</h2>
              <div className="text-xs sm:text-sm text-muted-foreground">Tap order for details</div>
            </div>
            <div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/rider/history')} className="text-xs h-8">Order History</Button>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Optimize pickup route */}
              {(() => {
                const pickups = assignedOrders.filter((o: any) => {
                  const s = (o.status || '').toLowerCase();
                  return s === 'pickup_assigned' || s === 'created' || s === 'vendor_assigned';
                });
                return pickups.length >= 2 ? (
                  <Button size="sm" variant="outline" onClick={() => openOptimizedRoute(pickups)}
                    className="text-xs px-2 py-1 border-purple-300 text-purple-700 hover:bg-purple-50">
                    🧺 Optimize Pickups ({pickups.length})
                  </Button>
                ) : null;
              })()}
              {/* Optimize delivery route */}
              {(() => {
                const deliveries = assignedOrders.filter((o: any) => {
                  const s = (o.status || '').toLowerCase();
                  return s === 'delivery_assigned' || s === 'in_transit' || s === 'ready_for_delivery';
                });
                return deliveries.length >= 2 ? (
                  <Button size="sm" variant="outline" onClick={() => openOptimizedRoute(deliveries)}
                    className="text-xs px-2 py-1 border-orange-300 text-orange-700 hover:bg-orange-50">
                    🚚 Optimize Deliveries ({deliveries.length})
                  </Button>
                ) : null;
              })()}
              {/* Fallback: optimize all if no separate groups */}
              {assignedOrders.length >= 2 && (
                <Button size="sm" variant="outline" onClick={() => openOptimizedRoute(assignedOrders)} disabled={assignedOrders.length < 2}
                  className="text-xs px-2 py-1">
                  🗺️ All Routes
                </Button>
              )}
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
                  eta={etaMap.get(o._id) ?? null}
                />
              ))
            )}
          </div>

          {/* Orders split by pickup / delivery / completed */}
          {assignedOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active orders right now.</div>
          ) : (
            <>
              {/* TO PICKUP - orders where rider needs to collect from customer */}
              {(() => {
                const pickupOrders = assignedOrders.filter((o: any) => {
                  const s = (o.status || '').toLowerCase();
                  return s === 'pickup_assigned' || s === 'created' || s === 'vendor_assigned';
                });
                return pickupOrders.length > 0 ? (
                  <div className="mb-4">
                    <h3 className="text-md font-semibold text-purple-700 flex items-center gap-1 mb-2">🧺 To Pickup <span className="text-xs bg-purple-100 px-2 py-0.5 rounded-full">{pickupOrders.length}</span></h3>
                    <p className="text-xs text-purple-500 mb-2">Collect from customer and bring to laundry</p>
                    {pickupOrders.map((o: any) => (
                      <OrderCard
                        key={`pick_${o._id}`}
                        order={o}
                        currentLocation={currentLocation}
                        onPickup={(id) => handleOrderAction(id, 'start')}
                        onDeliver={(id) => handleOrderAction(id, 'complete')}
                        onNavigate={(order) => openGoogleMapsNavigation(order)}
                        eta={etaMap.get(o._id) ?? null}
                      />
                    ))}
                  </div>
                ) : null;
              })()}

              {/* TO DELIVER - orders where rider delivers cleaned items to customer */}
              {(() => {
                const deliveryOrders = assignedOrders.filter((o: any) => {
                  const s = (o.status || '').toLowerCase();
                  return s === 'delivery_assigned' || s === 'in_transit' || s === 'ready_for_delivery';
                });
                return deliveryOrders.length > 0 ? (
                  <div className="mb-4">
                    <h3 className="text-md font-semibold text-orange-700 flex items-center gap-1 mb-2">🚚 To Deliver <span className="text-xs bg-orange-100 px-2 py-0.5 rounded-full">{deliveryOrders.length}</span></h3>
                    <p className="text-xs text-orange-500 mb-2">Deliver cleaned items back to customer</p>
                    {deliveryOrders.map((o: any) => (
                      <OrderCard
                        key={`del_${o._id}`}
                        order={o}
                        currentLocation={currentLocation}
                        onPickup={(id) => handleOrderAction(id, 'start')}
                        onDeliver={(id) => handleOrderAction(id, 'complete')}
                        onNavigate={(order) => openGoogleMapsNavigation(order)}
                        eta={etaMap.get(o._id) ?? null}
                      />
                    ))}
                  </div>
                ) : null;
              })()}

              {/* COMPLETED - recently completed orders */}
              {(() => {
                const completedOrders = assignedOrders.filter((o: any) => {
                  const s = (o.status || '').toLowerCase();
                  return s === 'delivered' || s === 'completed' || s === 'pickup_completed' || s === 'rider_pickup_done' || s === 'in_progress';
                });
                return completedOrders.length > 0 ? (
                  <div>
                    <h3 className="text-md font-semibold text-green-700 flex items-center gap-1 mb-2">✅ Done <span className="text-xs bg-green-100 px-2 py-0.5 rounded-full">{completedOrders.length}</span></h3>
                    {completedOrders.map((o: any) => (
                      <OrderCard
                        key={`done_${o._id}`}
                        order={o}
                        currentLocation={currentLocation}
                        onPickup={(id) => handleOrderAction(id, 'start')}
                        onDeliver={(id) => handleOrderAction(id, 'complete')}
                        onNavigate={(order) => openGoogleMapsNavigation(order)}
                        eta={etaMap.get(o._id) ?? null}
                      />
                    ))}
                  </div>
                ) : null;
              })()}
            </>
          )}
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
      </>}

    </RiderLayout>
  );
}
