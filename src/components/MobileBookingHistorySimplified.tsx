import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  createSuccessNotification,
  createErrorNotification,
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
  Calendar,
  Clock,
  MapPin,
  Edit,
  XCircle,
  CheckCircle,
  User,
  Phone,
  RefreshCw,
  Star,
  ArrowLeft,
  Package,
} from "lucide-react";
import { BookingService } from "@/services/bookingService";
import EditBookingModal from "./EditBookingModal";
import { clearAllUserData } from "@/utils/clearStorage";
import { filterProductionBookings } from "@/utils/bookingFilters";
import {
  mapBookingsData,
  type MappedBookingData,
} from "@/utils/bookingDataMapper";
import { laundryServices } from "@/data/laundryServices";

interface MobileBookingHistoryProps {
  currentUser?: any;
  onBack?: () => void;
}

const MobileBookingHistory: React.FC<MobileBookingHistoryProps> = ({
  currentUser,
  onBack,
}) => {
  const { addNotification } = useNotifications();

  // Function to get local service price as fallback
  const getLocalServicePrice = (
    serviceName: string,
    quantity: number = 1,
  ): number => {
    if (!serviceName) return 0;

    // Try to find exact match first
    let service = laundryServices.find(
      (s) => s.name.toLowerCase() === serviceName.toLowerCase(),
    );

    // If no exact match, try partial match
    if (!service) {
      service = laundryServices.find(
        (s) =>
          s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
          serviceName.toLowerCase().includes(s.name.toLowerCase()),
      );
    }

    // If still no match, try common service name mappings
    if (!service) {
      const serviceMap: { [key: string]: string } = {
        wash: "Laundry and Fold",
        fold: "Laundry and Fold",
        iron: "Traditional Iron",
        "dry clean": "Men Shirt",
        shirt: "Men Shirt",
        pant: "Men Trouser",
        trouser: "Men Trouser",
        saree: "Saree Simple",
        kurta: "Women Kurta",
        suit: "Men 2PC Suit",
        dress: "Women Dress",
        jacket: "Jacket",
        sweater: "Sweater",
        coat: "Long Coat",
      };

      const normalizedName = serviceName.toLowerCase();
      for (const [key, value] of Object.entries(serviceMap)) {
        if (normalizedName.includes(key)) {
          service = laundryServices.find((s) => s.name === value);
          break;
        }
      }
    }

    if (service) {
      return service.price * quantity;
    }

    // Default fallback price based on service type
    if (serviceName.toLowerCase().includes("dry clean")) {
      return 120 * quantity; // Average dry clean price
    } else if (serviceName.toLowerCase().includes("iron")) {
      return 40 * quantity; // Average iron price
    } else {
      return 70 * quantity; // Average laundry price
    }
  };
  const [bookings, setBookings] = useState<MappedBookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const loadBookings = async () => {
    if (!currentUser?.id && !currentUser?._id && !currentUser?.phone) {
      console.log("No user ID found for loading bookings");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const bookingService = BookingService.getInstance();

      console.log("📋 Loading bookings for current user:", {
        id: currentUser?.id,
        _id: currentUser?._id,
        phone: currentUser?.phone,
        name: currentUser?.name || currentUser?.full_name,
      });

      const response = await bookingService.getCurrentUserBookings();

      if (response.success && response.bookings) {
        const productionBookings = filterProductionBookings(response.bookings);
        const mappedBookings = mapBookingsData(productionBookings);

        console.log(
          "✅ Bookings loaded and mapped successfully:",
          mappedBookings.length,
        );
        setBookings(mappedBookings);
      } else {
        console.log("⚠️ No bookings found or error:", response.error);
        setBookings([]);
      }
    } catch (error) {
      console.error("❌ Error loading bookings:", error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshBookings = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  useEffect(() => {
    loadBookings();
  }, [currentUser]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "in_progress":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      const bookingService = BookingService.getInstance();
      const result = await bookingService.cancelBooking(bookingId);

      if (result.success) {
        addNotification(
          createSuccessNotification(
            "Booking Cancelled",
            "Your booking has been cancelled successfully!",
          ),
        );
        await refreshBookings();
      } else {
        addNotification(
          createErrorNotification(
            "Cancellation Failed",
            result.error || "Failed to cancel booking",
          ),
        );
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      addNotification(
        createErrorNotification(
          "Cancellation Failed",
          "Failed to cancel booking. Please try again.",
        ),
      );
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return "Date TBD";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Date TBD";
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Date TBD";
    }
  };

  const formatDateTime = (dateStr: string): string => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "N/A";
      return `${date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })} at ${date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    } catch {
      return "N/A";
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="text-center py-12">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Sign In Required
            </h2>
            <p className="text-gray-600 mb-6">
              Please sign in to view your booking history.
            </p>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 w-full py-3 rounded-xl">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              Loading your bookings...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-green-500 to-green-600 overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 p-2 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Button
              onClick={onBack || (() => window.history.back())}
              variant="ghost"
              className="text-white hover:bg-white/20 p-1.5 rounded-xl flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">
                My Bookings
              </h1>
              <p className="text-green-100 text-xs">
                {bookings.length}{" "}
                {bookings.length === 1 ? "booking" : "bookings"} found
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (confirm("Clear all data and start fresh?")) {
                  clearAllUserData();
                  setBookings([]);
                  addNotification(
                    createSuccessNotification(
                      "Data Cleared",
                      "All local data has been cleared. Refresh to start fresh.",
                    ),
                  );
                }
              }}
              variant="ghost"
              className="text-white hover:bg-white/20 p-2 sm:p-3 rounded-xl flex-shrink-0 text-xs"
              title="Clear All Data"
            >
              🗑️
            </Button>
            <Button
              onClick={refreshBookings}
              variant="ghost"
              className="text-white hover:bg-white/20 p-2 sm:p-3 rounded-xl flex-shrink-0"
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 sm:h-5 sm:w-5 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="px-3 sm:px-4 py-4 space-y-3 sm:space-y-4 overflow-x-hidden bg-white/10 backdrop-blur-sm rounded-t-3xl mt-2">
        {bookings.length === 0 ? (
          <Card className="max-w-md mx-auto bg-white/90 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="text-center py-8 sm:py-12 px-4">
              <Calendar className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                No Bookings Yet
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Start by booking your first service!
              </p>
              <Button
                onClick={onBack}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 w-full py-3 rounded-xl text-sm sm:text-base shadow-lg"
              >
                Book a Service
              </Button>
            </CardContent>
          </Card>
        ) : (
          bookings.map((booking, index) => {
            const bookingId = booking.id || `booking_${index}`;
            const isExpanded = expandedCard === bookingId;
            const totalItems = booking.services.reduce(
              (sum, service) => sum + service.quantity,
              0,
            );

            const toggleExpand = () => {
              setExpandedCard(isExpanded ? null : bookingId);
            };

            return (
              <Card
                key={bookingId}
                className="border-0 shadow-sm rounded-lg overflow-hidden bg-white/95 backdrop-blur-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={toggleExpand}
              >
                {/* Compact Card Header */}
                <CardHeader className="pb-2 px-3 py-3 bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-gray-900 truncate">
                          Order ID:{" "}
                          {booking.custom_order_id || booking.id || "N/A"}
                        </h3>
                        <Badge
                          className={`${getStatusColor(booking.status)} text-xs px-1.5 py-0.5`}
                        >
                          {booking.status}
                        </Badge>
                      </div>

                      {/* Quick Info Row */}
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          <span>
                            {totalItems} item{totalItems > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Pickup: {formatDate(booking.pickup_date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{booking.pickup_time}</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-600 font-semibold">
                          <span>
                            ₹
                            {(() => {
                              // Use database price if available, otherwise calculate locally
                              if (booking.pricing.final_amount) {
                                return booking.pricing.final_amount;
                              }

                              const localTotal = booking.services.reduce(
                                (total, service) => {
                                  const servicePrice =
                                    service.total_price ||
                                    service.price ||
                                    service.unit_price ||
                                    getLocalServicePrice(
                                      service.name,
                                      service.quantity || 1,
                                    );
                                  return total + servicePrice;
                                },
                                0,
                              );

                              return localTotal;
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Order placed time */}
                      <div className="text-xs text-gray-500 mt-1">
                        Ordered: {formatDateTime(booking.created_at)}
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

                {/* Expanded Content */}
                {isExpanded && (
                  <CardContent
                    className="px-3 pb-3 pt-2 space-y-3 bg-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Services */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-2 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-gray-900 text-xs">
                          Services ({booking.services.length})
                        </h4>
                        <span className="text-xs text-blue-600 font-medium">
                          ₹
                          {(() => {
                            // If we have final_amount from database, use it
                            if (booking.pricing.final_amount) {
                              return booking.pricing.final_amount;
                            }

                            // Otherwise calculate from individual services with local fallback
                            const calculatedTotal = booking.services.reduce(
                              (total, service) => {
                                const servicePrice =
                                  service.total_price ||
                                  service.price ||
                                  service.unit_price ||
                                  getLocalServicePrice(
                                    service.name,
                                    service.quantity || 1,
                                  );
                                return total + servicePrice;
                              },
                              0,
                            );

                            return calculatedTotal;
                          })()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {booking.services.map((service, idx) => {
                          // Get price with local fallback
                          const displayPrice =
                            service.total_price ||
                            service.price ||
                            service.unit_price ||
                            getLocalServicePrice(
                              service.name,
                              service.quantity || 1,
                            );

                          return (
                            <div
                              key={idx}
                              className="flex justify-between items-center text-xs"
                            >
                              <span>
                                {service.name}{" "}
                                {service.quantity > 1 && `x${service.quantity}`}
                                {!service.total_price &&
                                  !service.price &&
                                  !service.unit_price && (
                                    <span className="text-blue-600 text-[10px]">
                                      {" "}
                                      (local price)
                                    </span>
                                  )}
                              </span>
                              <span className="font-medium">
                                ₹{displayPrice}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pickup & Delivery Slots */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-1 mb-1">
                          <Calendar className="h-3 w-3 text-green-600" />
                          <span className="font-medium text-gray-900 text-xs">
                            Pickup
                          </span>
                        </div>
                        <p className="text-xs text-gray-900">
                          {formatDate(booking.pickup_date)}
                        </p>
                        <p className="text-xs text-green-600">
                          {booking.pickup_time}
                        </p>
                      </div>

                      <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="flex items-center gap-1 mb-1">
                          <Calendar className="h-3 w-3 text-emerald-600" />
                          <span className="font-medium text-gray-900 text-xs">
                            Delivery
                          </span>
                        </div>
                        <p className="text-xs text-gray-900">
                          {booking.delivery_date
                            ? formatDate(booking.delivery_date)
                            : "TBD"}
                        </p>
                        <p className="text-xs text-emerald-600">
                          {booking.delivery_time || "TBD"}
                        </p>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-3 p-3 bg-green-50/50 rounded-xl border border-green-100/50">
                      <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-1">
                          Service Address
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {booking.address}
                        </p>
                      </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">
                          Services Total
                        </span>
                        <span className="font-medium">
                          ₹
                          {(() => {
                            // Use database base_amount if available
                            if (booking.pricing.base_amount) {
                              return booking.pricing.base_amount;
                            }

                            // Calculate from services with local fallback
                            return booking.services.reduce((total, service) => {
                              const servicePrice =
                                service.total_price ||
                                service.price ||
                                service.unit_price ||
                                getLocalServicePrice(
                                  service.name,
                                  service.quantity || 1,
                                );
                              return total + servicePrice;
                            }, 0);
                          })()}
                          {!booking.pricing.base_amount && (
                            <span className="text-blue-600 text-[10px] ml-1">
                              (local)
                            </span>
                          )}
                        </span>
                      </div>

                      {booking.pricing.tax_amount > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">Tax</span>
                          <span className="font-medium">
                            ₹{booking.pricing.tax_amount}
                          </span>
                        </div>
                      )}

                      {booking.pricing.discount_amount > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-green-600">
                            Discount
                          </span>
                          <span className="font-medium text-green-600">
                            -₹{booking.pricing.discount_amount}
                          </span>
                        </div>
                      )}

                      <div className="border-t border-green-200 pt-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-900">
                            Total Amount
                          </span>
                          <span className="text-xl font-bold text-green-600">
                            ₹
                            {(() => {
                              // Use database final_amount if available
                              if (booking.pricing.final_amount) {
                                return booking.pricing.final_amount;
                              }

                              // Calculate total with local service prices
                              const servicesTotal = booking.services.reduce(
                                (total, service) => {
                                  const servicePrice =
                                    service.total_price ||
                                    service.price ||
                                    service.unit_price ||
                                    getLocalServicePrice(
                                      service.name,
                                      service.quantity || 1,
                                    );
                                  return total + servicePrice;
                                },
                                0,
                              );

                              // Add tax and subtract discount if available
                              const tax = booking.pricing.tax_amount || 0;
                              const discount =
                                booking.pricing.discount_amount || 0;

                              return servicesTotal + tax - discount;
                            })()}
                            {!booking.pricing.final_amount && (
                              <span className="text-blue-600 text-[10px] ml-1">
                                (calculated)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-500">
                            Payment Status
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              booking.payment_status === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {booking.payment_status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {(booking.status === "pending" ||
                      booking.status === "confirmed") && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-lg border border-green-200 hover:bg-green-50 text-green-600 text-xs py-2"
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="flex-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs py-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Cancel
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Cancel Booking
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this booking?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                Keep Booking
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelBooking(booking.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Yes, Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MobileBookingHistory;
