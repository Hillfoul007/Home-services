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
    value: "pickup_assigned",
    label: "Pickup Assigned",
    description: "Pickup rider has been assigned.",
  },
  {
    value: "pickup_completed",
    label: "Pickup Completed",
    description: "Laundry collected from the customer.",
  },
  {
    value: "delivered_to_vendor",
    label: "Delivered to Vendor",
    description: "Order handed over to the processing partner.",
  },
  {
    value: "ready_for_delivery",
    label: "Ready for Delivery",
    description: "Laundry processed and ready to return.",
  },
  {
    value: "delivery_assigned",
    label: "Delivery Assigned",
    description: "Delivery rider assigned for returning the order.",
  },
  {
    value: "completed",
    label: "Order Completed",
    description: "Order successfully delivered back to the customer.",
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
  confirmed: "pickup_assigned",
  accepted: "pickup_assigned",
  assigned: "pickup_assigned",
  pickup_scheduled: "pickup_assigned",
  pickup_in_progress: "pickup_assigned",
  picked_up: "pickup_completed",
  processing: "delivered_to_vendor",
  in_process: "delivered_to_vendor",
  in_progress: "ready_for_delivery",
  ready_for_pickup: "ready_for_delivery",
  out_for_delivery: "delivery_assigned",
  delivery_in_progress: "delivery_assigned",
  delivered: "completed",
  completed: "completed",
  cancelled: "cancelled",
};

const DEFAULT_RIDER_LIST = Array.from({ length: 10 }).map((_, index) => `Rider ${index + 1}`);
const DEFAULT_VENDOR_LIST = Array.from({ length: 10 }).map((_, index) => `Vendor ${index + 1}`);

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

const NEW_TO_LEGACY_MAP: Record<string, string> = {
  created: "pending",
  pickup_assigned: "confirmed",
  pickup_completed: "in_progress",
  delivered_to_vendor: "in_progress",
  ready_for_delivery: "in_progress",
  delivery_assigned: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

const mapToBackendStatus = (status: string) => {
  const normalized = status?.toLowerCase?.().replace(/\s+/g, "_") || status;
  return NEW_TO_LEGACY_MAP[normalized] || normalized;
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
    case "pickup_assigned":
      return "bg-orange-100 text-orange-800";
    case "pickup_completed":
      return "bg-purple-100 text-purple-800";
    case "delivered_to_vendor":
      return "bg-indigo-100 text-indigo-800";
    case "ready_for_delivery":
      return "bg-sky-100 text-sky-800";
    case "delivery_assigned":
      return "bg-amber-100 text-amber-800";
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
    case "pickup_assigned":
      return <MapPin className="h-4 w-4" />;
    case "pickup_completed":
      return <CheckCircle className="h-4 w-4" />;
    case "delivered_to_vendor":
      return <Package className="h-4 w-4" />;
    case "ready_for_delivery":
      return <Clock className="h-4 w-4" />;
    case "delivery_assigned":
      return <MapPin className="h-4 w-4" />;
    case "completed":
      return <CheckCircle className="h-4 w-4" />;
    case "cancelled":
      return <XCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
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

  useEffect(() => {
    fetchBookings();
  }, []);

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

  const fetchBookings = async () => {
    try {
      setLoading(true);

      const response = await apiClient.adminRequest<{ bookings: Booking[] }>("/admin/bookings?limit=100");

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

          return {
            ...booking,
            name: customerName,
            phone: customerPhone,
            services: booking.services || [],
            status: normalizeStatus(booking.status),
          } as Booking;
        };

        const processedA = rawA.map(process);
        const processedB = rawB.map(process);

        setBucketA(processedA);
        setBucketB(processedB);

        const combined = [...processedA, ...processedB];
        setBookings(combined);
        setFilteredBookings(combined);
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

            return {
              ...booking,
              name: customerName,
              phone: customerPhone,
              services: booking.services || [],
              status: normalizeStatus(booking.status),
            } as Booking;
          });

          setBookings(processedFallbackBookings);
          setFilteredBookings(processedFallbackBookings);
          toast.info("Using regular bookings API (admin endpoint not available)");
        } else {
          toast.error(response.error);
        }
      }
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
      const response = await apiClient.updateBookingStatus(bookingId, backendStatus);

      if (response.data) {
        // Keep showing the new normalized status in the admin UI
        applyBookingUpdate(bookingId, { status: normalizedStatus });
        toast.success(`Booking status updated to ${getStatusLabel(normalizedStatus)}`);
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
      const response = await apiClient.adminRequest<{ booking?: Booking }>(`/admin/bookings/${bookingId}`, {
        method: "PUT",
        body: updates,
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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

      <Card>
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

      <div className="space-y-6">
        {/* Bucket A: Pickup & Vendor Flow */}
        <div>
          <h3 className="text-lg font-semibold">Pickup / Vendor Flow</h3>
          <p className="text-sm text-gray-500">Orders currently being picked up or delivered to vendor</p>
          <div className="mt-3 space-y-4">
            {filteredBookings.filter(b => ["created","pickup_assigned","pickup_completed","delivered_to_vendor"].includes(normalizeStatus(b.status))).length > 0 ? (
              filteredBookings.filter(b => ["created","pickup_assigned","pickup_completed","delivered_to_vendor"].includes(normalizeStatus(b.status))).map(booking => (
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
                          <Button size="sm" variant="outline" onClick={() => { setEditingBooking({ ...booking }); setShowEditDialog(true); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
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
        <div>
          <h3 className="text-lg font-semibold">Ready for Delivery</h3>
          <p className="text-sm text-gray-500">Orders ready to be delivered back to customers</p>
          <div className="mt-3 space-y-4">
            {filteredBookings.filter(b => ["ready_for_delivery","delivery_assigned","in_progress"].includes(normalizeStatus(b.status))).length > 0 ? (
              filteredBookings.filter(b => ["ready_for_delivery","delivery_assigned","in_progress"].includes(normalizeStatus(b.status))).map(booking => (
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
                          {formatDate(booking.scheduled_date)}
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
                          <Button size="sm" variant="outline" onClick={() => { setEditingBooking({ ...booking }); setShowEditDialog(true); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
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
                          <span>₹{viewingBooking.charges_breakdown.delivery_fee}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-lg font-bold">
                    <span>Final Amount:</span>
                    <span>₹{viewingBooking.final_amount}</span>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          {editingBooking && (
            <div className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Assign Rider</Label>
                  <Select
                    value={editingBooking.rider ?? "__unassigned__"}
                    onValueChange={(value) =>
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              rider: value === "__unassigned__" ? null : value,
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
                      {DEFAULT_RIDER_LIST.map((rider) => (
                        <SelectItem key={rider} value={rider}>
                          {rider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      {DEFAULT_VENDOR_LIST.map((vendor) => (
                        <SelectItem key={vendor} value={vendor}>
                          {vendor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <h4 className="mb-3 font-semibold">Edit Cart / Items</h4>
                <div className="space-y-2">
                  {editingBooking.item_prices && editingBooking.item_prices.length > 0 ? (
                    editingBooking.item_prices.map((item, index) => (
                      <div key={index} className="grid grid-cols-4 items-center gap-2">
                        <Select
                          value={item.service_name || item.name || ""}
                          onValueChange={(value) => {
                            // Set service name and unit price from catalog when available
                            handleItemPriceChange(index, "service_name", value);
                            try {
                              const catalog = require("@/data/laundryServices").getSortedServices();
                              const matched = catalog.find((s: any) => s.name === value);
                              if (matched) {
                                handleItemPriceChange(index, "unit_price", String(matched.price));
                                // default quantity to 1 if zero
                                if (!item.quantity || item.quantity === 0) {
                                  handleItemPriceChange(index, "quantity", "1");
                                }
                              }
                            } catch (e) {
                              // ignore
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
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
                        <Input
                          type="number"
                          step="0.1"
                          value={String(item.quantity ?? 0)}
                          onChange={(event) => handleItemPriceChange(index, "quantity", event.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={String(item.unit_price ?? item.price ?? 0)}
                          onChange={(event) => handleItemPriceChange(index, "unit_price", event.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <div className="text-sm">₹{(item.total_price ?? 0).toFixed ? (item.total_price ?? 0).toFixed(2) : item.total_price}</div>
                          <Button size="sm" variant="ghost" onClick={() => removeItemFromEditing(index)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No itemized prices available for this order.</div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={addItemToEditing}>Add Item</Button>
                    <div className="ml-auto text-sm font-medium">
                      Subtotal: ₹{computeEditingTotals(editingBooking).total}
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

                      const payload: any = {
                        status: mapToBackendStatus(normalizeStatus(editingBooking.status)),
                        final_amount: editingBooking.final_amount ?? totals.final,
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
