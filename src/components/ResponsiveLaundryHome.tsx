import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MapPin,
  ShoppingBag,
  Clock,
  Star,
  Mic,
  User,
  Package,
  Plus,
  Minus,
  Menu,
  X,
  ArrowRight,
  Smartphone,
  Monitor,
  Bell,
  MessageCircle,
  Gift,
  AlertTriangle,
  Zap,
  Home,
} from "lucide-react";
import {
  laundryServices,
  serviceCategories,
  getPopularServices,
  getSortedServices,
  searchServices,
  getServicesByCategory,
  getCategoryDisplay,
  LaundryService,
} from "@/data/laundryServices";
import { toast } from "sonner";
import DynamicServicesService from "@/services/dynamicServicesService";
import type {
  DynamicLaundryService,
  DynamicServiceCategory,
} from "@/services/dynamicServicesService";
import PhoneOtpAuthModal from "./PhoneOtpAuthModal";
import EnhancedBookingHistoryModal from "./EnhancedBookingHistoryModal";
import UserMenuDropdown from "./UserMenuDropdown";
import OptimizedImage from "./OptimizedImage";
import DebugPanel from "./DebugPanel";
import BookingDebugPanel from "./BookingDebugPanel";
import ConnectionStatus from "./ConnectionStatus";
import analyticsService from "@/services/analyticsService";
import VoiceSearch from "./VoiceSearch";
import AdminServicesManager from "./AdminServicesManager";
import LocationUnavailableModal from "./LocationUnavailableModal";
import NotificationBell from "./NotificationBell";
import QuickPickupModal from "./QuickPickupModal";
import CustomerVerificationPopup from "./CustomerVerificationPopup";
import OrderStatusBar from "@/components/OrderStatusBar";
import { BookingService } from "@/services/bookingService";
import { DVHostingSmsService } from "@/services/dvhostingSmsService";
import { useCustomerVerification } from "@/hooks/useCustomerVerification";
import { useCustomerNotifications } from "@/hooks/useCustomerNotifications";
import clearTestVerifications from "@/utils/clearTestVerifications";
import { debugVerificationSystem } from "@/utils/debugVerification";
import { LocationDetectionService } from "@/services/locationDetectionService";
import { saveCartData, getCartData } from "@/utils/formPersistence";
import "@/styles/mobile-sticky-search.css";
import "@/styles/mobile-advanced-design.css";
import "@/styles/mobile-gestures-animations.css";
import "@/styles/mobile-typography-spacing.css";
import "@/styles/mobile-gesture-support.css";
import "@/styles/premium-app-ui.css";
import { preloadCriticalImages } from "@/utils/imagePreloader";
import BannerCarousel from "./BannerCarousel";
import UserPackages from "./UserPackages";

interface ResponsiveLaundryHomeProps {
  currentUser?: any;
  userLocation?: string;
  onLoginSuccess: (user: any) => void;
  onViewCart: () => void;
  onViewBookings: () => void;
  onLogout?: () => void;
}

const ResponsiveLaundryHome: React.FC<ResponsiveLaundryHomeProps> = ({
  currentUser,
  userLocation,
  onLoginSuccess,
  onViewCart,
  onViewBookings,
  onLogout,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showBookingDebugPanel, setShowBookingDebugPanel] = useState(false);
  const [showAdminServices, setShowAdminServices] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [showLocationUnavailable, setShowLocationUnavailable] = useState(false);
  const [detectedLocationText, setDetectedLocationText] = useState("");
  const [showQuickPickupModal, setShowQuickPickupModal] = useState(false);
  const [showQuickPickupAfterLogin, setShowQuickPickupAfterLogin] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [loadingActiveOrder, setLoadingActiveOrder] = useState(false);
  const [showUserPackages, setShowUserPackages] = useState(false);
  const dvhostingSmsService = DVHostingSmsService.getInstance();
  const locationDetectionService = LocationDetectionService.getInstance();

  // Customer verification system
  const {
    isPopupOpen: isVerificationPopupOpen,
    currentVerification,
    pendingCount,
    showVerificationPopup,
    hideVerificationPopup,
    checkOnStartup,
    checkPendingVerifications,
    handleVerificationComplete,
    verificationService
  } = useCustomerVerification();

  // Customer notifications system
  const {
    notifications: customerNotifications,
    simulateOrderConfirmation,
    simulateStatusUpdate
  } = useCustomerNotifications();

  // Function to request location permission and check availability
  const requestLocationPermission = async () => {
    setIsRequestingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        },
      );

      console.log("📍 Location detected:", position.coords);

      // Detect location details using our service
      const detectedLocation =
        await locationDetectionService.detectLocationGPS();

      if (detectedLocation) {
        console.log("📍 Location details:", detectedLocation);
        setDetectedLocationText(detectedLocation.full_address);

        // Save detected location to database
        await locationDetectionService.saveDetectedLocation(detectedLocation);

        // Check if location is available for service
        const availability =
          await locationDetectionService.checkLocationAvailability(
            detectedLocation.city,
            detectedLocation.pincode,
            detectedLocation.full_address,
          );

        console.log("�� Location availability:", availability);

        if (!availability.is_available) {
          // Show unavailable popup instead of reloading
          setShowLocationUnavailable(true);
          setIsRequestingLocation(false);
          return;
        }
      }

      // If location is available or detection failed, reload as before
      window.location.reload();
    } catch (error) {
      console.error("Location request failed:", error);
      // Show a more helpful message to the user
      alert(
        "Please enable location access in your browser settings, then refresh the page.",
      );
    } finally {
      setIsRequestingLocation(false);
    }
  };

  // Automatic location detection for new users/devices
  useEffect(() => {
    const handleAutoLocationDetection = async () => {
      // Only auto-detect if no location is set and user hasn't explicitly denied
      if (
        !userLocation ||
        (!userLocation.includes("denied") &&
          !userLocation.includes("access denied"))
      ) {
        // Check if we've already detected location for this device recently
        const lastDetection = localStorage.getItem("lastLocationDetection");
        const now = Date.now();

        // Only auto-detect once per day per device
        if (
          !lastDetection ||
          now - parseInt(lastDetection) > 24 * 60 * 60 * 1000
        ) {
          try {
            console.log("🔍 Auto-detecting location for new user/device...");

            // Try to get location without triggering permission popup
            const detectedLocation =
              await locationDetectionService.detectLocationGPS();

            if (detectedLocation) {
              console.log("�� Auto-detected location:", detectedLocation);
              setDetectedLocationText(detectedLocation.full_address);

              // Save detected location to database
              await locationDetectionService.saveDetectedLocation(
                detectedLocation,
              );

              // Check availability
              const availability =
                await locationDetectionService.checkLocationAvailability(
                  detectedLocation.city,
                  detectedLocation.pincode,
                  detectedLocation.full_address,
                );

              console.log(
                "🏠 Auto-detected location availability:",
                availability,
              );

              if (!availability.is_available) {
                // Show unavailable popup for auto-detected location
                setShowLocationUnavailable(true);
              }

              // Mark that we've detected location for this device
              localStorage.setItem("lastLocationDetection", now.toString());
            }
          } catch (error) {
            console.log(
              "🔍 Auto location detection failed (expected for permission restrictions):",
              error,
            );
            // This is expected if user hasn't granted permission - don't show error
          }
        }
      }
    };

    // Run auto-detection after a short delay to not block initial render
    const timer = setTimeout(handleAutoLocationDetection, 2000);
    return () => clearTimeout(timer);
  }, [userLocation, locationDetectionService]);

  // Add keyboard shortcut for booking debug panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+B to open booking debug panel
      if (event.ctrlKey && event.shiftKey && event.key === "B") {
        event.preventDefault();
        setShowBookingDebugPanel(true);
      }
      // Ctrl+Shift+D to open debug panel
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        event.preventDefault();
        setShowDebugPanel(true);
      }
      // Ctrl+Shift+A to open admin services manager
      if (event.ctrlKey && event.shiftKey && event.key === "A") {
        event.preventDefault();
        setShowAdminServices(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    // Load cart from localStorage on initialization
    return getCartData();
  });
  const [deliveryTime, setDeliveryTime] = useState("45 min");
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Dynamic services state
  const [dynamicServices, setDynamicServices] = useState<
    DynamicServiceCategory[]
  >([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [useStaticFallback, setUseStaticFallback] = useState(false);
  const dynamicServicesService = DynamicServicesService.getInstance();

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(cart).length > 0) {
      saveCartData(cart);
    }
  }, [cart]);

  // Simplified mobile detection
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      const userAgent = navigator.userAgent;

      // Simplified and more reliable mobile detection
      const isMobileUserAgent =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
          userAgent,
        );
      const isMobileViewport = width <= 768;
      const isTouchDevice =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;

      // Use OR logic - any one of these conditions makes it mobile
      const isMobileDevice =
        isMobileUserAgent ||
        isMobileViewport ||
        (isTouchDevice && width <= 1024);

      setIsMobile(isMobileDevice);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    window.addEventListener("orientationchange", checkScreenSize);
    return () => {
      window.removeEventListener("resize", checkScreenSize);
      window.removeEventListener("orientationchange", checkScreenSize);
    };
  }, []);

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem("laundry_cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // Listen for cart clearing events
  useEffect(() => {
    const handleClearCart = () => {
      console.log("🧹 ResponsiveLaundryHome: Received cart clear event");
      setCart({});
      localStorage.removeItem("laundry_cart");
      localStorage.removeItem("mobile_service_cart");
      localStorage.removeItem("service_cart");
      localStorage.removeItem("cleancare_cart");
    };

    window.addEventListener("clearCart", handleClearCart);
    return () => {
      window.removeEventListener("clearCart", handleClearCart);
    };
  }, []);

  // Load dynamic services
  useEffect(() => {
    const loadDynamicServices = async () => {
      try {
        setIsLoadingServices(true);
        const services = await dynamicServicesService.getServices();
        setDynamicServices(services);
        setUseStaticFallback(false);
        console.log(
          "✅ Loaded dynamic services:",
          services.length,
          "categories",
        );

        // Preload critical images for faster loading
        preloadCriticalImages(services).catch(console.warn);
      } catch (error) {
        console.warn(
          "⚠️ Failed to load dynamic services, using static fallback:",
          error,
        );
        setDynamicServices(laundryServices);
        setUseStaticFallback(true);

        // Preload critical images for fallback services
        preloadCriticalImages(laundryServices).catch(console.warn);
      } finally {
        setIsLoadingServices(false);
      }
    };

    loadDynamicServices();
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem("laundry_cart", JSON.stringify(cart));
  }, [cart]);

  // Check for pending customer verifications on app startup (optimized to prevent infinite refreshing)
  useEffect(() => {
    // Use a ref to track if we've already initialized to prevent multiple calls
    const initKey = `verification_initialized_${currentUser?.phone || 'anonymous'}`;
    const hasInitialized = sessionStorage.getItem(initKey);

    if (currentUser && !hasInitialized) {
      // Mark as initialized immediately to prevent re-runs
      sessionStorage.setItem(initKey, 'true');

      // Clear any test/demo verifications first
      clearTestVerifications();

      // Request notification permission
      requestNotificationPermission();

      // Only check when user is authenticated
      checkOnStartup();

      // Mobile-specific debug and verification check
      if (window.innerWidth < 768) {
        // Only check for existing verifications
        setTimeout(async () => {
          console.log('📱 Mobile: Checking for existing pending verifications...');
          const hasPending = await checkPendingVerifications();
          if (hasPending) {
            console.log('📱 Mobile: Found pending verifications, showing popup...');
            showVerificationPopup();
          }
        }, 1000); 
      }
    }
  }, [currentUser?.phone]); // Only depend on user phone to avoid excessive re-runs


  // Load active orders from user bookings
  useEffect(() => {
    const loadActiveOrders = async () => {
      if (!currentUser?.id && !currentUser?._id && !currentUser?.phone) {
        setActiveOrder(null);
        return;
      }

      try {
        setLoadingActiveOrder(true);
        const bookingService = BookingService.getInstance();
        const response = await bookingService.getCurrentUserBookings();

        if (response.success && response.bookings) {
          // Find active order (not cancelled, not completed)
          const active = response.bookings.find((booking: any) => {
            const status = booking.status?.toLowerCase() || "";
            return status !== "cancelled" && status !== "completed";
          });

          if (active) {
            setActiveOrder(active);
          } else {
            setActiveOrder(null);
          }
        }
      } catch (error) {
        console.error("Error loading active orders:", error);
        setActiveOrder(null);
      } finally {
        setLoadingActiveOrder(false);
      }
    };

    loadActiveOrders();
  }, [currentUser?.id, currentUser?._id, currentUser?.phone]);

  // Request notification permission for verification alerts
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log('🔔 Notification permission:', permission);
        if (permission === 'granted') {
          console.log('✅ Notifications enabled for order verifications');
        }
      } catch (error) {
        console.warn('⚠️ Could not request notification permission:', error);
      }
    }
  };

  // Handle verification notification events
  useEffect(() => {
    const handleOpenVerificationPopup = (event: CustomEvent) => {
      console.log('🔔 Opening verification popup from notification:', event.detail);
      if (event.detail.verification) {
        showVerificationPopup(event.detail.verification);
      } else {
        showVerificationPopup();
      }
    };

    const handleInAppNotification = (event: CustomEvent) => {
      console.log('🔔 Showing in-app notification:', event.detail);
      const { title, message, action } = event.detail;

      // Show a toast notification that's clickable
      const toastId = toast(title, {
        description: message,
        duration: 10000, // 10 seconds
        action: {
          label: 'Review Changes',
          onClick: () => {
            if (action) action();
            toast.dismiss(toastId);
          }
        }
      });
    };

    // Add event listeners
    window.addEventListener('openVerificationPopup', handleOpenVerificationPopup as EventListener);
    window.addEventListener('showInAppNotification', handleInAppNotification as EventListener);

    return () => {
      window.removeEventListener('openVerificationPopup', handleOpenVerificationPopup as EventListener);
      window.removeEventListener('showInAppNotification', handleInAppNotification as EventListener);
    };
  }, [showVerificationPopup]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const addToCart = (serviceId: string) => {
    setCart((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] || 0) + 1,
    }));
  };

  const removeFromCart = (serviceId: string) => {
    setCart((prev) => {
      const newCart = { ...prev };
      if (newCart[serviceId] > 1) {
        newCart[serviceId] -= 1;
      } else {
        delete newCart[serviceId];
      }
      return newCart;
    });
  };

  const getCartItemCount = () => {
    return Object.values(cart).reduce((sum, count) => sum + count, 0);
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [serviceId, count]) => {
      let service;
      if (useStaticFallback) {
        // Services are now flat, no need to flatMap
        service = laundryServices.find((s) => s.id === serviceId);
      } else {
        service = dynamicServices
          ?.flatMap((cat) => cat.services || [])
          ?.find((s) => s.id === serviceId);
      }
      return total + (service ? service.price * count : 0);
    }, 0);
  };

  const getFilteredServices = (): (
    | LaundryService
    | DynamicLaundryService
  )[] => {
    if (isLoadingServices) return [];

    let services: (LaundryService | DynamicLaundryService)[] = [];

    if (searchQuery) {
      if (useStaticFallback) {
        services = searchServices(searchQuery) || [];
      } else {
        // Search in dynamic services
        const searchTerm = searchQuery.toLowerCase();
        services =
          dynamicServices?.flatMap(
            (category) =>
              category.services?.filter(
                (service) =>
                  service.enabled !== false &&
                  (service.name?.toLowerCase().includes(searchTerm) ||
                    service.category?.toLowerCase().includes(searchTerm) ||
                    service.description?.toLowerCase().includes(searchTerm)),
              ) || [],
          ) || [];
      }
    } else if (selectedCategory === "all") {
      if (useStaticFallback) {
        services = getSortedServices() || [];
      } else {
        // Get all services from dynamic categories
        services =
          dynamicServices?.flatMap(
            (category) =>
              category.services?.filter(
                (service) => service.enabled !== false,
              ) || [],
          ) || [];
        // Sort: popular first, then alphabetically
        services.sort((a, b) => {
          if (a.popular && !b.popular) return -1;
          if (!a.popular && b.popular) return 1;
          return a.name.localeCompare(b.name);
        });
      }
    } else {
      if (useStaticFallback) {
        // Use the new getServicesByCategory function
        services = getServicesByCategory(selectedCategory) || [];
        // Sort by popular first, then alphabetically
        services.sort((a, b) => {
          if (a.popular && !b.popular) return -1;
          if (!a.popular && b.popular) return 1;
          return a.name.localeCompare(b.name);
        });
      } else {
        const category = dynamicServices?.find(
          (c) => c.id === selectedCategory,
        );
        services = (category?.services || [])
          .filter((service) => service.enabled !== false)
          .sort((a, b) => {
            // Sort by popular first, then alphabetically
            if (a.popular && !b.popular) return -1;
            if (!a.popular && b.popular) return 1;
            return a.name.localeCompare(b.name);
          });
      }
    }

    return services;
  };

  const handleLogin = () => {
    console.log("handleLogin clicked, setting showAuthModal to true");
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (user: any) => {
    setShowAuthModal(false);
    onLoginSuccess(user);

    // If user just logged in and Quick Pickup was the trigger, open Quick Pickup modal
    // We'll check this by adding a temporary state to track login intent
    if (showQuickPickupAfterLogin) {
      setTimeout(() => {
        setShowQuickPickupModal(true);
        setShowQuickPickupAfterLogin(false);
      }, 500); // Small delay for better UX
    }
  };

  const handleLogout = () => {
    // Use iOS fixes for logout
    import("../utils/iosAuthFix").then(({ clearIosAuthState }) => {
      clearIosAuthState();
    });

    // DVHosting SMS service doesn't have logout method - user logout handled at app level
    if (onLogout) {
      onLogout();
    }
  };

  const handleViewBookings = () => {
    if (currentUser) {
      // Use parent navigation to go to bookings view
      onViewBookings();
    } else {
      setShowAuthModal(true);
    }
  };

  const handleUpdateProfile = (updatedUser: any) => {
    // Update user data in the parent component or storage
    onLoginSuccess(updatedUser);
  };

  const handleBookService = () => {
    // Track Browse Services button click
    analyticsService.trackButtonClick('Browse Services', 'hero-section');

    // Scroll to services section
    const servicesSection = document.getElementById("services-section");
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const mapStatusToRiderStatus = (status: string): string => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "created":
        return "unassigned";
      case "vendor_assigned":
      case "vendor-assigned":
      case "pending":
      case "confirmed":
        return "assigned";
      case "pickup_assigned":
      case "pickup-assigned":
        return "assigned";
      case "pickup_completed":
      case "pickup-completed":
        return "accepted";
      case "ready_for_delivery":
      case "ready-for-delivery":
      case "delivery_assigned":
      case "delivery-assigned":
        return "picked_up";
      case "in_progress":
      case "in-progress":
      case "delivered_to_vendor":
      case "delivered-to-vendor":
        return "picked_up";
      case "delivered":
      case "completed":
        return "delivered";
      default:
        return "unassigned";
    }
  };

  const handleQuickPickup = () => {
    console.log("🚀 Quick Pickup button clicked!");
    console.log("👤 Current user:", currentUser);
    console.log("🎯 showQuickPickupModal state:", showQuickPickupModal);

    if (!currentUser) {
      console.log("❌ No current user, showing auth modal");
      // User not logged in, show login modal first and remember the intent
      setShowQuickPickupAfterLogin(true);
      setShowAuthModal(true);
      return;
    }

    console.log("✅ User logged in, showing Quick Pickup modal");
    // User is logged in, show quick pickup modal
    setShowQuickPickupModal(true);

    // Add a slight delay to ensure state update
    setTimeout(() => {
      console.log("🔄 Quick Pickup modal state after update:", showQuickPickupModal);
    }, 100);
  };

  const EmptyStateCard = () => (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden mx-auto max-w-md">
      <CardContent className="text-center py-12 px-6">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-laundrify-mint/20 to-laundrify-mint/40 rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="h-12 w-12 text-laundrify-blue" />
          </div>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
          No Services Selected
        </h3>

        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          Browse our professional laundry services and add them to your cart to
          get started.
        </p>

        <Button
          onClick={handleBookService}
          className="bg-laundrify-mint hover:bg-laundrify-mint/90 w-full py-3 rounded-xl text-laundrify-blue font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <ShoppingBag className="mr-2 h-5 w-5" />
          Browse Services
        </Button>
      </CardContent>
    </Card>
  );

  if (isMobile) {
    // Premium Mobile Interface - Zomato/Swiggy Style
    return (
      <div className="min-h-screen bg-white">
        {/* Verification Status Banner */}
        {(() => {
          console.log('📱 Mobile Banner Check - pendingCount:', pendingCount, 'isMobile:', typeof window !== 'undefined' && window.innerWidth < 768);
          return pendingCount > 0;
        })() && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white p-3 text-center shadow-lg">
            <div className="flex items-center justify-center space-x-2">
              <Bell className="h-4 w-4 animate-pulse" />
              <span className="font-semibold text-sm">
                {pendingCount} Order Change{pendingCount > 1 ? 's' : ''} Need Your Approval
              </span>
              <button
                onClick={() => {
                  console.log('📱 Mobile banner clicked - showing verification popup');
                  showVerificationPopup();
                }}
                className="bg-white bg-opacity-20 px-2 py-1 rounded text-xs font-medium ml-2 hover:bg-opacity-30 transition-all"
              >
                Review Now
              </button>
            </div>
          </div>
        )}

        {/* Premium Header with Location & Actions */}
        <div className={`premium-header ${pendingCount > 0 ? 'mt-12' : ''}`}>
          <div className="premium-header-content">
            <div className="premium-location-section">
              <div className="premium-location-label">Delivery to</div>
              <div className="premium-location-text">
                <MapPin className="premium-location-icon" size={16} />
                <span className="truncate">{userLocation || "Select Location"}</span>
              </div>
            </div>
            <div className="premium-header-actions">
              {currentUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewBookings}
                  className="premium-icon-button"
                  title="View Orders"
                >
                  <Package size={20} />
                </Button>
              )}
              {currentUser && (
                <NotificationBell
                  userId={currentUser._id || currentUser.phone}
                  className="premium-icon-button"
                />
              )}
              {currentUser ? (
                <UserMenuDropdown
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onViewBookings={handleViewBookings}
                  onViewPackages={() => setShowUserPackages(true)}
                  onUpdateProfile={handleUpdateProfile}
                />
              ) : (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLogin();
                  }}
                  className="premium-icon-button"
                  title="Sign In"
                >
                  <User size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu Overlay */}
          {showMobileMenu && (
            <div className="absolute top-full left-0 right-0 bg-white shadow-lg z-40">
              <div className="p-4 space-y-3">
                <Button
                  onClick={() => {
                    setShowMobileMenu(false);
                    if (currentUser) {
                      onViewBookings();
                    } else {
                      handleLogin();
                    }
                  }}
                  variant="ghost"
                  className="w-full justify-start text-gray-700"
                >
                  <User className="mr-3 h-4 w-4" />
                  {currentUser ? "My Bookings" : "Sign In"}
                </Button>
                <Button
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleBookService();
                  }}
                  variant="ghost"
                  className="w-full justify-start text-gray-700"
                >
                  <ShoppingBag className="mr-3 h-4 w-4" />
                  Browse Services
                </Button>
                {currentUser && (
                  <Button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowUserPackages(true);
                    }}
                    variant="ghost"
                    className="w-full justify-start text-gray-700"
                  >
                    <Package className="mr-3 h-4 w-4" />
                    My Packages
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Delivery Time Display */}
        <div className="premium-delivery-time">
          <div className="premium-delivery-time-content">
            <Clock className="premium-delivery-icon" size={16} />
            <span className="premium-delivery-text">Delivery in {deliveryTime}</span>
            <span className="premium-delivery-badge">Free Delivery</span>
          </div>
        </div>

        {/* Banner Carousel */}
        <div className="px-0 py-2">
          <BannerCarousel />
        </div>

        {/* Premium Search Bar */}
        <div className="premium-search-section">
          <div className="premium-search-bar">
            <Search className="premium-search-icon" size={16} />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="premium-search-input"
            />
            <VoiceSearch
              onResult={(transcript) => {
                handleSearch(transcript);
              }}
              onError={(error) => {
                console.error("Voice search error:", error);
              }}
              className="text-gray-400"
            />
          </div>
        </div>

        {/* Premium Filter Chips */}
        <div className="premium-filter-section">
          <div className="premium-filters">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`premium-filter-chip ${selectedCategory === "all" ? "active" : ""}`}
            >
              All Services
            </button>

            {(useStaticFallback
              ? (serviceCategories || []).slice(1)
              : dynamicServices || []
            )
              .filter((category) => category.enabled !== false)
              .slice(0, 5)
              .map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`premium-filter-chip ${selectedCategory === category.id ? "active" : ""}`}
                >
                  <span className="mr-1">{category.icon}</span>
                  {category.name}
                </button>
              ))}
          </div>
        </div>

        {/* Active Order Status Bar - Mobile */}
        {activeOrder && !loadingActiveOrder && (
          <div className="bg-white p-4 border-b border-gray-100">
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900 mb-1">Your Active Order</h3>
              <p className="text-xs text-gray-600">
                Order #{activeOrder.custom_order_id || activeOrder.order_id || "Order ID"}
              </p>
            </div>
            <OrderStatusBar
              riderStatus={mapStatusToRiderStatus(activeOrder.status)}
              bookingStatus={activeOrder.status}
              isOrderComplete={activeOrder.status === "completed" || activeOrder.status === "delivered"}
              className="mb-3"
            />
            <Button
              onClick={handleViewBookings}
              variant="outline"
              className="w-full text-xs py-2 border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              View Full Details
            </Button>
          </div>
        )}

        {/* Premium Services Container */}
        <div id="services-section" className="premium-services-container premium-content">
          {getFilteredServices().length === 0 ? (
            <div className="premium-empty-state">
              <div className="premium-empty-icon">🔍</div>
              <div className="premium-empty-title">No services available</div>
              <div className="premium-empty-description">Try different filters or search terms</div>
            </div>
          ) : (
            <>
              {/* Popular Items Section - Grid View */}
              {getFilteredServices().filter(s => s.popular).length > 0 && (
                <div className="premium-grid-section">
                  <div className="premium-section-title">Trending Now</div>
                  <div className="premium-service-grid">
                    {getFilteredServices().filter(s => s.popular).slice(0, 4).map((service) => {
                      const quantity = cart[service.id] || 0;
                      return (
                        <div key={service.id} className="premium-grid-card premium-animate-in">
                          <div className="premium-grid-image-container">
                            {service.image ? (
                              <OptimizedImage
                                src={service.image}
                                alt={service.name}
                                className="premium-grid-image"
                                priority
                                fallbackText={getCategoryDisplay(service.category).split(" ")[0]}
                              />
                            ) : (
                              <div className="premium-grid-image-fallback">
                                {getCategoryDisplay(service.category).split(" ")[0]}
                              </div>
                            )}
                            {service.popular && (
                              <div className="premium-grid-badge">POPULAR</div>
                            )}
                          </div>
                          <div className="premium-grid-content">
                            <h3 className="premium-grid-name">{service.name}</h3>
                            <p className="premium-grid-category">
                              {getCategoryDisplay(service.category)}
                            </p>
                            <div className="premium-grid-footer">
                              <span className="premium-grid-price">₹{service.price}</span>
                              {quantity > 0 ? (
                                <div className="premium-quantity-selector">
                                  <button
                                    onClick={() => removeFromCart(service.id)}
                                    className="premium-quantity-btn"
                                  >
                                    −
                                  </button>
                                  <span className="premium-quantity-value">{quantity}</span>
                                  <button
                                    onClick={() => addToCart(service.id)}
                                    className="premium-quantity-btn"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => addToCart(service.id)}
                                  className="premium-add-button"
                                >
                                  Add
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Services - List View */}
              <div className="premium-services-container">
                {getFilteredServices().filter(s => !s.popular).length > 0 && (
                  <div className="premium-section-title">All Services</div>
                )}
                {getFilteredServices().map((service) => {
                  const quantity = cart[service.id] || 0;
                  return (
                    <div key={service.id} className="premium-service-card premium-animate-in">
                      <div className="premium-service-image-container">
                        {service.image ? (
                          <OptimizedImage
                            src={service.image}
                            alt={service.name}
                            className="premium-service-image"
                            priority={service.popular}
                            fallbackText={getCategoryDisplay(service.category).split(" ")[0]}
                          />
                        ) : (
                          <div className="premium-service-image-fallback">
                            {getCategoryDisplay(service.category).split(" ")[0]}
                          </div>
                        )}
                        {service.popular && (
                          <div className="premium-service-badge">HOT DEAL</div>
                        )}
                      </div>

                      <div className="premium-service-content">
                        <div className="premium-service-header">
                          <h3 className="premium-service-name">{service.name}</h3>
                          <p className="premium-service-category">
                            {getCategoryDisplay(service.category)}
                          </p>
                        </div>

                        <div className="premium-service-footer">
                          <span className="premium-service-price">
                            ₹{service.price}
                            <span className="premium-service-unit">{service.unit}</span>
                          </span>
                          <div className="premium-service-actions">
                            {quantity > 0 ? (
                              <div className="premium-quantity-selector">
                                <button
                                  onClick={() => removeFromCart(service.id)}
                                  className="premium-quantity-btn"
                                >
                                  −
                                </button>
                                <span className="premium-quantity-value">{quantity}</span>
                                <button
                                  onClick={() => addToCart(service.id)}
                                  className="premium-quantity-btn"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(service.id)}
                                className="premium-add-button"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Premium Floating Cart Button */}
        {getCartItemCount() > 0 && (
          <div className="premium-bottom-bar">
            <button
              onClick={onViewCart}
              className="premium-bottom-button"
            >
              <span>🛒 View Cart ({getCartItemCount()}) • ₹{getCartTotal()}</span>
            </button>
          </div>
        )}

{/* Auth Modal */}
        <PhoneOtpAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* Quick Pickup Modal */}
        <QuickPickupModal
          isOpen={showQuickPickupModal}
          onClose={() => setShowQuickPickupModal(false)}
          currentUser={currentUser}
        />

        {/* WhatsApp Floating Action Button - Mobile */}
        <div 
          className="fixed bottom-20 right-4 z-[9999]"
          style={{ 
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            zIndex: 9999
          }}
        >
          <button
            onClick={() => {
              const phoneNumber = "917011585587"; // Your WhatsApp number
              const message = encodeURIComponent("Hi! I need help with laundry services.");
              window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
            }}
            className="bg-green-500 hover:bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-xl border-2 border-white transition-all duration-300 active:scale-95"
            title="Chat with us on WhatsApp"
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>

        <CustomerVerificationPopup
          isOpen={isVerificationPopupOpen}
          onClose={hideVerificationPopup}
          verification={currentVerification}
          onVerificationComplete={handleVerificationComplete}
        />

        {showUserPackages && currentUser && (
          <div className="fixed inset-0 z-50 bg-white">
            <UserPackages currentUser={currentUser} onClose={() => setShowUserPackages(false)} />
          </div>
        )}
      </div>
    );
  }

  // Desktop Interface
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Header */}
      <header className="glass-panel !rounded-none !border-x-0 !border-t-0 sticky top-0 z-50 mb-2">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden">
                  <img
                    src="/laundrify-exact-icon.svg"
                    alt="Laundrify Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Laundrify
                  </h1>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Monitor className="h-3 w-3" />
                    <span>Desktop</span>
                  </div>
                </div>
              </div>

              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search laundry services..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 pr-10 bg-gray-50 border-gray-200 focus:bg-white"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  {currentUser && (
                    <VoiceSearch
                      onResult={(transcript) => {
                        console.log("Voice search result:", transcript);
                        setSearchQuery(transcript);
                        if (transcript.toLowerCase().includes("cart")) {
                          handleViewCart();
                        } else if (
                          transcript.toLowerCase().includes("booking")
                        ) {
                          handleViewBookings();
                        }
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="hidden lg:flex items-center gap-2 bg-laundrify-mint/20 px-3 py-2 rounded-lg">
                <Clock className="h-4 w-4 text-laundrify-blue" />
                <span className="text-sm font-medium text-laundrify-blue">
                  Delivery in {deliveryTime}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div
                className={`hidden md:flex items-center gap-2 text-sm text-gray-600 ${
                  userLocation?.includes("denied") ||
                  userLocation?.includes("access denied")
                    ? "cursor-pointer hover:text-gray-800 transition-colors"
                    : ""
                }`}
                onClick={
                  userLocation?.includes("denied") ||
                  userLocation?.includes("access denied")
                    ? requestLocationPermission
                    : undefined
                }
                title={
                  userLocation?.includes("denied") ||
                  userLocation?.includes("access denied")
                    ? "Click to request location permission again"
                    : undefined
                }
              >
                <MapPin
                  className={`h-4 w-4 ${
                    userLocation?.includes("denied") ||
                    userLocation?.includes("access denied")
                      ? "animate-pulse text-orange-500"
                      : ""
                  }`}
                />
                <span>
                  {isRequestingLocation
                    ? "Requesting location..."
                    : userLocation || "Set Location"}
                </span>
              </div>

              {currentUser && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowUserPackages(true)} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    <Package className="h-4 w-4 mr-2" />
                    Packages
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleViewBookings}>
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Bookings
                  </Button>
                </div>
              )}

              {currentUser && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <NotificationBell
                      userId={currentUser._id || currentUser.phone}
                    />
                  </div>

                </div>
              )}

              {currentUser ? (
                <UserMenuDropdown
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onViewBookings={handleViewBookings}
                  onViewPackages={() => setShowUserPackages(true)}
                  onUpdateProfile={handleUpdateProfile}
                />
              ) : (
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Desktop signin button clicked");
                    handleLogin();
                  }}
                  className="bg-laundrify-mint hover:bg-laundrify-mint/90 cursor-pointer text-laundrify-blue"
                  type="button"
                >
                  <User className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Active Order Status Bar - Zomato Style */}
        {activeOrder && !loadingActiveOrder && (
          <div className="mb-8 p-6 glass-panel border-blue-100">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Your Active Order</h3>
              <p className="text-sm text-gray-600">
                Order #{activeOrder.custom_order_id || activeOrder.order_id || "Order ID"}
              </p>
            </div>
            <OrderStatusBar
              riderStatus={mapStatusToRiderStatus(activeOrder.status)}
              bookingStatus={activeOrder.status}
              isOrderComplete={activeOrder.status === "completed" || activeOrder.status === "delivered"}
            />
            <div className="mt-4">
              <Button
                onClick={handleViewBookings}
                variant="outline"
                className="text-sm text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                View Full Details
              </Button>
            </div>
          </div>
        )}

        {/* Banner Carousel */}
        <BannerCarousel />

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-laundrify-purple to-laundrify-pink rounded-2xl text-white p-8 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4">
                Laundrify - Quick Clean & Convenient
              </h2>
              <p className="text-white/90 mb-6 text-lg">
                Quick Clean & Convenient thats laundrify - delivered to your doorstep in {deliveryTime}
              </p>
              <Button
                onClick={handleBookService}
                className="bg-laundrify-mint text-laundrify-blue hover:bg-laundrify-mint/90 font-semibold px-8 py-3 rounded-xl"
              >
                Browse Services
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                {(useStaticFallback
                  ? (serviceCategories || []).slice(1)
                  : dynamicServices || []
                )
                  .filter((category) => category.enabled !== false)
                  .slice(0, 4)
                  .map((category) => (
                    <div
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center cursor-pointer hover:bg-white/20 transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <span className="text-3xl block mb-2">
                        {category.icon}
                      </span>
                      <span className="text-sm font-medium">
                        {category.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Search and Categories */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-3 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-12 pr-12 py-3 rounded-xl border-gray-200 focus:border-laundrify-purple"
              />
              <Mic className="absolute right-4 top-3 h-5 w-5 text-gray-400 cursor-pointer hover:text-laundrify-purple" />
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
              className={`flex-shrink-0 rounded-xl font-medium shadow-md border ${
                selectedCategory === "all"
                  ? "bg-laundrify-purple text-white border-laundrify-purple shadow-lg"
                  : "bg-laundrify-mint/80 text-laundrify-blue border-laundrify-mint hover:bg-laundrify-mint hover:shadow-lg"
              }`}
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              All Services
            </Button>

            <Button
              onClick={() => navigate("/pg-booking")}
              className="flex-shrink-0 rounded-xl font-medium shadow-md border bg-gradient-to-r from-laundrify-pink to-laundrify-red text-white border-laundrify-red hover:from-laundrify-pink/90 hover:to-laundrify-red/90 hover:shadow-lg"
              title="PG Laundry & Iron Service"
            >
              <Home className="h-4 w-4 mr-2" />
              PG Service
            </Button>

            {(useStaticFallback
              ? (serviceCategories || []).slice(1)
              : dynamicServices || []
            )
              .filter((category) => category.enabled !== false)
              .map((category) => (
                <Button
                  key={category.id}
                  variant={
                    selectedCategory === category.id ? "default" : "outline"
                  }
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex-shrink-0 rounded-xl font-medium shadow-md border ${
                    selectedCategory === category.id
                      ? "bg-laundrify-purple text-white border-laundrify-purple shadow-lg"
                      : "bg-laundrify-mint/80 text-laundrify-blue border-laundrify-mint hover:bg-laundrify-mint hover:shadow-lg"
                  }`}
                >
                  <span className="mr-2">{category.icon}</span>
                  {category.name}
                </Button>
              ))}
          </div>
        </div>

        {/* Services Grid */}
        <div id="services-section">
          {getFilteredServices().length === 0 ? (
            <div className="flex justify-center py-12">
              <EmptyStateCard />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
              {getFilteredServices().map((service) => {
                const quantity = cart[service.id] || 0;

                return (
                  <Card
                    key={service.id}
                    className="card-compact overflow-hidden border-0"
                  >
                    <CardContent className="p-6">
                      <div className="aspect-square bg-gradient-to-br from-laundrify-mint/20 to-laundrify-mint/40 rounded-xl mb-4 flex items-center justify-center">
                        <span className="text-5xl">
                          {getCategoryDisplay(service.category).split(" ")[0]}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-lg text-gray-900 leading-tight">
                          {service.name}
                        </h4>

                        <div className="text-sm text-gray-600">
                          {getCategoryDisplay(service.category)}
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-2xl font-bold text-gray-900">
                              ₹{service.price}
                            </span>
                            <span className="text-sm text-gray-600 ml-1">
                              {service.unit}
                            </span>
                          </div>

                          {service.popular && (
                            <Badge className="bg-laundrify-yellow/20 text-laundrify-blue">
                              <Star className="w-3 h-3 mr-1 fill-current" />
                              Popular
                            </Badge>
                          )}
                        </div>

                        {service.minQuantity && service.minQuantity > 1 && (
                          <div className="text-sm text-orange-600">
                            Min {service.minQuantity}
                            {service.unit.includes("kg") ? "kg" : " pcs"}
                          </div>
                        )}

                        {quantity > 0 ? (
                          <div className="flex items-center justify-between bg-laundrify-mint/20 rounded-lg p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(service.id)}
                              className="h-8 w-8 p-0 text-green-600 hover:bg-green-100"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>

                            <span className="font-semibold text-laundrify-blue text-lg">
                              {quantity}
                            </span>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addToCart(service.id)}
                              className="h-8 w-8 p-0 text-green-600 hover:bg-green-100"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => addToCart(service.id)}
                            className="w-full bg-laundrify-mint hover:bg-laundrify-mint/90 text-laundrify-blue rounded-xl py-3 font-semibold"
                          >
                            ADD TO CART
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Floating Cart Button - Desktop */}
        {getCartItemCount() > 0 && (
          <div className="fixed bottom-8 right-8 z-50">
            <Button
              onClick={onViewCart}
              className="bg-laundrify-mint hover:bg-laundrify-mint/90 text-laundrify-blue rounded-2xl py-4 px-6 flex items-center gap-3 shadow-lg hover:shadow-xl transition-all"
            >
              <ShoppingBag className="h-5 w-5" />
              <div>
                <div className="font-semibold">
                  {getCartItemCount()} item{getCartItemCount() > 1 ? "s" : ""}
                </div>
                <div className="text-sm opacity-90">���{getCartTotal()}</div>
              </div>
            </Button>
          </div>
        )}

        {/* Authentication Modal */}
        {console.log(
          "Rendering PhoneOtpAuthModal, showAuthModal:",
          showAuthModal,
        )}
        <PhoneOtpAuthModal
          isOpen={showAuthModal}
          onClose={() => {
            console.log("PhoneOtpAuthModal onClose called");
            setShowAuthModal(false);
          }}
          onSuccess={handleAuthSuccess}
        />

        {showUserPackages && currentUser && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <UserPackages currentUser={currentUser} onClose={() => setShowUserPackages(false)} />
             </div>
          </div>
        )}

        {/* Removed local booking history modal - using main navigation */}

        {/* Debug Panel */}
        <DebugPanel
          isOpen={showDebugPanel}
          onClose={() => setShowDebugPanel(false)}
        />

        {/* Booking Debug Panel */}
        <BookingDebugPanel
          currentUser={currentUser}
          isOpen={showBookingDebugPanel}
          onClose={() => setShowBookingDebugPanel(false)}
        />

        {/* Admin Services Manager */}
        {showAdminServices && (
          <AdminServicesManager onClose={() => setShowAdminServices(false)} />
        )}

        {/* Connection Status */}
        <ConnectionStatus />

        {/* Location Unavailable Modal */}
        <LocationUnavailableModal
          isOpen={showLocationUnavailable}
          onClose={() => setShowLocationUnavailable(false)}
          detectedLocation={detectedLocationText}
          onExplore={() => {
            console.log("🔍 User chose to explore available services");
            // You can add navigation logic here if needed
          }}
        />

        {/* Floating Action Buttons */}
        <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-3">
          {/* WhatsApp Button */}
          <Button
            onClick={() => {
              const phoneNumber = "917011585587"; // Replace with your WhatsApp business number
              const message = encodeURIComponent("Hi! I need help with laundry services.");
              window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
            }}
            className="bg-green-500 hover:bg-green-600 text-white rounded-full w-12 h-12 p-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
            title="Chat with us on WhatsApp"
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        </div>

        {/* Customer Verification Popup */}
        <CustomerVerificationPopup
          isOpen={isVerificationPopupOpen}
          onClose={hideVerificationPopup}
          verification={currentVerification}
          onVerificationComplete={handleVerificationComplete}
        />

        {/* Verification Alert Banner */}
        {pendingCount > 0 && (
          <div className="fixed top-16 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96">
            <div className="bg-orange-500 text-white p-4 rounded-lg shadow-lg border border-orange-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <div>
                    <p className="font-semibold">Order Changes Need Approval</p>
                    <p className="text-sm text-orange-100">
                      {pendingCount} verification{pendingCount > 1 ? 's' : ''} pending
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => showVerificationPopup()}
                  className="bg-white text-orange-600 hover:bg-orange-50"
                >
                  Review
                </Button>
              </div>
            </div>
          </div>
        )}

    </div>
      </div>
  );
};
export default ResponsiveLaundryHome;
