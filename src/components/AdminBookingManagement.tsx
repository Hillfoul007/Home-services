import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Edit3,
  Eye,
  RefreshCw,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Package,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { getSortedServices } from "@/data/laundryServices";
import { QuickPickupService, type QuickPickupDetails } from "@/services/quickPickupService";
import { formatDateTimeIST, formatDateOnlyIST } from "@/utils/timeUtils";
import { vendorService } from "@/services/vendorService";

interface ItemPrice {
  service_name?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  price?: number;
  total_price?: number;
}

interface ChargesBreakdown {
  base_price?: number;
  tax_amount?: number;
  service_fee?: number;
  delivery_fee?: number;
}

interface AddressDetails {
  flatNo?: string;
  landmark?: string;
  type?: string;
}

interface Booking {
  _id: string;
  custom_order_id: string;
  name: string;
  phone: string;
  customer_id: any;
  service: string;
  services: string[];
  scheduled_date: string;
  scheduled_time: string;
  delivery_date?: string;
  delivery_time?: string;
  address: string;
  status: string;
  total_price: number;
  final_amount: number;
  created_at: string;
  updated_at: string;
  payment_status?: string;
  item_prices?: ItemPrice[];
  rider?: string | null;
  vendor?: string | null;
  address_details?: AddressDetails;
  special_instructions?: string;
  additional_details?: string;
  service_type?: string;
  discount_amount?: number;
  discount_percent?: number;
  coupon_code?: string;
  charges_breakdown?: ChargesBreakdown;
  completed_at?: string;
  items_images?: Array<{
    file_id: string;
    filename: string;
    uploaded_at: string;
  }>;
}

const ORDER_FLOW_STEPS = [
  {
    value: "created",
    label: "Order Created",
    description: "Booking received and awaiting pickup scheduling.",
  },
  {
    value: "vendor_assigned",
    label: "Vendor Assigned",
    description: "Processing vendor has been assigned.",
  },
  {
    value: "pickup_completed",
    label: "Pickup Complete",
    description: "Laundry collected from the customer.",
  },
  {
    value: "ready_for_delivery",
    label: "Ready for Delivery",
    description: "Laundry processed and ready to return.",
  },
  {
    value: "delivered",
    label: "Delivered",
    description: "Delivered back to customer. Awaiting admin completion.",
  },
  {
    value: "completed",
    label: "Order Completed",
    description: "Moved to Completed Orders.",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    description: "Order was cancelled.",
  },
];

const ORDER_FLOW_SEQUENCE = ORDER_FLOW_STEPS.filter((step) => step.value !== "cancelled");

const LEGACY_STATUS_MAP: Record<string, string> = {
  pending: "created",
  new: "created",
  "new_order": "created",
  confirmed: "vendor_assigned",
  accepted: "vendor_assigned",
  assigned: "vendor_assigned",
  pickup_assigned: "vendor_assigned",
  pickup_scheduled: "vendor_assigned",
  pickup_in_progress: "vendor_assigned",
  picked_up: "pickup_completed",
  processing: "ready_for_delivery",
  delivered_to_vendor: "ready_for_delivery",
  in_process: "ready_for_delivery",
  in_progress: "ready_for_delivery",
  ready_for_pickup: "ready_for_delivery",
  out_for_delivery: "ready_for_delivery",
  delivery_assigned: "ready_for_delivery",
  delivered: "delivered",
  completed: "completed",
  cancelled: "cancelled",
};

const DEFAULT_RIDER_LIST = Array.from({ length: 10 }).map((_, index) => `Rider ${index + 1}`);

type MutationFlags = {
  status?: boolean;
  assignment?: boolean;
};

type MutationKey = keyof MutationFlags;

const normalizeStatus = (status: string) => {
  if (!status) {
    return "created";
  }

  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  return LEGACY_STATUS_MAP[normalized] || normalized;
};

const mapToBackendStatus = (status: string) => {
  const normalized = status?.toLowerCase?.().replace(/\s+/g, "_") || status;
  return normalized;
};

const getStatusLabel = (status: string) => {
  const normalized = normalizeStatus(status);
  const match = ORDER_FLOW_STEPS.find((step) => step.value === normalized);
  if (match) {
    return match.label;
  }

  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const getStatusColor = (status: string) => {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "created":
      return "bg-yellow-100 text-yellow-800";
    case "vendor_assigned":
      return "bg-orange-100 text-orange-800";
    case "pickup_completed":
      return "bg-purple-100 text-purple-800";
    case "ready_for_delivery":
      return "bg-sky-100 text-sky-800";
    case "delivered":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusIcon = (status: string) => {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "created":
      return <AlertCircle className="h-4 w-4" />;
    case "vendor_assigned":
      return <Package className="h-4 w-4" />;
    case "pickup_completed":
      return <CheckCircle className="h-4 w-4" />;
    case "ready_for_delivery":
      return <Clock className="h-4 w-4" />;
    case "delivered":
      return <CheckCircle className="h-4 w-4" />;
    case "completed":
      return <CheckCircle className="h-4 w-4" />;
    case "cancelled":
      return <XCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const normalizeBookingForEdit = (booking: Booking): Booking => {
  try {
    const rawItems: any[] = Array.isArray(booking.item_prices) ? booking.item_prices : [];

    const normalizedItems: ItemPrice[] = rawItems.map((it: any, index: number) => {
      const service_name = it.service_name || it.name || it.service || "Item";
      const quantity = Number(it.quantity ?? it.qty ?? 1) || 1;
      const unit_price = Number(it.unit_price ?? it.unitPrice ?? it.price ?? it.rate ?? 0) || 0;
      const total_price = Number(it.total_price ?? it.total ?? (quantity * unit_price)) || (quantity * unit_price);
      return {
        service_name,
        quantity,
        unit_price,
        total_price,
        _key: it._key || `item-${booking._id}-${index}`
      } as any as ItemPrice;
    });

    const services = booking.services && booking.services.length ? booking.services : normalizedItems.map(i => `${i.service_name} x${i.quantity}`);

    const normalizedBooking = {
      ...booking,
      item_prices: normalizedItems,
      services,
      final_amount: typeof booking.final_amount === 'number' ? booking.final_amount : (normalizedItems.reduce((s, it) => s + (it.total_price || 0), 0)),
      total_price: typeof booking.total_price === 'number' ? booking.total_price : (normalizedItems.reduce((s, it) => s + (it.total_price || 0), 0)),
      discount_amount: (booking as any).discount_amount || 0,
      discount_percent: (booking as any).discount_percent || 0,
      // New cashback field (admin-entered absolute rupees)
      cashback_amount: (booking as any).cashback_amount || (booking as any).cashback || 0,
    } as Booking;

    return normalizedBooking;
  } catch (e) {
    console.warn('normalizeBookingForEdit failed', e);
    return booking;
  }
};

const formatDate = (dateString?: string | Date) => {
  return formatDateTimeIST(dateString as any);
};

const getScheduledDateTime = (booking: Booking): Date => {
  try {
    const dateStr = booking.scheduled_date || '';
    const timeStr = booking.scheduled_time || '00:00';

    if (!dateStr) return new Date(0);

    const [hours, minutes] = timeStr.split(':').map(Number);
    const dateObj = new Date(dateStr);
    dateObj.setHours(hours || 0, minutes || 0, 0, 0);
    return dateObj;
  } catch (e) {
    return new Date(0);
  }
};

const getDeliveryDateTime = (booking: Booking): Date => {
  try {
    const dateStr = booking.delivery_date || '';
    const timeStr = booking.delivery_time || '00:00';

    if (!dateStr) return new Date(0);

    const [hours, minutes] = timeStr.split(':').map(Number);
    const dateObj = new Date(dateStr);
    dateObj.setHours(hours || 0, minutes || 0, 0, 0);
    return dateObj;
  } catch (e) {
    return new Date(0);
  }
};

const formatScheduledDateTime = (booking: Booking): string => {
  try {
    const dateStr = booking.scheduled_date || '';
    const timeStr = booking.scheduled_time || '00:00';

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
    return formatDateOnlyIST(booking.scheduled_date);
  }
};

const StatusFlowIndicator: React.FC<{ currentStatus: string; className?: string }> = ({
  currentStatus,
  className,
}) => {
  const normalizedStatus = normalizeStatus(currentStatus);

  if (normalizedStatus === "cancelled") {
    return (
      <div className={clsx("space-y-3", className)}>
        <Label className="text-xs font-medium uppercase text-gray-500">Order Flow</Label>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {getStatusIcon("cancelled")}
          <span>This order has been cancelled.</span>
        </div>
      </div>
    );
  }

  const currentIndex = ORDER_FLOW_SEQUENCE.findIndex((step) => step.value === normalizedStatus);

  return (
    <div className={clsx("space-y-3", className)}>
      <Label className="text-xs font-medium uppercase text-gray-500">Order Flow</Label>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2 pr-1">
          {ORDER_FLOW_SEQUENCE.map((step, index) => {
            const state =
              currentIndex === -1
                ? "upcoming"
                : index < currentIndex
                  ? "completed"
                  : index === currentIndex
                    ? "active"
                    : "upcoming";

            return (
              <div
                key={step.value}
                className={clsx(
                  "flex min-w-[180px] flex-1 flex-col rounded-lg border p-3 transition-colors",
                  state === "completed" && "border-green-200 bg-green-50",
                  state === "active" && "border-blue-200 bg-blue-50",
                  state === "upcoming" && "border-gray-200 bg-gray-50",
                )}
              >
                <div
                  className={clsx(
                    "flex items-center gap-2 text-sm font-medium",
                    state === "upcoming" ? "text-gray-700" : "text-gray-900",
                  )}
                >
                  {getStatusIcon(step.value)}
                  <span>{step.label}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface VendorOption {
  id: string;
  name: string;
  distance?: number; // in km
  estimatedTime?: number; // in minutes
}

const AdminBookingManagement: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bucketA, setBucketA] = useState<Booking[]>([]);
  const [bucketB, setBucketB] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [mutationState, setMutationState] = useState<Record<string, MutationFlags>>({});

  const [lastPollAt, setLastPollAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both'|'pickup'|'ready'>('both');
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Booking[]>([]);
  const [completedSearchTerm, setCompletedSearchTerm] = useState("");
  const [completedStatusFilter, setCompletedStatusFilter] = useState("completed");
  const [filteredCompletedOrders, setFilteredCompletedOrders] = useState<Booking[]>([]);
  const [completedPagination, setCompletedPagination] = useState<{ total: number; limit: number; offset: number; pages: number } | null>(null);

  // Pickup bucket (A) filters
  const [pickupSearchTerm, setPickupSearchTerm] = useState("");
  const [pickupStatusFilter, setPickupStatusFilter] = useState("all");
  const [filteredPickupOrders, setFilteredPickupOrders] = useState<Booking[]>([]);

  // Ready for Delivery bucket (B) filters
  const [readySearchTerm, setReadySearchTerm] = useState("");
  const [readyStatusFilter, setReadyStatusFilter] = useState("all");
  const [filteredReadyOrders, setFilteredReadyOrders] = useState<Booking[]>([]);

  const fetchVendors = async () => {
    try {
      const response = await apiClient.adminRequest<{ vendors: any[] }>('/admin/vendors');
      if (response.data?.vendors) {
        const vendorOptions: VendorOption[] = response.data.vendors.map((vendor: any) => ({
          id: vendor.id || vendor._id,
          name: vendor.name,
        }));
        setVendors(vendorOptions);
      }
    } catch (error) {
      console.warn('Failed to fetch vendors:', error);
      setVendors([]);
    }
  };

  const [completedLimit, setCompletedLimit] = useState(200);

  const fetchCompletedOrders = async (opts: { offset?: number, append?: boolean } = {}) => {
    try {
      const offset = opts.offset || 0;
      const res = await apiClient.adminRequest<{ bookings?: Booking[]; pagination?: any }>(`/admin/bookings?status=completed&limit=${completedLimit}&offset=${offset}`);
      if (res.data) {
        const anyData: any = res.data as any;
        const list = anyData.bookings || [...(anyData.bucketA || []), ...(anyData.bucketB || [])];
        const processed = list.map((b: any) => ({
          ...b,
          status: normalizeStatus(b.status),
          item_prices: Array.isArray(b.item_prices) ? b.item_prices : [],
        }));
        // Server already sorts completed by completed_at desc; still ensure client-side ordering
        processed.sort((a, b) => {
          const dateA = new Date(a.completed_at || a.updated_at || 0).getTime();
          const dateB = new Date(b.completed_at || b.updated_at || 0).getTime();
          return dateB - dateA;
        });

        if (opts.append) {
          setCompletedOrders((prev) => {
            // Merge unique by _id
            const map = new Map(prev.map(p => [p._id, p]));
            for (const p of processed) map.set(p._id, p);
            const merged = Array.from(map.values()).sort((a, b) => (new Date(b.completed_at || b.updated_at || 0).getTime()) - (new Date(a.completed_at || a.updated_at || 0).getTime()));
            filterCompletedOrders(merged);
            return merged;
          });
        } else {
          setCompletedOrders(processed);
          filterCompletedOrders(processed);
        }

        // store pagination info if provided
        if (anyData.pagination) {
          setCompletedPagination(anyData.pagination);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch completed orders', e);
    }
  };

  const filterCompletedOrders = (orders?: Booking[]) => {
    const ordersToFilter = orders || completedOrders;
    let filtered = ordersToFilter;

    if (completedSearchTerm) {
      filtered = filtered.filter((booking) =>
        booking.custom_order_id?.toLowerCase().includes(completedSearchTerm.toLowerCase()) ||
        booking.name?.toLowerCase().includes(completedSearchTerm.toLowerCase()) ||
        booking.phone?.includes(completedSearchTerm) ||
        booking.service?.toLowerCase().includes(completedSearchTerm.toLowerCase()),
      );
    }

    if (completedStatusFilter !== "all") {
      filtered = filtered.filter((booking) => normalizeStatus(booking.status) === completedStatusFilter);
    }

    // Ensure filtered completed orders are sorted by most recent completed/updated time (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.completed_at || a.updated_at || 0).getTime();
      const dateB = new Date(b.completed_at || b.updated_at || 0).getTime();
      return dateB - dateA;
    });

    setFilteredCompletedOrders(filtered);
  };

  const filterPickupOrders = (orders?: Booking[]) => {
    const ordersToFilter = orders || bucketA;
    let filtered = ordersToFilter;

    if (pickupSearchTerm) {
      filtered = filtered.filter((booking) =>
        booking.custom_order_id?.toLowerCase().includes(pickupSearchTerm.toLowerCase()) ||
        booking.name?.toLowerCase().includes(pickupSearchTerm.toLowerCase()) ||
        booking.phone?.includes(pickupSearchTerm) ||
        booking.service?.toLowerCase().includes(pickupSearchTerm.toLowerCase()),
      );
    }

    if (pickupStatusFilter !== "all") {
      filtered = filtered.filter((booking) => normalizeStatus(booking.status) === pickupStatusFilter);
    }

    setFilteredPickupOrders(filtered);
  };

  const filterReadyOrders = (orders?: Booking[]) => {
    const ordersToFilter = orders || bucketB;
    let filtered = ordersToFilter;

    if (readySearchTerm) {
      filtered = filtered.filter((booking) =>
        booking.custom_order_id?.toLowerCase().includes(readySearchTerm.toLowerCase()) ||
        booking.name?.toLowerCase().includes(readySearchTerm.toLowerCase()) ||
        booking.phone?.includes(readySearchTerm) ||
        (booking.service || (booking.services && booking.services.length ? (typeof booking.services[0] === 'string' ? booking.services[0] : booking.services[0].name || booking.services[0].service) : '') )
          .toLowerCase()
          .includes(readySearchTerm.toLowerCase()),
      );
    }

    if (readyStatusFilter !== "all") {
      filtered = filtered.filter((booking) => normalizeStatus(booking.status) === readyStatusFilter);
    }

    // Sort ready orders by delivery datetime (fallback to scheduled datetime)
    filtered.sort((a, b) => {
      const dateA = (getDeliveryDateTime(a).getTime() || getScheduledDateTime(a).getTime()) || 0;
      const dateB = (getDeliveryDateTime(b).getTime() || getScheduledDateTime(b).getTime()) || 0;
      return dateA - dateB; // earliest first
    });

    setFilteredReadyOrders(filtered);
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminRequest<{ bucketA?: Booking[]; bucketB?: Booking[] }>(`/admin/bookings?limit=100`);
      if (res.data) {
        const allBookings = [...(res.data.bucketA || []), ...(res.data.bucketB || [])];
        const processed = allBookings.map((b: any) => ({
          ...b,
          status: normalizeStatus(b.status),
          item_prices: Array.isArray(b.item_prices) ? b.item_prices : [],
        }));
        setBookings(processed);
        const a = processed.filter(b => ["created", "vendor_assigned"].includes(normalizeStatus(b.status)));
        const b = processed.filter(b => ["pickup_completed", "ready_for_delivery", "delivered"].includes(normalizeStatus(b.status)));
        setBucketA(a);
        setBucketB(b);
      }
      setLoading(false);
    } catch (e) {
      console.warn('Failed to fetch bookings', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchVendors();
    fetchCompletedOrders();

    let es: EventSource | null = null;
    try {
      es = new EventSource('/admin/bookings/stream');
      es.addEventListener('booking_change', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          console.log('🔔 Received booking_change SSE payload:', payload?._id || payload);
          if (payload && payload._id && !showEditDialog) {
            applyBookingUpdate(payload._id, payload);

            setTimeout(() => filterBookings(), 50);
          }
        } catch (err) {
          console.error('Failed to handle SSE booking_change event:', err);
        }
      });

      es.onerror = (err) => {
        console.warn('⚠️ SSE connection error:', err);
        try { es && es.close(); } catch (e) { }
      };
    } catch (e) {
      console.warn('SSE not supported or failed to connect:', e);
    }

    return () => {
      try {
        if (es) es.close();
      } catch (e) {
      }
    };
  }, []);

  // Fetch vendor recommendations when editingBooking address changes
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!editingBooking || !editingBooking.address) return;
      try {
        const services = editingBooking.services?.map((s: any) => (typeof s === 'string' ? s : s.name || s.service)) || [];
        const recs = await vendorService.getVendorRecommendations(editingBooking.address, services);

        // Get pickup coordinates to compute distances if needed
        const pickupCoords = await vendorService.getCoordinatesFromAddress(editingBooking.address);

        // Fetch authoritative vendor list from admin API
        const apiVendorsResp = await apiClient.adminRequest<{ vendors: any[] }>("/admin/vendors");
        const apiVendorsRaw = apiVendorsResp.data?.vendors || [];

        // Helper: compute haversine distance (km)
        const computeDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
          const R = 6371;
          const toRad = (d: number) => (d * Math.PI) / 180;
          const dLat = toRad(lat2 - lat1);
          const dLng = toRad(lng2 - lng1);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return Math.round(R * c * 100) / 100;
        };

        const apiVendorList: VendorOption[] = apiVendorsRaw.map((vendor: any) => ({
          id: vendor.id || vendor._id || vendor.vendor_id || String(vendor._id || vendor.id || vendor.vendor_id),
          name: vendor.name || vendor.vendor_id || 'Unnamed Vendor',
          // preserve coordinates if provided by admin API
          ...(vendor.coordinates && vendor.coordinates.lat !== undefined ? { distance: undefined, estimatedTime: undefined } : {}),
        }));

        // Merge distances: prefer exact id/name matches from recs; else compute from api vendor coordinates if available
        const merged: VendorOption[] = apiVendorList.map((v) => {
          // fuzzy match: by id, vendor_id, or name (case-insensitive)
          const match = recs.find((r) => {
            if (!r) return false;
            const rId = (r as any).id || (r as any).vendor_id || '';
            if (rId && (rId === v.id || rId === String(v.id))) return true;
            if (r.name && v.name && r.name.toLowerCase() === v.name.toLowerCase()) return true;
            return false;
          });

          let distance = match?.distance;
          let estimatedTime = match?.estimatedTime;

          // If no match but admin vendor has coordinates, compute distance using pickupCoords
          const rawVendor = apiVendorsRaw.find((av: any) => (av.id === v.id || av._id === v.id || av.vendor_id === v.id || av.name === v.name));
          if ((!distance || distance === undefined) && rawVendor && rawVendor.coordinates && pickupCoords) {
            const vLat = rawVendor.coordinates.lat || rawVendor.coordinates.latitude || rawVendor.lat || rawVendor.location?.lat;
            const vLng = rawVendor.coordinates.lng || rawVendor.coordinates.longitude || rawVendor.lng || rawVendor.location?.lng;
            if (vLat !== undefined && vLng !== undefined) {
              try {
                distance = computeDistanceKm(pickupCoords.lat, pickupCoords.lng, Number(vLat), Number(vLng));
                estimatedTime = Math.round((distance / 20) * 60 + 30); // mirror vendorService estimate
              } catch (e) {
                console.warn('Failed computing distance for vendor', v, e);
              }
            }
          }

          return {
            ...v,
            distance,
            estimatedTime,
          };
        });

        // Add any recommended vendors not in admin list
        recs.forEach((r) => {
          const exists = merged.find((m) => (r.id && m.id && String(r.id) === String(m.id)) || (r.name && m.name && r.name.toLowerCase() === m.name.toLowerCase()));
          if (!exists) merged.push({ id: r.id || r.name, name: r.name, distance: r.distance, estimatedTime: r.estimatedTime });
        });

        setVendors(merged);
      } catch (err) {
        console.warn('Failed to get vendor recommendations for address change:', err);
      }
    };

    fetchRecommendations();
  }, [editingBooking?.address, editingBooking?.services]);

  const getISTTimestamp = (): string => {
    const indianTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    return new Date(indianTime).toISOString();
  };

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const sinceParam = lastPollAt || getISTTimestamp();
        console.log("🔄 Polling for booking updates since:", sinceParam);
        const response = await apiClient.adminRequest<{ bucketA?: Booking[]; bucketB?: Booking[] }>(
          `/admin/bookings?modified_since=${encodeURIComponent(sinceParam)}&limit=100`,
        );

        if (cancelled) return;

        if (response.data) {
          const updates: Booking[] = [...(response.data.bucketA || []), ...(response.data.bucketB || [])];
          console.log(`🔄 Poll returned ${updates.length} updated bookings`);
          if (updates.length > 0) {
            updates.forEach((b) => {
              applyBookingUpdate(b._id, {
                ...b,
                status: normalizeStatus(b.status),
              });
            });

            const maxUpdated = updates
              .map((b) => new Date(b.updated_at || b.updatedAt || Date.now()))
              .reduce((max, curr) => (curr > max ? curr : max));

            const nextPollTime = getISTTimestamp();
            setLastPollAt(nextPollTime);
          } else {
            const nextPollTime = getISTTimestamp();
            setLastPollAt(nextPollTime);
          }
        }
      } catch (error) {
        console.warn('⚠️ Polling for admin booking updates failed', error);
      }
    };

    if (showEditDialog) {
      return () => {
        cancelled = true;
      };
    }

    const interval = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showEditDialog, lastPollAt]);

  useEffect(() => {
    filterBookings();
  }, [searchTerm, statusFilter, bookings]);

  useEffect(() => {
    filterCompletedOrders();
  }, [completedSearchTerm, completedStatusFilter, completedOrders]);

  useEffect(() => {
    filterPickupOrders();
  }, [pickupSearchTerm, pickupStatusFilter, bucketA]);

  useEffect(() => {
    filterReadyOrders();
  }, [readySearchTerm, readyStatusFilter, bucketB]);

  const rebucketBookings = (bookingsToRebucket: Booking[]) => {
    const a = bookingsToRebucket.filter(b => ["created", "vendor_assigned"].includes(normalizeStatus(b.status)));
    const b = bookingsToRebucket.filter(b => ["pickup_completed", "ready_for_delivery", "delivered"].includes(normalizeStatus(b.status)));
    setBucketA(a);
    setBucketB(b);
  };

  const calculateTotalPrice = (orders: Booking[]) => {
    return orders.reduce((total, order) => {
      return total + (order.total_price || 0);
    }, 0);
  };

  const groupOrdersByVendor = (orders: Booking[]): Record<string, Booking[]> => {
    return orders.reduce((acc, order) => {
      const vendorName = order.assignedVendor || "Unassigned";
      if (!acc[vendorName]) {
        acc[vendorName] = [];
      }
      acc[vendorName].push(order);
      return acc;
    }, {} as Record<string, Booking[]>);
  };

  const filterBookings = () => {
    let filtered = bookings;

    if (searchTerm) {
      filtered = filtered.filter((booking) =>
        booking.custom_order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.phone?.includes(searchTerm) ||
        booking.service?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((booking) => normalizeStatus(booking.status) === statusFilter);
    }

    filtered.sort((a, b) => {
      const dateA = getScheduledDateTime(a);
      const dateB = getScheduledDateTime(b);
      return dateA.getTime() - dateB.getTime();
    });

    setFilteredBookings(filtered);
    rebucketBookings(bookings);
  };

  const applyBookingUpdate = (bookingId: string, update: Partial<Booking>) => {
    setBookings((prev) => {
      const index = prev.findIndex((b) => b._id === bookingId);
      if (index !== -1) {
        const updated = { ...prev[index], ...update };
        const next = [...prev];
        next[index] = updated;
        return next;
      } else {
        return [...prev, update as Booking];
      }
    });
  };

  const setMutationFlag = (bookingId: string, key: MutationKey, value: boolean) => {
    setMutationState((prev) => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [key]: value,
      },
    }));
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    const normalizedStatus = normalizeStatus(newStatus);

    const backendStatus = mapToBackendStatus(normalizedStatus);

    try {
      setMutationFlag(bookingId, "status", true);
      const response = await apiClient.adminRequest<{ booking?: Booking }>(`/admin/bookings/${bookingId}`, {
        method: "PUT",
        body: { status: backendStatus },
      });

      if (response.data) {
        const updated = response.data.booking;
        if (updated) {
          applyBookingUpdate(bookingId, { ...updated, status: normalizeStatus(updated.status) });
        } else {
          applyBookingUpdate(bookingId, { status: normalizedStatus });
        }
        toast.success(`Booking status updated to ${getStatusLabel(normalizedStatus)}`);

        if (normalizedStatus === 'completed') {
          fetchCompletedOrders();
        }

        setTimeout(() => {
          console.log("🔄 Triggering immediate poll after status update");
          setLastPollAt(getISTTimestamp());
        }, 500);
      } else {
        toast.error(response.error || "Failed to update booking status");
      }
    } catch (error) {
      console.error("Error updating booking status:", error);
      toast.error("Error updating booking status");
    } finally {
      setMutationFlag(bookingId, "status", false);
    }
  };

  const updateBookingAssignments = async (
    bookingId: string,
    updates: Partial<Pick<Booking, "rider" | "vendor">>,
    successMessage: string,
  ) => {
    try {
      setMutationFlag(bookingId, "assignment", true);
      const body: any = { ...updates };
      if (typeof updates.vendor !== 'undefined' && updates.vendor !== null) {
        body.status = mapToBackendStatus('vendor_assigned');
      }
      const response = await apiClient.adminRequest<{ booking?: Booking }>(`/admin/bookings/${bookingId}`, {
        method: "PUT",
        body,
      });

      if (response.data) {
        const updatedBooking = response.data.booking;

        if (updatedBooking) {
          applyBookingUpdate(bookingId, {
            ...updatedBooking,
            status: normalizeStatus(updatedBooking.status),
          });
        } else {
          applyBookingUpdate(bookingId, updates);
        }

        toast.success(successMessage);

        setTimeout(() => {
          console.log("🔄 Triggering immediate poll after assignment update");
          setLastPollAt(getISTTimestamp());
        }, 500);
      } else {
        toast.error(response.error || "Failed to update booking");
      }
    } catch (error) {
      console.error("Error updating booking assignment:", error);
      toast.error("Error updating booking");
    } finally {
      setMutationFlag(bookingId, "assignment", false);
    }
  };

  const handleAssignmentChange = (booking: Booking, field: "rider" | "vendor", value: string) => {
    const formattedValue = value === "__unassigned__" ? null : value;

    if ((booking[field] ?? null) === formattedValue) {
      return;
    }

    updateBookingAssignments(
      booking._id,
      { [field]: formattedValue } as Partial<Pick<Booking, "rider" | "vendor">>,
      `${field === "rider" ? "Rider" : "Vendor"} assignment updated`,
    );
  };

  const handleItemPriceChange = (index: number, field: "service_name" | "quantity" | "unit_price", rawValue: string) => {
    // Normalize comma to dot for locales that type comma as decimal separator
    rawValue = String(rawValue).replace(/,/g, '.')

    setEditingBooking((prev) => {
      if (!prev) return prev;

      const currentItems = Array.isArray(prev.item_prices) ? prev.item_prices : [];
      const nextItems = [...currentItems];
      const currentItem = nextItems[index] || {};
      const nextItem = { ...currentItem } as ItemPrice;

      if (field === "service_name") {
        nextItem.service_name = rawValue;
      } else if (field === "quantity") {
        const parsedQuantity = parseFloat(rawValue);
        // Preserve incomplete decimal inputs (".", "", "-") so the user can type comfortably
        if (rawValue.trim() === "" || rawValue === "." || rawValue === "-") {
          // keep a raw string for rendering so caret doesn't jump
          (nextItem as any)._raw_quantity = rawValue;
          // keep numeric quantity as-is for calculations (fallback to 0)
          nextItem.quantity = typeof nextItem.quantity === 'number' ? nextItem.quantity : 0;
        } else {
          // valid numeric input
          delete (nextItem as any)._raw_quantity;
          nextItem.quantity = Number.isFinite(parsedQuantity) && parsedQuantity >= 0 ? parsedQuantity : 0;
        }
      } else if (field === "unit_price") {
        const parsedPrice = parseFloat(rawValue);
        nextItem.unit_price = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
      }

      // Compute totals using numeric coercion but tolerate user-typed intermediate strings
      const quantity = typeof nextItem.quantity === 'number' ? nextItem.quantity : (parseFloat(String(nextItem.quantity)) || 0);
      const unitPrice = Number(nextItem.unit_price ?? nextItem.price ?? 0) || 0;

      nextItem.total_price = +(quantity * unitPrice).toFixed(2);

      nextItems[index] = nextItem;

      return {
        ...prev,
        item_prices: nextItems,
      } as Booking;
    });
  };

  const addItemToEditing = () => {
    setEditingBooking((prev) => {
      if (!prev) return prev;
      const nextItems = Array.isArray(prev.item_prices) ? [...prev.item_prices] : [];
      nextItems.push({
        service_name: "",
        quantity: 0,
        unit_price: 0,
        total_price: 0,
        _key: `item-${Date.now()}-${Math.random()}`
      });
      return { ...prev, item_prices: nextItems } as Booking;
    });
  };

  const removeItemFromEditing = (index: number) => {
    setEditingBooking((prev) => {
      if (!prev) return prev;
      const nextItems = (prev.item_prices || []).filter((_, i) => i !== index);
      return { ...prev, item_prices: nextItems } as Booking;
    });
  };

  const computeEditingTotals = (bookingData: Booking | null) => {
    if (!bookingData) return { total: 0, afterCashback: 0, discountAmount: 0, final: 0, cashbackAmount: 0 };
    const items = bookingData.item_prices || [];
    const subtotal = items.reduce((s, it) => {
      const qty = Number(it.quantity ?? 0) || 0;
      const unitPrice = Number(it.unit_price ?? it.price ?? 0) || 0;
      const itemTotal = Number(it.total_price) || (qty * unitPrice);
      return s + itemTotal;
    }, 0);

    const cashbackAmount = Number((bookingData as any).cashback_amount ?? 0) || 0;
    const afterCashback = Math.max(0, subtotal - cashbackAmount);

    const discountPercent = Number(bookingData.discount_percent ?? 0) || 0;
    const discountAmount = +(afterCashback * (discountPercent / 100));

    const finalAmount = afterCashback - discountAmount;
    return {
      total: +subtotal.toFixed(2),
      cashbackAmount: +cashbackAmount.toFixed(2),
      afterCashback: +afterCashback.toFixed(2),
      discountAmount: +discountAmount.toFixed(2),
      final: +finalAmount.toFixed(2),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
        Loading bookings...
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-gray-50">
      <div className={viewMode === 'both' ? 'flex flex-col gap-4 md:flex-row md:items-center md:justify-between' : 'hidden'}>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Booking Management</h2>
          <p className="text-gray-600">
            Manage and edit customer bookings ({filteredBookings.length} total)
          </p>
        </div>
        <Button onClick={fetchBookings} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {viewMode !== 'both' && (
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => setViewMode('both')}>Back</Button>
            <h3 className="text-lg font-semibold">{viewMode === 'pickup' ? 'Pickup / Vendor Flow' : 'Ready for Delivery'}</h3>
            <span className="text-sm text-gray-500">{viewMode === 'pickup' ? filteredBookings.filter(b => ["created","vendor_assigned","pickup_completed"].includes(normalizeStatus(b.status))).length : filteredBookings.filter(b => ["ready_for_delivery","delivered"].includes(normalizeStatus(b.status))).length} orders</span>
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={fetchBookings}><RefreshCw className="mr-2 h-4 w-4"/> Refresh</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-6">
        <Card className={viewMode === 'both' ? '' : 'hidden'}>
          <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <Label htmlFor="search">Search Bookings</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by order ID, name, phone, or service..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="md:w-56">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {ORDER_FLOW_STEPS.map((step) => (
                    <SelectItem key={step.value} value={step.value}>
                      {step.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={viewMode === 'both' ? 'mb-4 flex items-center gap-3' : 'hidden'}>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('both')} className={clsx('inline-flex items-center gap-2 rounded-md px-3 py-2 border', viewMode === 'both' ? 'bg-white shadow-sm' : 'bg-transparent')}>
            <Package className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium">All</span>
            <span className="ml-2 text-xs text-gray-500">{filteredBookings.length}</span>
          </button>

          <button onClick={() => setViewMode('pickup')} className={clsx('inline-flex items-center gap-2 rounded-md px-3 py-2 border', viewMode === 'pickup' ? 'bg-white shadow-sm' : 'bg-transparent')}>
            <MapPin className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium">Pickup</span>
            <span className="ml-2 text-xs text-gray-500">{filteredPickupOrders.length}</span>
          </button>

          <button onClick={() => setViewMode('ready')} className={clsx('inline-flex items-center gap-2 rounded-md px-3 py-2 border', viewMode === 'ready' ? 'bg-white shadow-sm' : 'bg-transparent')}>
            <Clock className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium">Ready/Delivered</span>
            <span className="ml-2 text-xs text-gray-500">{filteredReadyOrders.length}</span>
          </button>
        </div>
      </div>

      <div className={viewMode === 'both' ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : 'grid grid-cols-1 gap-6'}>
        {/* Bucket A: Pickup & Vendor Flow */}
        <div className={viewMode === 'ready' ? 'hidden' : ''}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pickup / Vendor Flow</h3>
              <p className="text-sm text-gray-500">Orders currently being picked up or delivered to vendor</p>
            </div>
            <div className="text-right bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-xs text-gray-600 font-medium">Total Value</div>
              <div className="text-2xl font-bold text-blue-700">₹{calculateTotalPrice(filteredPickupOrders).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row mt-3 mb-4">
            <div className="flex-1">
              <Label htmlFor="pickup-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  id="pickup-search"
                  placeholder="Search by order ID, name, phone, or service..."
                  value={pickupSearchTerm}
                  onChange={(e) => setPickupSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="md:w-56">
              <Label htmlFor="pickup-status-filter">Filter by Status</Label>
              <Select value={pickupStatusFilter} onValueChange={setPickupStatusFilter}>
                <SelectTrigger id="pickup-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="created">Order Created</SelectItem>
                  <SelectItem value="vendor_assigned">Vendor Assigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 space-y-4">
            {filteredPickupOrders.length > 0 ? (
              filteredPickupOrders.map(booking => (
                <Card key={booking._id} className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">#{booking.custom_order_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{booking.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{booking.phone}</span>
                        </div>
                        {booking.assignedVendor && (
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-green-700">{booking.assignedVendorDetails?.name || booking.assigned_vendor_details?.name || (vendors.find(v => String(v.id) === String(booking.assignedVendor))?.name) || (vendors.find(v => String(v.id) === String(booking.assigned_vendor))?.name) || booking.assignedVendor || booking.assigned_vendor}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">{(booking.service && booking.service !== 'Misc Service') ? booking.service : (booking.services && booking.services.length ? (typeof booking.services[0] === 'string' ? booking.services[0] : booking.services[0].name || booking.services[0].service || 'Service') : 'Service')}</div>
                          {(booking as any).is_quick_pickup && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">🚀 Quick Pickup</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {formatScheduledDateTime(booking)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Badge className={clsx("inline-flex items-center gap-1", getStatusColor(booking.status))}>
                          {getStatusIcon(booking.status)}
                          <span>{getStatusLabel(booking.status)}</span>
                        </Badge>
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="font-medium">₹{booking.final_amount ?? booking.total_price}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setViewingBooking(booking); setShowViewDialog(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingBooking(normalizeBookingForEdit(booking)); setShowEditDialog(true); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          {normalizeStatus(booking.status) === 'vendor_assigned' && (
                            <Button size="sm" className="bg-purple-600 text-white" onClick={() => updateBookingStatus(booking._id, 'pickup_completed')}>
                              Mark Pickup Complete
                            </Button>
                          )}
                          {normalizeStatus(booking.status) === 'pickup_completed' && (
                            <Button size="sm" className="bg-sky-600 text-white" onClick={() => updateBookingStatus(booking._id, 'ready_for_delivery')}>
                              Mark Ready for Delivery
                            </Button>
                          )}
                          {normalizeStatus(booking.status) === 'ready_for_delivery' && (
                            <Button size="sm" className="bg-amber-600 text-white" onClick={() => updateBookingStatus(booking._id, 'delivered')}>
                              Mark Delivered
                            </Button>
                          )}
                          {normalizeStatus(booking.status) === 'delivered' && (
                            <Button size="sm" className="bg-green-600 text-white" onClick={() => updateBookingStatus(booking._id, 'completed')}>
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <StatusFlowIndicator currentStatus={booking.status} className="mt-6" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-gray-600">No orders in Pickup/Vendor flow</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Bucket B: Ready for Delivery */}
        <div className={viewMode === 'pickup' ? 'hidden' : ''}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Ready for Delivery</h3>
              <p className="text-sm text-gray-500">Orders ready to be delivered back to customers</p>
            </div>
            <div className="text-right bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="text-xs text-gray-600 font-medium">Total to Collect</div>
              <div className="text-2xl font-bold text-green-700">₹{calculateTotalPrice(filteredReadyOrders).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row mt-3 mb-4">
            <div className="flex-1">
              <Label htmlFor="ready-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  id="ready-search"
                  placeholder="Search by order ID, name, phone, or service..."
                  value={readySearchTerm}
                  onChange={(e) => setReadySearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="md:w-56">
              <Label htmlFor="ready-status-filter">Filter by Status</Label>
              <Select value={readyStatusFilter} onValueChange={setReadyStatusFilter}>
                <SelectTrigger id="ready-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pickup_completed">Pickup Completed</SelectItem>
                  <SelectItem value="ready_for_delivery">Ready for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 space-y-6">
            {filteredReadyOrders.length > 0 ? (
              // Flat list (no vendor grouping)
              filteredReadyOrders.map((booking) => (
                <Card key={booking._id} className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">#{booking.custom_order_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{booking.name}</span>
                        </div>
                        {booking.assignedVendor && (
                          <div className="flex items-center gap-2 mt-1">
                            <Store className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-green-700">{booking.assignedVendorDetails?.name || booking.assigned_vendor_details?.name || (vendors.find(v => String(v.id) === String(booking.assignedVendor))?.name) || (vendors.find(v => String(v.id) === String(booking.assigned_vendor))?.name) || booking.assignedVendor || booking.assigned_vendor}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">{(booking.service && booking.service !== 'Misc Service') ? booking.service : (booking.services && booking.services.length ? (typeof booking.services[0] === 'string' ? booking.services[0] : booking.services[0].name || booking.services[0].service || 'Service') : 'Service')}</div>
                          {(booking as any).is_quick_pickup && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">🚀 Quick Pickup</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {booking.delivery_date ? formatScheduledDateTime({...booking, scheduled_date: booking.delivery_date, scheduled_time: booking.delivery_time || '00:00'} as Booking) : formatScheduledDateTime(booking)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Badge className={clsx("inline-flex items-center gap-1", getStatusColor(booking.status))}>
                          {getStatusIcon(booking.status)}
                          <span>{getStatusLabel(booking.status)}</span>
                        </Badge>
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="font-medium">₹{booking.final_amount ?? booking.total_price}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setViewingBooking(booking); setShowViewDialog(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingBooking(normalizeBookingForEdit(booking)); setShowEditDialog(true); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          {normalizeStatus(booking.status) === 'vendor_assigned' && (
                            <Button size="sm" className="bg-purple-600 text-white" onClick={() => updateBookingStatus(booking._id, 'pickup_completed')}>
                              Mark Pickup Complete
                            </Button>
                          )}
                          {normalizeStatus(booking.status) === 'pickup_completed' && (
                            <Button size="sm" className="bg-sky-600 text-white" onClick={() => updateBookingStatus(booking._id, 'ready_for_delivery')}>
                              Mark Ready for Delivery
                            </Button>
                          )}
                          {normalizeStatus(booking.status) === 'ready_for_delivery' && (
                            <Button size="sm" className="bg-amber-600 text-white" onClick={() => updateBookingStatus(booking._id, 'delivered')}>
                              Mark Delivered
                            </Button>
                          )}
                          {normalizeStatus(booking.status) === 'delivered' && (
                            <Button size="sm" className="bg-green-600 text-white" onClick={() => updateBookingStatus(booking._id, 'completed')}>
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <StatusFlowIndicator currentStatus={booking.status} className="mt-6" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-gray-600">No orders ready for delivery</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Global empty state if no bookings at all */}
        {filteredBookings.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No bookings found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search criteria"
                  : "No bookings available"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {completedOrders.length > 0 && (
        <div className="mt-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Completed Orders</h3>
                <p className="text-sm text-gray-500 mb-4">Latest completed orders with search and filtering</p>
                
                <div className="flex flex-col gap-4 md:flex-row mb-4">
                  <div className="flex-1">
                    <Label htmlFor="completed-search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                      <Input
                        id="completed-search"
                        placeholder="Search by order ID, name, phone, or service..."
                        value={completedSearchTerm}
                        onChange={(e) => setCompletedSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="md:w-56">
                    <Label htmlFor="completed-status-filter">Filter by Status</Label>
                    <Select value={completedStatusFilter} onValueChange={setCompletedStatusFilter}>
                      <SelectTrigger id="completed-status-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {filteredCompletedOrders.length > 0 ? (
                  filteredCompletedOrders.map((booking) => (
                    <div key={booking._id} className="flex items-center justify-between rounded-md border p-3 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">#{booking.custom_order_id}</span>
                        <span className="text-sm text-gray-600">{booking.name}</span>
                        <Badge className={clsx("inline-flex items-center gap-1", getStatusColor(booking.status))}>
                          {getStatusLabel(booking.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium">₹{booking.final_amount ?? booking.total_price}</div>
                        <Button size="sm" variant="outline" onClick={() => { setViewingBooking(booking); setShowViewDialog(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    {completedOrders.length === 0 ? "No completed orders" : "No orders match your search"}
                  </div>
                )}
              </div>

              {/* Load more for completed orders if pagination indicates more pages */}
              {completedPagination && (completedOrders.length < (completedPagination.total || 0)) && (
                <div className="mt-3 flex justify-center">
                  <Button size="sm" onClick={() => fetchCompletedOrders({ offset: completedOrders.length, append: true })}>
                    Load more completed orders
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      )}

      </div>

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {viewingBooking && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order ID</Label>
                  <p className="font-medium">#{viewingBooking.custom_order_id}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={clsx("inline-flex items-center gap-1", getStatusColor(viewingBooking.status))}>
                    {getStatusIcon(viewingBooking.status)}
                    <span>{getStatusLabel(viewingBooking.status)}</span>
                  </Badge>
                </div>
                <div>
                  <Label>Customer Name</Label>
                  <p className="font-medium">{viewingBooking.name}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${viewingBooking.phone}`} className="text-blue-600 hover:underline">
                      {viewingBooking.phone}
                    </a>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-3 flex items-center font-semibold">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Pricing Details
                </h4>
                <div className="space-y-2 rounded-lg bg-gray-50 p-4">
                  <div className="flex justify-between">
                    <span>Total Price:</span>
                    <span className="font-medium">��{viewingBooking.total_price}</span>
                  </div>
                  {((viewingBooking as any).discount_percent || 0) > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Discount %:</span>
                      <span className="font-medium">{(viewingBooking as any).discount_percent}%</span>
                    </div>
                  )}
                  {viewingBooking.discount_amount && viewingBooking.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount Amount:</span>
                      <span>-₹{viewingBooking.discount_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-lg font-bold">
                    <span>Final Amount:</span>
                    <span>₹{viewingBooking.final_amount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          {editingBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={normalizeStatus(editingBooking.status)}
                    onValueChange={(value) =>
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: value,
                            }
                          : prev,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_FLOW_STEPS.map((step) => (
                        <SelectItem key={step.value} value={step.value}>
                          {step.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-discount">Discount %</Label>
                  <Input
                    id="edit-discount"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={editingBooking.discount_percent || ""}
                    onChange={(event) =>
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              discount_percent: parseFloat(event.target.value) || 0,
                            }
                          : prev,
                      )
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">Automatically calculates discount amount</p>
                </div>
                <div>
                  <Label htmlFor="edit-date">Scheduled Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editingBooking.scheduled_date}
                    onChange={(event) =>
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              scheduled_date: event.target.value,
                            }
                          : prev,
                      )
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-time">Scheduled Time</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={editingBooking.scheduled_time}
                    onChange={(event) =>
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              scheduled_time: event.target.value,
                            }
                          : prev,
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-delivery-date">Delivery Date</Label>
                  <Input
                    id="edit-delivery-date"
                    type="date"
                    value={editingBooking.delivery_date || ""}
                    onChange={(event) =>
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              delivery_date: event.target.value,
                            }
                          : prev,
                      )
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-delivery-time">Delivery Time</Label>
                  <Input
                    id="edit-delivery-time"
                    type="time"
                    value={editingBooking.delivery_time || ""}
                    onChange={(event) =>
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              delivery_time: event.target.value,
                            }
                          : prev,
                      )
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Assign Vendor</Label>
                <Select
                  value={editingBooking.vendor ?? "__unassigned__"}
                  onValueChange={(value) =>
                    setEditingBooking((prev) =>
                      prev
                        ? {
                            ...prev,
                            vendor: value === "__unassigned__" ? null : value,
                          }
                        : prev,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {vendors.length > 0 ? (
                      vendors
                        .slice()
                        .sort((a, b) => (a.distance || 0) - (b.distance || 0))
                        .map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{vendor.name}</span>
                              {vendor.distance !== undefined && (
                                <span className="text-xs text-gray-500">{vendorService.formatDistance(vendor.distance)} • {vendor.estimatedTime ? vendorService.formatEstimatedTime(vendor.estimatedTime) : ''}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value="no-vendors" disabled>
                        No vendors available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-4 font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Edit Cart / Items ({editingBooking.item_prices?.length || 0} items)
                </h4>
                <div className="space-y-3">
                  {editingBooking.item_prices && editingBooking.item_prices.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50 sticky top-0">
                              <th className="text-left py-3 px-3 font-semibold min-w-[220px]">Service Name</th>
                              <th className="text-center py-3 px-3 font-semibold min-w-[90px]">Qty</th>
                              <th className="text-right py-3 px-3 font-semibold min-w-[100px]">Unit Price</th>
                              <th className="text-right py-3 px-3 font-semibold min-w-[90px]">Total</th>
                              <th className="text-center py-3 px-3 font-semibold min-w-[70px]">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editingBooking.item_prices.map((item, index) => {
                              const displayPrice = item.unit_price ?? item.price ?? 0;
                              const displayTotal = item.total_price ?? (item.quantity ?? 0) * displayPrice;
                              return (
                                <tr key={index} className="border-b hover:bg-gray-50">
                                  <td className="py-3 px-3">
                                    <Select
                                      value={item.service_name || item.name || ""}
                                      onValueChange={(value) => {
                                        const realValue = value === "__none__" ? "" : value;
                                        handleItemPriceChange(index, "service_name", realValue);
                                        const catalog = getSortedServices();
                                        const matched = catalog.find((s: any) => s.name === realValue);
                                        if (matched) {
                                          handleItemPriceChange(index, "unit_price", String(matched.price));
                                          if (!item.quantity || item.quantity === 0) {
                                            handleItemPriceChange(index, "quantity", "1");
                                          }
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select item" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Select item</SelectItem>
                                        {getSortedServices().map((svc) => (
                                          <SelectItem key={svc.id || svc.name} value={svc.name}>
                                            {svc.name} — ₹{svc.price}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="py-3 px-3">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      pattern="[0-9]*[.,]?[0-9]*"
                                      value={ (item as any)._raw_quantity !== undefined ? String((item as any)._raw_quantity) : String(item.quantity ?? '') }
                                      onChange={(event) => handleItemPriceChange(index, "quantity", event.target.value)}
                                      onBlur={() => {
                                        // finalize raw quantity to numeric on blur
                                        setEditingBooking((prev) => {
                                          if (!prev) return prev;
                                          const nextItems = Array.isArray(prev.item_prices) ? [...prev.item_prices] : [];
                                          const currentItem = nextItems[index] || {};
                                          const parsed = parseFloat(String((currentItem as any)._raw_quantity ?? currentItem.quantity ?? 0).toString().replace(/,/g, '.'));
                                          if (Number.isFinite(parsed)) {
                                            currentItem.quantity = parsed;
                                          } else {
                                            currentItem.quantity = 0;
                                          }
                                          delete (currentItem as any)._raw_quantity;
                                          nextItems[index] = currentItem;
                                          return { ...prev, item_prices: nextItems } as Booking;
                                        });
                                      }}
                                      onKeyDown={(e) => {
                                        const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
                                        if (allowed.includes(e.key)) return;
                                        const isNum = /[0-9]/.test(e.key);
                                        const isCommaOrDot = e.key === '.' || e.key === ',';
                                        if (!isNum && !isCommaOrDot) {
                                          e.preventDefault();
                                        }
                                        const current = String((item as any)._raw_quantity !== undefined ? (item as any)._raw_quantity : item.quantity ?? '');
                                        if ((e.key === '.' || e.key === ',') && (current.includes('.') || current.includes(','))) {
                                          e.preventDefault();
                                        }
                                      }}
                                      className="h-8 text-center text-xs"
                                    />
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={String(displayPrice)}
                                      onChange={(event) => handleItemPriceChange(index, "unit_price", event.target.value)}
                                      className="h-8 text-right text-xs"
                                    />
                                  </td>
                                  <td className="py-3 px-3 text-right font-medium">₹{(Number(displayTotal) || 0).toFixed(2)}</td>
                                  <td className="py-3 px-3 text-center">
                                    <Button size="sm" variant="ghost" onClick={() => removeItemFromEditing(index)} className="h-8 text-xs">
                                      Remove
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 p-4 border rounded border-dashed">No itemized prices available. Click "Add Item" to add services.</div>
                  )}

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                    <Button size="sm" type="button" onClick={addItemToEditing} variant="outline">Add Item</Button>
                    <div className="text-lg font-semibold whitespace-nowrap">
                      Subtotal: <span className="text-green-600">₹{computeEditingTotals(editingBooking).total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-4 font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing & Rewards
                </h4>

                {/* Cashback Box - Top Priority */}
                <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        💰 Customer Cashback (₹)
                      </label>
                      <p className="text-xs text-gray-600 mb-2">
                        Amount to credit to customer's wallet when order completes
                      </p>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Enter cashback amount"
                        value={String((editingBooking as any)?.cashback_amount ?? 0)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value || "0") || 0;
                          setEditingBooking((prev) => prev ? ({ ...prev, cashback_amount: val } as Booking) : prev);
                        }}
                        className="w-full"
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        ₹{((editingBooking as any)?.cashback_amount ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-green-700 mt-1">Will be credited</p>
                    </div>
                  </div>
                </div>

                {/* Two-Tier Cashback System */}
                <div className="mb-4 rounded-lg bg-purple-50 border border-purple-200 p-4">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      💳 Type 1: Order Cashback (Auto-credited on completion)
                    </label>
                    <p className="text-xs text-gray-600 mb-2">
                      Amount automatically credited to customer's wallet when order is marked complete
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g., 50"
                        value={String((editingBooking as any)?.cashback_amount ?? 0)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value || "0") || 0;
                          setEditingBooking((prev) => prev ? ({ ...prev, cashback_amount: val } as Booking) : prev);
                        }}
                        className="flex-1"
                      />
                      <div className="text-right">
                        <p className="text-sm font-bold text-purple-600">
                          ₹{((editingBooking as any)?.cashback_amount ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      👛 Type 2: Wallet Deduction (Debit wallet to reduce order amount)
                    </label>
                    <p className="text-xs text-gray-600 mb-2">
                      Deduct from customer's wallet balance to reduce order amount. Wallet is debited immediately.
                    </p>
                    {editingBooking?.customer_id && (
                      <div className="bg-white rounded p-2 mb-3 border border-purple-200">
                        <p className="text-xs text-gray-600">Available Wallet Balance:</p>
                        <p className="text-xl font-bold text-blue-600">
                          ₹{((editingBooking as any)?.customer_wallet_balance ?? 0).toFixed(2)}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={(editingBooking as any)?.customer_wallet_balance ?? 0}
                        step="0.01"
                        placeholder="e.g., 30"
                        value={String((editingBooking as any)?.wallet_discount_amount ?? 0)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value || "0") || 0;
                          const maxWallet = (editingBooking as any)?.customer_wallet_balance ?? 0;
                          setEditingBooking((prev) => prev ? ({ ...prev, wallet_discount_amount: Math.min(val, maxWallet) } as any) : prev);
                        }}
                        className="flex-1"
                      />
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">
                          ₹{((editingBooking as any)?.wallet_discount_amount ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing Details */}
                <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">₹{computeEditingTotals(editingBooking).total.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700 w-32">Discount (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={String(editingBooking?.discount_percent ?? 0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value || "0") || 0;
                        setEditingBooking((prev) => prev ? ({ ...prev, discount_percent: val } as Booking) : prev);
                      }}
                      className="w-40"
                    />
                    <span className="text-sm text-gray-500">(Applied after cashback)</span>
                  </div>

                  <div className="flex justify-between text-blue-600">
                    <span>After Cashback:</span>
                    <span>- ₹{computeEditingTotals(editingBooking).afterCashback.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-blue-600">
                    <span>Discount Amount:</span>
                    <span>- ₹{computeEditingTotals(editingBooking).discountAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between border-t pt-2 text-lg font-bold">
                    <span>Final Amount:</span>
                    <span>₹{computeEditingTotals(editingBooking).final.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingBooking) {
                      return;
                    }

                    try {
                      const totals = computeEditingTotals(editingBooking);

                      const payload: any = {
                        status: mapToBackendStatus(normalizeStatus(editingBooking.status)),
                        final_amount: totals.final,
                        total_price: totals.total,
                        scheduled_date: editingBooking.scheduled_date,
                        scheduled_time: editingBooking.scheduled_time,
                        delivery_date: editingBooking.delivery_date || "",
                        delivery_time: editingBooking.delivery_time || "",
                        vendor: editingBooking.vendor,
                        discount_percent: editingBooking.discount_percent || 0,
                        discount_amount: totals.discountAmount || 0,
                        cashback_amount: totals.cashbackAmount || 0,
                      };

                      if (editingBooking.item_prices && editingBooking.item_prices.length > 0) {
                        const cleanedItems = editingBooking.item_prices
                          .filter((it) => it.service_name && it.service_name.trim() !== "")
                          .map((it) => ({
                            service_name: it.service_name || it.name,
                            quantity: it.quantity ?? 1,
                            unit_price: it.unit_price ?? it.price ?? 0,
                            total_price: it.total_price || (it.quantity ?? 1) * (it.unit_price ?? it.price ?? 0),
                          }));

                        payload.item_prices = cleanedItems;

                        // Ensure services and service fields are updated so backend stores itemized services
                        const servicesArray = cleanedItems.map((it) => `${it.service_name} x${it.quantity} (₹${it.unit_price})`);
                        if (servicesArray.length > 0) {
                          payload.services = servicesArray;
                          payload.service = servicesArray[0];
                        }
                      }

                      const response = await apiClient.adminRequest<{ booking?: Booking }>(`/admin/bookings/${editingBooking._id}`, {
                        method: "PUT",
                        body: payload,
                      });

                      if (response.data) {
                        toast.success("Booking updated successfully");
                        applyBookingUpdate(editingBooking._id, response.data.booking || editingBooking);
                        setShowEditDialog(false);
                      } else {
                        toast.error(response.error || "Failed to update booking");
                      }
                    } catch (error) {
                      console.error("Error updating booking:", error);
                      toast.error("Error updating booking");
                    }
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBookingManagement;
