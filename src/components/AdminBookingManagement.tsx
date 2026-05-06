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
  MessageCircle,
} from "lucide-react";
import { vendorService } from "@/services/vendorService";
import { walletService } from "@/services/walletService";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { getSortedServices } from "@/data/laundryServices";
import { QuickPickupService, type QuickPickupDetails } from "@/services/quickPickupService";
import { formatDateTimeIST, formatDateOnlyIST } from "@/utils/timeUtils";
import ReminderModal from "@/components/ReminderModal";
import { isGoogleMapsUrl, resolveAndParseGoogleMapsLink } from "@/utils/mapsLinkParser";

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
  cashback_amount?: number;
  cashback?: number;
  wallet_applied?: number;
  wallet_cashback?: number;
  coupon_code?: string;
  charges_breakdown?: ChargesBreakdown;
  completed_at?: string;
  coordinates?: { lat: number; lng: number };
  mapsLink?: string;
  distance_to_vendor?: number;
  assignedVendor?: string;
  assignedVendorId?: string;
  vendorGroupLink?: string;
  pickupRider?: { _id: string; name: string; phone: string } | string | null;
  deliveryRider?: { _id: string; name: string; phone: string } | string | null;
  items_images?: Array<{
    file_id: string;
    filename: string;
    uploaded_at: string;
  }>;
  items_video?: {
    file_id: string;
    filename: string;
    uploaded_at?: string;
  };
  vendor_payment_slips?: Array<{
    file_id: string;
    filename: string;
    uploaded_at?: string;
  }>;
  pickup_photos?: string[];
  delivery_photos?: string[];
  rider_pickup_slips?: Array<{
    file_id: string;
    filename: string;
    uploaded_at?: string;
  }>;
  rider_payment_slips?: Array<{
    file_id: string;
    filename: string;
    uploaded_at?: string;
  }>;
  pickup_pieces?: number;
  cod_collected?: boolean;
  cod_amount?: number;
  cod_collected_at?: string;
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
    value: "rider_pickup_done",
    label: "Rider Picked Up",
    description: "Rider has collected laundry — awaiting admin confirmation.",
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

const generateWhatsAppMessage = (booking: Booking): string => {
  const deliveryDate = booking.delivery_date || booking.scheduled_date;
  const deliveryTime = booking.delivery_time || booking.scheduled_time || "00:00";

  const formatDateForMessage = (dateStr: string | undefined): string => {
    if (!dateStr) return "N/A";
    try {
      const dateObj = new Date(dateStr);
      return dateObj.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatTimeForMessage = (timeStr: string): string => {
    if (!timeStr || timeStr === "00:00") return "N/A";
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const timeObj = new Date(2000, 0, 1, hours, minutes, 0);
      return timeObj.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return timeStr;
    }
  };

  const servicesList = booking.services && booking.services.length > 0
    ? booking.services.join(", ")
    : (booking.item_prices && booking.item_prices.length > 0
        ? booking.item_prices.map(item => item.service_name || item.name).join(", ")
        : "Laundry Services");

  const walletCashbackAmount = booking.final_amount && booking.wallet_cashback
    ? ((booking.final_amount * booking.wallet_cashback) / 100).toFixed(2)
    : "0.00";

  const message = `Order Confirmed! 🎉 Congratulations! Your order has been confirmed and picked up. Please find below the details:

Order ID: ${booking.custom_order_id}
Tentative delivery date: ${formatDateForMessage(deliveryDate)}
Tentative delivery time: ${formatTimeForMessage(deliveryTime)}
Address: ${booking.address || "N/A"}
Services requested: ${servicesList}
Total amount to pay: ₹${(booking.final_amount || booking.total_price || 0).toFixed(2)}
Old Cashback (deducted from wallet): ₹${(booking.cashback || 0).toFixed(2)}
New Cashback (added to wallet): ₹${walletCashbackAmount}

Thank you for choosing Laundrify! 😊🧺

Dear Customer, Please Download and login to the app with the below link for the bill details:

www.Laundrify.online

Thanks, Team Laundrify!`;

  return message;
};

const sendWhatsAppMessage = (phoneNumber: string, message: string) => {
  const encodedMessage = encodeURIComponent(message);
  const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
  const phoneWithCountryCode = cleanPhoneNumber.length === 10 ? `91${cleanPhoneNumber}` : cleanPhoneNumber;

  const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
};

const generatePickupReminder = (booking: Booking): string => {
  const pickupDate = booking.pickup_date || booking.scheduled_date;
  const pickupTime = booking.pickup_time || booking.scheduled_time || "00:00";

  const formatDateForMessage = (dateStr: string | undefined): string => {
    if (!dateStr) return "N/A";
    try {
      const dateObj = new Date(dateStr);
      return dateObj.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatTimeForMessage = (timeStr: string): string => {
    if (!timeStr || timeStr === "00:00") return "N/A";
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const timeObj = new Date(2000, 0, 1, hours, minutes, 0);
      return timeObj.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return timeStr;
    }
  };

  const address = booking.address || "N/A";
  const mapsLink = booking.mapsLink || (address && address !== "N/A"
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : "");

  const message = `Order Pickup 🧺

Order ID: ${booking.custom_order_id}
Name: ${booking.name}
Contact: ${booking.phone}
Address: ${address}${mapsLink ? '\n📍 Location: ' + mapsLink : ''}
Pickup Date & Time: ${formatDateForMessage(pickupDate)}, ${formatTimeForMessage(pickupTime)}`;

  return message;
};

const generateDeliveryReminder = (booking: Booking): string => {
  const deliveryDate = booking.delivery_date || booking.scheduled_date;
  const deliveryTime = booking.delivery_time || booking.scheduled_time || "00:00";

  const formatDateForMessage = (dateStr: string | undefined): string => {
    if (!dateStr) return "N/A";
    try {
      const dateObj = new Date(dateStr);
      return dateObj.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatTimeForMessage = (timeStr: string): string => {
    if (!timeStr || timeStr === "00:00") return "N/A";
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const timeObj = new Date(2000, 0, 1, hours, minutes, 0);
      return timeObj.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return timeStr;
    }
  };

  const address = booking.address || "N/A";
  const mapsLink = booking.mapsLink || (address && address !== "N/A"
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : "");

  const message = `Order Delivery 🚚

Order ID: ${booking.custom_order_id}
Name: ${booking.name}
Contact: ${booking.phone}
Address: ${address}${mapsLink ? '\n📍 Location: ' + mapsLink : ''}
Delivery Date & Time: ${formatDateForMessage(deliveryDate)}, ${formatTimeForMessage(deliveryTime)}
Amount to Collect: ₹${(booking.final_amount || booking.total_price || 0).toFixed(2)}

Payment: UPI - 7011585587@ptyes`;

  return message;
};

const sendVendorReminder = (vendorGroupLink: string, message: string) => {
  if (!vendorGroupLink) {
    toast.error("Vendor WhatsApp group link not available");
    return;
  }

  const encodedMessage = encodeURIComponent(message);
  const groupUrl = `${vendorGroupLink}?text=${encodedMessage}`;
  window.open(groupUrl, '_blank');
};

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
      return "bg-green-100 text-green-800";
    case "rider_pickup_done":
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
    case "rider_pickup_done":
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

    // Ensure coordinates is properly initialized (for old orders that may not have this field)
    const coordinates = booking.coordinates && booking.coordinates.lat && booking.coordinates.lng
      ? booking.coordinates
      : undefined;

    const normalizedBooking = {
      ...booking,
      item_prices: normalizedItems,
      services,
      final_amount: typeof booking.final_amount === 'number' ? booking.final_amount : (normalizedItems.reduce((s, it) => s + (it.total_price || 0), 0)),
      total_price: typeof booking.total_price === 'number' ? booking.total_price : (normalizedItems.reduce((s, it) => s + (it.total_price || 0), 0)),
      discount_amount: (booking as any).discount_amount || 0,
      discount_percent: (booking as any).discount_percent || 0,
      coordinates,
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

const parseTimeString = (timeStr: string): { hours: number; minutes: number } => {
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const isPM = ampmMatch[3].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return { hours, minutes };
  }
  const parts = timeStr.split(':').map(Number);
  return { hours: parts[0] || 0, minutes: parts[1] || 0 };
};

const getScheduledDateTime = (booking: Booking): Date => {
  try {
    const dateStr = booking.scheduled_date || '';
    const timeStr = booking.scheduled_time || '00:00';

    if (!dateStr) return new Date(0);

    const { hours, minutes } = parseTimeString(timeStr);
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

    const { hours, minutes } = parseTimeString(timeStr);
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
    const timeStr = booking.scheduled_time || '';

    if (!dateStr) return 'N/A';

    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return 'N/A';

    const dayMonth = dateObj.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    if (!timeStr || timeStr === '00:00') {
      return dayMonth;
    }

    // Handle time in both "HH:mm" and "h:mm AM/PM" formats
    let hours = 0, minutes = 0;
    const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
      hours = parseInt(ampmMatch[1], 10);
      minutes = parseInt(ampmMatch[2], 10);
      const isPM = ampmMatch[3].toUpperCase() === 'PM';
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    } else {
      const parts = timeStr.split(':').map(Number);
      hours = parts[0] || 0;
      minutes = parts[1] || 0;
    }

    if (isNaN(hours) || isNaN(minutes)) {
      return `${dayMonth}, ${timeStr}`;
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
  // Resolve file URL — Cloudinary URLs are used directly; GridFS IDs go through the backend proxy
  const mediaUrl = (fileId: string, apiPath: string) =>
    fileId?.startsWith('http') ? fileId : apiPath;

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [mediaBooking, setMediaBooking] = useState<Booking | null>(null);
  const [mutationState, setMutationState] = useState<Record<string, MutationFlags>>({});

  const [lastPollAt, setLastPollAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both'|'pickup'|'ready'|'offline'|'all_orders'>('both');
  const [offlineOrders, setOfflineOrders] = useState<Booking[]>([]);
  const [filteredOfflineOrders, setFilteredOfflineOrders] = useState<Booking[]>([]);
  const [offlineSearchTerm, setOfflineSearchTerm] = useState("");
  const [offlineStatusFilter, setOfflineStatusFilter] = useState("all");
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorFullData, setVendorFullData] = useState<Record<string, any>>({});
  const [riders, setRiders] = useState<Array<{ _id: string; name: string; phone: string; live_location_link?: string; location?: { lat: number; lng: number } }>>([]);
  const [bookingAddressCoords, setBookingAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userWalletBalance, setUserWalletBalance] = useState<number>(0);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [completedOrders, setCompletedOrders] = useState<Booking[]>([]);
  const [completedSearchTerm, setCompletedSearchTerm] = useState("");
  const [completedStatusFilter, setCompletedStatusFilter] = useState("completed");
  const [filteredCompletedOrders, setFilteredCompletedOrders] = useState<Booking[]>([]);
  const [expandedMediaOrderId, setExpandedMediaOrderId] = useState<string | null>(null);

  // All Orders search section
  const [allOrdersList, setAllOrdersList] = useState<Booking[]>([]);
  const [allOrdersSearchTerm, setAllOrdersSearchTerm] = useState("");
  const [allOrdersLoading, setAllOrdersLoading] = useState(false);
  const [allOrdersExpandedId, setAllOrdersExpandedId] = useState<string | null>(null);
  const [allOrdersHasSearched, setAllOrdersHasSearched] = useState(false);

  // Pickup bucket (A) filters
  const [pickupSearchTerm, setPickupSearchTerm] = useState("");
  const [pickupStatusFilter, setPickupStatusFilter] = useState("all");
  const [filteredPickupOrders, setFilteredPickupOrders] = useState<Booking[]>([]);

  // Ready for Delivery bucket (B) filters
  const [readySearchTerm, setReadySearchTerm] = useState("");
  const [readyStatusFilter, setReadyStatusFilter] = useState("all");
  const [filteredReadyOrders, setFilteredReadyOrders] = useState<Booking[]>([]);

  // Month filter state
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderType, setReminderType] = useState<'pickup' | 'delivery'>('pickup');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderVendorGroupLink, setReminderVendorGroupLink] = useState<string | undefined>();


  const fetchVendors = async () => {
    try {
      const response = await apiClient.adminRequest<{ vendors: any[] }>('/admin/vendors');
      if (response.data?.vendors) {
        const vendorOptions: VendorOption[] = response.data.vendors.map((vendor: any) => ({
          id: vendor.id || vendor._id,
          name: vendor.name,
        }));

        // Store full vendor data for distance calculations
        const fullDataMap: Record<string, any> = {};
        const vendorDetails = [];
        response.data.vendors.forEach((vendor: any) => {
          fullDataMap[vendor.name || vendor.id] = vendor;
          // Also provide to VendorService so other components can use them
          vendorDetails.push({
            id: vendor.id || vendor._id,
            name: vendor.name,
            address: vendor.address || '',
            coordinates: vendor.coordinates || { lat: 28.4595, lng: 77.0266 },
            services: vendor.services || [],
            contactPhone: vendor.contactPhone,
            rating: vendor.rating,
            isActive: vendor.isActive !== false,
          });
        });

        setVendors(vendorOptions);
        setVendorFullData(fullDataMap);

        // Sync vendors to VendorService for use in other components
        vendorService.setVendors(vendorDetails);
      }
    } catch (error) {
      console.warn('Failed to fetch vendors:', error);
      setVendors([]);
      setVendorFullData({});
    }
  };

  const fetchRiders = async () => {
    try {
      const response = await apiClient.adminRequest<{ riders: any[] }>('/admin/riders');
      if (response.data?.riders) {
        setRiders(response.data.riders);
      }
    } catch (error) {
      console.warn('Failed to fetch riders:', error);
      setRiders([]);
    }
  };

  const fetchCompletedOrders = async () => {
    try {
      const res = await apiClient.adminRequest<{ bookings?: Booking[] }>(`/admin/bookings?status=completed&limit=50`);
      if (res.data) {
        const anyData: any = res.data as any;
        const list = anyData.bookings || [...(anyData.bucketA || []), ...(anyData.bucketB || [])];
        const processed = list.map((b: any) => ({
          ...b,
          status: normalizeStatus(b.status),
          item_prices: Array.isArray(b.item_prices) ? b.item_prices : [],
        }));
        processed.sort((a, b) => {
          const dateA = new Date(a.completed_at || a.updated_at || 0).getTime();
          const dateB = new Date(b.completed_at || b.updated_at || 0).getTime();
          return dateB - dateA;
        });
        setCompletedOrders(processed);
        filterCompletedOrders(processed);
      }
    } catch (e) {
      console.warn('Failed to fetch completed orders', e);
    }
  };

  const searchAllOrders = async (term: string) => {
    if (!term || term.trim().length < 1) {
      setAllOrdersList([]);
      setAllOrdersHasSearched(false);
      return;
    }
    try {
      setAllOrdersLoading(true);
      setAllOrdersHasSearched(true);
      const res = await apiClient.adminRequest<any>(
        `/admin/bookings/search?q=${encodeURIComponent(term.trim())}&limit=50`
      );
      if (res.data?.orders) {
        const processed = res.data.orders.map((b: any) => ({
          ...b,
          status: normalizeStatus(b.status),
          item_prices: Array.isArray(b.item_prices) ? b.item_prices : [],
        }));
        setAllOrdersList(processed);
      } else {
        setAllOrdersList([]);
      }
    } catch (e) {
      console.warn('Failed to search orders', e);
      setAllOrdersList([]);
    } finally {
      setAllOrdersLoading(false);
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

    // Month filtering temporarily disabled to debug
    // filtered = filterByMonths(filtered);

    filtered.sort((a, b) => {
      const dateA = getScheduledDateTime(a);
      const dateB = getScheduledDateTime(b);
      return dateA.getTime() - dateB.getTime();
    });

    setFilteredPickupOrders(filtered);
  };

  const getDeliveryDateTimeForSort = (booking: Booking): Date => {
    try {
      const dateStr = booking.delivery_date || booking.scheduled_date || '';
      const timeStr = booking.delivery_time || booking.scheduled_time || '00:00';

      if (!dateStr) return new Date(0);

      const [hours, minutes] = timeStr.split(':').map(Number);
      const dateObj = new Date(dateStr);
      dateObj.setHours(hours || 0, minutes || 0, 0, 0);
      return dateObj;
    } catch (e) {
      return new Date(0);
    }
  };

  const filterReadyOrders = (orders?: Booking[]) => {
    const ordersToFilter = orders || bucketB;
    let filtered = ordersToFilter;

    if (readySearchTerm) {
      filtered = filtered.filter((booking) =>
        booking.custom_order_id?.toLowerCase().includes(readySearchTerm.toLowerCase()) ||
        booking.name?.toLowerCase().includes(readySearchTerm.toLowerCase()) ||
        booking.phone?.includes(readySearchTerm) ||
        booking.service?.toLowerCase().includes(readySearchTerm.toLowerCase()),
      );
    }

    if (readyStatusFilter !== "all") {
      filtered = filtered.filter((booking) => normalizeStatus(booking.status) === readyStatusFilter);
    }

    // Month filtering temporarily disabled to debug
    // filtered = filterByMonths(filtered);

    filtered.sort((a, b) => {
      const dateA = getDeliveryDateTimeForSort(a);
      const dateB = getDeliveryDateTimeForSort(b);
      return dateA.getTime() - dateB.getTime();
    });

    setFilteredReadyOrders(filtered);
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminRequest<{ bucketA?: Booking[]; bucketB?: Booking[]; offlineOrders?: Booking[] }>(`/admin/bookings?limit=100`);
      if (res.data) {
        const allBookings = [...(res.data.bucketA || []), ...(res.data.bucketB || [])];
        const processed = allBookings.map((b: any) => ({
          ...b,
          status: normalizeStatus(b.status),
          item_prices: Array.isArray(b.item_prices) ? b.item_prices : [],
        }));
        setBookings(processed);

        // Use offline orders directly from API response
        const offlineProcessed = (res.data.offlineOrders || []).map((b: any) => ({
          ...b,
          status: normalizeStatus(b.status),
          item_prices: Array.isArray(b.item_prices) ? b.item_prices : [],
        }));
        setOfflineOrders(offlineProcessed);

        // Bucket filtering - only online orders assigned to vendors
        const a = (res.data.bucketA || []).filter(b => (b as any).assignedVendor);
        const b = (res.data.bucketB || []).filter(b => (b as any).assignedVendor);
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
    fetchRiders();
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
        const response = await apiClient.adminRequest<{ bucketA?: Booking[]; bucketB?: Booking[]; offlineOrders?: Booking[] }>(
          `/admin/bookings?modified_since=${encodeURIComponent(sinceParam)}&limit=100`,
        );

        if (cancelled) return;

        if (response.data) {
          const updates: Booking[] = [...(response.data.bucketA || []), ...(response.data.bucketB || []), ...(response.data.offlineOrders || [])];
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
    // updateAvailableMonths(bookings);  // Temporarily disabled
    filterBookings();
  }, [searchTerm, statusFilter, bookings]); // Removed selectedMonths temporarily

  useEffect(() => {
    filterCompletedOrders();
  }, [completedSearchTerm, completedStatusFilter, completedOrders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchAllOrders(allOrdersSearchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [allOrdersSearchTerm]);

  useEffect(() => {
    filterPickupOrders();
  }, [pickupSearchTerm, pickupStatusFilter, bucketA]); // Removed selectedMonths

  useEffect(() => {
    filterReadyOrders();
  }, [readySearchTerm, readyStatusFilter, bucketB]); // Removed selectedMonths

  useEffect(() => {
    filterOfflineOrders();
  }, [offlineSearchTerm, offlineStatusFilter, offlineOrders]);

  // Geocode booking address and calculate vendor distances
  // Prioritize existing coordinates from Google Maps, then geocode the address
  useEffect(() => {
    if (showEditDialog && editingBooking) {
      const setCoords = async () => {
        // If booking already has valid coordinates (from Google Maps feature), use those
        if (editingBooking.coordinates && editingBooking.coordinates.lat && editingBooking.coordinates.lng) {
          setBookingAddressCoords(editingBooking.coordinates);
          return;
        }

        // Otherwise, try to geocode the address
        if (editingBooking.address) {
          try {
            const coords = await vendorService.getCoordinatesFromAddress(editingBooking.address);
            if (coords) {
              setBookingAddressCoords(coords);
            }
          } catch (error) {
            console.warn('Failed to geocode address:', error);
          }
        }
      };
      setCoords();
    }
  }, [editingBooking, showEditDialog]);

  // Load user's wallet balance when editing booking
  useEffect(() => {
    if (editingBooking && showEditDialog) {
      const loadWalletBalance = async () => {
        setLoadingWallet(true);
        try {
          // Extract string ID from customer_id (could be an object or string)
          let customerId = editingBooking.customer_id;
          if (customerId && typeof customerId === 'object') {
            // If it's an object, try to get the _id or id property
            customerId = customerId._id || customerId.id || customerId.toString();
          }

          // Use customer_id if available, otherwise fall back to phone number
          const userId = customerId || editingBooking.phone;

          console.log('🔍 Attempting wallet lookup with:', {
            customer_id: editingBooking.customer_id,
            customer_id_type: typeof editingBooking.customer_id,
            extracted_id: customerId,
            phone: editingBooking.phone,
            userId: userId,
            booking_id: editingBooking._id,
            booking_name: editingBooking.name
          });

          if (!userId) {
            console.warn('❌ No customer_id or phone available for wallet lookup');
            setUserWalletBalance(0);
            return;
          }

          const result = await walletService.getWalletBalance(userId);
          console.log('💰 Wallet balance response:', {
            userId,
            response: result,
            wallet_balance: result.wallet_balance
          });

          if (result.success) {
            setUserWalletBalance(result.wallet_balance || 0);
          } else {
            console.warn('⚠️  Wallet fetch returned success: false', result);
            setUserWalletBalance(0);
          }
        } catch (error) {
          console.warn('❌ Failed to load wallet balance:', error);
          setUserWalletBalance(0);
        } finally {
          setLoadingWallet(false);
        }
      };
      loadWalletBalance();
    }
  }, [editingBooking?._id, showEditDialog]);

  const rebucketBookings = (bookingsToRebucket: Booking[]) => {
    const a = bookingsToRebucket.filter(b => ["created", "vendor_assigned", "rider_pickup_done"].includes(normalizeStatus(b.status)));
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

  const getMonthYearKey = (dateStr?: string): string => {
    if (!dateStr) return "";
    try {
      const dateObj = new Date(dateStr);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    } catch (e) {
      return "";
    }
  };

  const getMonthYearDisplay = (monthYearKey: string): string => {
    if (!monthYearKey) return "";
    const [year, month] = monthYearKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  };

  const updateAvailableMonths = (bookingsToProcess: Booking[]) => {
    const monthSet = new Set<string>();
    bookingsToProcess.forEach((booking) => {
      const monthKey = getMonthYearKey(booking.scheduled_date);
      if (monthKey) {
        monthSet.add(monthKey);
      }
    });
    const sortedMonths = Array.from(monthSet).sort().reverse();
    setAvailableMonths(sortedMonths);
  };

  const toggleMonth = (monthKey: string) => {
    setSelectedMonths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const filterByMonths = (bookingsToFilter: Booking[]): Booking[] => {
    if (selectedMonths.size === 0) {
      return bookingsToFilter;
    }
    return bookingsToFilter.filter((booking) => {
      const monthKey = getMonthYearKey(booking.scheduled_date);
      return monthKey && selectedMonths.has(monthKey);
    });
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

    // Month filtering temporarily disabled to debug
    // filtered = filterByMonths(filtered);

    filtered.sort((a, b) => {
      const dateA = getScheduledDateTime(a);
      const dateB = getScheduledDateTime(b);
      return dateA.getTime() - dateB.getTime();
    });

    setFilteredBookings(filtered);
    rebucketBookings(bookings);
  };

  const filterOfflineOrders = () => {
    // Only include orders marked as offline
    let filtered = offlineOrders.filter(b => (b as any).is_offline_order === true);

    if (offlineSearchTerm) {
      filtered = filtered.filter((booking) =>
        booking.custom_order_id?.toLowerCase().includes(offlineSearchTerm.toLowerCase()) ||
        booking.customer_name?.toLowerCase().includes(offlineSearchTerm.toLowerCase()) ||
        booking.customer_phone?.includes(offlineSearchTerm) ||
        booking.service?.toLowerCase().includes(offlineSearchTerm.toLowerCase()),
      );
    }

    if (offlineStatusFilter !== "all") {
      filtered = filtered.filter((booking) => normalizeStatus(booking.status) === offlineStatusFilter);
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    setFilteredOfflineOrders(filtered);
  };

  const applyBookingUpdate = (bookingId: string, update: Partial<Booking>) => {
    const patchList = (prev: Booking[]): Booking[] => {
      const index = prev.findIndex((b) => b._id === bookingId);
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = { ...prev[index], ...update };
      return next;
    };
    setBookings(patchList);
    setBucketA(patchList);
    setBucketB(patchList);
    setFilteredBookings(patchList);
    setFilteredPickupOrders(patchList);
    setFilteredReadyOrders(patchList);
    setCompletedOrders(patchList);
    setFilteredCompletedOrders(patchList);
    setOfflineOrders(patchList);
    setFilteredOfflineOrders(patchList);
    setAllOrdersList(patchList);
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
        nextItem.quantity = Number.isFinite(parsedQuantity) && parsedQuantity >= 0 ? parsedQuantity : 1;
      } else if (field === "unit_price") {
        const parsedPrice = parseFloat(rawValue);
        nextItem.unit_price = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
      }

      const quantity = Number(nextItem.quantity ?? 1) || 1;
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
    if (!bookingData) return { total: 0, final: 0, details: { subtotal: 0, cashback: 0, afterCashback: 0, discount: 0 } };
    const items = bookingData.item_prices || [];
    const subtotal = items.reduce((s, it) => {
      const qty = Number(it.quantity ?? 0) || 0;
      const unitPrice = Number(it.unit_price ?? it.price ?? 0) || 0;
      const itemTotal = Number(it.total_price) || (qty * unitPrice);
      return s + itemTotal;
    }, 0);

    // Apply cashback first (use new 'cashback' field if available, otherwise fallback to 'cashback_amount')
    const cashbackAmount = Number((bookingData as any).cashback ?? bookingData.cashback_amount ?? 0) || 0;
    const afterCashback = subtotal - cashbackAmount;

    // Then apply discount percentage
    const discountPercent = Number(bookingData.discount_percent ?? 0) || 0;
    const discountAmount = (afterCashback * discountPercent) / 100;
    const finalAmount = afterCashback - discountAmount;

    return {
      total: +(subtotal).toFixed(2),
      final: +(finalAmount).toFixed(2),
      details: {
        subtotal: +(subtotal).toFixed(2),
        cashback: +(cashbackAmount).toFixed(2),
        afterCashback: +(afterCashback).toFixed(2),
        discount: +(discountAmount).toFixed(2)
      }
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
            <h3 className="text-lg font-semibold">
              {viewMode === 'pickup' ? 'Pickup / Vendor Flow' : viewMode === 'offline' ? 'Offline Orders' : viewMode === 'all_orders' ? 'All Orders Search' : 'Ready for Delivery'}
            </h3>
            <span className="text-sm text-gray-500">
              {viewMode === 'pickup' ? filteredBookings.filter(b => ["created","vendor_assigned","rider_pickup_done"].includes(normalizeStatus(b.status))).length : viewMode === 'offline' ? filteredOfflineOrders.length : viewMode === 'all_orders' ? allOrdersList.length : filteredBookings.filter(b => ["pickup_completed","ready_for_delivery","delivered"].includes(normalizeStatus(b.status))).length} orders
            </span>
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
        <div className="flex items-center gap-2 flex-wrap">
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

          <button onClick={() => setViewMode('offline')} className={clsx('inline-flex items-center gap-2 rounded-md px-3 py-2 border', viewMode === 'offline' ? 'bg-purple-50 shadow-sm border-purple-300' : 'bg-transparent')}>
            <Store className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Offline Orders</span>
            <span className="ml-2 text-xs text-purple-500">{filteredOfflineOrders.length}</span>
          </button>

          <button onClick={() => setViewMode('all_orders')} className={clsx('inline-flex items-center gap-2 rounded-md px-3 py-2 border', viewMode === 'all_orders' ? 'bg-amber-50 shadow-sm border-amber-300' : 'bg-transparent')}>
            <Search className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">All Orders</span>
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
                  <SelectItem value="rider_pickup_done">Rider Picked Up</SelectItem>
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
                        {booking.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-gray-700 truncate" title={booking.address}>{booking.address}</span>
                          </div>
                        )}
                        {booking.assignedVendor && (
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-green-700">{booking.assignedVendor}</span>
                          </div>
                        )}
                        {(() => {
                          const pr = booking.pickupRider && typeof booking.pickupRider === "object" ? (booking.pickupRider as any).name : null;
                          const dr = booking.deliveryRider && typeof booking.deliveryRider === "object" ? (booking.deliveryRider as any).name : null;
                          if (pr || dr) return (
                            <div className="flex flex-col gap-0.5">
                              {pr && <div className="flex items-center gap-1"><span className="text-xs">🧺</span><span className="text-xs text-indigo-700 font-medium">{pr}</span></div>}
                              {dr && <div className="flex items-center gap-1"><span className="text-xs">🚚</span><span className="text-xs text-emerald-700 font-medium">{dr}</span></div>}
                            </div>
                          );
                          if (!booking.rider) return null;
                          const riderObj = riders.find(r => r._id === booking.rider || r.name === booking.rider);
                          return (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🛵</span>
                              <span className="text-sm text-indigo-700 font-medium">{riderObj ? riderObj.name : booking.rider}</span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">{booking.service}</div>
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
                        {booking.pickup_pieces != null && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">🧺 {booking.pickup_pieces} pcs (rider)</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => { setViewingBooking(booking); setShowViewDialog(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" title="View Media" className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100" onClick={() => { setMediaBooking(booking); setShowMediaDialog(true); }}>
                            📷
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingBooking(normalizeBookingForEdit(booking)); setShowEditDialog(true); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                            onClick={() => {
                              const message = generateWhatsAppMessage(booking);
                              sendWhatsAppMessage(booking.phone, message);
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            className="bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-100"
                            onClick={() => {
                              // Handle both vendor name and vendor ID for backward compatibility
                              let vendorData = vendorFullData[booking.assignedVendor];
                              if (!vendorData && booking.assignedVendorId) {
                                // Try to find by ID if name lookup fails
                                vendorData = Object.values(vendorFullData).find((v: any) => v.id === booking.assignedVendorId || v._id === booking.assignedVendorId);
                              }
                              const vendorGroupLink = booking.vendorGroupLink || vendorData?.whatsapp_group_invite_link;
                              const message = generatePickupReminder(booking);
                              setReminderMessage(message);
                              setReminderType('pickup');
                              setReminderVendorGroupLink(vendorGroupLink);
                              setShowReminderModal(true);
                            }}
                          >
                            📤 Pickup Reminder
                          </Button>
                          {(normalizeStatus(booking.status) === 'vendor_assigned' || normalizeStatus(booking.status) === 'rider_pickup_done') && (
                            <>
                              <Button size="sm" className="bg-purple-600 text-white" onClick={() => updateBookingStatus(booking._id, 'pickup_completed')}>
                                {normalizeStatus(booking.status) === 'rider_pickup_done' ? '✅ Mark Pickup Complete (Rider Done)' : 'Mark Pickup Complete'}
                              </Button>
                            </>
                          )}
                          {normalizeStatus(booking.status) === 'pickup_completed' && (
                            <Button size="sm" className="bg-sky-600 text-white" onClick={() => updateBookingStatus(booking._id, 'ready_for_delivery')}>
                              Mark Ready for Delivery
                            </Button>
                          )}
                          {normalizeStatus(booking.status) === 'ready_for_delivery' && (
                            <>
                              <Button size="sm" className="bg-amber-600 text-white" onClick={() => updateBookingStatus(booking._id, 'delivered')}>
                                Mark Delivered
                              </Button>
                            </>
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
                  <SelectItem value="ready_for_delivery">Ready for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 space-y-4">
            {filteredReadyOrders.length > 0 ? (
              filteredReadyOrders.map(booking => (
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
                        {booking.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-gray-700 truncate" title={booking.address}>{booking.address}</span>
                          </div>
                        )}
                        {booking.assignedVendor && (
                          <div className="flex items-center gap-2 mt-1">
                            <Store className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-green-700">{booking.assignedVendor}</span>
                          </div>
                        )}
                        {(() => {
                          const pr = booking.pickupRider && typeof booking.pickupRider === "object" ? (booking.pickupRider as any).name : null;
                          const dr = booking.deliveryRider && typeof booking.deliveryRider === "object" ? (booking.deliveryRider as any).name : null;
                          if (!pr && !dr) return null;
                          return (
                            <div className="flex flex-col gap-0.5 mt-1">
                              {pr && <div className="flex items-center gap-1"><span className="text-xs">🧺</span><span className="text-xs text-indigo-700 font-medium">{pr}</span></div>}
                              {dr && <div className="flex items-center gap-1"><span className="text-xs">🚚</span><span className="text-xs text-emerald-700 font-medium">{dr}</span></div>}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">{booking.service}</div>
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
                        {booking.pickup_pieces != null && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">🧺 {booking.pickup_pieces} pcs (rider)</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => { setViewingBooking(booking); setShowViewDialog(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" title="View Media" className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100" onClick={() => { setMediaBooking(booking); setShowMediaDialog(true); }}>
                            📷
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingBooking(normalizeBookingForEdit(booking)); setShowEditDialog(true); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                            onClick={() => {
                              const message = generateWhatsAppMessage(booking);
                              sendWhatsAppMessage(booking.phone, message);
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            className="bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100"
                            onClick={() => {
                              // Handle both vendor name and vendor ID for backward compatibility
                              let vendorData = vendorFullData[booking.assignedVendor];
                              if (!vendorData && booking.assignedVendorId) {
                                // Try to find by ID if name lookup fails
                                vendorData = Object.values(vendorFullData).find((v: any) => v.id === booking.assignedVendorId || v._id === booking.assignedVendorId);
                              }
                              const vendorGroupLink = booking.vendorGroupLink || vendorData?.whatsapp_group_invite_link;
                              const message = generateDeliveryReminder(booking);
                              setReminderMessage(message);
                              setReminderType('delivery');
                              setReminderVendorGroupLink(vendorGroupLink);
                              setShowReminderModal(true);
                            }}
                          >
                            🚚 Delivery Reminder
                          </Button>
                          {(normalizeStatus(booking.status) === 'vendor_assigned' || normalizeStatus(booking.status) === 'rider_pickup_done') && (
                            <>
                              <Button size="sm" className="bg-purple-600 text-white" onClick={() => updateBookingStatus(booking._id, 'pickup_completed')}>
                                {normalizeStatus(booking.status) === 'rider_pickup_done' ? '✅ Mark Pickup Complete (Rider Done)' : 'Mark Pickup Complete'}
                              </Button>
                            </>
                          )}
                          {normalizeStatus(booking.status) === 'pickup_completed' && (
                            <Button size="sm" className="bg-sky-600 text-white" onClick={() => updateBookingStatus(booking._id, 'ready_for_delivery')}>
                              Mark Ready for Delivery
                            </Button>
                          )}
                          {normalizeStatus(booking.status) === 'ready_for_delivery' && (
                            <>
                              <Button size="sm" className="bg-amber-600 text-white" onClick={() => updateBookingStatus(booking._id, 'delivered')}>
                                Mark Delivered
                              </Button>
                            </>
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

      {viewMode === 'offline' && (
        <div className="grid grid-cols-1 gap-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Offline Orders Management</h3>
                <p className="text-sm text-gray-500">Orders created at the store desk</p>
              </div>
              <div className="text-right bg-purple-50 p-3 rounded-lg border border-purple-200">
                <div className="text-xs text-gray-600 font-medium">Total Value</div>
                <div className="text-2xl font-bold text-purple-700">₹{calculateTotalPrice(filteredOfflineOrders).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row mt-3 mb-4">
              <div className="flex-1">
                <Label htmlFor="offline-search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                  <Input
                    id="offline-search"
                    placeholder="Search by order ID, customer name, or phone..."
                    value={offlineSearchTerm}
                    onChange={(e) => setOfflineSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="md:w-56">
                <Label htmlFor="offline-status-filter">Filter by Status</Label>
                <Select value={offlineStatusFilter} onValueChange={setOfflineStatusFilter}>
                  <SelectTrigger id="offline-status-filter">
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

            <div className="mt-3 space-y-4">
              {filteredOfflineOrders.length > 0 ? (
                filteredOfflineOrders.map(booking => (
                  <Card key={booking._id} className="transition-shadow hover:shadow-md">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-purple-600" />
                            <span className="font-medium">#{booking.custom_order_id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{booking.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{booking.customer_phone}</span>
                          </div>
                          {booking.assignedVendorDetails?.name && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                              <Store className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-600">{booking.assignedVendorDetails.name}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-900">{booking.service}</div>
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

                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingBooking(booking);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setViewingBooking(booking);
                              setShowViewDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" title="View Media" className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100" onClick={() => { setMediaBooking(booking); setShowMediaDialog(true); }}>
                            📷
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No offline orders found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'all_orders' && (
        <div className="space-y-4">
          {/* Search bar */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <h3 className="text-lg font-bold mb-1">All Orders Search</h3>
              <p className="text-sm text-gray-500 mb-4">Search the entire database — any order, any status (active, completed, cancelled, offline). Type a name, phone, order ID, or address.</p>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
                <Input
                  placeholder="Search by name, phone, order ID, address..."
                  value={allOrdersSearchTerm}
                  onChange={(e) => setAllOrdersSearchTerm(e.target.value)}
                  className="pl-12 h-12 text-base border-amber-200 focus:border-amber-400"
                  autoFocus
                />
                {allOrdersLoading && (
                  <RefreshCw className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-amber-500" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {!allOrdersHasSearched && (
            <div className="text-center py-16 text-gray-400">
              <Search className="mx-auto h-12 w-12 mb-3 text-amber-300" />
              <p className="text-base">Start typing to search all orders in the database</p>
            </div>
          )}

          {allOrdersHasSearched && !allOrdersLoading && allOrdersList.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No orders found for <strong>"{allOrdersSearchTerm}"</strong></p>
            </div>
          )}

          {allOrdersList.length > 0 && (
            <div className="text-xs text-gray-500 mb-1">{allOrdersList.length} result{allOrdersList.length !== 1 ? 's' : ''} found</div>
          )}

          <div className="space-y-3">
            {allOrdersList.map((booking) => {
              const isExpanded = allOrdersExpandedId === booking._id;
              const riderObj = booking.rider
                ? riders.find(r => r._id === booking.rider || r.name === booking.rider)
                : null;
              const riderName = riderObj?.name || (typeof booking.rider === 'string' ? booking.rider : null);
              const hasMedia = booking.items_video
                || (booking.items_images?.length ?? 0) > 0
                || (booking.rider_pickup_slips?.length ?? 0) > 0
                || (booking.rider_payment_slips?.length ?? 0) > 0
                || (booking.vendor_payment_slips?.length ?? 0) > 0
                || (booking.pickup_photos?.length ?? 0) > 0
                || (booking.delivery_photos?.length ?? 0) > 0;

              return (
                <Card key={booking._id} className={clsx("overflow-hidden transition-shadow", isExpanded ? "shadow-md border-amber-200" : "hover:shadow-sm")}>
                  {/* Summary row */}
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-start">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="font-bold text-sm">#{booking.custom_order_id}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-medium">{booking.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                          <a href={`tel:${booking.phone}`} className="text-sm text-blue-600 hover:underline">{booking.phone}</a>
                        </div>
                        <Badge className={clsx("inline-flex items-center gap-1 shrink-0", getStatusColor(booking.status))}>
                          {getStatusIcon(booking.status)}
                          <span>{getStatusLabel(booking.status)}</span>
                        </Badge>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                          <DollarSign className="h-4 w-4" />
                          ₹{booking.final_amount ?? booking.total_price}
                        </div>
                        <div className="text-xs text-gray-400 self-center">
                          {booking.created_at ? formatDate(booking.created_at) : ''}
                        </div>
                        {booking.pickupRider && typeof booking.pickupRider === "object" && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium self-center">
                            🧺 {(booking.pickupRider as any).name}
                          </span>
                        )}
                        {booking.deliveryRider && typeof booking.deliveryRider === "object" && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium self-center">
                            🚚 {(booking.deliveryRider as any).name}
                          </span>
                        )}
                        {booking.pickup_pieces != null && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold self-center">
                            🧺 {booking.pickup_pieces} pcs
                          </span>
                        )}
                        {booking.cod_collected && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold self-center border border-green-300">
                            💵 Cash Received ₹{booking.cod_amount ?? booking.final_amount ?? ''}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 shrink-0 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className={clsx("border transition-colors", isExpanded ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100")}
                          onClick={() => setAllOrdersExpandedId(isExpanded ? null : booking._id)}
                        >
                          {isExpanded ? "▲ Hide" : "▼ Full Details"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingBooking(normalizeBookingForEdit(booking)); setShowEditDialog(true); }}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                          onClick={() => { sendWhatsAppMessage(booking.phone, generateWhatsAppMessage(booking)); }}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>

                  {/* Expanded full detail */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 px-4 py-5 space-y-5">

                      {/* Order Info Grid */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        <div className="bg-white rounded-lg border p-3">
                          <p className="text-xs text-gray-500 mb-1">Order ID</p>
                          <p className="font-semibold text-sm">#{booking.custom_order_id}</p>
                        </div>
                        <div className="bg-white rounded-lg border p-3">
                          <p className="text-xs text-gray-500 mb-1">Status</p>
                          <Badge className={clsx("inline-flex items-center gap-1 text-xs", getStatusColor(booking.status))}>
                            {getStatusIcon(booking.status)}
                            {getStatusLabel(booking.status)}
                          </Badge>
                        </div>
                        <div className="bg-white rounded-lg border p-3">
                          <p className="text-xs text-gray-500 mb-1">Customer</p>
                          <p className="font-medium text-sm">{booking.name}</p>
                        </div>
                        <div className="bg-white rounded-lg border p-3">
                          <p className="text-xs text-gray-500 mb-1">Phone</p>
                          <a href={`tel:${booking.phone}`} className="text-sm text-blue-600 hover:underline font-medium">{booking.phone}</a>
                        </div>
                        <div className="bg-white rounded-lg border p-3 col-span-2">
                          <p className="text-xs text-gray-500 mb-1">Address</p>
                          <p className="text-sm">{booking.address || '—'}</p>
                        </div>
                        <div className="bg-white rounded-lg border p-3">
                          <p className="text-xs text-gray-500 mb-1">Pickup Date</p>
                          <p className="text-sm">{formatScheduledDateTime(booking)}</p>
                        </div>
                        {booking.delivery_date && (
                          <div className="bg-white rounded-lg border p-3">
                            <p className="text-xs text-gray-500 mb-1">Delivery Date</p>
                            <p className="text-sm">{formatScheduledDateTime({...booking, scheduled_date: booking.delivery_date, scheduled_time: booking.delivery_time || '00:00'} as Booking)}</p>
                          </div>
                        )}
                        <div className="bg-white rounded-lg border p-3">
                          <p className="text-xs text-gray-500 mb-1">Service</p>
                          <p className="text-sm font-medium">{booking.service || '—'}</p>
                        </div>
                        {booking.payment_status && (
                          <div className="bg-white rounded-lg border p-3">
                            <p className="text-xs text-gray-500 mb-1">Payment</p>
                            <p className="text-sm font-medium capitalize">{booking.payment_status}</p>
                          </div>
                        )}
                        {booking.created_at && (
                          <div className="bg-white rounded-lg border p-3">
                            <p className="text-xs text-gray-500 mb-1">Created</p>
                            <p className="text-sm">{formatDate(booking.created_at)}</p>
                          </div>
                        )}
                        {booking.completed_at && (
                          <div className="bg-white rounded-lg border p-3">
                            <p className="text-xs text-gray-500 mb-1">Completed</p>
                            <p className="text-sm">{formatDate(booking.completed_at)}</p>
                          </div>
                        )}
                        {booking.pickup_pieces != null && (
                          <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-3">
                            <p className="text-xs text-indigo-500 mb-1">Pieces (Rider)</p>
                            <p className="text-sm font-bold text-indigo-700">🧺 {booking.pickup_pieces} pcs</p>
                          </div>
                        )}
                      </div>

                      {/* Pricing */}
                      <div className="bg-white rounded-lg border p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Pricing</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between"><span className="text-gray-600">Total Price</span><span className="font-medium">₹{booking.total_price ?? '—'}</span></div>
                          {(booking.discount_amount ?? 0) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{booking.discount_amount}</span></div>}
                          {(booking.discount_percent ?? 0) > 0 && <div className="flex justify-between text-blue-600"><span>Discount %</span><span>{booking.discount_percent}%</span></div>}
                          {(booking.cashback ?? 0) > 0 && <div className="flex justify-between text-purple-600"><span>Cashback Used</span><span>-₹{booking.cashback}</span></div>}
                          {(booking.wallet_applied ?? 0) > 0 && <div className="flex justify-between text-purple-600"><span>Wallet Applied</span><span>-₹{booking.wallet_applied}</span></div>}
                          {booking.coupon_code && <div className="flex justify-between text-blue-600"><span>Coupon</span><span>{booking.coupon_code}</span></div>}
                          <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Final Amount</span><span className="text-green-700">₹{booking.final_amount ?? '—'}</span></div>
                          {(booking.wallet_cashback ?? 0) > 0 && <div className="flex justify-between text-purple-600 text-xs"><span>Cashback to Wallet</span><span>{booking.wallet_cashback}% = ₹{((booking.final_amount || 0) * (booking.wallet_cashback || 0) / 100).toFixed(2)}</span></div>}
                          {booking.cod_collected && (
                            <div className="flex justify-between mt-2 pt-2 border-t border-green-200 text-green-700 font-semibold">
                              <span>💵 Cash Received</span>
                              <span>₹{booking.cod_amount ?? booking.final_amount ?? '—'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Item breakdown */}
                      {(booking.item_prices?.length ?? 0) > 0 && (
                        <div className="bg-white rounded-lg border p-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Items</p>
                          <div className="space-y-1">
                            {booking.item_prices!.map((item, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-700">{item.service_name || item.name} × {item.quantity}</span>
                                <span className="font-medium">₹{item.total_price ?? item.price}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vendor & Riders */}
                      {(() => {
                        const prObj = booking.pickupRider && typeof booking.pickupRider === "object" ? booking.pickupRider as { _id: string; name: string; phone: string } : null;
                        const drObj = booking.deliveryRider && typeof booking.deliveryRider === "object" ? booking.deliveryRider as { _id: string; name: string; phone: string } : null;
                        const hasAny = booking.assignedVendor || riderName || prObj || drObj;
                        if (!hasAny) return null;
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {booking.assignedVendor && (
                              <div className="bg-white rounded-lg border p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Assigned Vendor</p>
                                <div className="flex items-center gap-2">
                                  <Store className="h-4 w-4 text-green-600" />
                                  <span className="font-medium text-sm">{booking.assignedVendor}</span>
                                </div>
                              </div>
                            )}
                            {prObj && (
                              <div className="bg-indigo-50 rounded-lg border border-indigo-100 p-4">
                                <p className="text-xs font-semibold text-indigo-500 uppercase mb-2">🧺 Pickup Rider</p>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-indigo-700">{prObj.name}</span>
                                </div>
                                {prObj.phone && <a href={`tel:${prObj.phone}`} className="text-xs text-blue-600 hover:underline">{prObj.phone}</a>}
                              </div>
                            )}
                            {drObj && (
                              <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-4">
                                <p className="text-xs font-semibold text-emerald-500 uppercase mb-2">🚚 Delivery Rider</p>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-emerald-700">{drObj.name}</span>
                                </div>
                                {drObj.phone && <a href={`tel:${drObj.phone}`} className="text-xs text-blue-600 hover:underline">{drObj.phone}</a>}
                              </div>
                            )}
                            {!prObj && !drObj && riderName && (
                              <div className="bg-white rounded-lg border p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Assigned Rider</p>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-base">🛵</span>
                                  <span className="font-medium text-sm text-indigo-700">{riderName}</span>
                                </div>
                                {riderObj?.phone && <a href={`tel:${riderObj.phone}`} className="text-xs text-blue-600 hover:underline">{riderObj.phone}</a>}
                                {riderObj?.live_location_link && (
                                  <a href={riderObj.live_location_link} target="_blank" rel="noreferrer" className="block text-xs text-green-600 hover:underline mt-1">📍 Live Location</a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Special instructions */}
                      {(booking.special_instructions || booking.additional_details) && (
                        <div className="bg-white rounded-lg border p-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes / Instructions</p>
                          <p className="text-sm text-gray-700">{booking.special_instructions || booking.additional_details}</p>
                        </div>
                      )}

                      {/* All Media */}
                      <div className="bg-white rounded-lg border p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">All Media & Slips</p>
                        {!hasMedia ? (
                          <p className="text-sm text-gray-400">No media uploaded for this order.</p>
                        ) : (
                          <div className="space-y-4">
                            {booking.items_video && (
                              <div>
                                <p className="text-xs font-semibold text-purple-700 mb-2">🎥 Items Video (Desk)</p>
                                <video
                                  src={mediaUrl(booking.items_video.file_id, `/api/vendor/orders/public/orders/${booking._id}/items-video/${booking.items_video.file_id}`)}
                                  controls
                                  className="w-full max-h-56 rounded-lg border border-purple-200"
                                  preload="metadata"
                                />
                              </div>
                            )}
                            {(booking.items_images?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-2">📷 Item Photos (Desk) — {booking.items_images!.length} photo{booking.items_images!.length !== 1 ? 's' : ''}</p>
                                <div className="flex gap-2 flex-wrap">
                                  {booking.items_images!.map(img => (
                                    <a key={img.file_id} href={mediaUrl(img.file_id, `/api/vendor/orders/public/orders/${booking._id}/items-image/${img.file_id}`)} target="_blank" rel="noreferrer">
                                      <img src={mediaUrl(img.file_id, `/api/vendor/orders/public/orders/${booking._id}/items-image/${img.file_id}`)} alt="item" loading="lazy" className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 hover:opacity-80 cursor-pointer" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(booking.rider_pickup_slips?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-indigo-600 mb-2">🧾 Rider Pickup Slip — {booking.rider_pickup_slips!.length} slip{booking.rider_pickup_slips!.length !== 1 ? 's' : ''}</p>
                                <div className="flex gap-2 flex-wrap">
                                  {booking.rider_pickup_slips!.map(slip => (
                                    <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/riders/public/orders/${booking._id}/slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                                      <img src={mediaUrl(slip.file_id, `/api/riders/public/orders/${booking._id}/slip/${slip.file_id}`)} alt="pickup slip" loading="lazy" className="w-24 h-24 object-cover rounded-lg border-2 border-indigo-200 hover:opacity-80 cursor-pointer" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(booking.rider_payment_slips?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-green-600 mb-2">💳 Rider Payment Screenshot — {booking.rider_payment_slips!.length} screenshot{booking.rider_payment_slips!.length !== 1 ? 's' : ''}</p>
                                <div className="flex gap-2 flex-wrap">
                                  {booking.rider_payment_slips!.map(slip => (
                                    <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/riders/public/orders/${booking._id}/slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                                      <img src={mediaUrl(slip.file_id, `/api/riders/public/orders/${booking._id}/slip/${slip.file_id}`)} alt="payment ss" loading="lazy" className="w-24 h-24 object-cover rounded-lg border-2 border-green-200 hover:opacity-80 cursor-pointer" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(booking.vendor_payment_slips?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-orange-600 mb-2">🧾 Vendor Payment Slips — {booking.vendor_payment_slips!.length} slip{booking.vendor_payment_slips!.length !== 1 ? 's' : ''}</p>
                                <div className="flex gap-2 flex-wrap">
                                  {booking.vendor_payment_slips!.map(slip => (
                                    <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/vendor/orders/public/orders/${booking._id}/payment-slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                                      <img src={mediaUrl(slip.file_id, `/api/vendor/orders/public/orders/${booking._id}/payment-slip/${slip.file_id}`)} alt="vendor slip" loading="lazy" className="w-24 h-24 object-cover rounded-lg border-2 border-orange-200 hover:opacity-80 cursor-pointer" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(booking.pickup_photos?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-purple-600 mb-2">🧺 Pickup Photos (Rider) — {booking.pickup_photos!.length} photo{booking.pickup_photos!.length !== 1 ? 's' : ''}</p>
                                <div className="flex gap-2 flex-wrap">
                                  {booking.pickup_photos!.map((p, i) => (
                                    <a key={p + i} href={p} target="_blank" rel="noreferrer">
                                      <img src={p} alt="pickup" loading="lazy" className="w-24 h-24 object-cover rounded-lg border-2 border-purple-200 hover:opacity-80 cursor-pointer" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(booking.delivery_photos?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-teal-600 mb-2">🚚 Delivery Photos (Rider) — {booking.delivery_photos!.length} photo{booking.delivery_photos!.length !== 1 ? 's' : ''}</p>
                                <div className="flex gap-2 flex-wrap">
                                  {booking.delivery_photos!.map((p, i) => (
                                    <a key={p + i} href={p} target="_blank" rel="noreferrer">
                                      <img src={p} alt="delivery" loading="lazy" className="w-24 h-24 object-cover rounded-lg border-2 border-teal-200 hover:opacity-80 cursor-pointer" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

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
                  filteredCompletedOrders.map((booking) => {
                    const isMediaExpanded = expandedMediaOrderId === booking._id;
                    const hasMedia = booking.items_video || (booking.items_images?.length ?? 0) > 0
                      || (booking.rider_pickup_slips?.length ?? 0) > 0 || (booking.rider_payment_slips?.length ?? 0) > 0
                      || (booking.vendor_payment_slips?.length ?? 0) > 0 || (booking.pickup_photos?.length ?? 0) > 0
                      || (booking.delivery_photos?.length ?? 0) > 0;
                    return (
                    <div key={booking._id} className="rounded-md border hover:border-gray-300 overflow-hidden">
                      <div className="flex items-center justify-between p-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium">#{booking.custom_order_id}</span>
                          <span className="text-sm text-gray-600">{booking.name}</span>
                          {booking.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-red-500" />
                              <span className="text-sm text-gray-700 truncate max-w-xs" title={booking.address}>{booking.address}</span>
                            </div>
                          )}
                          <Badge className={clsx("inline-flex items-center gap-1", getStatusColor(booking.status))}>
                            {getStatusLabel(booking.status)}
                          </Badge>
                          {booking.pickupRider && typeof booking.pickupRider === "object" && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                              🧺 {(booking.pickupRider as any).name}
                            </span>
                          )}
                          {booking.deliveryRider && typeof booking.deliveryRider === "object" && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                              🚚 {(booking.deliveryRider as any).name}
                            </span>
                          )}
                          {booking.pickup_pieces != null && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                              🧺 {booking.pickup_pieces} pcs
                            </span>
                          )}
                          {booking.cod_collected && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold border border-green-300">
                              💵 Cash ₹{booking.cod_amount ?? booking.final_amount ?? ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-medium">₹{booking.final_amount ?? booking.total_price}</div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                            onClick={() => { const message = generateWhatsAppMessage(booking); sendWhatsAppMessage(booking.phone, message); }}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setViewingBooking(booking); setShowViewDialog(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title={isMediaExpanded ? "Hide Media" : "Show Media"}
                            className={clsx(
                              "border transition-colors",
                              isMediaExpanded
                                ? "bg-purple-100 text-purple-800 border-purple-400"
                                : "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                            )}
                            onClick={() => setExpandedMediaOrderId(isMediaExpanded ? null : booking._id)}
                          >
                            📷 {isMediaExpanded ? "Hide" : "Media"}
                          </Button>
                        </div>
                      </div>

                      {isMediaExpanded && (
                        <div className="border-t bg-gray-50 p-4">
                          {!hasMedia ? (
                            <p className="text-sm text-gray-400 text-center py-2">No media uploaded for this order.</p>
                          ) : (
                            <div className="space-y-4">
                              {booking.items_video && (
                                <div>
                                  <p className="text-xs font-semibold text-purple-700 mb-2">🎥 Items Video (Desk)</p>
                                  <video
                                    src={mediaUrl(booking.items_video.file_id, `/api/vendor/orders/public/orders/${booking._id}/items-video/${booking.items_video.file_id}`)}
                                    controls
                                    className="w-full max-h-48 rounded-lg border border-purple-200"
                                    preload="metadata"
                                  />
                                </div>
                              )}
                              {(booking.items_images?.length ?? 0) > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 mb-2">📷 Item Photos (Desk)</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {booking.items_images!.map(img => (
                                      <a key={img.file_id} href={mediaUrl(img.file_id, `/api/vendor/orders/public/orders/${booking._id}/items-image/${img.file_id}`)} target="_blank" rel="noreferrer">
                                        <img src={mediaUrl(img.file_id, `/api/vendor/orders/public/orders/${booking._id}/items-image/${img.file_id}`)} alt="item" loading="lazy" className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200 hover:opacity-80 cursor-pointer" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(booking.rider_pickup_slips?.length ?? 0) > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-indigo-600 mb-2">🧾 Rider Pickup Slip</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {booking.rider_pickup_slips!.map(slip => (
                                      <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/riders/public/orders/${booking._id}/slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                                        <img src={mediaUrl(slip.file_id, `/api/riders/public/orders/${booking._id}/slip/${slip.file_id}`)} alt="pickup slip" loading="lazy" className="w-20 h-20 object-cover rounded-lg border-2 border-indigo-200 hover:opacity-80 cursor-pointer" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(booking.rider_payment_slips?.length ?? 0) > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-green-600 mb-2">💳 Rider Payment Screenshot</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {booking.rider_payment_slips!.map(slip => (
                                      <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/riders/public/orders/${booking._id}/slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                                        <img src={mediaUrl(slip.file_id, `/api/riders/public/orders/${booking._id}/slip/${slip.file_id}`)} alt="payment ss" loading="lazy" className="w-20 h-20 object-cover rounded-lg border-2 border-green-200 hover:opacity-80 cursor-pointer" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(booking.vendor_payment_slips?.length ?? 0) > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-orange-600 mb-2">🧾 Vendor Payment Slips</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {booking.vendor_payment_slips!.map(slip => (
                                      <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/vendor/orders/public/orders/${booking._id}/payment-slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                                        <img src={mediaUrl(slip.file_id, `/api/vendor/orders/public/orders/${booking._id}/payment-slip/${slip.file_id}`)} alt="vendor slip" loading="lazy" className="w-20 h-20 object-cover rounded-lg border-2 border-orange-200 hover:opacity-80 cursor-pointer" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(booking.pickup_photos?.length ?? 0) > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-purple-600 mb-2">🧺 Pickup Photos (Rider)</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {booking.pickup_photos!.map((p, i) => (
                                      <a key={p + i} href={p} target="_blank" rel="noreferrer">
                                        <img src={p} alt="pickup" loading="lazy" className="w-20 h-20 object-cover rounded-lg border-2 border-purple-200 hover:opacity-80 cursor-pointer" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(booking.delivery_photos?.length ?? 0) > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-teal-600 mb-2">🚚 Delivery Photos (Rider)</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {booking.delivery_photos!.map((p, i) => (
                                      <a key={p + i} href={p} target="_blank" rel="noreferrer">
                                        <img src={p} alt="delivery" loading="lazy" className="w-20 h-20 object-cover rounded-lg border-2 border-teal-200 hover:opacity-80 cursor-pointer" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    {completedOrders.length === 0 ? "No completed orders" : "No orders match your search"}
                  </div>
                )}
              </div>
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
                    <span className="font-medium">₹{viewingBooking.total_price}</span>
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
                  {viewingBooking.wallet_cashback && viewingBooking.wallet_cashback > 0 && (
                    <div className="flex justify-between border-t pt-2 text-purple-600">
                      <span>Wallet Cashback:</span>
                      <span className="font-medium">{viewingBooking.wallet_cashback}% = ₹{((viewingBooking.final_amount || 0) * viewingBooking.wallet_cashback / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {(viewingBooking.wallet_applied || 0) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Wallet Applied:</span>
                      <span>-₹{viewingBooking.wallet_applied}</span>
                    </div>
                  )}
                  {viewingBooking.cod_collected && (
                    <div className="flex justify-between border-t pt-2 text-green-700 font-bold">
                      <span>💵 Cash Received:</span>
                      <span>₹{viewingBooking.cod_amount ?? viewingBooking.final_amount}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rider Slips & Payment Screenshots */}
              {((viewingBooking.rider_pickup_slips?.length ?? 0) > 0 || (viewingBooking.rider_payment_slips?.length ?? 0) > 0) && (
                <div className="border-t pt-4">
                  <h4 className="mb-3 font-semibold text-gray-800">📸 Rider Uploads</h4>
                  {(viewingBooking.rider_pickup_slips?.length ?? 0) > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-indigo-600 mb-2">🧾 Pickup Slip</p>
                      <div className="flex gap-2 flex-wrap">
                        {viewingBooking.rider_pickup_slips!.map((slip) => (
                          <a
                            key={slip.file_id}
                            href={mediaUrl(slip.file_id, `/api/riders/public/orders/${viewingBooking._id}/slip/${slip.file_id}`)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={mediaUrl(slip.file_id, `/api/riders/public/orders/${viewingBooking._id}/slip/${slip.file_id}`)}
                              alt="pickup slip"
                              className="w-24 h-24 object-cover rounded-lg border-2 border-indigo-200 hover:opacity-80 cursor-pointer"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {(viewingBooking.rider_payment_slips?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-600 mb-2">💳 Payment Screenshot</p>
                      <div className="flex gap-2 flex-wrap">
                        {viewingBooking.rider_payment_slips!.map((slip) => (
                          <a
                            key={slip.file_id}
                            href={mediaUrl(slip.file_id, `/api/riders/public/orders/${viewingBooking._id}/slip/${slip.file_id}`)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={mediaUrl(slip.file_id, `/api/riders/public/orders/${viewingBooking._id}/slip/${slip.file_id}`)}
                              alt="payment screenshot"
                              className="w-24 h-24 object-cover rounded-lg border-2 border-green-200 hover:opacity-80 cursor-pointer"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Media Dialog ── */}
      <Dialog open={showMediaDialog} onOpenChange={setShowMediaDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📷 Media — #{mediaBooking?.custom_order_id || mediaBooking?._id?.slice(-6).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {mediaBooking && (() => {
            const b = mediaBooking;
            const hasAny = (b.items_video) || (b.items_images?.length ?? 0) > 0 || (b.rider_pickup_slips?.length ?? 0) > 0 || (b.rider_payment_slips?.length ?? 0) > 0 || (b.vendor_payment_slips?.length ?? 0) > 0 || (b.pickup_photos?.length ?? 0) > 0 || (b.delivery_photos?.length ?? 0) > 0;
            if (!hasAny) return <p className="text-center text-gray-400 py-8">No media uploaded for this order yet.</p>;
            return (
              <div className="space-y-5 py-2">
                {b.items_video && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-2">🎥 Items Video (Desk)</p>
                    <video
                      src={mediaUrl(b.items_video.file_id, `/api/vendor/orders/public/orders/${b._id}/items-video/${b.items_video.file_id}`)}
                      controls
                      className="w-full max-h-56 rounded-lg border border-purple-200"
                      preload="metadata"
                    />
                  </div>
                )}
                {(b.items_images?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">📷 Item Photos (Desk)</p>
                    <div className="flex gap-2 flex-wrap">
                      {b.items_images!.map(img => (
                        <a key={img.file_id} href={mediaUrl(img.file_id, `/api/vendor/orders/public/orders/${b._id}/items-image/${img.file_id}`)} target="_blank" rel="noreferrer">
                          <img src={mediaUrl(img.file_id, `/api/vendor/orders/public/orders/${b._id}/items-image/${img.file_id}`)} alt="item" className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 hover:opacity-80 cursor-pointer" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(b.rider_pickup_slips?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-indigo-600 mb-2">🧾 Rider Pickup Slip</p>
                    <div className="flex gap-2 flex-wrap">
                      {b.rider_pickup_slips!.map(slip => (
                        <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/riders/public/orders/${b._id}/slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                          <img src={mediaUrl(slip.file_id, `/api/riders/public/orders/${b._id}/slip/${slip.file_id}`)} alt="pickup slip" className="w-24 h-24 object-cover rounded-lg border-2 border-indigo-200 hover:opacity-80 cursor-pointer" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(b.rider_payment_slips?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-2">💳 Rider Payment Screenshot</p>
                    <div className="flex gap-2 flex-wrap">
                      {b.rider_payment_slips!.map(slip => (
                        <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/riders/public/orders/${b._id}/slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                          <img src={mediaUrl(slip.file_id, `/api/riders/public/orders/${b._id}/slip/${slip.file_id}`)} alt="payment ss" className="w-24 h-24 object-cover rounded-lg border-2 border-green-200 hover:opacity-80 cursor-pointer" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(b.vendor_payment_slips?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-2">🧾 Vendor Payment Slips</p>
                    <div className="flex gap-2 flex-wrap">
                      {b.vendor_payment_slips!.map(slip => (
                        <a key={slip.file_id} href={mediaUrl(slip.file_id, `/api/vendor/orders/public/orders/${b._id}/payment-slip/${slip.file_id}`)} target="_blank" rel="noreferrer">
                          <img src={mediaUrl(slip.file_id, `/api/vendor/orders/public/orders/${b._id}/payment-slip/${slip.file_id}`)} alt="vendor slip" className="w-24 h-24 object-cover rounded-lg border-2 border-orange-200 hover:opacity-80 cursor-pointer" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(b.pickup_photos?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-600 mb-2">🧺 Pickup Photos (Rider)</p>
                    <div className="flex gap-2 flex-wrap">
                      {b.pickup_photos!.map((p, i) => (
                        <a key={p + i} href={p} target="_blank" rel="noreferrer">
                          <img src={p} alt="pickup" loading="lazy" className="w-24 h-24 object-cover rounded-lg border-2 border-purple-200 hover:opacity-80 cursor-pointer" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(b.delivery_photos?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-teal-600 mb-2">🚚 Delivery Photos (Rider)</p>
                    <div className="flex gap-2 flex-wrap">
                      {b.delivery_photos!.map((p, i) => (
                        <a key={p + i} href={p} target="_blank" rel="noreferrer">
                          <img src={p} alt="delivery" loading="lazy" className="w-24 h-24 object-cover rounded-lg border-2 border-teal-200 hover:opacity-80 cursor-pointer" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          {editingBooking && (
            <div className="space-y-4">
              {editingBooking.pickup_pieces != null && (
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
                  <span className="text-indigo-600 font-semibold text-sm">🧺 Rider Pickup Count:</span>
                  <span className="text-indigo-800 font-bold text-lg">{editingBooking.pickup_pieces} pcs</span>
                </div>
              )}
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
                  <p className="text-xs text-gray-500 mt-1">Applied after cashback</p>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Assign Vendor</Label>
                  <Select
                    value={editingBooking.vendor ?? "__unassigned__"}
                    onValueChange={(value) => {
                      setEditingBooking((prev) =>
                        prev
                          ? {
                              ...prev,
                              vendor: value === "__unassigned__" ? null : value,
                            }
                          : prev,
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {vendors.length > 0 ? (
                        vendors
                          .map((vendor) => {
                            let distance = Infinity;
                            const vendorData = vendorFullData[vendor.name];

                            // Only calculate distance if both booking and vendor have coordinates
                            if (bookingAddressCoords && bookingAddressCoords.lat && bookingAddressCoords.lng &&
                                vendorData && vendorData.coordinates && vendorData.coordinates.lat && vendorData.coordinates.lng) {
                              try {
                                const vendorCoords = vendorData.coordinates;
                                const R = 6371;
                                const dLat = (vendorCoords.lat - bookingAddressCoords.lat) * (Math.PI / 180);
                                const dLng = (vendorCoords.lng - bookingAddressCoords.lng) * (Math.PI / 180);
                                const a =
                                  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                  Math.cos(bookingAddressCoords.lat * (Math.PI / 180)) * Math.cos(vendorCoords.lat * (Math.PI / 180)) *
                                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                distance = R * c;
                              } catch (e) {
                                distance = Infinity;
                              }
                            }

                            return { vendor, distance };
                          })
                          .sort((a, b) => a.distance - b.distance)
                          .slice(0, 10)
                          .map(({ vendor, distance }) => {
                            const distanceLabel = distance !== Infinity ? ` • ${distance.toFixed(1)} km` : "";
                            return (
                              <SelectItem key={vendor.id} value={vendor.name}>
                                {vendor.name}{distanceLabel}
                              </SelectItem>
                            );
                          })
                      ) : (
                        <SelectItem value="no-vendors" disabled>
                          No vendors available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {editingBooking.distance_to_vendor ? (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <Label className="text-blue-900 text-sm">Distance to Vendor</Label>
                    <div className="text-lg font-bold text-blue-700 mt-2">{editingBooking.distance_to_vendor.toFixed(2)} km</div>
                  </div>
                ) : null}
              </div>

              {/* Rider assignments */}
              {(() => {
                const riderSelectOptions = (
                  <>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {riders.length > 0 ? riders.map(r => (
                      <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
                    )) : (
                      <SelectItem value="no-riders" disabled>No riders available</SelectItem>
                    )}
                  </>
                );
                const pickupRiderId = (() => {
                  const pr = editingBooking.pickupRider;
                  if (!pr) return "__unassigned__";
                  if (typeof pr === "object") return pr._id;
                  return pr;
                })();
                const deliveryRiderId = (() => {
                  const dr = editingBooking.deliveryRider;
                  if (!dr) return "__unassigned__";
                  if (typeof dr === "object") return dr._id;
                  return dr;
                })();
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>🧺 Pickup Rider</Label>
                      <Select value={pickupRiderId} onValueChange={(value) =>
                        setEditingBooking(prev => prev ? { ...prev, pickupRider: value === "__unassigned__" ? null : value } : prev)
                      }>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{riderSelectOptions}</SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">Rider who picks up the laundry</p>
                    </div>
                    <div>
                      <Label>🚚 Delivery Rider</Label>
                      <Select value={deliveryRiderId} onValueChange={(value) =>
                        setEditingBooking(prev => prev ? { ...prev, deliveryRider: value === "__unassigned__" ? null : value } : prev)
                      }>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{riderSelectOptions}</SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">Rider who delivers the laundry</p>
                    </div>
                  </div>
                );
              })()}

              <div className="border-t pt-4">
                <h4 className="mb-4 font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Details
                </h4>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-address">Customer Address</Label>
                    <Textarea
                      id="edit-address"
                      rows={3}
                      placeholder="Full delivery address"
                      value={editingBooking.address || ""}
                      onChange={(e) =>
                        setEditingBooking((prev) =>
                          prev ? { ...prev, address: e.target.value } : prev
                        )
                      }
                      className="mt-1 resize-none"
                    />
                  </div>
                  <div>
                    <Label htmlFor="google-maps-link">Google Maps Link (for reminders)</Label>
                    <Input
                      id="google-maps-link"
                      placeholder="Paste Google Maps link (e.g., https://maps.google.com/@12.9716,77.5946,17z)"
                      value={editingBooking.mapsLink || ""}
                      onChange={(e) => {
                        const mapsLink = e.target.value.trim();
                        setEditingBooking((prev) =>
                          prev
                            ? {
                                ...prev,
                                mapsLink: mapsLink || undefined,
                              }
                            : prev,
                        );
                      }}
                      onBlur={async (e) => {
                        const mapsLink = e.target.value.trim();
                        if (mapsLink && isGoogleMapsUrl(mapsLink)) {
                          const parsed = await resolveAndParseGoogleMapsLink(mapsLink);
                          if (parsed.coordinates && !parsed.error) {
                            setEditingBooking((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    coordinates: parsed.coordinates,
                                    mapsLink: mapsLink,
                                  }
                                : prev,
                            );
                            toast.success(`✅ Maps link saved & location extracted: ${parsed.coordinates.lat.toFixed(4)}, ${parsed.coordinates.lng.toFixed(4)}`);
                          } else if (parsed.error) {
                            toast.error(parsed.error);
                          }
                        } else if (mapsLink && mapsLink.length > 0) {
                          toast.error("Please enter a valid Google Maps link (starts with https://maps.google.com)");
                        }
                      }}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Paste a Google Maps link. This will be included in pickup & delivery reminders sent to vendors.
                    </p>
                  </div>

                  {editingBooking.coordinates && editingBooking.coordinates.lat && editingBooking.coordinates.lng && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Label className="text-green-900 text-sm font-semibold">Current Location</Label>
                          <p className="text-sm text-green-700 mt-2">
                            <span className="font-mono">{editingBooking.coordinates.lat.toFixed(4)}, {editingBooking.coordinates.lng.toFixed(4)}</span>
                          </p>
                          <a
                            href={`https://maps.google.com/@${editingBooking.coordinates.lat},${editingBooking.coordinates.lng},17z`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:text-green-700 underline mt-1 inline-block"
                          >
                            Open in Google Maps →
                          </a>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingBooking((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    coordinates: undefined,
                                  }
                                : prev,
                            );
                            toast.info("Location cleared");
                          }}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}

                  {editingBooking.mapsLink && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Label className="text-blue-900 text-sm font-semibold">📍 Maps Link for Reminders</Label>
                          <p className="text-sm text-blue-700 mt-2 break-all">
                            <span className="font-mono text-xs">{editingBooking.mapsLink}</span>
                          </p>
                          <p className="text-xs text-blue-600 mt-2">
                            ✓ This link will be included in pickup & delivery reminder messages
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingBooking((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    mapsLink: undefined,
                                  }
                                : prev,
                            );
                            toast.info("Maps link removed");
                          }}
                          className="text-blue-600 border-blue-300 hover:bg-blue-100"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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
                                        <SelectValue placeholder="Select item">
                                          {item.service_name || item.name ? (
                                            <>
                                              {item.service_name || item.name} — ₹{item.unit_price || item.price || 0}
                                            </>
                                          ) : (
                                            "Select item"
                                          )}
                                        </SelectValue>
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
                    <Button size="sm" type="button" onClick={addItemToEditing} variant="outline">Add Item</Button>
                    <div className="text-lg font-semibold whitespace-nowrap">
                      Subtotal: <span className="text-green-600">₹{computeEditingTotals(editingBooking).total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-4 font-semibold flex items-center gap-2">
                  💰 Wallet & Cashback
                </h4>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* User Wallet Balance */}
                    <div>
                      <div className="text-sm text-purple-900 font-semibold mb-1">
                        User's Wallet Balance
                      </div>
                      {loadingWallet ? (
                        <div className="text-lg font-bold text-purple-700">Loading...</div>
                      ) : (
                        <div className="text-2xl font-bold text-green-600">
                          ₹{userWalletBalance.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* Cashback Input */}
                    <div>
                      <label className="text-sm text-purple-900 font-semibold mb-1 block">
                        Cashback for This Order (debits wallet)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingBooking.cashback || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          if (value <= userWalletBalance) {
                            setEditingBooking((prev) =>
                              prev ? { ...prev, cashback: value } : prev
                            );
                          } else {
                            toast.error("Cashback cannot exceed wallet balance");
                          }
                        }}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-purple-300 rounded text-sm"
                      />
                      <div className="text-xs text-purple-600 mt-1">
                        Max: ₹{userWalletBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Wallet Cashback Percentage Input */}
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <label className="text-sm text-purple-900 font-semibold mb-2 block">
                      Wallet Cashback Percentage (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={editingBooking.wallet_cashback || 0}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setEditingBooking((prev) =>
                          prev ? { ...prev, wallet_cashback: Math.min(value, 100) } : prev
                        );
                      }}
                      placeholder="0.0"
                      className="w-full px-3 py-2 border border-purple-300 rounded text-sm"
                    />
                    {editingBooking.wallet_cashback && editingBooking.wallet_cashback > 0 && (
                      <div className="mt-2 p-2 bg-purple-100 rounded border border-purple-300">
                        <div className="text-sm text-purple-900 font-semibold">
                          Cashback Amount: ₹{((computeEditingTotals(editingBooking).final * editingBooking.wallet_cashback) / 100).toFixed(2)}
                        </div>
                        <div className="text-xs text-purple-600 mt-1">
                          {editingBooking.wallet_cashback}% of ₹{computeEditingTotals(editingBooking).final.toFixed(2)} = credited to wallet after order completion
                        </div>
                      </div>
                    )}
                    {(!editingBooking.wallet_cashback || editingBooking.wallet_cashback === 0) && (
                      <div className="text-xs text-purple-600 mt-1">
                        Enter a percentage (0-100) to give cashback to user's wallet after order completion
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-4 font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing Summary
                </h4>
                <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                  {/* Subtotal */}
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">₹{computeEditingTotals(editingBooking).total.toFixed(2)}</span>
                  </div>

                  {/* Cashback Box */}
                  <div className="space-y-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <label className="text-sm font-semibold text-blue-900">Cashback Amount</label>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Cashback:</span>
                      <span className="text-blue-700 font-medium">-₹{(computeEditingTotals(editingBooking).details?.cashback || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Discount Box */}
                  <div className="space-y-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <label className="text-sm font-semibold text-blue-900">Discount Amount</label>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Discount {editingBooking.discount_percent || 0}%:</span>
                      <span className="text-blue-700 font-medium">-₹{(computeEditingTotals(editingBooking).details?.discount || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* After Cashback */}
                  {(editingBooking.cashback_amount ?? 0) > 0 && (
                    <div className="flex justify-between border-t pt-2">
                      <span>After Cashback:</span>
                      <span className="font-medium">₹{(computeEditingTotals(editingBooking).details?.afterCashback || 0).toFixed(2)}</span>
                    </div>
                  )}

                  {/* After Discount */}
                  {(editingBooking.discount_percent ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span>After Discount:</span>
                      <span className="font-medium">₹{(computeEditingTotals(editingBooking).final || 0).toFixed(2)}</span>
                    </div>
                  )}

                  {/* Total / Final Amount */}
                  <div className="flex justify-between border-t pt-2 text-lg font-bold">
                    <span>Total:</span>
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
                        address: editingBooking.address || "",
                        pickupRider: (() => { const pr = editingBooking.pickupRider; if (!pr) return null; if (typeof pr === "object") return pr._id; return pr; })(),
                        deliveryRider: (() => { const dr = editingBooking.deliveryRider; if (!dr) return null; if (typeof dr === "object") return dr._id; return dr; })(),
                        scheduled_date: editingBooking.scheduled_date,
                        scheduled_time: editingBooking.scheduled_time,
                        delivery_date: editingBooking.delivery_date || "",
                        delivery_time: editingBooking.delivery_time || "",
                        vendor: editingBooking.vendor,
                        rider: editingBooking.rider || null,
                        cashback_amount: editingBooking.cashback_amount || 0,
                        cashback: editingBooking.cashback || 0,
                        wallet_cashback: editingBooking.wallet_cashback || 0,
                        discount_percent: editingBooking.discount_percent || 0,
                        discount_amount: totals.details?.discount || 0,
                      };

                      // Only include coordinates if they exist (for old orders that don't have them)
                      if (editingBooking.coordinates) {
                        payload.coordinates = editingBooking.coordinates;
                      }

                      // Include mapsLink for reminders
                      if (editingBooking.mapsLink) {
                        payload.mapsLink = editingBooking.mapsLink;
                      }

                      // Only include distance_to_vendor if it exists
                      if (editingBooking.distance_to_vendor) {
                        payload.distance_to_vendor = editingBooking.distance_to_vendor;
                      }

                      if (editingBooking.item_prices && editingBooking.item_prices.length > 0) {
                        payload.item_prices = editingBooking.item_prices
                          .filter((it) => it.service_name && it.service_name.trim() !== "")
                          .map((it) => ({
                            service_name: it.service_name || it.name,
                            quantity: it.quantity ?? 1,
                            unit_price: it.unit_price ?? it.price ?? 0,
                            total_price: it.total_price || (it.quantity ?? 1) * (it.unit_price ?? it.price ?? 0),
                          }));
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

      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        title={reminderType === 'pickup' ? 'Pickup Reminder' : 'Delivery Reminder'}
        message={reminderMessage}
        vendorGroupLink={reminderVendorGroupLink}
        reminderType={reminderType}
      />


    </div>
  );
};

export default AdminBookingManagement;
