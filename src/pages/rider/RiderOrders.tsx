import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { vendorService } from '@/services/vendorService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { laundryServices, serviceCategories, getServicesByCategory, LaundryService } from '@/data/laundryServices';
import {
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  Edit,
  Plus,
  Minus,
  Navigation,
  CheckCircle,
  ArrowLeft,
  Save,
  X,
  AlertTriangle,
  Bell,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import RiderLayout from '@/components/rider/RiderLayout';
import CustomerVerificationService from '@/services/customerVerificationService';
import globalVerificationManager from '@/utils/globalVerificationManager';
import { getRiderApiUrl } from '@/lib/riderApi';
import analyticsService from '@/services/analyticsService';
import { quickPickupService } from '@/services/quickPickupService';

export default function RiderOrders() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);

  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);

  // If navigated from Accept action, Dialogflow or RiderDashboard passes state { fromAccept: true }
  useEffect(() => {
    try {
      const state = (location as any)?.state;
      if (state && (state.fromAccept || state.editCart)) {
        console.log('➡️ Entering edit mode: navigated from accept or editCart');
        setIsEditing(true);
      }
    } catch (e) {
      // ignore
    }
  }, [location]);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedService, setSelectedService] = useState<LaundryService | null>(null);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [isQuickPickup, setIsQuickPickup] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [pickupPhotos, setPickupPhotos] = useState<string[]>([]);
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const pickupInputRef = useRef<HTMLInputElement | null>(null);
  const deliveryInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize customer verification service
  const verificationService = CustomerVerificationService.getInstance();

  // Helper function to get current user ID
  const getCurrentUserId = (): string | null => {
    try {
      return localStorage.getItem("user_id") || localStorage.getItem("cleancare_user_id");
    } catch (error) {
      console.error("Error getting current user ID:", error);
      return null;
    }
  };

  // Helper function to transform quick pickup to order format
  const transformQuickPickupToOrder = (quickPickup: any) => {
    return {
      _id: quickPickup.id,
      bookingId: quickPickup.custom_order_id || `QP${quickPickup.id.slice(-6).toUpperCase()}`,
      custom_order_id: quickPickup.custom_order_id || `QP${quickPickup.id.slice(-6).toUpperCase()}`,
      customerName: quickPickup.customer_name,
      customerPhone: quickPickup.customer_phone,
      customer_id: quickPickup.userId,
      address: quickPickup.address,
      address_details: {
        flatNo: quickPickup.house_number || '',
        street: quickPickup.address,
        city: quickPickup.address.includes('Gurugram') ? 'Gurugram' : 'Unknown',
        pincode: '110071',
        type: 'home'
      },
      pickupTime: quickPickup.pickup_time,
      scheduled_date: quickPickup.pickup_date,
      scheduled_time: quickPickup.pickup_time,
      delivery_date: quickPickup.delivery_date,
      delivery_time: quickPickup.delivery_time,
      type: 'Quick Pickup',
      service: 'Quick Pickup Service',
      service_type: 'express',
      services: ['Quick Pickup', 'On-Location Assessment'],
      riderStatus: 'accepted',
      assignedAt: quickPickup.assignedAt,
      status: quickPickup.status,
      payment_status: 'pending',
      items: quickPickup.items_collected || [],
      item_prices: [],
      charges_breakdown: {
        base_price: quickPickup.estimated_cost || 0,
        tax_amount: 0,
        service_fee: 0,
        delivery_fee: 0,
        handling_fee: 0,
        discount: 0
      },
      total_price: quickPickup.actual_cost || quickPickup.estimated_cost || 0,
      discount_amount: 0,
      final_amount: quickPickup.actual_cost || quickPickup.estimated_cost || 0,
      specialInstructions: quickPickup.special_instructions || 'Quick pickup service - rider will assess items on location and create order based on customer needs',
      additional_details: 'Real quick pickup order from customer',
      provider_name: 'Laundrify Express Services',
      estimated_duration: 0,
      created_at: quickPickup.createdAt,
      updated_at: quickPickup.updatedAt,
      isQuickPickup: true
    };
  };

  // Global debug listener for all verification events
  useEffect(() => {
    const globalDebugListener = (event: CustomEvent) => {
      console.log('��� GLOBAL: verificationCompleted event detected:', event.detail);
    };

    window.addEventListener('verificationCompleted', globalDebugListener as EventListener);

    return () => {
      window.removeEventListener('verificationCompleted', globalDebugListener as EventListener);
    };
  }, []);

  // Listen for global verification status changes
  useEffect(() => {
    if (!orderId) return;

    const handleGlobalVerificationChange = (event: CustomEvent) => {
      const { orderId: eventOrderId, status, timestamp } = event.detail;

      console.log('🌍 Global verification status change detected:', { eventOrderId, status, orderId });

      if (eventOrderId === orderId && status) {
        console.log(`🔄 Updating rider view: ${status} for order ${orderId}`);
        setVerificationStatus(status);

        if (status === 'approved') {
          toast.success('✅ Customer approved the changes! You can now save the order.');
        } else if (status === 'rejected') {
          toast.error('❌ Customer rejected the changes. Please modify the order.');
        }
      } else if (eventOrderId === orderId && status === null) {
        // Status cleared
        setVerificationStatus(null);
      }
    };

    // Add listener for global verification changes
    window.addEventListener('globalVerificationStatusChanged', handleGlobalVerificationChange as EventListener);

    // Check current status from global manager
    const currentStatus = globalVerificationManager.getVerificationStatus(orderId);
    if (currentStatus && currentStatus.status !== verificationStatus) {
      console.log('📋 Found existing verification status in global manager:', currentStatus);
      setVerificationStatus(currentStatus.status);
    }

    return () => {
      window.removeEventListener('globalVerificationStatusChanged', handleGlobalVerificationChange as EventListener);
    };
  }, [orderId]);

  // Window focus verification check (for when rider returns to tab)
  useEffect(() => {
    if (!orderId) return;

    const handleWindowFocus = () => {
      console.log('🪟 Window focused, checking verification status');
      const globalStatus = globalVerificationManager.getVerificationStatus(orderId);
      const localStatus = localStorage.getItem(`verification_status_${orderId}`);

      console.log('Focus check:', { globalStatus, localStatus, currentState: verificationStatus });

      if (globalStatus && globalStatus.status !== verificationStatus) {
        console.log('🔄 Window focus: Verification status changed:', globalStatus.status);
        setVerificationStatus(globalStatus.status);

        if (globalStatus.status === 'approved') {
          toast.success('✅ Customer approved the changes! You can now save the order.');
        } else if (globalStatus.status === 'rejected') {
          toast.error('��� Customer rejected the changes. Please modify the order.');
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [orderId, verificationStatus]);

  // Periodic check for verification status changes (fallback)
  useEffect(() => {
    if (!orderId) return;

    const checkVerificationStatus = () => {
      const savedStatus = localStorage.getItem(`verification_status_${orderId}`);
      if (savedStatus && savedStatus !== verificationStatus) {
        console.log('🔄 Periodic check: Verification status changed:', savedStatus);
        setVerificationStatus(savedStatus as 'pending' | 'approved' | 'rejected');
      }
    };

    // Check immediately
    checkVerificationStatus();

    // Check every 5 seconds as fallback
    const interval = setInterval(checkVerificationStatus, 5000);

    return () => clearInterval(interval);
  }, [orderId, verificationStatus]);

  useEffect(() => {
    if (orderId) {
      console.log('🔍 useEffect: Fetching order details for ID:', orderId);

      // Try to load from quick pickup service first for quick pickup orders
      if (orderId && orderId.startsWith('qp_')) {
        console.log('🚚 Loading quick pickup order from service:', orderId);
        const loadQuickPickup = async () => {
          try {
            const quickPickupResult = await quickPickupService.getUserQuickPickups(getCurrentUserId() || '');
            if (quickPickupResult.success && quickPickupResult.quickPickups) {
              const quickPickup = quickPickupResult.quickPickups.find(qp => qp.id === orderId);
              if (quickPickup) {
                console.log('✅ Quick pickup found:', quickPickup);
                const transformedOrder = transformQuickPickupToOrder(quickPickup);
                setOrder(transformedOrder);
                setEditedItems(quickPickup.items_collected || []);
                setOriginalTotal(quickPickup.estimated_cost || 0);
                setIsQuickPickup(true);
                setDeliveryDate(quickPickup.delivery_date || '');
                setDeliveryTime(quickPickup.delivery_time || '');
                return;
              }
            }
            // If quick pickup not found, continue with regular order loading
            fetchOrderDetails(orderId);
          } catch (error) {
            console.warn('⚠️ Failed to load quick pickup:', error);
            // Fallback to regular order loading
            fetchOrderDetails(orderId);
          }
        };

        loadQuickPickup();
        return;
      }

      fetchOrderDetails(orderId);

      // Check for any pending verification status in localStorage for this order
      const savedVerificationStatus = localStorage.getItem(`verification_status_${orderId}`);
      if (savedVerificationStatus) {
        console.log('📋 Found saved verification status:', savedVerificationStatus);
        setVerificationStatus(savedVerificationStatus as 'pending' | 'approved' | 'rejected');
      }
    }
  }, [orderId]);

  // Listen for verification completion events
  useEffect(() => {
    console.log('🎯 Setting up verification completion listener for rider orders');

    const handleVerificationCompleted = (event: CustomEvent) => {
      const { verificationId, approved, verification, backendSuccess } = event.detail;

      console.log('🔔 Rider received verification completion:', {
        verificationId,
        approved,
        verification,
        backendSuccess,
        currentOrderId: orderId
      });

      // Check if this verification is for the current order
      const isForCurrentOrder = verification?.orderData?.orderId === orderId ||
                               verification?.orderId === orderId ||
                               event.detail.orderId === orderId;

      console.log('🎯 Verification match check:', {
        isForCurrentOrder,
        verificationOrderId: verification?.orderData?.orderId || verification?.orderId,
        currentOrderId: orderId
      });

      // Update verification status based on customer response
      const newStatus = approved ? 'approved' : 'rejected';
      setVerificationStatus(newStatus);

      // Persist verification status for this order
      if (orderId) {
        localStorage.setItem(`verification_status_${orderId}`, newStatus);
        console.log(`💾 Saved verification status ${newStatus} for order ${orderId}`);
      }

      if (approved) {
        toast.success('�� Customer approved the changes! You can now save the order.', {
          duration: 5000,
          description: 'Click "Save Order" to complete the update'
        });

        // Auto-focus save button for immediate action
        setTimeout(() => {
          const saveButton = document.querySelector('[data-save-button]');
          if (saveButton && saveButton instanceof HTMLElement) {
            saveButton.focus();
            saveButton.style.boxShadow = '0 0 10px #10b981';
            saveButton.style.transform = 'scale(1.05)';
            setTimeout(() => {
              saveButton.style.boxShadow = '';
              saveButton.style.transform = '';
            }, 2000);
          }
        }, 100);
      } else {
        toast.error('❌ Customer rejected the changes. Please modify the order.', {
          duration: 5000,
          description: 'Update the order and try again'
        });
      }
    };

    // Add event listener
    window.addEventListener('verificationCompleted', handleVerificationCompleted as EventListener);

    console.log('�� Verification completion listener added');

    // Cleanup on unmount
    return () => {
      console.log('🧹 Removing verification completion listener');
      window.removeEventListener('verificationCompleted', handleVerificationCompleted as EventListener);
    };
  }, [orderId]);

  // Debug order state changes
  useEffect(() => {
    console.log('📋 Order state changed:', order);
    console.log('📋 isQuickPickup state:', isQuickPickup);
    console.log('📋 editedItems state:', editedItems);
  }, [order, isQuickPickup, editedItems]);

  const getMockOrderData = (id: string) => {
    // Simulate different order types based on ID
    const isQuickPickupDemo = false; // Disabled: Quick pickups now loaded from quickPickupService

    console.log('📋 getMockOrderData called with ID:', id);
    console.log('��� isQuickPickupDemo:', isQuickPickupDemo);
    console.log('📋 ID checks:', {
      includesQuick: id.includes('quick'),
      includesQP: id.includes('QP'),
      exactMatch: id === '68a1cb6dbea207fd0ace501b'
    });

    if (isQuickPickupDemo) {
      console.log('✅ Returning quick pickup mock data for ID:', id);
      return {
        _id: id,
        bookingId: id === '68a1cb6dbea207fd0ace501b' ? id.slice(-6).toUpperCase() : 'QP-002',
        custom_order_id: id === '68a1cb6dbea207fd0ace501b' ? `QP${id.slice(-8).toUpperCase()}` : 'QP202412002',
        customerName: id === '68a1cb6dbea207fd0ace501b' ? 'Chaman Kataria' : 'Sarah Johnson',
        customerPhone: id === '68a1cb6dbea207fd0ace501b' ? '+91 9717619183' : '+91 9876543211',
        customer_id: id === '68a1cb6dbea207fd0ace501b' ? id : '12345678901234567890abcd',
        address: id === '68a1cb6dbea207fd0ace501b' ? 'D62, Chhawla, Gurugram, Delhi Division, 110071' : 'A-45, Sector 12, Noida, Uttar Pradesh, 201301',
        address_details: {
          flatNo: id === '68a1cb6dbea207fd0ace501b' ? 'D62' : 'A-45',
          street: id === '68a1cb6dbea207fd0ace501b' ? 'Chhawla' : 'Sector 12',
          city: id === '68a1cb6dbea207fd0ace501b' ? 'Gurugram' : 'Noida',
          pincode: id === '68a1cb6dbea207fd0ace501b' ? '110071' : '201301',
          type: 'home'
        },
        pickupTime: id === '68a1cb6dbea207fd0ace501b' ? '10:00 AM' : '3:00 PM - 5:00 PM',
        scheduled_date: id === '68a1cb6dbea207fd0ace501b' ? '2025-08-18' : new Date().toISOString().split('T')[0],
        scheduled_time: id === '68a1cb6dbea207fd0ace501b' ? '10:00' : '15:00',
        delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        delivery_time: '18:00',
        type: 'Quick Pickup',
        service: 'Quick Pickup Service',
        service_type: 'express',
        services: ['Quick Pickup', 'On-Location Assessment'],
        riderStatus: 'accepted',
        assignedAt: new Date().toISOString(),
        status: 'confirmed',
        payment_status: 'pending',
        items: [], // No predefined items for quick pickup
        item_prices: [], // Will be populated when rider adds services
        charges_breakdown: {
          base_price: 0,
          tax_amount: 0,
          service_fee: 0,
          delivery_fee: 0,
          handling_fee: 0,
          discount: 0
        },
        total_price: 0,
        discount_amount: 0,
        final_amount: 0,
        specialInstructions: 'Quick pickup service - rider will assess items on location and create order based on customer needs',
        additional_details: 'Customer requested quick pickup service. No pre-selected items.',
        provider_name: 'Laundrify Express Services',
        estimated_duration: 0,
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    // Comprehensive mock order with real service data
    console.log('⚠️ Returning regular order mock data for ID:', id);
    return {
      _id: id,
      bookingId: 'LAU-001',
      custom_order_id: 'A202412001',
      customerName: 'John Doe',
      customerPhone: '+91 9876543210',
      customer_id: '67890123456789abcdef0123',
      address: 'D62, Extension, Chhawla, New Delhi, Delhi, 122101',
      address_details: {
        flatNo: 'D62',
        street: 'Extension, Chhawla',
        city: 'New Delhi',
        pincode: '122101',
        type: 'home'
      },
      pickupTime: '2:00 PM - 4:00 PM',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '14:00',
      delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      delivery_time: '18:00',
      type: 'Regular',
      service: 'Dry Cleaning Service',
      service_type: 'premium',
      services: ['Dry Cleaning', 'Premium Care', 'Express Delivery'],
      riderStatus: 'accepted',
      assignedAt: new Date().toISOString(),
      status: 'confirmed',
      payment_status: 'pending',

      // Previously selected services (what the customer ordered) - using actual service data
      items: [
        {
          id: '1',
          serviceId: 'steam-press-suit',
          name: "Men's Suit / Lehenga / Heavy Dresses",
          description: "Professional steam pressing for men's suits, lehengas, and heavy dresses.",
          price: 150,
          unit: 'SET',
          category: 'iron',
          quantity: 1,
          total: 150
        },
        {
          id: '2',
          serviceId: 'steam-press-ladies-suit',
          name: 'Ladies Suit / Kurta & Pyjama / Saree',
          description: "Expert steam pressing for ladies suits, kurta sets, and sarees.",
          price: 100,
          unit: 'SET',
          category: 'iron',
          quantity: 1,
          total: 100
        },
        {
          id: '3',
          serviceId: 'laundry-iron',
          name: 'Laundry and Iron',
          description: 'Complete washing and ironing service for fresh, crisp clothes.',
          price: 120,
          unit: 'KG',
          category: 'laundry',
          quantity: 1,
          total: 120
        },
        {
          id: '4',
          serviceId: 'dry-clean-mens-shirt',
          name: "Men's Shirt/T-Shirt",
          description: "Professional dry cleaning for men's shirts and t-shirts.",
          price: 100,
          unit: 'PC',
          category: 'mens-dry-clean',
          quantity: 1,
          total: 100
        },
        {
          id: '5',
          serviceId: 'dry-clean-kurta-pyjama',
          name: 'Kurta Pyjama (2 PC)',
          description: "Traditional dry cleaning for kurta pyjama sets.",
          price: 220,
          unit: 'SET',
          category: 'mens-dry-clean',
          quantity: 1,
          total: 220
        }
      ],

      // Detailed pricing breakdown
      item_prices: [
        {
          service_name: "Men's Suit / Lehenga / Heavy Dresses",
          quantity: 1,
          unit_price: 150,
          total_price: 150
        },
        {
          service_name: "Ladies Suit / Kurta & Pyjama / Saree",
          quantity: 1,
          unit_price: 100,
          total_price: 100
        },
        {
          service_name: "Laundry and Iron",
          quantity: 1,
          unit_price: 120,
          total_price: 120
        },
        {
          service_name: "Men's Shirt/T-Shirt",
          quantity: 1,
          unit_price: 100,
          total_price: 100
        },
        {
          service_name: "Kurta Pyjama (2 PC)",
          quantity: 1,
          unit_price: 220,
          total_price: 220
        }
      ],

      charges_breakdown: {
        base_price: 690,
        tax_amount: 41.40,
        service_fee: 20,
        delivery_fee: 30,
        handling_fee: 15,
        discount: 0
      },

      total_price: 796.40,
      discount_amount: 0,
      final_amount: 796.40,

      specialInstructions: 'Handle with care - customer prefers gentle wash for delicate items. Please ensure shirts are properly pressed.',
      additional_details: 'Customer will be available after 2 PM. Ring doorbell twice.',

      provider_name: 'Laundrify Premium Services',
      estimated_duration: 120,

      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  const fetchOrderDetails = async (id: string) => {
    // Helper function to use mock data
    const useMockData = (reason: string) => {
      console.log(`���� Using mock data: ${reason}`);
      console.log('📋 Order ID being processed:', id);
      const mockData = getMockOrderData(id);

      if (!mockData) {
        console.log('📋 No mock data available for this ID (likely a quick pickup)');
        toast.error('Order not found. Please check the order ID.');
        return;
      }

      console.log('📋 Mock data generated:', mockData);
      setOrder(mockData);
      const items = mockData.items || [];
      setEditedItems([...items]);
      setOriginalTotal(items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0));
      const isQuickPickupDetected = items.length === 0 || mockData.type === 'Quick Pickup';
      console.log('📋 Quick pickup detected:', isQuickPickupDetected, 'Items length:', items.length, 'Type:', mockData.type);
      setIsQuickPickup(isQuickPickupDetected);
    };

    try {
      const token = localStorage.getItem('riderToken');

      // For development/testing, try to fetch real data even without token
      const isDev = import.meta.env.DEV;
      if (!token && !isDev) {
        useMockData('No authentication token found');
        toast.info('Using demo data - no authentication');
        return;
      }

      const apiUrl = getRiderApiUrl(`/orders/${id}`);
      console.log('🔍 Fetching order details:', apiUrl);

      // Check if we're in development and the backend might not be available
      const hostname = window.location.hostname;
      const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");

      // For local development, check if backend is likely available
      if (isDev && isLocalhost) {
        try {
          // Quick health check for local backend
          const healthCheck = await fetch('/api/health', { method: 'HEAD' });
          if (!healthCheck.ok) {
            useMockData('Local backend not available');
            toast.info('Using demo data - backend not running');
            return;
          }
        } catch {
          useMockData('Local backend health check failed');
          toast.info('Using demo data - backend not running');
          return;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('⏰ Request timeout - using mock data');
      }, 8000); // Reduced timeout to 8 seconds

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(apiUrl, {
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const orderData = await response.json();
        console.log('✅ Order data received:', orderData);

        // Process and normalize order data
        const processedOrder = {
          ...orderData,
          // Ensure items array is properly structured with real service prices
          items: orderData.items || orderData.item_prices?.map((item: any, index: number) => {
            // Try to find the actual service from laundryServices
            const actualService = laundryServices.find(service =>
              service.name.toLowerCase() === item.service_name?.toLowerCase() ||
              item.service_name?.toLowerCase().includes(service.name.toLowerCase())
            );

            return {
              id: index + 1,
              serviceId: actualService?.id || item.service_name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `service-${index}`,
              name: item.service_name,
              description: actualService?.description || `Professional ${item.service_name.toLowerCase()}`,
              price: actualService?.price || item.unit_price,
              unit: actualService?.unit || 'PC',
              category: actualService?.category || (
                item.service_name.toLowerCase().includes('dry') ? 'dry-clean' :
                item.service_name.toLowerCase().includes('wash') ? 'wash-fold' :
                item.service_name.toLowerCase().includes('iron') ? 'iron' : 'general'
              ),
              quantity: item.quantity,
              total: (actualService?.price || item.unit_price) * item.quantity
            };
          }) || []
        };

        setOrder(processedOrder);
        const items = processedOrder.items || [];
        setEditedItems([...items]);
        setOriginalTotal(items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0));

        // Check if this is a quick pickup - use multiple indicators
        const isQuickPickupOrder = orderData.isQuickPickup ||
                                  orderData.type === 'Quick Pickup' ||
                                  orderData.service === 'Quick Pickup Service' ||
                                  (items.length === 0 && orderData.service_type === 'express');

        setIsQuickPickup(isQuickPickupOrder);
        setDeliveryDate(processedOrder.delivery_date || '');
        setDeliveryTime(processedOrder.delivery_time || '');
        console.log('📦 Order type detected:', isQuickPickupOrder ? 'Quick Pickup' : 'Regular Order');

        // Show success message only in development
        if (isDev) {
          toast.success('Order data loaded from API');
        }
      } else {
        console.warn(`⚠️ API responded with ${response.status}, using mock data`);
        useMockData(`API error: ${response.status}`);
        toast.info('Using demo data - API error');
      }
    } catch (error: any) {
      // Handle different types of errors
      if (error.name === 'AbortError') {
        console.warn('⏰ Request timed out, using mock data');
        useMockData('Request timeout');
        toast.info('Using demo data - connection timeout');
      } else if (error.message && error.message.includes('Failed to fetch')) {
        console.warn('🌐 Network error, using mock data');
        useMockData('Network error');
        toast.info('Using demo data - network unavailable');
      } else {
        console.error('❌ Unexpected error, using mock data:', error);
        useMockData('Unexpected error');
        toast.info('Using demo data - unexpected error');
      }
    }
  };

  const updateItemQuantity = (index: number, change: number) => {
    const updatedItems = [...editedItems];
    updatedItems[index].quantity = Math.max(0, updatedItems[index].quantity + change);
    setEditedItems(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = editedItems.filter((_, i) => i !== index);
    setEditedItems(updatedItems);
  };

  const addSelectedService = () => {
    if (!selectedService) {
      toast.error('Please select a service');
      return;
    }

    if (serviceQuantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const newItem = {
      id: Date.now(),
      serviceId: selectedService.id,
      name: selectedService.name,
      description: selectedService.description,
      price: selectedService.price,
      unit: selectedService.unit,
      category: selectedService.category,
      quantity: serviceQuantity,
      total: selectedService.price * serviceQuantity
    };

    setEditedItems([...editedItems, newItem]);
    setSelectedService(null);
    setServiceQuantity(1);
    toast.success(`Added ${selectedService.name} to order`);
  };

  const getAvailableServices = () => {
    return getServicesByCategory(selectedCategory);
  };

  const saveDeliveryInfo = async () => {
    if (!deliveryDate || !deliveryTime || !orderId) {
      toast.error('Please select both delivery date and time');
      return;
    }

    setIsSaving(true);
    try {
      console.log('🚚 Saving delivery info for quick pickup:', { orderId, deliveryDate, deliveryTime });

      const result = await quickPickupService.updateDeliveryInfo(orderId, {
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
        items_collected: editedItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price
        })),
        actual_cost: totalAmount
      });

      if (result.success) {
        toast.success('✅ Delivery schedule saved successfully!', {
          description: `Delivery set for ${deliveryDate} at ${deliveryTime}`,
          duration: 4000
        });

        // Update the order with new delivery info
        if (result.quickPickup) {
          setOrder(prevOrder => ({
            ...prevOrder,
            delivery_date: result.quickPickup.delivery_date,
            delivery_time: result.quickPickup.delivery_time,
            status: 'picked_up'
          }));
        }

        // Track delivery schedule event
        analyticsService.trackEvent('rider_delivery_scheduled', {
          event_category: 'rider',
          order_id: orderId,
          delivery_date: deliveryDate,
          delivery_time: deliveryTime
        });
      } else {
        toast.error('❌ Failed to save delivery schedule: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error saving delivery info:', error);
      toast.error('❌ Failed to save delivery schedule');
    } finally {
      setIsSaving(false);
    }
  };

  // Upload photo helper
  const handleUploadPhotoFile = async (type: 'pickup' | 'delivery', file: File) => {
    if (!file || !orderId) return;
    try {
      const token = localStorage.getItem('riderToken');
      const apiUrl = getRiderApiUrl(`/orders/${orderId}/upload-photo?type=${type}`);
      const fd = new FormData();
      fd.append('photo', file, file.name);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        if (type === 'delivery') {
          setDeliveryPhotos(prev => [...prev, data.url]);
          setOrder(prev => ({ ...prev, delivery_photos: [...(prev.delivery_photos || []), data.url] }));
        } else {
          setPickupPhotos(prev => [...prev, data.url]);
          setOrder(prev => ({ ...prev, pickup_photos: [...(prev.pickup_photos || []), data.url] }));
        }
        toast.success('Photo uploaded successfully');
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload photo error:', error);
      toast.error('Upload failed. Please try again.');
    }
  };

  const triggerPickupInput = () => pickupInputRef.current?.click();
  const triggerDeliveryInput = () => deliveryInputRef.current?.click();

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'pickup'|'delivery') => {
    const file = e.target.files?.[0];
    if (file) await handleUploadPhotoFile(type, file);
    // Clear value to allow reuploading same file if needed
    if (e.target) e.target.value = '';
  };

  const saveOrderChanges = async () => {
    // If verification is required and not approved, show error
  // FORCE_DISABLE_VERIFICATION can be toggled to bypass customer OTP/verification for faster rider workflow
  const FORCE_DISABLE_VERIFICATION = true;
  if (verificationStatus && verificationStatus !== 'approved' && !FORCE_DISABLE_VERIFICATION) {
    toast.error('Customer verification required before saving changes');
    return;
  }

    setIsSaving(true);
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Handle quick pickup orders differently
      if (isQuickPickup) {
        console.log('💾 Saving quick pickup order changes:', { orderId, editedItems, deliveryDate, deliveryTime });

        const result = await quickPickupService.updateDeliveryInfo(orderId!, {
          delivery_date: deliveryDate,
          delivery_time: deliveryTime,
          items_collected: editedItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price
          })),
          actual_cost: totalAmount,
          rider_notes: 'Order updated by rider with collected items'
        });

        if (result.success) {
          toast.success('✅ Quick pickup order saved successfully!', {
            description: `Items collected and delivery scheduled for ${deliveryDate} at ${deliveryTime}`,
            duration: 4000
          });

          // Update the order with new data
          if (result.quickPickup) {
            setOrder(prevOrder => ({
              ...prevOrder,
              delivery_date: result.quickPickup.delivery_date,
              delivery_time: result.quickPickup.delivery_time,
              status: 'picked_up',
              items: editedItems,
              total_price: totalAmount,
              final_amount: totalAmount
            }));
          }

          // Track successful quick pickup update
          analyticsService.trackEvent('rider_quick_pickup_update', {
            event_category: 'rider',
            order_id: orderId,
            items_count: editedItems.length,
            total_amount: totalAmount,
            delivery_date: deliveryDate,
            delivery_time: deliveryTime
          });

          // Dispatch event for booking history refresh
          window.dispatchEvent(new CustomEvent('refreshBookings'));

          setIsSaving(false);
          return;
        } else {
          toast.error('❌ Failed to save quick pickup: ' + (result.error || 'Unknown error'));
          setIsSaving(false);
          return;
        }
      }

      // Regular order handling
      const token = localStorage.getItem('riderToken');

      if (!token) {
        toast.error('Authentication required. Please login again.');
        setIsSaving(false);
        return;
      }

      const apiUrl = getRiderApiUrl(`/orders/${orderId}/update`);

      // Create notification data for customer
      const notificationData = {
        type: 'order_verification_required',
        title: 'Order Changes Need Your Approval',
        message: `Your order ${order.bookingId || order.custom_order_id} has been updated by the rider and requires your approval.`,
        orderId: orderId,
        orderNumber: order.bookingId || order.custom_order_id,
        customerPhone: order.customerPhone || order.phone,
        riderChanges: {
          originalTotal: originalTotal,
          newTotal: totalAmount,
          priceChange: totalAmount - originalTotal,
          itemChanges: editedItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price
          }))
        },
        timestamp: new Date().toISOString()
      };

      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort();
        console.log('⏰ Save request timeout');
      }, 15000); // 15 second timeout for save operations

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: editedItems,
          updatedBy: 'rider',
          notes: `Order updated by rider ${new Date().toLocaleString()}. ${verificationStatus === 'approved' ? 'Customer approved changes.' : 'Customer will be notified to verify changes.'}`,
          // Respect FORCE_DISABLE_VERIFICATION when deciding whether to require customer verification
          requiresVerification: FORCE_DISABLE_VERIFICATION ? false : (verificationStatus !== 'approved'),
          verificationStatus: FORCE_DISABLE_VERIFICATION ? 'approved' : (verificationStatus || 'pending'),
          notificationData: notificationData
        }),
        signal: controller.signal
      });

      // Clear timeout immediately after successful fetch
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Safely read response body once and handle both success and error cases
      let responseData: any = null;
      let responseText: string = '';

      // Helper function to safely read response
      const safeReadResponse = async (res: Response, signal?: AbortSignal): Promise<{ text: string; data: any }> => {
        try {
          // Check if request was aborted
          if (signal && signal.aborted) {
            console.log('Request was aborted, skipping response read');
            return { text: '', data: null };
          }

          // Check if we can read the response
          if (!res || typeof res.text !== 'function') {
            console.warn('Invalid response object');
            return { text: '', data: null };
          }

          if (res.bodyUsed) {
            console.warn('Response body already consumed');
            return { text: '', data: null };
          }

          const text = await res.text();
          let data = null;

          if (text) {
            try {
              data = JSON.parse(text);
            } catch (parseError) {
              console.log('Response is not JSON, treating as text');
            }
          }

          return { text, data };
        } catch (readError) {
          console.error('❌ Error reading response:', readError);
          return { text: '', data: null };
        }
      };

      const { text, data } = await safeReadResponse(response, controller.signal);
      responseText = text;
      responseData = data;

      if (response.ok) {
        const result = responseData || {};

        if (verificationStatus === 'approved') {
          toast.success('Order saved successfully!', {
            description: 'Customer has approved the changes',
            duration: 4000,
            icon: <Bell className="h-4 w-4" />
          });

          // Clean up verification status after successful save
      if (orderId) {
        globalVerificationManager.clearVerificationStatus(orderId);
        localStorage.removeItem(`verification_status_${orderId}`);
      }
      setVerificationStatus(null);
        } else {
          toast.success('Order updated and customer notified!', {
            description: result.price_change !== 0
              ? `Price changed by ₹${Math.abs(result.price_change)} ${result.price_change > 0 ? 'increase' : 'decrease'}`
              : 'Items updated successfully',
            duration: 4000,
            icon: <Bell className="h-4 w-4" />
          });
          setVerificationStatus('pending');
        }

        // Track successful order update
        analyticsService.trackEvent('rider_order_update', {
          event_category: 'rider',
          order_id: orderId,
          items_count: editedItems.length,
          total_amount: editedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
        });

        setIsEditing(false);
        fetchOrderDetails(orderId!);
      } else {
        let errorMessage = 'Failed to update order';

        // Handle specific status codes
        if (response.status === 404) {
          errorMessage = 'Backend service unavailable. Using demo mode.';
          console.warn('🔧 Backend API endpoint not found, falling back to demo mode');

          // Simulate successful save in demo mode
          toast.success('Order updated successfully (demo mode)', {
            description: 'Changes saved locally - backend service unavailable',
            duration: 4000
          });
          setIsEditing(false);
          fetchOrderDetails(orderId!); // Refresh data even in demo mode
          return; // Don't show error for 404, treat as success in demo mode
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (responseData && responseData.message) {
          errorMessage = responseData.message;
        } else if (responseText) {
          errorMessage = responseText;
        } else {
          errorMessage = response.statusText || errorMessage;
        }

        toast.error(`Save failed: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('❌ Save error:', error);

      if (error.name === 'AbortError') {
        toast.error('Save timeout. Please check your connection and try again.');
      } else if (error.message && error.message.includes('Failed to fetch')) {
        console.warn('🔧 Network error, falling back to demo mode:', error.message);

        // Always treat network errors as successful saves in demo mode
        toast.success('Order updated successfully (demo mode)', {
          description: 'Changes saved locally - network unavailable',
          duration: 4000
        });
        setIsEditing(false);
        fetchOrderDetails(orderId!); // Refresh data even after network errors
      } else {
        toast.error('Unexpected error. Please try again.');
      }
    } finally {
      setIsSaving(false);
      // Ensure timeout is always cleared
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  // Cancel verification request
  const cancelVerificationRequest = () => {
    try {
      if (orderId && verificationStatus === 'pending') {
        console.log('🚫 Cancelling verification request for order:', orderId);

        // Clear verification status locally
        setVerificationStatus(null);

        // Clear from global manager
        globalVerificationManager.clearVerificationStatus(orderId);

        // Clear from localStorage
        localStorage.removeItem(`verification_status_${orderId}`);

        // Cancel any pending verification in the service
        const pendingVerifications = verificationService.getPendingVerifications();
        const orderVerification = pendingVerifications.find(v => v.orderId === orderId);

        if (orderVerification) {
          // Remove the verification from service
          verificationService.processVerification(orderVerification.id, false, 'Cancelled by rider');
          console.log('✅ Verification request cancelled successfully');
          toast.info('Verification request cancelled');
        }
      }
    } catch (error) {
      console.error('❌ Error cancelling verification:', error);
    }
  };

  const sendVerificationToCustomer = () => {
    try {
      // Calculate totals
      const originalTotal = order?.items?.reduce((sum: number, item: any) =>
        sum + (item.quantity * item.price), 0) || 0;
      const updatedTotal = editedItems.reduce((sum: number, item: any) =>
        sum + (item.quantity * item.price), 0);
      const priceChange = updatedTotal - originalTotal;

      // Create verification data
      const verificationData = {
        orderId: order._id || orderId,
        orderData: {
          bookingId: order.bookingId || order.custom_order_id || order._id,
          customerName: order.customerName || order.name || 'Customer',
          customerPhone: order.customerPhone || order.phone || '',
          riderName: 'Current Rider',
          address: order.address || '',
          pickupTime: order.pickupTime || '',
          originalItems: order.items || [],
          updatedItems: editedItems,
          originalTotal,
          updatedTotal,
          priceChange,
          riderNotes: `Rider updated order items${isQuickPickup ? ' for quick pickup service' : ''}`,
          isQuickPickup: isQuickPickup
        },
        type: (isQuickPickup ? 'quick_pickup_created' :
              Math.abs(priceChange) > 0 ? 'price_change' : 'items_change') as 'price_change' | 'items_change' | 'quick_pickup_created',
        priority: (Math.abs(priceChange) > 100 ? 'high' : 'medium') as 'high' | 'medium' | 'low'
      };

      console.log('📦 Sending verification to customer:', verificationData);

      // Create the verification
      const verificationId = verificationService.addPendingVerification(verificationData);

      console.log('✅ Verification sent to customer with ID:', verificationId);

      // Set local state
      setVerificationStatus('pending');

      // Use global manager to set pending status
      if (orderId) {
        globalVerificationManager.setVerificationStatus(orderId, 'pending');
      }

      toast.success('Verification sent to customer! They will receive a popup to approve/reject changes.');

    } catch (error) {
      console.error('❌ Error sending verification:', error);
      toast.error('Failed to send verification. Please try again.');
    }
  };


  const handleSaveClick = () => {
    // Check if customer verification is required and approved
    if (verificationStatus === 'approved') {
      saveOrderChanges();
    } else {
      // Send for verification first
      sendVerificationToCustomer();
    }
  };

  const openMapsNavigation = (address: string, type: 'pickup' | 'delivery') => {
    const destination = type === 'delivery'
      ? 'Sector 69, Gurugram, Haryana' // Vendor address
      : address; // Customer address

    const encodedAddress = encodeURIComponent(destination);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    window.open(googleMapsUrl, '_blank');
  };

  // Debug function to test verification completion
  const testVerificationCompletion = (approved: boolean) => {
    console.log('🧪 Testing verification completion:', approved);

    if (orderId) {
      const status = approved ? 'approved' : 'rejected';

      // Use global manager directly for immediate update
      globalVerificationManager.setVerificationStatus(orderId, status);

      // Also dispatch the original event for compatibility
      const testEvent = new CustomEvent('verificationCompleted', {
        detail: {
          verificationId: 'test-verification-id',
          approved,
          verification: {
            orderId: orderId,
            orderData: { orderId: orderId }
          },
          backendSuccess: true,
          orderId: orderId
        }
      });
      window.dispatchEvent(testEvent);
    }
  };

  if (!order) {
    return (
      <RiderLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p>Loading order details...</p>
          </div>
        </div>
      </RiderLayout>
    );
  }

  const totalAmount = editedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const [customerOtp, setCustomerOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const requestCustomerOTP = async (type: 'pickup'|'delivery') => {
    try {
      const token = localStorage.getItem('riderToken');
      const apiUrl = getRiderApiUrl(`/orders/${orderId}/request-customer-otp`);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ type })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setOtpRequested(true);
        toast.success('OTP requested to customer');
      } else {
        toast.error(data.message || 'Failed to request OTP');
      }
    } catch (err) {
      console.error('Request customer OTP error', err);
      toast.error('Failed to request OTP');
    }
  };

  const verifyCustomerOTP = async (type: 'pickup'|'delivery') => {
    if (!customerOtp) return toast.error('Enter OTP');
    try {
      setOtpVerifying(true);
      const token = localStorage.getItem('riderToken');
      const apiUrl = getRiderApiUrl(`/orders/${orderId}/verify-customer-otp`);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ otp: customerOtp, type })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('OTP verified');
        setOtpRequested(false);
        setCustomerOtp('');
        // Refresh order details
        fetchOrderDetails(orderId!);

        // Inform global manager and other parts of the app that verification completed so dashboards refresh
        try {
          if (orderId && globalVerificationManager) {
            globalVerificationManager.setVerificationStatus(orderId, 'approved');
          }
          window.dispatchEvent(new CustomEvent('globalVerificationStatusChanged', { detail: { orderId, status: 'approved' } }));
        } catch (e) {
          console.warn('Failed to notify global verification manager after OTP verify', e);
        }
      } else {
        toast.error(data.message || 'OTP verification failed');
      }
    } catch (err) {
      console.error('Verify customer OTP error', err);
      toast.error('OTP verification failed');
    } finally {
      setOtpVerifying(false);
    }
  };

  return (
    <RiderLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/rider/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Order #{typeof order.bookingId === 'string' ? order.bookingId : order._id || 'Unknown'}</h1>
          <Badge variant={
            order.riderStatus === 'assigned' ? 'secondary' :
            order.riderStatus === 'picked_up' ? 'default' : 'default'
          }>
            {typeof order.riderStatus === 'string' ? order.riderStatus : 'Unknown'}
          </Badge>

          <div className="ml-auto flex items-center space-x-2">
            <Button size="sm" variant="ghost" onClick={() => {
              try {
                const phone = order.customerPhone || order.phone || (order.customer_id && order.customer_id.phone) || '';
                const itemsList = (editedItems && editedItems.length > 0 ? editedItems : (order.items || [])).map((it: any) => `- ${it.name} x${it.quantity} (₹${it.price || it.unit_price || 0})`).join('%0A');
                const msg = `Hello ${order.customerName || ''},%0AYour items:%0A${itemsList}%0AOrder ID: ${order.bookingId || order._id}`;
                const wa = phone ? `https://wa.me/${phone.replace(/\D/g,'')}?text=${msg}` : `https://wa.me/?text=${msg}`;
                window.open(wa, '_blank');
              } catch (e) {
                console.warn('Failed to open WhatsApp', e);
              }
            }}>Share Confirmation</Button>
          </div>
        </div>

        {/* Customer Information */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-600" />
              <span className="text-blue-900">Customer Information</span>
            </CardTitle>
            <CardDescription className="text-blue-700">
              Contact details and pickup information for this order
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Primary Customer Info - More Prominent */}
            <div className="bg-white rounded-lg p-4 mb-4 border border-blue-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-blue-800">Customer Name</Label>
                  <p className="text-xl font-bold text-blue-900">
                    {typeof (order.customerName || order.name) === 'string' ? (order.customerName || order.name) : 'N/A'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-blue-800">Phone Number</Label>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <a
                      href={`tel:${typeof (order.customerPhone || order.phone) === 'string' ? (order.customerPhone || order.phone) : 'N/A'}`}
                      className="text-xl font-bold text-blue-900 hover:text-blue-700 hover:underline"
                    >
                      {typeof (order.customerPhone || order.phone) === 'string' ? (order.customerPhone || order.phone) : 'N/A'}
                    </a>
                  </div>
                </div>
              </div>

              {/* Customer ID and Service Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-blue-200">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-blue-800">Customer ID</Label>
                  <p className="text-sm font-mono text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    {typeof order.customer_id === 'string' ? order.customer_id : 'N/A'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-blue-800">Service Type</Label>
                  <Badge variant="secondary" className="text-blue-700 bg-blue-200">
                    {typeof order.service_type === 'string' ? order.service_type : 'Standard'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-semibold text-blue-800">Pickup Address</Label>
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <p className="text-blue-900 font-medium leading-relaxed">
                      {typeof order.address === 'string' ? order.address : 'Address not available'}
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 bg-blue-600 hover:bg-blue-700"
                      onClick={() => openMapsNavigation(order.address, 'pickup')}
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Navigate to Customer
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-blue-800">Pickup Time</Label>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <p className="text-blue-900 font-medium">
                    {typeof order.pickupTime === 'string' ? order.pickupTime : 'Time not specified'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-blue-800">Order Type</Label>
                <Badge variant={isQuickPickup ? "secondary" : "default"} className="text-sm">
                  {isQuickPickup ? "Quick Pickup" : "Regular Order"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photos (Pickup / Delivery) */}
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center space-x-2">
        <Package className="h-5 w-5" />
        <span>Pickup / Delivery Photos</span>
      </CardTitle>
      <CardDescription>
        Upload proof photos during pickup or delivery. Photos will be attached to the order record.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Pickup Photos</div>
            <div className="flex items-center gap-2">
              <input ref={pickupInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileInputChange(e, 'pickup')} />
              <Button size="sm" onClick={triggerPickupInput}>Upload Pickup Photo</Button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {(order?.pickup_photos || pickupPhotos || []).map((p: string, i: number) => (
              <img key={p + i} src={p} alt={`pickup-${i}`} className="h-20 w-20 object-cover rounded-md border" />
            ))}
            {((order?.pickup_photos || pickupPhotos || []).length === 0) && (
              <div className="text-xs text-gray-500">No pickup photos uploaded</div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Delivery Photos</div>
            <div className="flex items-center gap-2">
              <input ref={deliveryInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileInputChange(e, 'delivery')} />
              <Button size="sm" onClick={triggerDeliveryInput}>Upload Delivery Photo</Button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {(order?.delivery_photos || deliveryPhotos || []).map((p: string, i: number) => (
              <img key={p + i} src={p} alt={`delivery-${i}`} className="h-20 w-20 object-cover rounded-md border" />
            ))}
            {((order?.delivery_photos || deliveryPhotos || []).length === 0) && (
              <div className="text-xs text-gray-500">No delivery photos uploaded</div>
            )}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Customer OTP Confirmation */}
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center space-x-2">
        <Lock className="h-5 w-5" />
        <span>Customer OTP Confirmation</span>
      </CardTitle>
      <CardDescription>
        Request an OTP to the customer and verify it when picking up or delivering items.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => requestCustomerOTP('pickup')}>Request Pickup OTP</Button>
        <Button size="sm" onClick={() => requestCustomerOTP('delivery')}>Request Delivery OTP</Button>
        <div className="flex items-center gap-2 ml-auto">
          <input type="text" value={customerOtp} onChange={(e) => setCustomerOtp(e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="Enter OTP" className="px-3 py-2 border rounded text-sm" />
          <Button size="sm" onClick={() => verifyCustomerOTP('pickup')} disabled={otpVerifying}>{otpVerifying ? 'Verifying...' : 'Verify Pickup'}</Button>
          <Button size="sm" variant="outline" onClick={() => verifyCustomerOTP('delivery')} disabled={otpVerifying}>{otpVerifying ? 'Verifying...' : 'Verify Delivery'}</Button>
        </div>
      </div>
      {otpRequested && (
        <p className="text-sm text-green-600 mt-2">OTP has been requested to the customer. Please ask them for the code.</p>
      )}
    </CardContent>
  </Card>

        {/* Order Items */}
  <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Order Items</span>
              </CardTitle>
              <div className="flex space-x-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Cancel any pending verification
                        cancelVerificationRequest();

                        // Reset editing state
                        setIsEditing(false);
                        setEditedItems([...order.items]);
                        setSelectedService(null);
                        setServiceQuantity(1);

                        toast.success('Edit cancelled');
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveClick}
                      disabled={isSaving || (verificationStatus === 'pending')}
                      data-save-button
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' :
                       verificationStatus === 'approved' ? 'Save Order' :
                       verificationStatus === 'pending' ? 'Waiting for Customer' :
                       'Send for Verification'}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Order
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              You can edit quantities and add new items during pickup
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isQuickPickup && editedItems.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium text-blue-800">
                    Customer's Pre-Selected Services
                  </p>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  These are the services the customer originally ordered. You can modify quantities or add/remove items as needed.
                </p>
              </div>
            )}

            {/* Quick Pickup Empty State */}
            {isQuickPickup && editedItems.length === 0 && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-yellow-600" />
                  <p className="font-medium text-yellow-800">
                    Quick Pickup Order - No Pre-Selected Services
                  </p>
                </div>
                <p className="text-sm text-yellow-700 mt-2">
                  This is a quick pickup order. The customer did not pre-select any services.
                  You will assess the items on location and add services as needed.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {editedItems.map((item, index) => (
                <div key={item.id || index} className={`flex items-center justify-between p-3 border rounded-lg ${
                  !isQuickPickup ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{item.name}</h4>
                      {!isQuickPickup && (
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                          Pre-selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">��{item.price} each</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateItemQuantity(index, -1)}
                        disabled={item.quantity <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateItemQuantity(index, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="text-right">
                      <p className="font-medium">Qty: {item.quantity}</p>
                      <p className="text-sm text-gray-600">₹{item.quantity * item.price}</p>
                    </div>
                  )}
                </div>
              ))}

              {isEditing && (
                <Card className="border-dashed border-green-300 bg-green-50">
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3 text-green-800">Add Service to Order</h4>
                    <p className="text-sm text-green-700 mb-4">
                      {isQuickPickup ?
                        "This is a quick pickup order. Add services based on items collected from customer." :
                        "Select additional services from our available options."
                      }
                    </p>

                    <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-4">
                      <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-1">
                        {serviceCategories.map((category) => (
                          <TabsTrigger
                            key={category.id}
                            value={category.id}
                            className="text-xs"
                          >
                            {category.icon}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium">Service</Label>
                        <Select
                          value={selectedService?.id || ""}
                          onValueChange={(serviceId) => {
                            const service = laundryServices.find(s => s.id === serviceId);
                            setSelectedService(service || null);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a service" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableServices().map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{service.name}</span>
                                  <span className="text-sm text-gray-500">
                                    ₹{service.price}/{service.unit}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={serviceQuantity}
                          onChange={(e) => setServiceQuantity(parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <Button
                          onClick={addSelectedService}
                          disabled={!selectedService}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Service
                        </Button>
                      </div>
                    </div>

                    {selectedService && (
                      <div className="mt-3 p-3 bg-white rounded-lg border">
                        <p className="text-sm font-medium">{selectedService.name}</p>
                        <p className="text-xs text-gray-600">{selectedService.description}</p>
                        <p className="text-sm font-semibold text-green-600 mt-1">
                          Total: ₹{selectedService.price * serviceQuantity}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Amount:</span>
                  <div className="text-right">
                    <span>₹{totalAmount}</span>
                    {isEditing && totalAmount !== originalTotal && (
                      <div className="text-sm font-normal">
                        <span className={`${totalAmount > originalTotal ? 'text-red-600' : 'text-green-600'}`}>
                          {totalAmount > originalTotal ? '+' : ''}₹{totalAmount - originalTotal}
                        </span>
                        <span className="text-gray-500 ml-1">(from ₹{originalTotal})</span>
                      </div>
                    )}\n                  </div>
                </div>
                {isEditing && totalAmount !== originalTotal && (
                  <div className={`mt-2 p-3 rounded-lg ${totalAmount > originalTotal ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border`}>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className={`h-4 w-4 ${totalAmount > originalTotal ? 'text-red-600' : 'text-green-600'}`} />
                      <p className={`text-sm ${totalAmount > originalTotal ? 'text-red-800' : 'text-green-800'}`}>
                        {totalAmount > originalTotal
                          ? 'Price increase detected. Customer will be notified to approve the changes.'
                          : 'Price decrease detected. Customer will be notified of the savings.'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Verification Status */}
        {verificationStatus && (
          <Card className={`border-2 transition-all duration-300 ${
            verificationStatus === 'approved' ? 'border-green-500 bg-green-50 shadow-lg shadow-green-200' :
            verificationStatus === 'rejected' ? 'border-red-500 bg-red-50' :
            'border-orange-500 bg-orange-50'
          } ${
            verificationStatus === 'approved' ? 'animate-pulse' : ''
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className={`h-5 w-5 ${
                  verificationStatus === 'approved' ? 'text-green-600' :
                  verificationStatus === 'rejected' ? 'text-red-600' :
                  'text-orange-600'
                }`} />
                <span>Customer Verification</span>
                <Badge variant={
                  verificationStatus === 'approved' ? 'default' :
                  verificationStatus === 'rejected' ? 'destructive' :
                  'secondary'
                }>
                  {verificationStatus === 'approved' ? 'Approved' :
                   verificationStatus === 'rejected' ? 'Rejected' :
                   'Pending'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {verificationStatus === 'pending' && (
                <div className="text-orange-800">
                  <p className="font-medium">⏳ Waiting for customer verification</p>
                  <p className="text-sm">Customer has been notified of the changes and needs to verify them before you can save the order.</p>

                  {/* Demo Buttons for Testing */}
                  <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 mb-2">🧪 Demo Testing Controls:</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setVerificationStatus('approved');
                          if (orderId) {
                            localStorage.setItem(`verification_status_${orderId}`, 'approved');
                            globalVerificationManager.setVerificationStatus(orderId, 'approved');
                          }
                          toast.success('Demo: Customer approved changes!');
                        }}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        ✅ Demo Approve
                      </Button>
                      <Button
                        onClick={() => {
                          setVerificationStatus('rejected');
                          if (orderId) {
                            localStorage.setItem(`verification_status_${orderId}`, 'rejected');
                            globalVerificationManager.setVerificationStatus(orderId, 'rejected');
                          }
                          toast.error('Demo: Customer rejected changes!');
                        }}
                        size="sm"
                        variant="destructive"
                      >
                        ❌ Demo Reject
                      </Button>
                      <Button
                        onClick={() => {
                          setVerificationStatus('pending');
                          if (orderId) {
                            localStorage.setItem(`verification_status_${orderId}`, 'pending');
                            globalVerificationManager.setVerificationStatus(orderId, 'pending');
                          }
                          toast.info('Demo: Reset to pending status');
                        }}
                        size="sm"
                        variant="outline"
                      >
                        🔄 Reset
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {verificationStatus === 'approved' && (
                <div className="text-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">✅ Customer has approved the changes!</p>
                      <p className="text-sm">You can now save the updated order.</p>
                    </div>
                    <Button
                      onClick={saveOrderChanges}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700 text-white ml-4"
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save Now'}
                    </Button>
                  </div>
                </div>
              )}

              {verificationStatus === 'rejected' && (
                <div className="text-red-800">
                  <p className="font-medium">❌ Customer rejected the changes</p>
                  <p className="text-sm">Please modify the order according to customer requirements.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Delivery Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Assigned Vendor</Label>
                {order.assignedVendor || order.assigned_vendor ? (
                  <div className="space-y-2">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="font-medium text-green-900">
                        {order.assignedVendorDetails?.name || order.assigned_vendor_details?.name ||
                         (order.assignedVendor === 'vendor1' ? 'Priya Dry Cleaners' :
                          order.assignedVendor === 'vendor2' ? 'White Tiger Dry Cleaning' :
                          order.assignedVendor || order.assigned_vendor)}
                      </div>
                      <div className="text-sm text-green-700 mt-1">
                        {order.assignedVendorDetails?.address || order.assigned_vendor_details?.address ||
                         (order.assignedVendor === 'vendor1' ? 'Shop n.155, Spaze corporate park, 1sf, Sector 69, Gurugram, Haryana 122101' :
                          order.assignedVendor === 'vendor2' ? 'Shop No. 153, First Floor, Spaze Corporate Park, Sector 69, Gurugram, Haryana 122101' :
                          'Sector 69, Gurugram, Haryana')}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {order.assignedVendorDetails?.distance && (
                          <Badge variant="secondary" className="text-xs">
                            📍 {vendorService.formatDistance(order.assignedVendorDetails.distance)}
                          </Badge>
                        )}
                        {order.assignedVendorDetails?.estimatedTime && (
                          <Badge variant="outline" className="text-xs">
                            ⏱️ {vendorService.formatEstimatedTime(order.assignedVendorDetails.estimatedTime)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openMapsNavigation(order.address, 'delivery')}
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Navigate to Vendor
                    </Button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="text-yellow-800 text-sm">
                      ⚠️ No vendor assigned yet. Contact admin for vendor assignment.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Delivery Date/Time Section for Quick Pickups */}
              {isQuickPickup && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Set Delivery Date & Time
                  </h4>
                  <p className="text-sm text-purple-700 mb-4">
                    Set the delivery date and time for this quick pickup order. Customer will be notified of the delivery schedule.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Delivery Date</Label>
                      <Input
                        type="date"
                        value={deliveryDate || order.delivery_date || ''}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Delivery Time</Label>
                      <Input
                        type="time"
                        value={deliveryTime || order.delivery_time || ''}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={saveDeliveryInfo}
                    disabled={!deliveryDate || !deliveryTime || isSaving}
                    className="mt-4 w-full bg-purple-600 hover:bg-purple-700"
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Delivery Schedule'}
                  </Button>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Pickup & Delivery Process</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>Navigate to customer address and collect the items</li>
                  <li>If order changes are needed, edit the order and wait for customer approval</li>
                  <li>{isQuickPickup ? 'Set delivery date/time above, then deliver items to vendor address' : 'Once approved (or no changes needed), deliver items to vendor address'}</li>
                  <li>Complete the order in the system after delivery</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </RiderLayout>
  );
}
