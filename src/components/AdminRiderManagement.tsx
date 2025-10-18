import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { vendorService, type VendorWithDistance } from '@/services/vendorService';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Phone,
  FileText,
  Eye,
  Check,
  X,
  MapPin,
  Navigation,
  Package,
  Clock,
  Activity,
  Search,
  Store
} from 'lucide-react';
import { toast } from 'sonner';
import AdminLiveMap from './AdminLiveMap';

// Component to display rider images with proper URL handling
const RiderImageDisplay: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get the correct image URL based on environment
  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '';

    // If already a full URL, use as-is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    const isDev = import.meta.env.DEV;
    const hostname = window.location.hostname;
    const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");

    if (isLocalhost && isDev) {
      // In local development, proxy to backend
      return `/api${imagePath}`;
    } else {
      // In production/hosted, use direct backend URL
      return `https://home-services-5alb.onrender.com${imagePath}`;
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = (e: any) => {
    console.error('🖼️ Image failed to load:', {
      src,
      imageUrl: getImageUrl(src),
      error: e,
      networkError: e?.target?.error
    });
    setIsLoading(false);
    setHasError(true);
  };

  const imageUrl = getImageUrl(src);

  if (!imageUrl) {
    return (
      <div className="mt-2 p-4 border rounded bg-gray-50 text-center text-gray-500">
        <p>No image path provided</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="mt-2 p-4 border rounded bg-orange-50 text-center">
        <div className="space-y-2">
          <p className="text-orange-600 font-medium">Image failed to load</p>
          <p className="text-xs text-gray-600">Path: {src}</p>
          <p className="text-xs text-gray-600">URL: {imageUrl}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
            }}
            className="mt-2"
          >
            Retry Loading
          </Button>
          <Button
            size="sm"
            variant="link"
            onClick={() => window.open(imageUrl, '_blank')}
            className="mt-1"
          >
            Open in New Tab
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      )}
      <img
        src={imageUrl}
        alt={alt}
        className="w-full h-32 object-cover border rounded cursor-pointer hover:opacity-90 transition-opacity"
        onLoad={handleImageLoad}
        onError={handleImageError}
        onClick={() => window.open(imageUrl, '_blank')}
        style={{ display: isLoading ? 'none' : 'block' }}
        title="Click to open in new tab"
      />
    </div>
  );
};

// Helper function to get the correct API URL for admin rider endpoints
const getAdminApiUrl = (endpoint: string): string => {
  const isDev = import.meta.env.DEV;
  const hostname = window.location.hostname;
  const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const isRenderCom = hostname.includes("onrender.com");
  const isLaundrifyDomain = hostname.includes("laundrify.online");

  console.log('🔍 Admin Rider API URL Detection:', {
    isDev,
    hostname,
    isLocalhost,
    isRenderCom,
    isLaundrifyDomain,
    endpoint
  });

  // Force correct backend URL based on environment
  if (isLocalhost && isDev) {
    // Local development - use proxy
    console.log('🏠 Using local proxy for admin API');
    return `/api/admin${endpoint}`;
  } else if (isRenderCom || isLaundrifyDomain || !isLocalhost) {
    // Any hosted environment - use backend server
    const backendUrl = 'https://home-services-5alb.onrender.com/api/admin' + endpoint;
    console.log('🌐 Using backend server for admin API:', backendUrl);
    return backendUrl;
  }

  // Fallback
  return `/api/admin${endpoint}`;
};

export default function AdminRiderManagement() {
  const [riders, setRiders] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeRiders, setActiveRiders] = useState<any[]>([]);
  const [selectedRider, setSelectedRider] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [combinedAssignModalOpen, setCombinedAssignModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [recommendedVendors, setRecommendedVendors] = useState<VendorWithDistance[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    console.log('🚀 AdminRiderManagement component mounted, fetching data...');

    // Test vendor service on mount
    try {
      const testVendors = vendorService.getActiveVendors();
      console.log('🏪 Vendor service test - active vendors:', testVendors);
    } catch (error) {
      console.error('❌ Vendor service test failed:', error);
    }

    // Directly try to fetch data - let individual functions handle connection issues
    fetchRiders();
    fetchOrders();
    fetchActiveRiders();

    // Set up polling for active riders every 30 seconds (functions will handle connectivity)
    const interval = setInterval(fetchActiveRiders, 30000);

    return () => clearInterval(interval);
  }, []);

  // Debug effect to monitor orders state changes
  useEffect(() => {
    console.log('📊 Orders state updated:', {
      totalOrders: orders.length,
      orderTypes: orders.map(o => ({ id: o._id, type: o.type, assigned: !!(o.assignedRider || o.rider_id) })),
      unassignedCount: orders.filter(o => !o.assignedRider && !o.rider_id).length,
      quickPickupCount: orders.filter(o => o.type === 'Quick Pickup').length
    });
  }, [orders]);

  // Debug vendor state changes
  useEffect(() => {
    console.log('🏪 Vendor state debug:', {
      vendorCount: recommendedVendors.length,
      vendors: recommendedVendors.map(v => ({ name: v.name, distance: v.distance })),
      loadingVendors
    });
  }, [recommendedVendors, loadingVendors]);

  const fetchRiders = async () => {
    try {
      const response = await fetch(getAdminApiUrl('/riders'), {
        headers: {
          'admin-token': 'admin-access-granted' // Simple admin token for demo
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Riders fetched from API:', data.length, 'riders');
        setRiders(data);

        if (data.length > 0) {
          toast.success(`Loaded ${data.length} riders from database`);
        }
      } else {
        console.warn('Failed to fetch riders:', response.status);
        setRiders([]);
      }
    } catch (error) {
      console.log('⚪ Backend unavailable for riders:', error.message);
      setRiders([]); // Prevent crashes with empty array
    }
  };

  const fetchOrders = async () => {
    console.log('📋 Fetching orders from API...');

    try {
      // Use the admin orders endpoint instead of regular bookings endpoint
      const response = await fetch(getAdminApiUrl('/orders?status=pending,confirmed&includeAssigned=false'), {
        headers: {
          'admin-token': 'admin-access-granted'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Admin orders fetched from API:', data);

        // Handle both direct array and object with bookings property
        const apiOrders = Array.isArray(data) ? data : (data.bookings || data.orders || []);

        if (apiOrders.length > 0) {
          console.log('📋 Processing orders from API:', apiOrders.length, 'orders');
          console.log('🔍 Raw API orders:', apiOrders);

          // Process orders to ensure consistent data format with populated customer data
          const processedOrders = apiOrders.map((order: any) => {
            // Handle populated customer_id object vs direct fields
            const customer = order.customer_id || {};
            const customerName = order.customerName ||
                                order.name ||
                                customer.full_name ||
                                customer.name ||
                                'Unknown Customer';
            const customerPhone = order.customerPhone ||
                                 order.phone ||
                                 customer.phone ||
                                 'No phone';
            const customerEmail = order.customerEmail ||
                                 order.email ||
                                 customer.email ||
                                 'No email';

            // Handle populated rider_id object
            const rider = order.rider_id || order.assignedRider || {};
            const riderName = rider.full_name || rider.name || null;
            const riderPhone = rider.phone || null;

            return {
              ...order,
              // Customer information from populated data
              customerName,
              customerPhone,
              customerEmail,
              name: customerName, // Backward compatibility
              phone: customerPhone, // Backward compatibility

              // Rider information from populated data
              riderName,
              riderPhone,
              assignedRider: order.assignedRider || order.rider_id,

              // Normalize order ID fields
              bookingId: order.bookingId || order.custom_order_id || order._id,

              // Ensure status and other required fields
              status: order.status || 'pending',

              // Normalize service info
              service: order.service || (Array.isArray(order.services) ? order.services[0] : 'Laundry Service'),
              services: Array.isArray(order.services) ? order.services : [order.service || 'Laundry Service'],

              // Normalize pricing
              final_amount: order.final_amount || order.total_price || order.estimatedCost || 0,
              total_price: order.total_price || order.final_amount || order.estimatedCost || 0,

              // Normalize time fields
              pickupTime: order.pickupTime || `${order.scheduled_time || '09:00'} - ${order.delivery_time || '17:00'}`,

              // Default type - check for Quick Pickup
              type: order.type || (order.estimatedCost ? 'Quick Pickup' : 'Regular'),

              // Include items and other detailed info
              items: order.items || [],
              item_prices: order.item_prices || [],
              special_instructions: order.special_instructions || order.specialInstructions || order.notes || '',
              address: order.address || 'No address provided',

              // Quick pickup specific fields
              estimatedCost: order.estimatedCost || 0,
              actualCost: order.actualCost || 0,

              // Location coordinates for distance calculation
              location: (() => {
                console.log(`📍 Order ${order._id || order.bookingId} location data:`, {
                  hasCoordinates: !!order.coordinates,
                  coordinates: order.coordinates,
                  hasLat: !!(order.coordinates?.lat),
                  hasLng: !!(order.coordinates?.lng),
                  address: order.address
                });

                // First try to use provided coordinates
                if (order.coordinates && order.coordinates.lat && order.coordinates.lng) {
                  const coords = {
                    lat: parseFloat(order.coordinates.lat),
                    lng: parseFloat(order.coordinates.lng)
                  };
                  console.log(`✅ Using order coordinates:`, coords);
                  return coords;
                }

                // Fallback: try to extract coordinates from address
                if (order.address) {
                  const fallbackCoords = extractCoordinatesFromAddress(order.address);
                  console.log(`🗺️ Using address-based coordinates for order:`, fallbackCoords);
                  return fallbackCoords;
                }

                // Last resort: default Gurugram coordinates
                console.log(`⚠️ Using default coordinates for order`);
                return { lat: 28.4595, lng: 77.0266 };
              })(),
              itemsCollected: order.itemsCollected || [],
              riderStatus: order.riderStatus || 'unassigned'
            };
          });

          console.log('✅ Using real API data:', processedOrders.length, 'orders');
          setOrders(processedOrders);
          if (processedOrders.length > 0) {
            toast.success(`Loaded ${processedOrders.length} real orders from database`);
          }
          return;
        } else {
          console.log('ℹ️ API returned empty results');
          toast.info('No orders found in database');
          setOrders([]);
          return;
        }
      } else {
        const errorText = await response.text();
        console.warn('⚠️ API failed with status:', response.status, errorText);
        if (response.status === 404) {
          toast.error('Orders API not available. Please check backend connection.');
        } else {
          toast.error(`API error: ${response.status}`);
        }
      }
    } catch (error) {
      console.log('⚪ Backend unavailable for orders:', error.message);
      setOrders([]);
    }
  };

  const fetchActiveRiders = async () => {
    try {
      const response = await fetch(getAdminApiUrl('/riders/active'), {
        headers: {
          'admin-token': 'admin-access-granted'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setActiveRiders(data);
      } else {
        console.warn('Failed to fetch active riders:', response.status);
        setActiveRiders([]);
      }
    } catch (error) {
      console.log('⚪ Backend unavailable for active riders:', error.message);
      setActiveRiders([]); // Prevent crashes with empty array
    }
  };

  const handleVerifyRider = async (riderId: string, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch(getAdminApiUrl(`/riders/${riderId}/verify`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'admin-token': 'admin-access-granted'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        toast.success(`Rider ${status} successfully`);
        fetchRiders();
        setVerifyModalOpen(false);
      } else {
        toast.error('Failed to update rider status');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const assignOrderToRider = async () => {
    if (!selectedOrder || !selectedRider) return;

    try {
      const response = await fetch(getAdminApiUrl('/orders/assign'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'admin-token': 'admin-access-granted'
        },
        body: JSON.stringify({
          orderId: selectedOrder._id,
          riderId: selectedRider._id,
          orderType: selectedOrder.type
        })
      });

      if (response.ok) {
        toast.success('Order assigned successfully');
        fetchOrders();
        fetchActiveRiders();
        setAssignModalOpen(false);
      } else {
        toast.error('Failed to assign order');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const loadVendorRecommendations = async (order: any) => {
    console.log('🏪 Loading vendor recommendations for order:', order);
    setLoadingVendors(true);

    try {
      // Always start with default vendors to ensure something shows
      const defaultVendors = vendorService.getActiveVendors().map(vendor => ({
        ...vendor,
        distance: 0,
        estimatedTime: 60
      }));

      console.log('📋 Default vendors loaded:', defaultVendors);
      setRecommendedVendors(defaultVendors);

      // Try to get address and calculate distances
      if (order?.address) {
        const address = typeof order.address === 'string' ? order.address :
          `${order.address?.flatNo || ''} ${order.address?.street || ''} ${order.address?.city || 'Gurugram'}`.trim();

        console.log('🏪 Loading vendor recommendations for address:', address);

        const vendors = await vendorService.getVendorRecommendations(
          address,
          order.services || []
        );

        console.log('✅ Loaded vendor recommendations with distances:', vendors);
        if (vendors && vendors.length > 0) {
          setRecommendedVendors(vendors);
        }
      } else {
        console.warn('⚠️ No address found for order, using default vendors');
      }
    } catch (error) {
      console.error('❌ Error loading vendor recommendations:', error);
      // Ensure we always have vendors showing
      const fallbackVendors = vendorService.getActiveVendors().map(vendor => ({
        ...vendor,
        distance: 0,
        estimatedTime: 60
      }));
      setRecommendedVendors(fallbackVendors);
    } finally {
      setLoadingVendors(false);
    }
  };

  const openVendorModal = (order: any) => {
    setSelectedOrder(order);
    setVendorModalOpen(true);
    setSelectedVendor('');
    loadVendorRecommendations(order);
  };

  // Function to open combined assignment modal
  const openCombinedAssignModal = (order: any) => {
    console.log('🚚🏪 Opening combined assignment modal for order:', order);
    setSelectedOrder(order);
    setCombinedAssignModalOpen(true);
    setSelectedRider(null);
    setSelectedVendor('');

    // Always ensure we have vendors to display
    const defaultVendors = vendorService.getActiveVendors().map(vendor => ({
      ...vendor,
      distance: 0,
      estimatedTime: 60
    }));
    console.log('🏪 Setting default vendors immediately:', defaultVendors);
    setRecommendedVendors(defaultVendors);

    // Then try to load with distance calculations
    loadVendorRecommendations(order);
  };

  const assignVendorToOrder = async () => {
    if (!selectedOrder || !selectedVendor) return;

    try {
      const selectedVendorData = recommendedVendors.find(v => v.id === selectedVendor);

      console.log('🏪 Assigning vendor to order:', {
        order: selectedOrder._id,
        vendor: selectedVendor,
        vendorData: selectedVendorData,
        orderType: selectedOrder.type
      });

      const response = await fetch(getAdminApiUrl('/orders/assign-vendor'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'admin-token': 'admin-access-granted'
        },
        body: JSON.stringify({
          orderId: selectedOrder._id,
          vendorData: {
            vendorId: selectedVendor,
            vendorName: selectedVendorData?.name,
            vendorAddress: selectedVendorData?.address,
            distance: selectedVendorData?.distance,
            estimatedTime: selectedVendorData?.estimatedTime
          },
          orderType: selectedOrder.type
        })
      });

      if (response.ok) {
        toast.success(`${selectedVendorData?.name || 'Vendor'} assigned successfully`);
        fetchOrders();
        setVendorModalOpen(false);
        setSelectedVendor('');
      } else {
        toast.error('Failed to assign vendor');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  // Combined assignment function for rider and vendor together
  const assignRiderAndVendor = async () => {
    if (!selectedOrder || !selectedRider || !selectedVendor) return;

    try {
      const selectedVendorData = recommendedVendors.find(v => v.id === selectedVendor);

      console.log('🚚🏪 Assigning rider and vendor together:', {
        order: selectedOrder._id,
        rider: selectedRider._id,
        vendor: selectedVendor,
        vendorData: selectedVendorData,
        orderType: selectedOrder.type
      });

      // First assign rider
      const riderResponse = await fetch(getAdminApiUrl('/orders/assign'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'admin-token': 'admin-access-granted'
        },
        body: JSON.stringify({
          orderId: selectedOrder._id,
          riderId: selectedRider._id,
          orderType: selectedOrder.type
        })
      });

      if (!riderResponse.ok) {
        throw new Error('Failed to assign rider');
      }

      // Then assign vendor
      const vendorResponse = await fetch(getAdminApiUrl('/orders/assign-vendor'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'admin-token': 'admin-access-granted'
        },
        body: JSON.stringify({
          orderId: selectedOrder._id,
          vendorData: {
            vendorId: selectedVendor,
            vendorName: selectedVendorData?.name,
            vendorAddress: selectedVendorData?.address,
            distance: selectedVendorData?.distance,
            estimatedTime: selectedVendorData?.estimatedTime
          },
          orderType: selectedOrder.type
        })
      });

      if (!vendorResponse.ok) {
        throw new Error('Failed to assign vendor');
      }

      toast.success(`✅ Order assigned to ${selectedRider.name} and ${selectedVendorData?.name}`);
      fetchOrders();
      fetchActiveRiders();
      setAssignModalOpen(false);
      setCombinedAssignModalOpen(false);
      setSelectedRider(null);
      setSelectedVendor('');
    } catch (error) {
      console.error('Error in combined assignment:', error);
      toast.error('Failed to assign rider and vendor. Please try again.');
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in kilometers
    return d.toFixed(1);
  };

  // Helper function to extract coordinates from address
  const extractCoordinatesFromAddress = (address: string): { lat: number; lng: number } => {
    if (!address || typeof address !== 'string') {
      return { lat: 28.4595, lng: 77.0266 }; // Default Gurugram
    }

    const addressLower = address.toLowerCase();

    // Common Gurugram coordinates
    const sectorCoordinates: Record<string, { lat: number; lng: number }> = {
      'sector 69': { lat: 28.3984, lng: 77.0648 },
      'sector 70': { lat: 28.3920, lng: 77.0580 },
      'sector 71': { lat: 28.3890, lng: 77.0520 },
      'sector 14': { lat: 28.4595, lng: 77.0266 },
      'sector 25': { lat: 28.4949, lng: 77.0828 },
      'sector 54': { lat: 28.4211, lng: 77.0869 },
      'sector 15': { lat: 28.4650, lng: 77.0300 },
      'sector 44': { lat: 28.4400, lng: 77.0500 },
      'sector 50': { lat: 28.4250, lng: 77.0600 },
      'cyber city': { lat: 28.4949, lng: 77.0828 },
      'mg road': { lat: 28.4595, lng: 77.0266 },
      'golf course road': { lat: 28.4211, lng: 77.0869 },
      'sohna road': { lat: 28.4089, lng: 77.0520 },
      'dwarka expressway': { lat: 28.4089, lng: 76.9560 }
    };

    // Find matching area
    for (const [area, coords] of Object.entries(sectorCoordinates)) {
      if (addressLower.includes(area)) {
        return coords;
      }
    }

    // Try to extract sector number
    const sectorMatch = addressLower.match(/sector[\s\-]*([0-9]+)/);
    if (sectorMatch) {
      const sectorNum = parseInt(sectorMatch[1]);
      const baseLat = 28.4595;
      const baseLng = 77.0266;
      const latOffset = (sectorNum % 10) * 0.008;
      const lngOffset = Math.floor(sectorNum / 10) * 0.008;

      return {
        lat: baseLat + latOffset,
        lng: baseLng + lngOffset
      };
    }

    // Default coordinates
    return { lat: 28.4595, lng: 77.0266 };
  };

  const getNearestRiders = (orderLocation: {lat: number, lng: number} | null) => {
    console.log('🗺️ Distance calculation debug:', {
      orderLocation,
      activeRidersCount: activeRiders.length,
      activeRiders: activeRiders.map(r => ({ name: r.name, location: r.location }))
    });

    // Ensure we always have order location
    const effectiveOrderLocation = orderLocation || { lat: 28.4595, lng: 77.0266 };

    return activeRiders
      .map(rider => {
        let distance = 'Unknown';

        if (effectiveOrderLocation && rider.location) {
          try {
            const calculatedDistance = calculateDistance(
              effectiveOrderLocation.lat,
              effectiveOrderLocation.lng,
              rider.location.lat,
              rider.location.lng
            );
            distance = calculatedDistance;
            console.log(`📍 Distance from ${rider.name} to order: ${distance} km`);
          } catch (error) {
            console.error('❌ Distance calculation error:', error);
            distance = 'Error';
          }
        } else if (effectiveOrderLocation && !rider.location) {
          console.log(`⚠️ Rider ${rider.name} has no location data`);
          distance = 'No GPS';
        } else {
          console.log(`⚠️ Missing location data for ${rider.name}:`, {
            hasOrderLocation: !!effectiveOrderLocation,
            hasRiderLocation: !!rider.location,
            orderLocation: effectiveOrderLocation,
            riderLocation: rider.location
          });
        }

        return {
          ...rider,
          distance
        };
      })
      .sort((a, b) => {
        if (typeof a.distance === 'string') return 1;
        if (typeof b.distance === 'string') return -1;
        return parseFloat(a.distance as string) - parseFloat(b.distance as string);
      });
  };

  const filteredRiders = riders.filter(rider =>
    rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rider.phone.includes(searchTerm) ||
    rider.aadharNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="verification" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="active">Active Riders</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="quick-pickups">Quick Pickups</TabsTrigger>
          <TabsTrigger value="tracking">Live Tracking</TabsTrigger>
        </TabsList>

        {/* Rider Verification Tab */}
        <TabsContent value="verification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Rider Verification</span>
              </CardTitle>
              <CardDescription>
                Review and verify rider registrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search riders by name, phone, or Aadhar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                <div className="grid gap-4">
                  {filteredRiders.map((rider) => (
                    <Card key={rider._id} className="border-l-4 border-l-laundrify-purple">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <h4 className="font-semibold">{rider.name}</h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span className="flex items-center space-x-1">
                                <Phone className="h-3 w-3" />
                                <span>{rider.phone}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <FileText className="h-3 w-3" />
                                <span>{rider.aadharNumber}</span>
                              </span>
                            </div>
                            <Badge variant={
                              rider.status === 'approved' ? 'default' :
                              rider.status === 'rejected' ? 'destructive' : 'secondary'
                            }>
                              {rider.status}
                            </Badge>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Dialog 
                              open={verifyModalOpen && selectedRider?._id === rider._id}
                              onOpenChange={(open) => {
                                setVerifyModalOpen(open);
                                if (open) setSelectedRider(rider);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Rider Verification</DialogTitle>
                                  <DialogDescription>
                                    Review rider details and documents
                                  </DialogDescription>
                                </DialogHeader>
                                
                                {selectedRider && (
                                  <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="font-medium">Name</Label>
                                        <p>{selectedRider.name}</p>
                                      </div>
                                      <div>
                                        <Label className="font-medium">Phone</Label>
                                        <p>{selectedRider.phone}</p>
                                      </div>
                                      <div>
                                        <Label className="font-medium">Aadhar Number</Label>
                                        <p>{selectedRider.aadharNumber}</p>
                                      </div>
                                      <div>
                                        <Label className="font-medium">Registration Date</Label>
                                        <p>{new Date(selectedRider.createdAt).toLocaleDateString()}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="font-medium">Aadhar Card</Label>
                                        {selectedRider.aadharImageUrl ? (
                                          <RiderImageDisplay
                                            src={selectedRider.aadharImageUrl}
                                            alt="Aadhar Card"
                                          />
                                        ) : (
                                          <div className="mt-2 p-4 border rounded bg-gray-50 text-center text-gray-500">
                                            No image uploaded
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <Label className="font-medium">Selfie</Label>
                                        {selectedRider.selfieImageUrl ? (
                                          <RiderImageDisplay
                                            src={selectedRider.selfieImageUrl}
                                            alt="Selfie"
                                          />
                                        ) : (
                                          <div className="mt-2 p-4 border rounded bg-gray-50 text-center text-gray-500">
                                            No image uploaded
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {selectedRider.status === 'pending' && (
                                      <div className="flex space-x-4">
                                        <Button
                                          onClick={() => handleVerifyRider(selectedRider._id, 'approved')}
                                          className="flex-1"
                                        >
                                          <Check className="h-4 w-4 mr-2" />
                                          Approve
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          onClick={() => handleVerifyRider(selectedRider._id, 'rejected')}
                                          className="flex-1"
                                        >
                                          <X className="h-4 w-4 mr-2" />
                                          Reject
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {filteredRiders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No riders found</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Riders Tab */}
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Active Riders ({activeRiders.length})</span>
              </CardTitle>
              <CardDescription>
                Currently active riders available for assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {activeRiders.map((rider) => (
                  <Card key={rider._id} className="border-l-4 border-l-green-500">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold">{rider.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="flex items-center space-x-1">
                              <Phone className="h-3 w-3" />
                              <span>{rider.phone}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {rider.location ? 
                                  `${rider.location.lat.toFixed(4)}, ${rider.location.lng.toFixed(4)}` : 
                                  'Location not available'
                                }
                              </span>
                            </span>
                          </div>
                          <Badge variant="default" className="mt-2">
                            <Activity className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        </div>
                        
                        <div className="text-right text-xs text-gray-500">
                          Last updated: {rider.lastLocationUpdate ? 
                            new Date(rider.lastLocationUpdate).toLocaleTimeString() : 
                            'Unknown'
                          }
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {activeRiders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No active riders</p>
                    <p className="text-sm">Riders will appear here when they go active</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order Assignment Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Order Assignment</span>
              </CardTitle>
              <CardDescription>
                Manually assign orders to available riders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {orders.filter(order => {
                  // Check if order is unassigned (not assigned to any rider)
                  const isUnassigned = !order.assignedRider && !order.rider_id &&
                                      (!order.riderStatus || order.riderStatus === 'unassigned');
                  console.log('🔍 Order filter check:', {
                    orderId: order._id,
                    assignedRider: order.assignedRider,
                    rider_id: order.rider_id,
                    riderStatus: order.riderStatus,
                    isUnassigned
                  });
                  return isUnassigned;
                })
                .sort((a, b) => {
                  // Sort by pickup time - earliest first
                  const timeA = a.pickupTime || a.scheduled_time || '23:59';
                  const timeB = b.pickupTime || b.scheduled_time || '23:59';
                  const dateA = a.pickupDate || a.scheduled_date || '2099-12-31';
                  const dateB = b.pickupDate || b.scheduled_date || '2099-12-31';

                  // Combine date and time for comparison
                  const datetimeA = new Date(`${dateA} ${timeA}`);
                  const datetimeB = new Date(`${dateB} ${timeB}`);

                  return datetimeA.getTime() - datetimeB.getTime();
                })
                .map((order) => (
                  <Card key={order._id} className="border-l-4 border-l-orange-500 shadow-sm">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Order Header - Full width */}
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                            <h4 className="font-bold text-xl text-gray-900">
                              Order #{order.custom_order_id || order.bookingId || order._id}
                            </h4>
                            <div className="flex gap-2">
                              <Badge
                                variant={order.type === 'Quick Pickup' ? 'default' : 'secondary'}
                                className={order.type === 'Quick Pickup' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
                              >
                                {order.type || 'Regular'} Order
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {order.status || 'pending'}
                              </Badge>
                            </div>
                          </div>

                          <Dialog
                            open={combinedAssignModalOpen && selectedOrder?._id === order._id}
                            onOpenChange={(open) => {
                              setCombinedAssignModalOpen(open);
                              if (open) openCombinedAssignModal(order);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-green-500 hover:from-orange-600 hover:to-green-600 text-white shadow-lg">
                                <Navigation className="h-4 w-4 mr-2" />
                                <Store className="h-4 w-4 mr-1" />
                                Assign Rider & Vendor
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="flex items-center space-x-2">
                                  <Navigation className="h-5 w-5 text-orange-500" />
                                  <Store className="h-5 w-5 text-green-500" />
                                  <span>Assign Rider & Vendor Together</span>
                                </DialogTitle>
                                <DialogDescription>
                                  Select both a rider and vendor to assign this order completely. Distance from pickup to vendor is shown for each vendor.
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                                {/* Order Details */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <Label className="font-medium text-lg">Order Details</Label>
                                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium">Order ID:</span>
                                      <p className="text-gray-600">#{selectedOrder?.custom_order_id || selectedOrder?.bookingId}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium">Customer:</span>
                                      <p className="text-gray-600">{selectedOrder?.name || selectedOrder?.customerName}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium">Phone:</span>
                                      <p className="text-gray-600">{selectedOrder?.customerPhone || selectedOrder?.phone}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium">Type:</span>
                                      <p className="text-gray-600">{selectedOrder?.type || 'Regular'} Order</p>
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <span className="font-medium">Pickup Address:</span>
                                    <p className="text-gray-600 text-sm bg-white p-2 rounded border mt-1">
                                      {selectedOrder?.address || 'Address not available'}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Rider Selection */}
                                  <div className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                      <Navigation className="h-5 w-5 text-orange-500" />
                                      <Label className="font-medium text-lg">Select Rider</Label>
                                    </div>
                                    <div className="border rounded-lg p-3 max-h-64 overflow-y-auto">
                                      {selectedOrder && getNearestRiders(selectedOrder.location || null).map((rider) => (
                                        <div
                                          key={rider._id}
                                          className={`p-3 border rounded mb-2 cursor-pointer transition-colors ${
                                            selectedRider?._id === rider._id ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50'
                                          }`}
                                          onClick={() => setSelectedRider(rider)}
                                        >
                                          <div className="flex justify-between items-center">
                                            <div>
                                              <p className="font-medium">{rider.name}</p>
                                              <p className="text-sm text-gray-600">{rider.phone}</p>
                                              <p className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded mt-1">
                                        📍 {typeof rider.distance === 'string' ? rider.distance : `${rider.distance} km`} away from pickup
                                      </p>
                                            </div>
                                            <Badge variant="outline" className="bg-orange-50">
                                              Available
                                            </Badge>
                                          </div>
                                        </div>
                                      ))}

                                      {(!selectedOrder || getNearestRiders(selectedOrder.location || null).length === 0) && (
                                        <p className="text-center text-gray-500 py-4">
                                          No active riders available
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Vendor Selection */}
                                  <div className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                      <Store className="h-5 w-5 text-green-500" />
                                      <Label className="font-medium text-lg">Select Vendor</Label>
                                    </div>
                                    <div className="text-xs text-gray-500 mb-2">
                                      📍 Distance from pickup to vendor shown below
                                    </div>
                                    {loadingVendors ? (
                                      <div className="flex items-center justify-center py-8 border rounded-lg">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                                        <span className="ml-2 text-sm text-gray-600">Loading vendors...</span>
                                      </div>
                                    ) : (
                                      <div className="border rounded-lg p-3 max-h-64 overflow-y-auto">
                                        {recommendedVendors.length > 0 ? (
                                          recommendedVendors.map((vendor) => (
                                            <div
                                              key={vendor.id}
                                              className={`p-4 border rounded mb-2 cursor-pointer transition-colors ${
                                                selectedVendor === vendor.id ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'
                                              }`}
                                              onClick={() => setSelectedVendor(vendor.id)}
                                            >
                                              <div className="space-y-2">
                                                <div className="font-medium text-gray-900">{vendor.name}</div>
                                                <div className="text-sm text-gray-600 leading-relaxed">
                                                  {vendor.address}
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                    📍 {vendor.distance > 0 ? vendorService.formatDistance(vendor.distance) : 'Calculating...'} from pickup
                                  </Badge>
                                                  <Badge variant="outline" className="text-xs">
                                                    ⏱️ {vendorService.formatEstimatedTime(vendor.estimatedTime)}
                                                  </Badge>
                                                  {vendor.rating && (
                                                    <Badge variant="outline" className="text-xs">
                                                      ⭐ {vendor.rating}
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-center py-8 text-gray-500">
                                            <Store className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                            <p className="font-medium">No vendors available</p>
                                            <p className="text-sm">Vendor data failed to load</p>
                                            <div className="mt-3 text-xs bg-yellow-50 p-3 rounded border">
                                              <p><strong>Debug Info:</strong></p>
                                              <p>Vendors array length: {recommendedVendors.length}</p>
                                              <p>Loading state: {loadingVendors ? 'true' : 'false'}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Assignment Summary */}
                                {selectedRider && selectedVendor && (
                                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <h4 className="font-medium text-blue-900 mb-2">✅ Assignment Summary</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium text-blue-800">Selected Rider:</span>
                                        <p className="text-blue-700">{selectedRider.name} ({selectedRider.phone})</p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-blue-800">Selected Vendor:</span>
                                        <p className="text-blue-700">
                                          {recommendedVendors.find(v => v.id === selectedVendor)?.name}
                                        </p>
                                        <p className="text-xs text-blue-600">
                                          📍 {vendorService.formatDistance(recommendedVendors.find(v => v.id === selectedVendor)?.distance || 0)} from pickup location
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <Button
                                  onClick={assignRiderAndVendor}
                                  disabled={!selectedRider || !selectedVendor}
                                  className="w-full bg-gradient-to-r from-orange-500 to-green-500 hover:from-orange-600 hover:to-green-600 text-white py-3"
                                  size="lg"
                                >
                                  <Navigation className="h-4 w-4 mr-2" />
                                  <Store className="h-4 w-4 mr-2" />
                                  Assign Rider & Vendor Together
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {/* Show vendor assignment button only if rider is assigned */}
                          {(order.assignedRider || order.rider_id) && (
                            <Dialog
                              open={vendorModalOpen && selectedOrder?._id === order._id}
                              onOpenChange={(open) => {
                                setVendorModalOpen(open);
                                if (!open) setSelectedOrder(null);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="lg"
                                  className="bg-green-500 hover:bg-green-600 text-white ml-2"
                                  onClick={() => openVendorModal(order)}
                                >
                                  <Store className="h-4 w-4 mr-2" />
                                  Assign Vendor
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Assign Vendor to Order</DialogTitle>
                                  <DialogDescription>
                                    Select a vendor for order processing
                                  </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4">
                                  <div>
                                    <Label className="font-medium">Order Details</Label>
                                    <p className="text-sm text-gray-600">
                                      #{order.custom_order_id || order.bookingId} - {order.name || order.customerName}
                                    </p>
                                    {order.assignedVendor && (
                                      <p className="text-sm text-green-600 font-medium">
                                        Current Vendor: {order.assignedVendor}
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <Label className="font-medium">Select Vendor</Label>
                                    <div className="text-xs text-gray-500 mb-2">
                                      Sorted by distance from pickup location
                                    </div>
                                    {loadingVendors ? (
                                      <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                        <span className="ml-2 text-sm text-gray-600">Loading vendors...</span>
                                      </div>
                                    ) : (
                                      <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                                        {recommendedVendors.map((vendor) => (
                                          <div
                                            key={vendor.id}
                                            className={`p-3 border rounded cursor-pointer transition-colors ${
                                              selectedVendor === vendor.id ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'
                                            }`}
                                            onClick={() => setSelectedVendor(vendor.id)}
                                          >
                                            <div className="flex justify-between items-start">
                                              <div className="flex-1">
                                                <div className="font-medium">{vendor.name}</div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                  {vendor.address}
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                  <Badge variant="secondary" className="text-xs">
                                                    📍 {vendorService.formatDistance(vendor.distance)}
                                                  </Badge>
                                                  <Badge variant="outline" className="text-xs">
                                                    ⏱️ {vendorService.formatEstimatedTime(vendor.estimatedTime)}
                                                  </Badge>
                                                  {vendor.rating && (
                                                    <Badge variant="outline" className="text-xs">
                                                      ⭐ {vendor.rating}
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <Button
                                    onClick={assignVendorToOrder}
                                    disabled={!selectedVendor}
                                    className="w-full"
                                  >
                                    Assign Vendor
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left Column */}
                          <div className="space-y-4">
                            {/* Customer Information */}
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <h5 className="font-semibold text-blue-900 mb-3 flex items-center">
                                <User className="h-4 w-4 mr-2" />
                                Customer Details
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-blue-700 font-medium">Name:</span>
                                  <span className="font-semibold">{order.name || order.customerName || 'N/A'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-blue-700 font-medium">Phone:</span>
                                  <span className="font-semibold">{order.phone || order.customerPhone || 'N/A'}</span>
                                </div>
                                {order.customer_id && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-blue-700 font-medium">Customer ID:</span>
                                    <span className="text-xs font-mono bg-blue-100 px-2 py-1 rounded">
                                      {order.customer_id}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Service Information */}
                            {order.service && (
                              <div className="bg-green-50 p-4 rounded-lg">
                                <h5 className="font-semibold text-green-900 mb-3 flex items-center">
                                  <Package className="h-4 w-4 mr-2" />
                                  Service Details
                                </h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-green-700 font-medium">Service:</span>
                                    <span className="font-semibold">{order.service}</span>
                                  </div>
                                  {order.services && order.services.length > 0 && (
                                    <div>
                                      <span className="text-green-700 font-medium block mb-2">Additional Services:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {order.services.map((service, index) => (
                                          <Badge key={index} variant="outline" className="text-xs bg-green-100">
                                            {service}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {order.final_amount && (
                                    <div className="flex items-center justify-between border-t border-green-200 pt-2 mt-2">
                                      <span className="text-green-700 font-medium">Amount:</span>
                                      <div className="text-right">
                                        <span className="text-green-700 font-bold text-lg">₹{order.final_amount}</span>
                                        {order.total_price && order.final_amount !== order.total_price && (
                                          <div className="text-xs text-gray-500 line-through">₹{order.total_price}</div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Quick Pickup Specific */}
                            {order.type === 'Quick Pickup' && order.estimatedCost > 0 && (
                              <div className="bg-orange-50 p-4 rounded-lg">
                                <h5 className="font-semibold text-orange-900 mb-3">Quick Pickup Details</h5>
                                <div className="flex items-center justify-between">
                                  <span className="text-orange-700 font-medium">Estimated Cost:</span>
                                  <span className="text-orange-700 font-bold text-lg">₹{order.estimatedCost}</span>
                                </div>
                              </div>
                            )}

                            {/* Assignment Information */}
                            <div className="bg-purple-50 p-4 rounded-lg">
                              <h5 className="font-semibold text-purple-900 mb-3 flex items-center">
                                <Navigation className="h-4 w-4 mr-2" />
                                Assignment Details
                              </h5>
                              <div className="space-y-2 text-sm">
                                {/* Rider Assignment */}
                                <div className="flex items-center justify-between">
                                  <span className="text-purple-700 font-medium">Assigned Rider:</span>
                                  <span className="font-semibold">
                                    {order.assignedRider ? 'Assigned' : order.rider_id ? 'Assigned' : 'Unassigned'}
                                  </span>
                                </div>
                                {order.assignedRiderPhone && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-purple-700 font-medium">Rider Phone:</span>
                                    <span className="font-semibold">{order.assignedRiderPhone}</span>
                                  </div>
                                )}
                                {order.rider_phone && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-purple-700 font-medium">Rider Phone:</span>
                                    <span className="font-semibold">{order.rider_phone}</span>
                                  </div>
                                )}
                                {order.assignedAt && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-purple-700 font-medium">Assigned At:</span>
                                    <span className="text-xs">{new Date(order.assignedAt).toLocaleString()}</span>
                                  </div>
                                )}

                                {/* Vendor Assignment */}
                                <div className="border-t border-purple-200 pt-2 mt-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-purple-700 font-medium">Assigned Vendor:</span>
                                    <span className="font-semibold">
                                      {order.assignedVendor || order.assigned_vendor || 'Not Assigned'}
                                    </span>
                                  </div>
                                  {(order.assignedVendorDetails || order.assigned_vendor_details) && (
                                    <div className="mt-2 text-xs bg-purple-100 p-2 rounded">
                                      <div className="font-medium">
                                        {order.assignedVendorDetails?.name || order.assigned_vendor_details?.name}
                                      </div>
                                      <div className="text-purple-600">
                                        {order.assignedVendorDetails?.address || order.assigned_vendor_details?.address}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Column */}
                          <div className="space-y-4">
                            {/* Address & Timing */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                                <MapPin className="h-4 w-4 mr-2" />
                                Pickup Information
                              </h5>
                              <div className="space-y-3 text-sm">
                                <div>
                                  <span className="text-gray-700 font-medium block mb-1">Address:</span>
                                  <p className="text-gray-900 bg-white p-2 rounded border">
                                    {order.address || 'Address not available'}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-700 font-medium flex items-center">
                                    <Clock className="h-4 w-4 mr-1" />
                                    Pickup Time:
                                  </span>
                                  <span className="font-semibold">
                                    {order.scheduled_date && order.scheduled_time ?
                                      `${order.scheduled_date} at ${order.scheduled_time}` :
                                      order.pickupTime || 'Time not specified'
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Special Instructions */}
                            {(order.special_instructions || order.specialInstructions || order.additional_details) && (
                              <div className="bg-yellow-50 p-4 rounded-lg">
                                <h5 className="font-semibold text-yellow-900 mb-3 flex items-center">
                                  <FileText className="h-4 w-4 mr-2" />
                                  Special Instructions
                                </h5>
                                <div className="space-y-2 text-sm">
                                  {order.special_instructions && (
                                    <div className="bg-white p-3 rounded border">
                                      <span className="font-medium text-yellow-800">Instructions:</span>
                                      <p className="text-gray-900 mt-1">{order.special_instructions}</p>
                                    </div>
                                  )}
                                  {order.specialInstructions && order.specialInstructions !== order.special_instructions && (
                                    <div className="bg-white p-3 rounded border">
                                      <span className="font-medium text-yellow-800">Special Instructions:</span>
                                      <p className="text-gray-900 mt-1">{order.specialInstructions}</p>
                                    </div>
                                  )}
                                  {order.additional_details && (
                                    <div className="bg-white p-3 rounded border">
                                      <span className="font-medium text-yellow-800">Additional Details:</span>
                                      <p className="text-gray-700 text-xs mt-1">{order.additional_details}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {orders.filter(order => {
                  const isUnassigned = !order.assignedRider && !order.rider_id &&
                                      (!order.riderStatus || order.riderStatus === 'unassigned');
                  return isUnassigned;
                }).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No unassigned orders</p>
                    <p className="text-sm">New orders will appear here for assignment</p>
                    <div className="mt-4 text-xs bg-blue-50 p-3 rounded-lg border">
                      <p className="font-medium text-blue-800">Debug Info:</p>
                      <p className="text-blue-700">Total orders loaded: {orders.length}</p>
                      <p className="text-blue-700">Orders with assignment: {orders.filter(o => o.assignedRider || o.rider_id).length}</p>
                      <p className="text-blue-700">Quick pickups: {orders.filter(o => o.type === 'Quick Pickup').length}</p>
                      <p className="text-blue-700">Regular orders: {orders.filter(o => o.type !== 'Quick Pickup').length}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Pickup Tab */}
        <TabsContent value="quick-pickups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Quick Pickup Orders</span>
              </CardTitle>
              <CardDescription>
                Manage quick pickup orders and assign to riders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {orders.filter(order => {
                  const isQuickPickup = order.type === 'Quick Pickup';
                  const isUnassigned = !order.assignedRider && !order.rider_id &&
                                      (!order.riderStatus || order.riderStatus === 'unassigned');
                  console.log('🔍 Quick Pickup filter check:', {
                    orderId: order._id,
                    type: order.type,
                    isQuickPickup,
                    isUnassigned,
                    shouldShow: isQuickPickup && isUnassigned
                  });
                  return isQuickPickup && isUnassigned;
                })
                .sort((a, b) => {
                  // Sort by pickup time - earliest first
                  const timeA = a.pickupTime || a.scheduled_time || '23:59';
                  const timeB = b.pickupTime || b.scheduled_time || '23:59';
                  const dateA = a.pickupDate || a.scheduled_date || '2099-12-31';
                  const dateB = b.pickupDate || b.scheduled_date || '2099-12-31';

                  // Combine date and time for comparison
                  const datetimeA = new Date(`${dateA} ${timeA}`);
                  const datetimeB = new Date(`${dateB} ${timeB}`);

                  return datetimeA.getTime() - datetimeB.getTime();
                })
                .map((order) => (
                  <Card key={order._id} className="border-l-4 border-l-orange-600">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <h4 className="font-semibold">Quick Pickup #{order.bookingId}</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center space-x-2">
                              <User className="h-3 w-3" />
                              <span>{order.customerName}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Phone className="h-3 w-3" />
                              <span>{order.customerPhone}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-3 w-3" />
                              <span>{order.address}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3" />
                              <span>{order.pickupTime}</span>
                            </div>
                            {order.specialInstructions && (
                              <div className="flex items-start space-x-2">
                                <FileText className="h-3 w-3 mt-0.5" />
                                <span className="text-xs bg-blue-50 p-1 rounded">{order.specialInstructions}</span>
                              </div>
                            )}
                            {order.estimatedCost > 0 && (
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium bg-green-50 px-2 py-1 rounded">
                                  Est. Cost: ��{order.estimatedCost}
                                </span>
                              </div>
                            )}
                          </div>
                          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
                            Quick Pickup
                          </Badge>
                        </div>

                        <Dialog
                          open={assignModalOpen && selectedOrder?._id === order._id}
                          onOpenChange={(open) => {
                            setAssignModalOpen(open);
                            if (open) setSelectedOrder(order);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                              <Navigation className="h-4 w-4 mr-2" />
                              Assign Rider
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign Quick Pickup to Rider</DialogTitle>
                              <DialogDescription>
                                Select a rider to assign this quick pickup to
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div>
                                <Label className="font-medium">Quick Pickup Details</Label>
                                <p className="text-sm text-gray-600">
                                  #{selectedOrder?.bookingId} - {selectedOrder?.customerName}
                                </p>
                                {selectedOrder?.specialInstructions && (
                                  <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-1">
                                    <strong>Instructions:</strong> {selectedOrder.specialInstructions}
                                  </p>
                                )}
                              </div>

                              <div>
                                <Label className="font-medium">Available Riders</Label>
                                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                                  {activeRiders.map((rider) => (
                                    <div
                                      key={rider._id}
                                      className={`p-3 border rounded cursor-pointer transition-colors ${
                                        selectedRider?._id === rider._id ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50'
                                      }`}
                                      onClick={() => setSelectedRider(rider)}
                                    >
                                      <div className="flex justify-between items-center">
                                        <div>
                                          <p className="font-medium">{rider.name}</p>
                                          <p className="text-sm text-gray-600">{rider.phone}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-orange-50">
                                          Available
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}

                                  {activeRiders.length === 0 && (
                                    <p className="text-center text-gray-500 py-4">
                                      No active riders available
                                    </p>
                                  )}
                                </div>
                              </div>

                              <Button
                                onClick={assignOrderToRider}
                                disabled={!selectedRider}
                                className="w-full bg-orange-500 hover:bg-orange-600"
                              >
                                Assign Quick Pickup
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Show vendor assignment button only if rider is assigned */}
                        {(order.assignedRider || order.rider_id) && (
                          <Dialog
                            open={vendorModalOpen && selectedOrder?._id === order._id}
                            onOpenChange={(open) => {
                              setVendorModalOpen(open);
                              if (!open) setSelectedOrder(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="lg"
                                className="bg-green-500 hover:bg-green-600 text-white ml-2"
                                onClick={() => openVendorModal(order)}
                              >
                                <Store className="h-4 w-4 mr-2" />
                                Assign Vendor
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Assign Vendor to Quick Pickup</DialogTitle>
                                <DialogDescription>
                                  Select a vendor for quick pickup processing
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                <div>
                                  <Label className="font-medium">Quick Pickup Details</Label>
                                  <p className="text-sm text-gray-600">
                                    {order.customerName} - {order.address}
                                  </p>
                                  {order.assigned_vendor && (
                                    <p className="text-sm text-green-600 font-medium">
                                      Current Vendor: {order.assigned_vendor}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <Label className="font-medium">Select Vendor</Label>
                                  <div className="text-xs text-gray-500 mb-2">
                                    Sorted by distance from pickup location
                                  </div>
                                  {loadingVendors ? (
                                    <div className="flex items-center justify-center py-4">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                      <span className="ml-2 text-sm text-gray-600">Loading vendors...</span>
                                    </div>
                                  ) : (
                                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                                      {recommendedVendors.map((vendor) => (
                                        <div
                                          key={vendor.id}
                                          className={`p-3 border rounded cursor-pointer transition-colors ${
                                            selectedVendor === vendor.id ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'
                                          }`}
                                          onClick={() => setSelectedVendor(vendor.id)}
                                        >
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <div className="font-medium">{vendor.name}</div>
                                              <div className="text-sm text-gray-600 mt-1">
                                                {vendor.address}
                                              </div>
                                              <div className="flex items-center gap-2 mt-2">
                                                <Badge variant="secondary" className="text-xs">
                                                  📍 {vendorService.formatDistance(vendor.distance)}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                  ⏱️ {vendorService.formatEstimatedTime(vendor.estimatedTime)}
                                                </Badge>
                                                {vendor.rating && (
                                                  <Badge variant="outline" className="text-xs">
                                                    ⭐ {vendor.rating}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <Button
                                  onClick={assignVendorToOrder}
                                  disabled={!selectedVendor}
                                  className="w-full"
                                >
                                  Assign Vendor
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {orders.filter(order => {
                  const isQuickPickup = order.type === 'Quick Pickup';
                  const isUnassigned = !order.assignedRider && !order.rider_id &&
                                      (!order.riderStatus || order.riderStatus === 'unassigned');
                  return isQuickPickup && isUnassigned;
                }).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No unassigned quick pickups</p>
                    <p className="text-sm">New quick pickup orders will appear here for assignment</p>
                    <div className="mt-4 text-xs bg-orange-50 p-3 rounded-lg border">
                      <p className="font-medium text-orange-800">Debug Info:</p>
                      <p className="text-orange-700">Total Quick Pickups: {orders.filter(o => o.type === 'Quick Pickup').length}</p>
                      <p className="text-orange-700">Assigned Quick Pickups: {orders.filter(o => o.type === 'Quick Pickup' && (o.assignedRider || o.rider_id)).length}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Tracking Tab */}
        <TabsContent value="tracking" className="space-y-4">
          <AdminLiveMap />
        </TabsContent>
      </Tabs>
    </div>
  );
}
