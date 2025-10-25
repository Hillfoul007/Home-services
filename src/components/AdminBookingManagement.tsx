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
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { getSortedServices } from "@/data/laundryServices";
import { QuickPickupService, type QuickPickupDetails } from "@/services/quickPickupService";

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
  coupon_code?: string;
  charges_breakdown?: ChargesBreakdown;
  completed_at?: string;
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
  // Backend now supports new status names; send normalized status directly
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

// Normalize booking object for admin edit modal to ensure item_prices shape
const normalizeBookingForEdit = (booking: Booking): Booking => {
  try {
    const rawItems: any[] = Array.isArray(booking.item_prices) ? booking.item_prices : [];

    const normalizedItems: ItemPrice[] = rawItems.map((it: any) => {
      const service_name = it.service_name || it.name || it.service || "Item";
      const quantity = Number(it.quantity ?? it.qty ?? 1) || 1;
      const unit_price = Number(it.unit_price ?? it.unitPrice ?? it.price ?? it.rate ?? 0) || 0;
      const total_price = Number(it.total_price ?? it.total ?? (quantity * unit_price)) || (quantity * unit_price);
      return { service_name, quantity, unit_price, total_price } as ItemPrice;
    });

    // If services array is missing, build from item names
    const services = booking.services && booking.services.length ? booking.services : normalizedItems.map(i => `${i.service_name} x${i.quantity}`);

    const normalizedBooking = {
      ...booking,
      item_prices: normalizedItems,
      services,
      final_amount: typeof booking.final_amount === 'number' ? booking.final_amount : (normalizedItems.reduce((s, it) => s + (it.total_price || 0), 0)),
      total_price: typeof booking.total_price === 'number' ? booking.total_price : (normalizedItems.reduce((s, it) => s + (it.total_price || 0), 0)),
    } as Booking;

    return normalizedBooking;
  } catch (e) {
    console.warn('normalizeBookingForEdit failed', e);
    return booking;
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) {
    return "N/A";
  }

  const parsed = new Date(dateString);

  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

  const fetchCompletedOrders = async () => {
    try {
      const res = await apiClient.adminRequest<{ bookings?: Booking[] }>(`/admin/bookings?status=completed&limit=20`);
      if (res.data) {
        const anyData: any = res.data as any;
        const list = anyData.bookings || [...(anyData.bucketA || []), ...(anyData.bucketB || [])];
        const processed = list.map((b: any) => ({
          ...b,
          status: normalizeStatus(b.status),
          item_prices: Array.isArray(b.item_prices) ? b.item_prices : [],
        }));
        setCompletedOrders(processed);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchVendors();
    fetchCompletedOrders();

    // Open SSE connection for real-time admin updates (if server supports it)
    let es: EventSource | null = null;
    try {
      es = new EventSource('/admin/bookings/stream');
      es.addEventListener('booking_change', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          console.log('🔔 Received booking_change SSE payload:', payload?._id || payload);
          if (payload && payload._id) {
            applyBookingUpdate(payload._id, payload);

            // Re-filter bookings to reflect incoming changes
            setTimeout(() => filterBookings(), 50);
          }
        } catch (err) {
          console.error('Failed to handle SSE booking_change event:', err);
        }
      });

      es.onerror = (err) => {
        console.warn('⚠️ SSE connection error:', err);
        // Close and let polling resume
        try { es && es.close(); } catch (e) { /* ignore */ }
      };
    } catch (e) {
      console.warn('SSE not supported or failed to connect:', e);
    }

    return () => {
      try {
        if (es) es.close();
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  // Helper to get current time in IST format (matching server timezone)
  const getISTTimestamp = (): string => {
    const indianTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    return new Date(indianTime).toISOString();
  };

  // Poll for updates since last poll and apply them to local state
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

            // Update last poll to the newest updated_at from updates
            const maxUpdated = updates
              .map((b) => new Date(b.updated_at || b.updatedAt || Date.now()))
              .reduce((max, curr) => (curr > max ? curr : max));

            const nextPollTime = getISTTimestamp();
            setLastPollAt(nextPollTime);
          } else {
            // Nothing new, advance lastPollAt
            const nextPollTime = getISTTimestamp();
            setLastPollAt(nextPollTime);
          }
        }
      } catch (error) {
        console.warn('⚠️ Polling for admin booking updates failed', error);
      }
    };

    // Start polling interval
    const id = setInterval(poll, 8000);

    // Also run one immediately after a short delay to avoid race conditions
    const timeoutId = setTimeout(() => {
      if (!cancelled) poll();
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(timeoutId);
    };
  }, [lastPollAt]);

  useEffect(() => {
    filterBookings();
  }, [bookings, searchTerm, statusFilter]);

  const setMutationFlag = (bookingId: string, key: MutationKey, value: boolean) => {
    setMutationState((prev) => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [key]: value,
      },
    }));
  };

  const applyBookingUpdate = (bookingId: string, updates: Partial<Booking>) => {
    const sanitizedUpdates: Partial<Booking> = {
      ...updates,
      status: updates.status ? normalizeStatus(updates.status) : updates.status,
    };

    setBookings((prev) =>
      prev.map((booking) =>
        booking._id === bookingId
          ? {
              ...booking,
              ...sanitizedUpdates,
              status: sanitizedUpdates.status || booking.status,
            }
          : booking,
      ),
    );

    setEditingBooking((prev) =>
      prev && prev._id === bookingId
        ? {
            ...prev,
            ...sanitizedUpdates,
            status: sanitizedUpdates.status || prev.status,
          }
        : prev,
    );

    setViewingBooking((prev) =>
      prev && prev._id === bookingId
        ? {
            ...prev,
            ...sanitizedUpdates,
            status: sanitizedUpdates.status || prev.status,
          }
        : prev,
    );
  };

  const convertQuickPickupToBooking = (quickPickup: QuickPickupDetails): Booking => {
    const createdAt = new Date(quickPickup.createdAt || Date.now()).toISOString();
    const itemsCollected = quickPickup.items_collected || [];

    return {
      _id: quickPickup.id,
      custom_order_id: quickPickup.custom_order_id || quickPickup.id.substring(0, 8).toUpperCase(),
      name: quickPickup.customer_name || "Quick Pickup Customer",
      phone: quickPickup.customer_phone || "N/A",
      customer_id: quickPickup.userId,
      service: "Quick Pickup",
      services: itemsCollected.map((item) => item.name),
      scheduled_date: quickPickup.pickup_date || new Date().toISOString(),
      scheduled_time: quickPickup.pickup_time || "ASAP",
      address: quickPickup.address || "N/A",
      status: quickPickup.status || "pending",
      total_price: quickPickup.estimated_cost || quickPickup.actual_cost || 0,
      final_amount: quickPickup.actual_cost || quickPickup.estimated_cost || 0,
      created_at: createdAt,
      updated_at: quickPickup.updatedAt || createdAt,
      payment_status: "pending",
      item_prices: itemsCollected.map((item) => ({
        service_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total,
      })),
      vendor: null,
      rider: quickPickup.rider_id || null,
      address_details: {
        flatNo: quickPickup.house_number || "",
        landmark: "",
        type: "quick_pickup",
      },
    };
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);

      const response = await apiClient.adminRequest<{ bookings: Booking[] }>("/admin/bookings?limit=100");
      let allBookings: Booking[] = [];

      if (response.data) {
        // Handle bucketed response from backend
        const rawA = (response.data.bucketA || []);
        const rawB = (response.data.bucketB || []);

        const process = (booking: any) => {
          const customer = booking.customer_id || {};
          const customerName =
            booking.customerName ||
            booking.name ||
            customer.full_name ||
            customer.name ||
            "Unknown Customer";
          const customerPhone =
            booking.customerPhone ||
            booking.phone ||
            customer.phone ||
            "No phone";

          // Ensure item_prices is always an array
          let itemPrices = booking.item_prices || [];
          if (!Array.isArray(itemPrices)) {
            itemPrices = [];
          }

          // Normalize vendor field from multiple possible backend names
          const vendorName = booking.assignedVendor || booking.assigned_vendor || booking.vendor || booking.assignedVendorName || booking.assigned_vendor_name || null;

          return {
            ...booking,
            name: customerName,
            phone: customerPhone,
            services: booking.services || [],
            status: normalizeStatus(booking.status),
            item_prices: itemPrices,
            vendor: vendorName,
          } as Booking;
        };

        const processedA = rawA.map(process);
        const processedB = rawB.map(process);

        setBucketA(processedA);
        setBucketB(processedB);

        allBookings = [...processedA, ...processedB];
      } else if (response.error) {
        const fallbackResponse = await apiClient.request<{ bookings: Booking[] }>("/bookings?limit=100");

        if (fallbackResponse.data) {
          const processedFallbackBookings = (fallbackResponse.data.bookings || []).map((booking: any) => {
            const customer = booking.customer_id || {};
            const customerName =
              booking.customerName ||
              booking.name ||
              customer.full_name ||
              customer.name ||
              "Unknown Customer";
            const customerPhone =
              booking.customerPhone ||
              booking.phone ||
              customer.phone ||
              "No phone";

            // Ensure item_prices is always an array
            let itemPrices = booking.item_prices || [];
            if (!Array.isArray(itemPrices)) {
              itemPrices = [];
            }

            // Normalize vendor field from multiple possible backend names
            const vendorName = booking.assignedVendor || booking.assigned_vendor || booking.vendor || booking.assignedVendorName || booking.assigned_vendor_name || null;

            return {
              ...booking,
              name: customerName,
              phone: customerPhone,
              services: booking.services || [],
              status: normalizeStatus(booking.status),
              item_prices: itemPrices,
              vendor: vendorName,
            } as Booking;
          });

          allBookings = processedFallbackBookings;
          toast.info("Using regular bookings API (admin endpoint not available)");
        } else {
          toast.error(response.error);
          allBookings = [];
        }
      }

      // Fetch quick-pickup orders
      try {
        const quickPickupResponse = await apiClient.adminRequest<{ quickPickups: QuickPickupDetails[] }>("/admin/quick-pickups?limit=100");

        if (quickPickupResponse.data?.quickPickups) {
          const convertedQuickPickups = quickPickupResponse.data.quickPickups.map(convertQuickPickupToBooking);
          allBookings = [...allBookings, ...convertedQuickPickups];
        } else {
          // Fallback: try to fetch from regular quick-pickup endpoint
          const quickPickupService = QuickPickupService.getInstance();
          const quickPickupResponse = await quickPickupService.getCurrentUserQuickPickups();

          if (quickPickupResponse.success && quickPickupResponse.quickPickups) {
            const convertedQuickPickups = quickPickupResponse.quickPickups.map(convertQuickPickupToBooking);
            allBookings = [...allBookings, ...convertedQuickPickups];
          }
        }
      } catch (qpError) {
        console.warn("Warning: Could not fetch quick-pickup orders:", qpError);
        // Continue without quick-pickups, don't fail the entire fetch
      }

      // Sort all bookings by created_at descending (newest first)
      allBookings.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setBookings(allBookings);
      setFilteredBookings(allBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Error fetching bookings");
    } finally {
      setLoading(false);
    }
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

    setFilteredBookings(filtered);
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

        // Trigger immediate polling to sync updates
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
    setEditingBooking((prev) => {
      if (!prev) return prev;

      const currentItems = prev.item_prices || [];
      const nextItems = currentItems.map((item, i) => (i === index ? { ...item } : { ...item }));
      const nextItem = { ...(nextItems[index] || {}) } as ItemPrice;

      if (field === "service_name") {
        nextItem.service_name = rawValue;
      }

      if (field === "quantity") {
        const parsedQuantity = parseFloat(rawValue);
        nextItem.quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 0;
      }

      if (field === "unit_price") {
        const parsedPrice = parseFloat(rawValue);
        nextItem.unit_price = Number.isFinite(parsedPrice) ? parsedPrice : 0;
      }

      const quantity = nextItem.quantity ?? 0;
      const unitPrice = nextItem.unit_price ?? nextItem.price ?? 0;

      nextItem.total_price = +(Number(quantity || 0) * Number(unitPrice || 0)).toFixed(2);
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
      nextItems.push({ service_name: "", quantity: 0, unit_price: 0, total_price: 0 });
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
    if (!bookingData) return { total: 0, final: 0 };
    const items = bookingData.item_prices || [];
    const subtotal = items.reduce((s, it) => s + (Number(it.total_price) || 0), 0);
    return { total: +(subtotal).toFixed(2), final: +(subtotal).toFixed(2) };
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
            <span className="ml-2 text-xs text-gray-500">{filteredBookings.filter(b => ["created","vendor_assigned","pickup_completed"].includes(normalizeStatus(b.status))).length}</span>
          </button>

          <button onClick={() => setViewMode('ready')} className={clsx('inline-flex items-center gap-2 rounded-md px-3 py-2 border', viewMode === 'ready' ? 'bg-white shadow-sm' : 'bg-transparent')}>
            <Clock className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium">Ready/Delivered</span>
            <span className="ml-2 text-xs text-gray-500">{filteredBookings.filter(b => ["ready_for_delivery","delivered"].includes(normalizeStatus(b.status))).length}</span>
          </button>
        </div>
      </div>

      <div className={viewMode === 'both' ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : 'grid grid-cols-1 gap-6'}>
        {/* Bucket A: Pickup & Vendor Flow */}
        <div className={viewMode === 'ready' ? 'hidden' : ''}>
          <h3 className="text-lg font-semibold">Pickup / Vendor Flow</h3>
          <p className="text-sm text-gray-500">Orders currently being picked up or delivered to vendor</p>
          <div className="mt-3 space-y-4">
            {filteredBookings.filter(b => ["created","vendor_assigned","pickup_completed"].includes(normalizeStatus(b.status))).length > 0 ? (
              filteredBookings.filter(b => ["created","vendor_assigned","pickup_completed"].includes(normalizeStatus(b.status))).map(booking => (
                <Card key={booking._id} className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    {/* reuse existing booking card layout by calling a small render helper - inline for simplicity */}
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
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-900">{booking.service}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {formatDate(booking.scheduled_date)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          {booking.scheduled_time || "-"}
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
          <h3 className="text-lg font-semibold">Ready for Delivery</h3>
          <p className="text-sm text-gray-500">Orders ready to be delivered back to customers</p>
          <div className="mt-3 space-y-4">
            {filteredBookings.filter(b => ["ready_for_delivery","delivered"].includes(normalizeStatus(b.status))).length > 0 ? (
              filteredBookings.filter(b => ["ready_for_delivery","delivered"].includes(normalizeStatus(b.status))).map(booking => (
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
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-900">{booking.service}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {formatDate(booking.delivery_date || booking.scheduled_date)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          {booking.delivery_time || booking.delivery_time === '' ? (booking.delivery_time || "-") : (booking.scheduled_time || "-")}
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
        <div className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">Completed Orders</h3>
              <p className="text-sm text-gray-500 mb-3">Recently completed orders (last 20)</p>
              <div className="space-y-3">
                {completedOrders.map((booking) => (
                  <div key={booking._id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <Badge className={clsx("inline-flex items-center gap-1", getStatusColor(booking.status))}>
                        {getStatusIcon(booking.status)}
                        <span>{getStatusLabel(booking.status)}</span>
                      </Badge>
                      <span className="font-medium">#{booking.custom_order_id}</span>
                      <span className="text-sm text-gray-600">{booking.name}</span>
                    </div>
                    <div className="text-sm text-gray-700">₹{booking.final_amount ?? booking.total_price}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      </div>

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
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
                <div>
                  <Label>Customer ID</Label>
                  <p className="text-sm text-gray-600">
                    {typeof viewingBooking.customer_id === "object" && viewingBooking.customer_id?._id
                      ? viewingBooking.customer_id._id
                      : viewingBooking.customer_id}
                  </p>
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Badge variant={viewingBooking.payment_status === "paid" ? "default" : "secondary"}>
                    {viewingBooking.payment_status || "pending"}
                  </Badge>
                </div>
                <div>
                  <Label>Assigned Rider</Label>
                  <p className="text-sm">{viewingBooking.rider || "Not assigned"}</p>
                </div>
                <div>
                  <Label>Assigned Vendor</Label>
                  <p className="text-sm">{viewingBooking.vendor || "Not assigned"}</p>
                </div>
              </div>

              <StatusFlowIndicator currentStatus={viewingBooking.status} />

              <div className="border-t pt-4">
                <h4 className="mb-3 flex items-center font-semibold">
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Pickup Date</Label>
                    <p className="font-medium">{formatDate(viewingBooking.scheduled_date)}</p>
                  </div>
                  <div>
                    <Label>Pickup Time</Label>
                    <p className="font-medium">{viewingBooking.scheduled_time}</p>
                  </div>
                  {viewingBooking.delivery_date && (
                    <div>
                      <Label>Delivery Date</Label>
                      <p>{formatDate(viewingBooking.delivery_date)}</p>
                    </div>
                  )}
                  {viewingBooking.delivery_time && (
                    <div>
                      <Label>Delivery Time</Label>
                      <p>{viewingBooking.delivery_time}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-3 flex items-center font-semibold">
                  <MapPin className="mr-2 h-4 w-4" />
                  Address Details
                </h4>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-900">{viewingBooking.address}</p>
                  {viewingBooking.address_details && (
                    <div className="mt-2 text-sm text-gray-600">
                      {viewingBooking.address_details.flatNo && (
                        <span>Flat: {viewingBooking.address_details.flatNo} • </span>
                      )}
                      {viewingBooking.address_details.landmark && (
                        <span>Landmark: {viewingBooking.address_details.landmark} • </span>
                      )}
                      {viewingBooking.address_details.type && (
                        <span>Type: {viewingBooking.address_details.type}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-3 flex items-center font-semibold">
                  <Package className="mr-2 h-4 w-4" />
                  Service Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label>Primary Service</Label>
                    <p className="font-medium">{viewingBooking.service}</p>
                    {viewingBooking.service_type && (
                      <p className="text-sm text-gray-600">Type: {viewingBooking.service_type}</p>
                    )}
                  </div>

                  {viewingBooking.services && viewingBooking.services.length > 0 && (
                    <div>
                      <Label>Additional Services</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {viewingBooking.services.map((service, index) => (
                          <Badge key={index} variant="outline">
                            {typeof service === "string" ? service : JSON.stringify(service)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingBooking.item_prices && viewingBooking.item_prices.length > 0 && (
                    <div>
                      <Label>Service Breakdown</Label>
                      <div className="mt-2 space-y-2">
                        {viewingBooking.item_prices.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                          >
                            <div>
                              <p className="font-medium">{item.service_name || item.name}</p>
                              <p className="text-sm text-gray-600">
                                Qty: {item.quantity} × ₹{item.unit_price || item.price || 0}
                              </p>
                            </div>
                            <p className="font-semibold">₹{item.total_price || 0}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <span className="font-medium">₹{viewingBooking.total_price}</span>
                  </div>
                  {viewingBooking.discount_amount && viewingBooking.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>-₹{viewingBooking.discount_amount}</span>
                    </div>
                  )}
                  {viewingBooking.coupon_code && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Coupon Applied:</span>
                      <span>{viewingBooking.coupon_code}</span>
                    </div>
                  )}
                  {viewingBooking.charges_breakdown && (
                    <div className="mt-2 border-t pt-2 text-sm">
                      {viewingBooking.charges_breakdown.base_price && (
                        <div className="flex justify-between">
                          <span>Base Price:</span>
                          <span>₹{viewingBooking.charges_breakdown.base_price}</span>
                        </div>
                      )}
                      {viewingBooking.charges_breakdown.tax_amount && (
                        <div className="flex justify-between">
                          <span>Tax:</span>
                          <span>₹{viewingBooking.charges_breakdown.tax_amount}</span>
                        </div>
                      )}
                      {viewingBooking.charges_breakdown.service_fee && (
                        <div className="flex justify-between">
                          <span>Service Fee:</span>
                          <span>₹{viewingBooking.charges_breakdown.service_fee}</span>
                        </div>
                      )}
                      {viewingBooking.charges_breakdown.delivery_fee && (
                        <div className="flex justify-between">
                          <span>Delivery Fee:</span>
                          <span>��{viewingBooking.charges_breakdown.delivery_fee}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-lg font-bold">
                    <span>Final Amount:</span>
                    <span>���{viewingBooking.final_amount}</span>
                  </div>
                </div>
              </div>

              {(viewingBooking.special_instructions || viewingBooking.additional_details) && (
                <div className="border-t pt-4">
                  <h4 className="mb-3 font-semibold">Additional Information</h4>
                  {viewingBooking.special_instructions && (
                    <div className="mb-2">
                      <Label>Special Instructions</Label>
                      <p className="text-gray-700">{viewingBooking.special_instructions}</p>
                    </div>
                  )}
                  {viewingBooking.additional_details && (
                    <div>
                      <Label>Additional Details</Label>
                      <p className="text-gray-700">{viewingBooking.additional_details}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="mb-3 font-semibold">Order Timeline</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Created At</Label>
                    <p>{formatDate(viewingBooking.created_at)}</p>
                  </div>
                  <div>
                    <Label>Updated At</Label>
                    <p>{formatDate(viewingBooking.updated_at)}</p>
                  </div>
                  {viewingBooking.completed_at && (
                    <div>
                      <Label>Completed At</Label>
                      <p>{formatDate(viewingBooking.completed_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          {editingBooking && (
            <div className="space-y-4" key={editingBooking._id}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    id="edit-status"
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
                  <Label htmlFor="edit-amount">Final Amount</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    value={editingBooking.final_amount}
                    onChange={(event) =>
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              final_amount: parseFloat(event.target.value) || 0,
                            }
                          : prev,
                      )
                    }
                  />
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
                      vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.name}>
                          {vendor.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-vendors" disabled>
                        No vendors available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {vendors.length > 0 ? `${vendors.length} vendor(s) available` : 'No saved vendors - create one in Vendors tab'}
                </p>
              </div>

              <div>
                <Label htmlFor="edit-address">Address</Label>
                <Textarea
                  id="edit-address"
                  value={editingBooking.address}
                  onChange={(event) =>
                    setEditingBooking((prev) =>
                      prev
                        ? {
                            ...prev,
                            address: event.target.value,
                          }
                        : prev,
                    )
                  }
                  rows={3}
                />
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
                                      type="number"
                                      step="0.1"
                                      value={String(item.quantity ?? 0)}
                                      onChange={(event) => handleItemPriceChange(index, "quantity", event.target.value)}
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
                    <Button size="sm" onClick={addItemToEditing} variant="outline">Add Item</Button>
                    <div className="text-lg font-semibold whitespace-nowrap">
                      Subtotal: <span className="text-green-600">₹{computeEditingTotals(editingBooking).total.toFixed(2)}</span>
                    </div>
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
                      // Recompute totals from items
                      const totals = computeEditingTotals(editingBooking);

                      const finalAmount = (typeof editingBooking.final_amount === "number" && !Number.isNaN(editingBooking.final_amount) && editingBooking.final_amount > 0)
                        ? editingBooking.final_amount
                        : totals.final;

                      const payload: any = {
                        status: mapToBackendStatus(normalizeStatus(editingBooking.status)),
                        final_amount: finalAmount,
                        total_price: totals.total,
                        scheduled_date: editingBooking.scheduled_date,
                        scheduled_time: editingBooking.scheduled_time,
                        address: editingBooking.address || "",
                        rider: editingBooking.rider,
                        vendor: editingBooking.vendor,
                      };

                      // Build services array from item names for backend compatibility
                      if (editingBooking.item_prices && editingBooking.item_prices.length > 0) {
                        payload.item_prices = editingBooking.item_prices.map((it) => ({
                          service_name: it.service_name || it.name || "Item",
                          quantity: it.quantity || 0,
                          unit_price: it.unit_price || it.price || 0,
                          total_price: it.total_price || 0,
                        }));

                        payload.services = payload.item_prices.map((it) =>
                          it.quantity > 1 ? `${it.service_name} x${it.quantity}` : it.service_name,
                        );

                        payload.service = payload.services.join(", ") || "Misc Service";
                      } else {
                        // Allow admin to save without services by providing defaults
                        payload.item_prices = [];
                        payload.services = ["Misc Service"];
                        payload.service = "Misc Service";
                      }

                      const response = await apiClient.adminRequest<{ booking?: Booking }>(
                        `/admin/bookings/${editingBooking._id}`,
                        {
                          method: "PUT",
                          body: payload,
                        },
                      );

                      if (response.data) {
                        const updatedBooking = response.data.booking;

                        if (updatedBooking) {
                          applyBookingUpdate(editingBooking._id, {
                            ...updatedBooking,
                            status: normalizeStatus(updatedBooking.status),
                          });
                        } else {
                          applyBookingUpdate(editingBooking._id, payload);
                        }

                        toast.success("Booking updated successfully");
                        setShowEditDialog(false);
                        setEditingBooking(null);

                        // Trigger immediate polling to sync updates
                        setTimeout(() => {
                          console.log("🔄 Triggering immediate poll after booking edit");
                          setLastPollAt(getISTTimestamp());
                        }, 500);
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
