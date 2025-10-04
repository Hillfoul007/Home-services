import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/contexts/NotificationContext";
import { quickPickupService, type QuickPickupDetails } from "@/services/quickPickupService";

import {
  createSuccessNotification,
  createErrorNotification,
  createWarningNotification,
} from "@/utils/notificationUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  MapPin,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
  RefreshCw,
  Star,
  ArrowLeft,
  Package,
  CreditCard,
  User,
  MessageCircle,
} from "lucide-react";
import { BookingService } from "@/services/bookingService";
import EditBookingModal from "./EditBookingModal";
import { filterProductionBookings } from "@/utils/bookingFilters";
import {
  getServicePriceWithFallback,
  calculateServiceTotal,
} from "@/utils/servicePricing";

interface EnhancedBookingHistoryProps {
  currentUser?: any;
  onBack?: () => void;
  onLoginRequired?: () => void;
}

const EnhancedBookingHistory: React.FC<EnhancedBookingHistoryProps> =
  React.memo(({ currentUser, onBack, onLoginRequired }) => {
    const { addNotification } = useNotifications();
  const [bookings, setBookings] = useState([]);
  const [quickPickups, setQuickPickups] = useState<QuickPickupDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("regular");

    const [cancellingBooking, setCancellingBooking] = useState<string | null>(
      null,
    );
    const [showContactDialog, setShowContactDialog] = useState(false);
    const [contactBookingId, setContactBookingId] = useState<string | null>(
      null,
    );

    // ... (keeping all the existing methods unchanged) ...
    const loadBookings = async (forceRefresh = false) => {
      if (!currentUser?.id && !currentUser?._id && !currentUser?.phone) {
        console.log("No user ID found for loading bookings");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        if (forceRefresh) {
          console.log("🔄 Force refreshing bookings from backend...");
        }

        // Import MongoDB helpers
        const { bookingHelpers } = await import(
          "../integrations/mongodb/bookingHelpers"
        );
        const bookingService = BookingService.getInstance();

        console.log(
          "Loading bookings from MongoDB for user:",
          currentUser._id || currentUser.id,
        );

        // Try MongoDB first (but it will gracefully fallback if no backend)
        let mongoBookings = [];
        const userId = currentUser._id || currentUser.id || currentUser.phone;

        if (userId) {
          const mongoResponse = await bookingHelpers.getUserBookings(userId);
          if (
            mongoResponse.data &&
            Array.isArray(mongoResponse.data) &&
            mongoResponse.data.length > 0
          ) {
            mongoBookings = filterProductionBookings(mongoResponse.data).map(
              (booking: any) => ({
                id: booking._id,
                custom_order_id: booking.custom_order_id, // Add custom order ID
                order_id: booking.custom_order_id, // Also map to order_id for compatibility
                userId: booking.customer_id,
                services: booking.services || [booking.service],
                totalAmount: booking.final_amount || booking.total_price,
                item_prices: booking.item_prices, // Include item prices from database
                status: booking.status,
                pickupDate: booking.scheduled_date,
                deliveryDate: booking.delivery_date || booking.scheduled_date,
                pickupTime: booking.scheduled_time,
                deliveryTime: booking.delivery_time || "TBD",
                address: booking.address,
                contactDetails: {
                  phone: currentUser.phone,
                  name: currentUser.full_name || currentUser.name,
                  instructions:
                    booking.additional_details || booking.special_instructions,
                },
                paymentStatus: booking.payment_status,
                createdAt: booking.created_at || booking.createdAt,
                updatedAt: booking.updated_at || booking.updatedAt,
              }),
            );

            // Load real quick pickup orders
            console.log("Loading quick pickup orders...");
            let quickPickupOrders = [];
            try {
              const quickPickupResult = await quickPickupService.getCurrentUserQuickPickups();
              if (quickPickupResult.success && quickPickupResult.quickPickups) {
                quickPickupOrders = quickPickupResult.quickPickups.map((qp: any) => ({
                  id: qp.id,
                  custom_order_id: qp.custom_order_id || `QP${qp.id.slice(-6).toUpperCase()}`,
                  order_id: qp.custom_order_id || `QP${qp.id.slice(-6).toUpperCase()}`,
                  userId: qp.userId,
                  services: qp.items_collected?.map((item: any) => `${item.name} x${item.quantity}`) || ["Quick Pickup - Items TBD"],
                  totalAmount: qp.actual_cost || qp.estimated_cost || 0,
                  item_prices: qp.items_collected || [],
                  status: qp.status,
                  pickupDate: qp.pickup_date,
                  deliveryDate: qp.delivery_date || "TBD",
                  pickupTime: qp.pickup_time,
                  deliveryTime: qp.delivery_time || "TBD",
                  address: qp.address,
                  contactDetails: {
                    phone: qp.customer_phone,
                    name: qp.customer_name,
                    instructions: qp.special_instructions || 'Quick pickup service',
                  },
                  paymentStatus: 'pending',
                  createdAt: qp.createdAt,
                  updatedAt: qp.updatedAt,
                  isQuickPickup: true,
                  quickPickupNote: '🚚 Quick pickup order'
                }));
                console.log("✅ Loaded real quick pickup orders:", quickPickupOrders.length);
              }
            } catch (error) {
              console.warn("⚠️ Failed to load quick pickup orders:", error);
            }

            // Combine regular bookings with real quick pickup orders
            const bookingsWithQuickPickup = [...quickPickupOrders, ...mongoBookings];

            console.log(
              "✅ Loaded bookings from MongoDB (filtered + quick pickup demo):",
              bookingsWithQuickPickup.length,
            );
            setBookings(bookingsWithQuickPickup);
            return;
          }
        }

        // Fallback to BookingService
        console.log("Loading bookings from BookingService...");
        const response = await bookingService.getCurrentUserBookings();

        if (response.success && response.bookings) {
          // Filter out demo bookings for production
          const productionBookings = filterProductionBookings(
            response.bookings,
          );

          // Load real quick pickup orders for fallback
          console.log("Loading quick pickup orders for fallback...");
          let quickPickupOrders = [];
          try {
            const quickPickupResult = await quickPickupService.getCurrentUserQuickPickups();
            if (quickPickupResult.success && quickPickupResult.quickPickups) {
              quickPickupOrders = quickPickupResult.quickPickups.map((qp: any) => ({
                id: qp.id,
                custom_order_id: qp.custom_order_id || `QP${qp.id.slice(-6).toUpperCase()}`,
                order_id: qp.custom_order_id || `QP${qp.id.slice(-6).toUpperCase()}`,
                userId: qp.userId,
                services: qp.items_collected?.map((item: any) => `${item.name} x${item.quantity}`) || ["Quick Pickup - Items TBD"],
                totalAmount: qp.actual_cost || qp.estimated_cost || 0,
                item_prices: qp.items_collected || [],
                status: qp.status,
                pickupDate: qp.pickup_date,
                deliveryDate: qp.delivery_date || "TBD",
                pickupTime: qp.pickup_time,
                deliveryTime: qp.delivery_time || "TBD",
                address: qp.address,
                contactDetails: {
                  phone: qp.customer_phone,
                  name: qp.customer_name,
                  instructions: qp.special_instructions || 'Quick pickup service',
                },
                paymentStatus: 'pending',
                createdAt: qp.createdAt,
                updatedAt: qp.updatedAt,
                isQuickPickup: true,
                quickPickupNote: '🚚 Quick pickup order'
              }));
              console.log("✅ Loaded real quick pickup orders for fallback:", quickPickupOrders.length);
            }
          } catch (error) {
            console.warn("⚠️ Failed to load quick pickup orders for fallback:", error);
          }

          // Combine regular bookings with real quick pickup orders
          const bookingsWithQuickPickup = [...quickPickupOrders, ...productionBookings];

          console.log(
            "✅ Bookings loaded from BookingService (filtered + real quick pickups):",
            bookingsWithQuickPickup.length,
          );
          setBookings(bookingsWithQuickPickup);
        } else {
          console.log("No bookings found or error:", response.error);
          setBookings([]);
        }
      } catch (error) {
        console.error("Error loading bookings:", error);
        setBookings([]);
        addNotification(
          createErrorNotification(
            "Loading Error",
            "Failed to load bookings. Please try again.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    const refreshBookings = async () => {
      setRefreshing(true);
      try {
        // Don't clear cache immediately - preserve local bookings during refresh
        console.log("��� Refreshing bookings while preserving local data...");

        await loadBookings(true);
        addNotification(
          createSuccessNotification(
            "Refreshed",
            "Booking history updated from database",
          ),
        );
      } catch (error) {
        console.error("Error refreshing bookings:", error);
        addNotification(
          createErrorNotification(
            "Refresh Failed",
            "Failed to refresh bookings",
          ),
        );
      } finally {
        setRefreshing(false);
      }
    };

    useEffect(() => {
      loadBookings();
    }, [currentUser]);

    // Listen for booking refresh events
    useEffect(() => {
      const handleRefreshBookings = () => {
        console.log(
          "🔄 Received booking refresh event - using force refresh to preserve new bookings",
        );
        refreshBookings();
      };

      const handleBookingCreated = (event: CustomEvent) => {
        console.log("🆕 New booking created - immediately updating history");
        const newBooking = event.detail.booking;
        setBookings((prevBookings) => {
          // Check if booking already exists
          const existingIndex = prevBookings.findIndex(
            (b) => b.id === newBooking.id || (b as any)._id === newBooking.id,
          );

          if (existingIndex >= 0) {
            // Update existing booking
            const updated = [...prevBookings];
            updated[existingIndex] = newBooking;
            return updated.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
          } else {
            // Add new booking and sort by creation date
            return [newBooking, ...prevBookings].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
          }
        });
      };

      window.addEventListener("refreshBookings", handleRefreshBookings);
      window.addEventListener("bookingCreated", handleBookingCreated);

      return () => {
        window.removeEventListener("refreshBookings", handleRefreshBookings);
        window.removeEventListener("bookingCreated", handleBookingCreated);
      };
    }, [currentUser]);

    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case "pending":
          return "bg-yellow-100 text-yellow-800 border-yellow-200";
        case "confirmed":
          return "bg-blue-100 text-blue-800 border-blue-200";
        case "in_progress":
        case "in-progress":
          return "bg-purple-100 text-purple-800 border-purple-200";
        case "completed":
          return "bg-green-100 text-green-800 border-green-200";
        case "cancelled":
          return "bg-red-100 text-red-800 border-red-200";
        default:
          return "bg-gray-100 text-gray-800 border-gray-200";
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status?.toLowerCase()) {
        case "confirmed":
          return <CheckCircle className="h-4 w-4" />;
        case "completed":
          return <CheckCircle className="h-4 w-4" />;
        case "cancelled":
          return <XCircle className="h-4 w-4" />;
        case "in_progress":
        case "in-progress":
          return <RefreshCw className="h-4 w-4 animate-spin" />;
        default:
          return <Clock className="h-4 w-4" />;
      }
    };

    const canCancelBooking = (booking: any) => {
      const status = booking.status?.toLowerCase();
      return status !== "cancelled" && status !== "completed";
    };

    const canEditBooking = (booking: any) => {
      const status = booking.status?.toLowerCase();
      return status === "pending" || status === "confirmed";
    };

    const handleCancelBooking = async (bookingId: string) => {
      if (!bookingId) {
        addNotification(createErrorNotification("Error", "Invalid booking ID"));
        return;
      }

      console.log("🔥 Starting booking cancellation for ID:", bookingId);
      setCancellingBooking(bookingId);

      try {
        const bookingService = BookingService.getInstance();
        const result = await bookingService.cancelBooking(bookingId);

        if (result.success) {
          // Update local state immediately for better UX
          setBookings((prev) =>
            prev.map((booking: any) => {
              const currentBookingId = booking.id || booking._id;
              const shouldUpdate =
                currentBookingId === bookingId ||
                currentBookingId?.toString() === bookingId ||
                (typeof currentBookingId === "object" &&
                  currentBookingId.toString() === bookingId);

              if (shouldUpdate) {
                console.log(
                  "✅ Updated booking status in local state:",
                  currentBookingId,
                );
                return {
                  ...booking,
                  status: "cancelled",
                  updatedAt: new Date().toISOString(),
                };
              }
              return booking;
            }),
          );

          addNotification(
            createSuccessNotification(
              "Booking Cancelled",
              "Your booking has been cancelled successfully",
            ),
          );

          // Don't force reload - trust the local cancellation since it worked
        } else {
          // Show a more user-friendly error message
          const errorMessage =
            result.error?.includes("localStorage") ||
            result.error?.includes("backend")
              ? "Booking has been cancelled locally. Changes will sync when connection is restored."
              : result.error || "Failed to cancel booking";

          // If it's a sync error but the booking was updated locally, show success
          if (result.error?.includes("localStorage")) {
            addNotification(
              createSuccessNotification(
                "Booking Cancelled",
                "Your booking has been cancelled successfully",
              ),
            );

            // Force update local state even if backend failed
            setBookings((prev) =>
              prev.map((booking: any) => {
                const currentBookingId = booking.id || booking._id;
                const shouldUpdate =
                  currentBookingId === bookingId ||
                  currentBookingId?.toString() === bookingId;

                return shouldUpdate
                  ? { ...booking, status: "cancelled" }
                  : booking;
              }),
            );
          } else {
            addNotification(
              createErrorNotification("Cancellation Failed", errorMessage),
            );
          }
        }
      } catch (error) {
        console.error("Error cancelling booking:", error);
        addNotification(
          createErrorNotification(
            "Cancellation Failed",
            "Network error. Please check your connection and try again.",
          ),
        );
      } finally {
        setCancellingBooking(null);
      }
    };

    const handleEditBooking = (booking: any) => {
      if (!canEditBooking(booking)) {
        addNotification(
          createWarningNotification(
            "Cannot Edit",
            "This booking cannot be edited in its current status",
          ),
        );
        return;
      }
      setEditingBooking(booking);
      setShowEditModal(true);
    };

    const handleSaveEditedBooking = async (updatedBooking: any) => {
      try {
        console.log(
          "📋 EnhancedBookingHistory: Starting booking update process",
          {
            bookingId: updatedBooking.id || updatedBooking._id,
            updatedFields: Object.keys(updatedBooking),
          },
        );

        const bookingService = BookingService.getInstance();
        const bookingId = updatedBooking.id || updatedBooking._id;

        const result = await bookingService.updateBooking(
          bookingId,
          updatedBooking,
        );

        console.log(
          "📋 EnhancedBookingHistory: BookingService update result:",
          result,
        );

        if (result.success) {
          // Update local state with more comprehensive ID matching
          setBookings((prev) =>
            prev.map((booking: any) => {
              const currentBookingId = booking.id || booking._id;
              const matches =
                currentBookingId === bookingId ||
                currentBookingId === updatedBooking.id ||
                currentBookingId === updatedBooking._id ||
                String(currentBookingId) === String(bookingId);

              if (matches) {
                console.log("✏️ Updating booking in local state:", bookingId);
                return {
                  ...booking,
                  ...updatedBooking,
                  updatedAt: new Date().toISOString(),
                };
              }
              return booking;
            }),
          );

          setShowEditModal(false);
          setEditingBooking(null);

          addNotification(
            createSuccessNotification(
              "Booking Updated",
              "Your booking has been updated successfully",
            ),
          );

          // Don't force reload - trust the local update since it worked
          // This prevents overwriting successful local changes
        } else {
          addNotification(
            createErrorNotification(
              "Update Failed",
              result.error || "Failed to update booking",
            ),
          );
        }
      } catch (error) {
        console.error("Error updating booking:", error);
        addNotification(
          createErrorNotification(
            "Update Failed",
            "Failed to update booking. Please try again.",
          ),
        );
      }
    };

    const handleContactSupport = (bookingId: string) => {
      setContactBookingId(bookingId);
      setShowContactDialog(true);
    };

    const formatDate = (dateStr: string) => {
      if (!dateStr || dateStr === "N/A") {
        // Return today's date as fallback
        return new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      try {
        let date;
        if (dateStr.includes("-")) {
          const [year, month, day] = dateStr.split("-").map(Number);
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(dateStr);
        }

        if (isNaN(date.getTime())) {
          // Return today's date as fallback
          return new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }

        return date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch (error) {
        console.error("Error parsing date:", dateStr, error);
        // Return today's date as fallback
        return new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    };

    const calculateTotal = (booking: any) => {
      if (booking.totalAmount) return booking.totalAmount;
      if (booking.total_price) return booking.total_price;
      if (booking.final_amount) return booking.final_amount;

      // Calculate from services if available
      if (Array.isArray(booking.services)) {
        return booking.services.reduce((total: number, service: any) => {
          const price = service.price || service.amount || 0;
          const quantity = service.quantity || 1;
          return total + price * quantity;
        }, 0);
      }

      return 0;
    };

    if (!currentUser) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="text-center py-12">
              <User className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Sign In Required
              </h2>
              <p className="text-gray-600 mb-6">
                You need to sign in to view your booking history.
              </p>
              <Button
                onClick={onLoginRequired}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 w-full py-3 rounded-xl text-white font-medium"
              >
                <User className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              Loading your bookings...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-3 py-3 sm:px-6 sm:py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4">
                {onBack && (
                  <Button
                    onClick={onBack}
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 hover:text-gray-900 p-1 sm:p-2"
                  >
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                )}
                <div>
                  <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
                    Booking History
                  </h1>
                  <p className="text-gray-600 mt-1 text-sm sm:text-base">
                    {bookings.length}{" "}
                    {bookings.length === 1 ? "booking" : "bookings"} found
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={refreshBookings}
                  variant="outline"
                  size="sm"
                  disabled={refreshing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-3 py-3 sm:px-6 sm:py-8">
          {bookings.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  No Bookings Yet
                </h3>
                <p className="text-gray-600 mb-8">
                  Your booking history will appear here once you book a service.
                </p>
                <Button
                  onClick={onBack}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium"
                >
                  Book Your First Service
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking: any, index) => {
                const bookingId =
                  booking.id || booking._id || `booking_${index}`;
                const services = Array.isArray(booking.services)
                  ? booking.services
                  : [booking.service || "Home Service"];
                const total = calculateTotal(booking);
                const hasRealId =
                  !!(booking.id || booking._id) &&
                  !bookingId.startsWith("booking_");
                const isExpanded = expandedCard === bookingId;

                const toggleExpand = () => {
                  setExpandedCard(isExpanded ? null : bookingId);
                };

                return (
                  <Card
                    key={bookingId}
                    className="overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                    onClick={toggleExpand}
                  >
                    {/* Compact Card Header - Always Visible */}
                    <CardHeader className="pb-2 px-3 py-3 bg-gradient-to-r from-green-50 to-blue-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex flex-col">
                              <h3 className="font-bold text-base text-blue-600 truncate">
                                #
                                {booking.custom_order_id ||
                                  booking.order_id ||
                                  "Order ID not available"}
                              </h3>
                            </div>
                            <Badge
                              className={`${getStatusColor(booking.status)} text-xs px-1.5 py-0.5 ml-auto`}
                            >
                              {booking.status || "pending"}
                            </Badge>
                          </div>

                          {/* Quick Pickup Indicator */}
                          {booking.isQuickPickup && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                <span>Quick Pickup</span>
                              </div>
                              {booking.quickPickupNote && (
                                <div className="text-xs text-orange-600">
                                  {booking.quickPickupNote}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Quick Info Row */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              <span>
                                {services.reduce((total, service) => {
                                  const quantity =
                                    typeof service === "object"
                                      ? service.quantity || 1
                                      : 1;
                                  return total + quantity;
                                }, 0)}{" "}
                                item
                                {services.reduce((total, service) => {
                                  const quantity =
                                    typeof service === "object"
                                      ? service.quantity || 1
                                      : 1;
                                  return total + quantity;
                                }, 0) > 1
                                  ? "s"
                                  : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span className="hidden sm:inline">Pickup: </span>
                              <span>
                                {formatDate(
                                  booking.pickupDate || booking.scheduled_date,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {booking.pickupTime ||
                                  booking.scheduled_time ||
                                  "10:00 AM"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-green-600 font-semibold ml-auto">
                              <span>₹{total}</span>
                            </div>
                          </div>

                          {/* Order placed time */}
                          <div className="text-xs text-gray-500 mt-1">
                            Ordered:{" "}
                            {new Date(
                              booking.created_at ||
                                booking.createdAt ||
                                Date.now(),
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            at{" "}
                            {new Date(
                              booking.created_at ||
                                booking.createdAt ||
                                Date.now(),
                            ).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {isExpanded ? "Less" : "More"}
                          </span>
                          <div
                            className={`transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          >
                            <svg
                              className="h-4 w-4 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Expanded Content - Only Visible When Expanded */}
                    {isExpanded && (
                      <CardContent
                        className="px-3 pb-3 pt-2 space-y-3 bg-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Services Detail */}
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <h4 className="font-semibold text-gray-900 mb-2 text-sm flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            Order Details
                          </h4>
                          <div className="space-y-2 bg-white p-2 rounded">
                            <div className="flex justify-between items-center text-xs border-b pb-2 mb-2">
                              <span className="text-gray-600 font-medium">
                                Order ID
                              </span>
                              <span className="font-mono font-bold text-blue-600 text-sm">
                                #
                                {booking.custom_order_id ||
                                  booking.order_id ||
                                  "Not available"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-600">
                                No. of Items Booked
                              </span>
                              <span className="font-medium">
                                {services.reduce((total, service) => {
                                  const quantity =
                                    typeof service === "object"
                                      ? service.quantity || 1
                                      : 1;
                                  return total + quantity;
                                }, 0)}{" "}
                                items
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-600">
                                Order Placed Date
                              </span>
                              <span className="font-medium">
                                {new Date(
                                  booking.created_at ||
                                    booking.createdAt ||
                                    Date.now(),
                                ).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}{" "}
                                at{" "}
                                {new Date(
                                  booking.created_at ||
                                    booking.createdAt ||
                                    Date.now(),
                                ).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-600">Order Value</span>
                              <span className="font-bold text-green-600">
                                ₹{total}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="text-xs text-gray-600 mb-1">
                              Services:
                            </p>
                            {services.map((service: any, idx: number) => {
                              let serviceName = "";
                              let quantity = 1;

                              // Extract service information based on data structure
                              if (
                                typeof service === "object" &&
                                service !== null
                              ) {
                                serviceName =
                                  service.name ||
                                  service.service ||
                                  service.serviceName ||
                                  "Unknown Service";
                                quantity =
                                  parseInt(service.quantity) ||
                                  parseInt(service.qty) ||
                                  1;
                              } else {
                                serviceName = String(
                                  service || "Unknown Service",
                                );
                                quantity = 1;
                              }

                              // Extract quantity from service name if it contains "x<number>" pattern
                              const quantityMatch = serviceName.match(/x(\d+)$/i);
                              if (quantityMatch) {
                                const extractedQuantity = parseInt(quantityMatch[1]);
                                if (extractedQuantity > 0) {
                                  quantity = extractedQuantity;
                                  // Remove the quantity part from the service name for display
                                  serviceName = serviceName.replace(/\s*x\d+$/i, '').trim();
                                }
                              }

                              // Get pricing from static service data instead of database
                              const serviceInfo =
                                getServicePriceWithFallback(serviceName);
                              const unitPrice = serviceInfo.unitPrice;
                              const totalServicePrice = calculateServiceTotal(
                                serviceName,
                                quantity,
                              );

                              console.log(
                                `💰 Using static pricing for "${serviceName}": ₹${unitPrice} x ${quantity} = ₹${totalServicePrice}`,
                              );

                              return (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center bg-white p-3 rounded text-xs border border-gray-100"
                                >
                                  <div className="flex-1">
                                    <span className="font-medium text-gray-900">
                                      {serviceName}
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">
                                      ₹{unitPrice} per{" "}
                                      {serviceInfo.unit.toLowerCase()}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-gray-600 text-xs">
                                      Qty: {quantity}
                                    </span>
                                    <span className="font-semibold text-green-600 text-sm">
                                      ₹{totalServicePrice}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Schedule Details */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="h-3 w-3 text-green-600" />
                              <span className="font-medium text-gray-900 text-xs">
                                Pickup
                              </span>
                            </div>
                            <p className="text-xs font-medium text-gray-900">
                              {formatDate(
                                booking.pickupDate || booking.scheduled_date,
                              )}
                            </p>
                            <p className="text-xs text-green-600">
                              {booking.pickupTime ||
                                booking.scheduled_time ||
                                "10:00"}
                            </p>
                          </div>

                          <div className="p-3 bg-emerald-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="h-3 w-3 text-emerald-600" />
                              <span className="font-medium text-gray-900 text-xs">
                                Delivery
                              </span>
                            </div>
                            <p className="text-xs font-medium text-gray-900">
                              {formatDate(booking.deliveryDate) ||
                                formatDate(
                                  booking.created_at || booking.createdAt,
                                ) ||
                                "Date TBD"}
                            </p>
                            <p className="text-xs text-emerald-600">
                              {booking.deliveryTime || "TBD"}
                            </p>
                          </div>
                        </div>

                        {/* Address */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 mb-1 text-xs">
                                Service Address
                              </p>
                              <p className="text-xs text-gray-600 leading-relaxed">
                                {typeof booking.address === "object" &&
                                booking.address !== null
                                  ? booking.address.fullAddress ||
                                    [
                                      booking.address.flatNo,
                                      booking.address.street,
                                      booking.address.landmark,
                                      booking.address.village,
                                      booking.address.city,
                                      booking.address.pincode,
                                    ]
                                      .filter(Boolean)
                                      .join(", ") ||
                                    "Address not provided"
                                  : booking.address || "Address not provided"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Price Breakdown */}
                        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                          <h4 className="font-semibold text-gray-900 mb-2 text-xs flex items-center gap-2">
                            <CreditCard className="h-3 w-3 text-green-600" />
                            Price Breakdown
                          </h4>

                          <div className="space-y-1 text-xs">
                            {/* Calculate service total and delivery fee */}
                            {(() => {
                              const handlingFee = 0; // Free handling fee
                              const serviceTotal = Math.max(
                                0,
                                total - handlingFee,
                              );

                              return (
                                <>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">
                                      Services Total
                                    </span>
                                    <span className="font-medium">
                                      ₹{serviceTotal}
                                    </span>
                                  </div>

                                  <div className="flex justify-between items-center">
                                    <span className="text-green-600">
                                      Delivery Fee
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="line-through text-gray-400 text-xs">
                                        ₹30
                                      </span>
                                      <span className="font-medium text-green-600">
                                        FREE
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center">
                                    <span className="text-green-600">
                                      Handling Fee
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="line-through text-gray-400 text-xs">
                                        ₹9
                                      </span>
                                      <span className="font-medium text-green-600">
                                        FREE
                                      </span>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}

                            {booking.discount_amount &&
                              booking.discount_amount > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-green-600">
                                    Discount
                                  </span>
                                  <span className="font-medium text-green-600">
                                    -₹{booking.discount_amount}
                                  </span>
                                </div>
                              )}

                            <Separator className="my-1" />

                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-gray-900">
                                Total Amount
                              </span>
                              <span className="font-bold text-green-600">
                                ₹{total}
                              </span>
                            </div>

                            <div className="flex justify-between items-center pt-1">
                              <span className="text-gray-500">
                                Payment Status
                              </span>
                              <Badge
                                variant={
                                  (booking.payment_status ||
                                    booking.paymentStatus) === "paid"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {(
                                  booking.payment_status ||
                                  booking.paymentStatus ||
                                  "pending"
                                ).toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 pt-2 border-t">
                          {hasRealId ? (
                            <>
                              <div className="grid grid-cols-1 gap-2">
                                {canCancelBooking(booking) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="text-xs py-2 border-red-200 text-red-600 hover:bg-red-50"
                                        disabled={
                                          cancellingBooking === bookingId
                                        }
                                        size="sm"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        {cancellingBooking === bookingId
                                          ? "Cancelling..."
                                          : "Cancel"}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="mx-4">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Cancel Booking?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to cancel this
                                          booking? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                        <AlertDialogCancel className="w-full sm:w-auto">
                                          Keep Booking
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => {
                                            if (bookingId) {
                                              handleCancelBooking(bookingId);
                                            }
                                          }}
                                          className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                                        >
                                          Yes, Cancel Booking
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>

                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleContactSupport(bookingId);
                                }}
                                variant="outline"
                                className="w-full text-xs py-2 border-gray-200 text-gray-600 hover:bg-gray-50"
                                size="sm"
                              >
                                <MessageCircle className="h-3 w-3 mr-1" />
                                Contact Support
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContactSupport(bookingId);
                              }}
                              variant="outline"
                              className="w-full text-xs py-2 border-gray-200 text-gray-600 hover:bg-gray-50"
                              size="sm"
                            >
                              <MessageCircle className="h-3 w-3 mr-1" />
                              Contact Support
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit Booking Modal */}
        {editingBooking && (
          <EditBookingModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingBooking(null);
            }}
            booking={editingBooking}
            onSave={handleSaveEditedBooking}
          />
        )}

        {/* Contact Support Dialog */}
        <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600" />
                Contact Support
              </DialogTitle>
              <DialogDescription>
                Get help with your booking #{contactBookingId}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">
                  Phone Support
                </h4>
                <p className="text-blue-800 font-mono text-lg">
                  +91 9876543210
                </p>
                <p className="text-sm text-blue-600 mt-1">Available 24/7</p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">
                  WhatsApp Support
                </h4>
                <p className="text-green-800 font-mono text-lg">
                  +91 9876543210
                </p>
                <p className="text-sm text-green-600 mt-1">Quick responses</p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowContactDialog(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  window.open("tel:+919876543210", "_self");
                  setShowContactDialog(false);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  });

EnhancedBookingHistory.displayName = "EnhancedBookingHistory";

export default EnhancedBookingHistory;
