import React, { useState, useEffect } from "react";
import ResponsiveLaundryHome from "../components/ResponsiveLaundryHome";
import LaundryCart from "../components/LaundryCart";
import EnhancedBookingHistory from "@/components/EnhancedBookingHistory";
import PhoneOtpAuthModal from "@/components/PhoneOtpAuthModal";
import BookingConfirmed from "@/components/BookingConfirmed";
import { BookingService } from "@/services/bookingService";
import { bookingHelpers } from "@/integrations/mongodb/bookingHelpers";

import LaundrifySplashLoader from "@/components/LaundrifySplashLoader";
import { DVHostingSmsService } from "../services/dvhostingSmsService";
import PushNotificationService from "../services/pushNotificationService";
import { LocationTrackingService } from "../services/locationTrackingService";

import { useNotifications } from "@/contexts/NotificationContext";
import {
  createSuccessNotification,
  createErrorNotification,
} from "@/utils/notificationUtils";

// Helper function for coordinate-based location detection (fallback)
const getCoordinateBasedLocation = (
  latitude: number,
  longitude: number,
): string => {
  console.log(
    `🎯 Using coordinate-based fallback for: ${latitude}, ${longitude}`,
  );

  // Check if coordinates are within India
  if (latitude >= 8 && latitude <= 37 && longitude >= 68 && longitude <= 97) {
    // Rough approximations for major Indian cities
    if (
      latitude >= 28.4 &&
      latitude <= 28.8 &&
      longitude >= 76.8 &&
      longitude <= 77.3
    ) {
      return "Delhi";
    } else if (
      latitude >= 18.8 &&
      latitude <= 19.3 &&
      longitude >= 72.7 &&
      longitude <= 73.0
    ) {
      return "Mumbai";
    } else if (
      latitude >= 12.8 &&
      latitude <= 13.1 &&
      longitude >= 77.4 &&
      longitude <= 77.8
    ) {
      return "Bangalore";
    } else if (
      latitude >= 22.4 &&
      latitude <= 22.7 &&
      longitude >= 88.2 &&
      longitude <= 88.5
    ) {
      return "Kolkata";
    } else if (
      latitude >= 17.2 &&
      latitude <= 17.6 &&
      longitude >= 78.2 &&
      longitude <= 78.7
    ) {
      return "Hyderabad";
    } else if (
      latitude >= 13.0 &&
      latitude <= 13.2 &&
      longitude >= 80.1 &&
      longitude <= 80.3
    ) {
      return "Chennai";
    } else {
      return "India"; // Generic fallback for India
    }
  }

  // For international coordinates, return a generic location
  return "Your Location";
};

// Helper function for reverse geocoding with multiple fallbacks
const getReverseGeocodedLocation = async (
  latitude: number,
  longitude: number,
): Promise<string> => {
  console.log(`🔄 Attempting reverse geocoding for: ${latitude}, ${longitude}`);

  // Check if we're in a hosted environment where external APIs might fail
  const isHostedEnv =
    window.location.hostname.includes("fly.dev") ||
    window.location.hostname.includes("builder.codes");

  if (isHostedEnv) {
    console.log(
      "🌐 Hosted environment - using coordinates instead of geocoding",
    );
    return `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }

  // Method 1: Try Google Maps API if available
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    try {
      console.log("🗺️ Trying Google Maps API...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}`,
        {
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const result = data.results[0];

          // Extract city from address components
          const cityComponent = result.address_components?.find(
            (component: any) =>
              component.types.includes("locality") ||
              component.types.includes("administrative_area_level_2"),
          );

          const stateComponent = result.address_components?.find(
            (component: any) =>
              component.types.includes("administrative_area_level_1"),
          );

          if (cityComponent) {
            const location =
              stateComponent &&
              cityComponent.long_name !== stateComponent.long_name
                ? `${cityComponent.long_name}, ${stateComponent.long_name}`
                : cityComponent.long_name;
            console.log("✅ Google Maps success:", location);
            return location;
          }
        }
      }
    } catch (error) {
      console.log("❌ Google Maps geocoding failed:", error);
    }
  }

  // Method 2: Try OpenStreetMap with better error handling
  try {
    console.log("🌍 Trying OpenStreetMap API...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Longer timeout for OSM

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "CleanCare-App/1.0",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      if (data.address) {
        const city =
          data.address.city ||
          data.address.town ||
          data.address.village ||
          data.address.suburb;

        const state = data.address.state;

        if (city) {
          const location = state && city !== state ? `${city}, ${state}` : city;
          console.log("✅ OpenStreetMap success:", location);
          return location;
        } else if (state) {
          console.log("✅ OpenStreetMap success (state only):", state);
          return state;
        }
      }
    }
  } catch (error) {
    console.log("❌ OpenStreetMap geocoding failed:", error);
  }

  // Method 3: Use coordinate-based fallback
  console.log("🎯 Using coordinate-based location detection...");
  return getCoordinateBasedLocation(latitude, longitude);
};

const LaundryIndex = () => {
  const { addNotification } = useNotifications();
  const [currentView, setCurrentView] = useState<
    "home" | "cart" | "bookings" | "auth" | "booking-confirmed"
  >("home");
  const [previousView, setPreviousView] = useState<
    "home" | "cart" | "bookings"
  >("home");
  const [lastBookingData, setLastBookingData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<string>("");

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const authService = DVHostingSmsService.getInstance();
  const pushService = PushNotificationService.getInstance();
  const locationTracker = LocationTrackingService.getInstance();


  // Initialize PWA and check auth state
  useEffect(() => {
    initializeApp();
    checkAuthState();
    getUserLocation();
    checkFirst30Notification();
    checkReferralCodeInUrl();

    // Listen for auth events from other tabs or auth persistence
    const handleAuthLogin = (event: CustomEvent) => {
      console.log("🎉 Auth login event received");
      checkAuthState(); // Refresh auth state
    };

    const handleAuthLogout = () => {
      console.log("🚪 Auth logout event received");
      setIsLoggedIn(false);
      setCurrentUser(null);
      setCurrentView("home");
    };

    // Handle referral notifications
    const handleReferralBonus = (event: CustomEvent) => {
      const { bonusCoupon } = event.detail;
      addNotification(
        createSuccessNotification(
          "Referral Bonus Earned! 🎉",
          `You've earned a ${bonusCoupon.discount}% discount coupon (${bonusCoupon.code}) for referring a friend!`,
        ),
      );
    };

    window.addEventListener("auth-login", handleAuthLogin as EventListener);
    window.addEventListener("auth-logout", handleAuthLogout);
    window.addEventListener(
      "referralBonusAwarded",
      handleReferralBonus as EventListener,
    );

    // Handle iOS session restoration
    const handleIOSSessionRestore = () => {
      console.log("📱 iOS session restoration event received");
      checkAuthState(); // Refresh auth state from localStorage
    };

    window.addEventListener("ios-session-restored", handleIOSSessionRestore);

    return () => {
      window.removeEventListener(
        "auth-login",
        handleAuthLogin as EventListener,
      );
      window.removeEventListener("auth-logout", handleAuthLogout);
      window.removeEventListener(
        "referralBonusAwarded",
        handleReferralBonus as EventListener,
      );
      window.removeEventListener(
        "ios-session-restored",
        handleIOSSessionRestore,
      );
    };
  }, []);

  const initializeApp = async () => {
    // Show loader for minimum 2 seconds for better UX
    setTimeout(() => {
      setIsInitialLoading(false);
    }, 2000);

    // Initialize PWA features
    await pushService.initializePWA();

    // Add manifest link to head if not present
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = "/manifest.json";
      document.head.appendChild(manifestLink);
    }

    // Add theme color meta tag
    if (!document.querySelector('meta[name="theme-color"]')) {
      const themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      themeColorMeta.content = "#C46DD8";
      document.head.appendChild(themeColorMeta);
    }
  };

  const checkFirst30Notification = () => {

  };

  const checkReferralCodeInUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode && refCode.trim()) {
      console.log('🎁 Referral code detected in URL:', refCode);

      // Check if user is already logged in
      if (isLoggedIn && currentUser) {
        console.log('ℹ️ User already logged in, referral code detected but not auto-opening modal');
        return;
      }

      // Add a small delay to ensure the page is fully loaded, then show auth modal
      setTimeout(() => {
        console.log('🎁 Auto-opening auth modal for referral code:', refCode);
        setCurrentView("auth");
      }, 1000);
    }
  };

  const checkAuthState = async () => {
    try {
      console.log("🔍 Checking authentication state...");

      // First, always check localStorage directly for auth data
      const token =
        localStorage.getItem("auth_token") ||
        localStorage.getItem("cleancare_auth_token");
      const userStr =
        localStorage.getItem("current_user") ||
        localStorage.getItem("cleancare_user");

      // If we have both token and user data, restore session immediately
      if (token && userStr) {
        try {
          const storedUser = JSON.parse(userStr);
          if (
            storedUser &&
            (storedUser.phone || storedUser.id || storedUser._id)
          ) {
            setCurrentUser(storedUser);
            setIsLoggedIn(true);
            console.log("✅ User session restored from localStorage:", {
              phone: storedUser.phone,
              name: storedUser.name,
              id: storedUser.id || storedUser._id,
            });

            // Ensure auth service has the latest data
            authService.setCurrentUser(storedUser, token);
            return; // Exit early - user is authenticated
          }
        } catch (parseError) {
          console.warn("��️ Error parsing stored user data:", parseError);
        }
      }

      // Fallback: check auth service state
      const user = authService.getCurrentUser();
      const isAuth = authService.isAuthenticated();

      if (isAuth && user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        console.log("✅ User authentication confirmed via auth service:", {
          phone: user.phone,
          name: user.name,
          isVerified: user.isVerified,
        });
      } else {
        // Only log state, never automatically clear login
        console.log("ℹ️ No valid authentication data found");
        console.log("🔒 Preserving current login state to prevent auto-logout");
        // Don't call setIsLoggedIn(false) or setCurrentUser(null) here
      }
    } catch (error) {
      console.error("Error checking auth state:", error);
      // Never auto-logout on errors - always preserve existing state
      console.warn("🔒 Preserving current auth state despite error");
    }
  };

// Enhanced function to get detailed location information
const getDetailedLocationInfo = async (
  latitude: number,
  longitude: number,
): Promise<{
  fullAddress: string;
  displayLocation: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
} | null> => {
  console.log(`🔄 Getting detailed location info for: ${latitude}, ${longitude}`);

  // Check if we're in a hosted environment where external APIs might fail
  const isHostedEnv =
    window.location.hostname.includes("fly.dev") ||
    window.location.hostname.includes("builder.codes");

  if (isHostedEnv) {
    console.log("🌐 Hosted environment - using coordinates only");
    const coordsStr = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    return {
      fullAddress: `Location: ${coordsStr}`,
      displayLocation: `Location: ${coordsStr}`,
    };
  }

  // Method 1: Try Google Maps API if available
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    try {
      console.log("🗺️ Trying Google Maps API for detailed info...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const components = result.address_components || [];

          const cityComponent = components.find((c: any) =>
            c.types.includes("locality") || c.types.includes("administrative_area_level_2"),
          );
          const stateComponent = components.find((c: any) =>
            c.types.includes("administrative_area_level_1"),
          );
          const countryComponent = components.find((c: any) =>
            c.types.includes("country"),
          );
          const pincodeComponent = components.find((c: any) =>
            c.types.includes("postal_code"),
          );

          const city = cityComponent?.long_name;
          const state = stateComponent?.long_name;
          const country = countryComponent?.long_name;
          const pincode = pincodeComponent?.long_name;

          const displayLocation = city && state && city !== state
            ? `${city}, ${state}`
            : city || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;

          return {
            fullAddress: result.formatted_address,
            displayLocation,
            city,
            state,
            country,
            pincode,
          };
        }
      }
    } catch (error) {
      console.log("❌ Google Maps detailed geocoding failed:", error);
    }
  }

  // Method 2: Try OpenStreetMap
  try {
    console.log("🌍 Trying OpenStreetMap for detailed info...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "CleanCare-App/1.0",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      if (data.address) {
        const city = data.address.city || data.address.town || data.address.village;
        const state = data.address.state;
        const country = data.address.country;
        const pincode = data.address.postcode;

        const displayLocation = city && state && city !== state
          ? `${city}, ${state}`
          : city || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;

        return {
          fullAddress: data.display_name || `${latitude}, ${longitude}`,
          displayLocation,
          city,
          state,
          country,
          pincode,
        };
      }
    }
  } catch (error) {
    console.log("❌ OpenStreetMap detailed geocoding failed:", error);
  }

  console.log("⚠️ All geocoding methods failed, using coordinates");
  const coordsStr = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  return {
    fullAddress: coordsStr,
    displayLocation: coordsStr,
  };
};

  const getUserLocation = async () => {
    setCurrentLocation("Detecting location...");

    if (!navigator.geolocation) {
      setCurrentLocation("India");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          // Store coordinates for later use
          console.log(`📍 Location coordinates: ${latitude}, ${longitude}`);

          // Set coordinates immediately for a quick response
          setCurrentLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);

          // Prepare location data for saving
          let locationData = {
            latitude,
            longitude,
            fullAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            detectionMethod: 'gps' as const,
          };

          // Try to get readable address with multiple fallbacks
          try {
            const addressResult = await getDetailedLocationInfo(latitude, longitude);

            if (addressResult) {
              // Update location data with detailed info
              locationData = {
                ...locationData,
                fullAddress: addressResult.fullAddress,
                city: addressResult.city,
                state: addressResult.state,
                country: addressResult.country,
                pincode: addressResult.pincode,
              };

              setCurrentLocation(addressResult.displayLocation);
              console.log("✅ Final location set:", addressResult.displayLocation);
            } else {
              console.log("🔍 Using coordinate fallback");
              setCurrentLocation(
                `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
              );
            }
          } catch (geocodeError) {
            console.warn("Geocoding failed, using coordinates:", geocodeError);
            setCurrentLocation(
              `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
            );
          }

          // Save location for anonymous users (if not logged in)
          if (!currentUser) {
            try {
              await locationTracker.saveAnonymousLocation(locationData);
              // Also store for later use when user logs in
              locationTracker.storeLocationForLater(locationData);
            } catch (error) {
              console.error("Failed to save anonymous location:", error);
            }
          } else {
            // If user is already logged in, save as logged-in user location
            try {
              await locationTracker.saveLoggedInUserLocation({
                ...locationData,
                userId: currentUser._id || currentUser.id,
                phone: currentUser.phone,
                name: currentUser.name || currentUser.full_name || 'Unknown',
              });
            } catch (error) {
              console.error("Failed to save logged-in user location:", error);
            }
          }
        } catch (error) {
          console.error("Location processing error:", error);
          setCurrentLocation("Location unavailable");
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setCurrentLocation("Location access denied");
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000,
      },
    );
  };

  const handleLoginSuccess = async (user: any) => {
    setCurrentUser(user);
    setIsLoggedIn(true);

    // Return to the previous view instead of always going to home
    const targetView = previousView || "home";
    setCurrentView(targetView);

    console.log("✅ User logged in successfully:", user.name || user.phone);
    console.log("📍 Redirecting to:", targetView);

    // Save user location if we have stored location data
    try {
      const storedLocation = locationTracker.getStoredLocation();
      if (storedLocation) {
        console.log("📍 Found stored location, saving for logged-in user:", storedLocation);

        await locationTracker.saveLoggedInUserLocation({
          ...storedLocation,
          userId: user._id || user.id,
          phone: user.phone,
          name: user.name || user.full_name || 'Unknown',
        });

        // Clear the stored location since we've used it
        locationTracker.clearStoredLocation();
      } else {
        // If no stored location, try to get current location for the logged-in user
        console.log("📍 No stored location found, getting current location for logged-in user");
        // Note: getUserLocation will now automatically save for logged-in users
      }
    } catch (error) {
      console.error("Failed to save logged-in user location:", error);
    }

    // Add success notification
    addNotification(
      createSuccessNotification(
        "Welcome!",
        `Hello ${user.name || user.phone}, you're now logged in.`,
      ),
    );
  };

  const handleLogout = () => {
    // Import iOS fixes and clear state for iPhone compatibility
    import("../utils/iosAuthFix").then(({ clearIosAuthState }) => {
      clearIosAuthState();
    });

    authService.logout();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentView("home");
    console.log("✅ User logged out");

    // Add logout notification
    addNotification(
      createSuccessNotification(
        "Goodbye!",
        "You have been logged out successfully.",
      ),
    );
  };

  const handleViewCart = () => {
    setCurrentView("cart");
  };

  const handleViewBookings = () => {
    if (!currentUser) {
      // Auto-redirect to auth view
      console.log("User not authenticated, showing auth view");
      setPreviousView("bookings");
      setCurrentView("auth");
      return;
    }
    setCurrentView("bookings");
  };

  const handleLoginRequired = (fromView: "cart" | "bookings" = "cart") => {
    setPreviousView(fromView);
    setCurrentView("auth");
  };

  const [isProcessingGlobalCheckout, setIsProcessingGlobalCheckout] =
    useState(false);

  const handleProceedToCheckout = async (cartData: any) => {
    // Prevent multiple submissions at the parent level too
    if (isProcessingGlobalCheckout) {
      console.log("⚠️ Global checkout already in progress, ignoring duplicate");
      return;
    }

    // Check if user is authenticated first
    if (!currentUser) {
      console.log("User not authenticated, switching to auth view");
      setCurrentView("auth");
      return;
    }

    setIsProcessingGlobalCheckout(true);
    console.log("Processing checkout for authenticated user:", cartData);

    // Add loading notification
    addNotification(
      createSuccessNotification(
        "Processing Order",
        "Creating your booking, please wait...",
      ),
    );

    try {
      // Access booking helpers and service
      const bookingService = BookingService.getInstance();

      // Prepare services array for MongoDB with quantities
      const servicesArray =
        cartData.services?.map((service: any) => {
          if (typeof service === "string") {
            return service;
          }
          return service.quantity > 1
            ? `${service.name} x${service.quantity}`
            : service.name;
        }) || [];

      // Prepare detailed services for confirmation
      const detailedServices =
        cartData.services?.map((service: any) => ({
          name: typeof service === "string" ? service : service.name,
          quantity: typeof service === "object" ? service.quantity || 1 : 1,
          price: typeof service === "object" ? service.price || 0 : 0,
        })) || [];

      // Prepare item prices for accurate booking history
      const itemPrices = detailedServices.map((service) => ({
        service_name: service.name,
        quantity: service.quantity,
        unit_price: service.price,
        total_price: service.price * service.quantity,
      }));

      // Create booking data for MongoDB backend
      const mongoBookingData = {
        customer_id: currentUser._id || currentUser.id,
        service: servicesArray[0] || "Laundry Service",
        service_type: "laundry",
        services: servicesArray,
        scheduled_date: cartData.pickupDate,
        scheduled_time: cartData.pickupTime,
        delivery_date: cartData.deliveryDate,
        delivery_time: cartData.deliveryTime,
        provider_name: "CleanCare Pro",
        address:
          typeof cartData.address === "string"
            ? cartData.address
            : cartData.address?.fullAddress || "",
        coordinates: cartData.address?.coordinates || { lat: 0, lng: 0 },
        additional_details: cartData.instructions || "",
        total_price: cartData.original_total || cartData.totalAmount,
        discount_amount: cartData.discount_amount || 0,
        final_amount: cartData.totalAmount,
        coupon_code: cartData.coupon_code || null,
        special_instructions: cartData.instructions || "",
        charges_breakdown: cartData.charges_breakdown || {
          base_price: cartData.original_total || cartData.totalAmount,
          delivery_fee: 0,
          handling_fee: 0,
          discount: cartData.discount_amount || 0,
        },
        // Save item prices for accurate booking history display
        item_prices: itemPrices,
      };

      // Save to MongoDB backend first
      console.log("💾 Saving to MongoDB backend...");
      console.log(
        "📤 MongoDB booking data:",
        JSON.stringify(mongoBookingData, null, 2),
      );
      const mongoResult = await bookingHelpers.createBooking(mongoBookingData);

      if (mongoResult.data) {
        console.log(
          "✅ Booking saved to MongoDB:",
          mongoResult.data.custom_order_id ||
            mongoResult.data._id ||
            "unknown_id",
        );

        // Google Sheets integration removed

        // Also save using booking service for local storage backup
        const localBookingData = {
          userId: currentUser._id || currentUser.id || currentUser.phone,
          services: servicesArray,
          totalAmount: cartData.totalAmount,
          status: "pending" as const,
          pickupDate: cartData.pickupDate,
          deliveryDate: cartData.deliveryDate ?? cartData.pickupDate,
          pickupTime: cartData.pickupTime,
          deliveryTime: cartData.deliveryTime ?? cartData.pickupTime,
          address:
            typeof cartData.address === "string"
              ? cartData.address
              : cartData.address?.fullAddress ||
                JSON.stringify(cartData.address),
          contactDetails: {
            phone: cartData.phone || currentUser.phone,
            name: currentUser.full_name || currentUser.name || "User",
            instructions: cartData.instructions,
          },
          paymentStatus: "pending" as const,
        };

        const localResult = await bookingService.createBooking(
          localBookingData,
          itemPrices,
        );
        console.log("📝 Local booking result:", localResult);

        // Store booking data for confirmation screen
        const confirmationData = {
          bookingId:
            mongoResult.data.custom_order_id ||
            mongoResult.data._id ||
            `local_${Date.now()}`,
          custom_order_id: mongoResult.data.custom_order_id, // Add custom_order_id field
          services: detailedServices, // Use detailed services with quantities
          totalAmount: cartData.totalAmount,
          pickupDate: cartData.pickupDate,
          pickupTime: cartData.pickupTime,
          address: cartData.address,
          customerName: currentUser.full_name || currentUser.name || "Customer",
          customerPhone: currentUser.phone,
        };

        setLastBookingData(confirmationData);

        // Show success message
        addNotification(
          createSuccessNotification(
            "Order Confirmed!",
            `Your order has been placed successfully! Booking ID: ${confirmationData.bookingId ? confirmationData.bookingId.slice(-6) : "N/A"}`,
          ),
        );

        // Clear cart and form data
        localStorage.removeItem("laundry_cart");
        localStorage.removeItem("mobile_service_cart");
        localStorage.removeItem("service_cart");
        localStorage.removeItem("cleancare_cart");
        localStorage.removeItem("laundry_booking_form");
        localStorage.removeItem("cleancare_booking_form");
        localStorage.removeItem("user_bookings"); // Clear cached bookings

        // Clear any cached cart state
        const clearCartEvent = new CustomEvent("clearCart");
        window.dispatchEvent(clearCartEvent);

        // Trigger booking history refresh
        const refreshBookingsEvent = new CustomEvent("refreshBookings");
        window.dispatchEvent(refreshBookingsEvent);

        // Show booking confirmation screen
        setCurrentView("booking-confirmed");
      } else {
        // If MongoDB fails, still try to save locally
        console.warn(
          "❌ MongoDB booking failed, saving locally:",
          mongoResult.error,
        );

        const localBookingData = {
          userId: currentUser._id || currentUser.id || currentUser.phone,
          services: servicesArray,
          totalAmount: cartData.totalAmount,
          status: "pending" as const,
          pickupDate: cartData.pickupDate,
          deliveryDate: cartData.deliveryDate,
          pickupTime: cartData.pickupTime,
          deliveryTime: cartData.deliveryTime,
          address: cartData.address,
          contactDetails: {
            phone: cartData.phone || currentUser.phone,
            name: currentUser.full_name || currentUser.name || "User",
            instructions: cartData.instructions,
          },
          paymentStatus: "pending" as const,
          // Add item prices for accurate history display
          item_prices: itemPrices,
        };

        const localResult = await bookingService.createBooking(
          localBookingData,
          itemPrices,
        );
        console.log("📝 Fallback local booking result:", localResult);

        if (localResult.success) {
          // Google Sheets fallback removed

          // Store booking data for confirmation screen
          const confirmationData = {
            bookingId: `local_${Date.now()}`,
            custom_order_id:
              localResult.data?.custom_order_id ||
              `CC${Date.now().toString().slice(-6)}`, // Add custom_order_id for local bookings
            services: detailedServices, // Use detailed services with quantities
            totalAmount: cartData.totalAmount,
            pickupDate: cartData.pickupDate,
            pickupTime: cartData.pickupTime,
            address: cartData.address,
            customerName:
              currentUser.full_name || currentUser.name || "Customer",
            customerPhone: currentUser.phone,
          };

          setLastBookingData(confirmationData);

          // Show success but mention it will sync later
          addNotification(
            createSuccessNotification(
              "Order Saved!",
              "Your order has been saved successfully!",
            ),
          );

          // Clear cart
          localStorage.removeItem("laundry_cart");
          localStorage.removeItem("mobile_service_cart");
          localStorage.removeItem("service_cart");
          localStorage.removeItem("cleancare_cart");

          // Show booking confirmation screen
          setCurrentView("booking-confirmed");
        } else {
          console.error("❌ Local booking also failed:", localResult.error);

          // Google Sheets backup removed - continue with local-only booking

          throw new Error(
            localResult.error ||
              mongoResult.error?.message ||
              "Failed to create booking",
          );
        }
      }
    } catch (error) {
      console.error("Checkout failed:", error);

      let errorMessage = "Failed to place order. Please try again.";
      let errorTitle = "Order Failed";

      if (error instanceof Error) {
        if (error.message.includes("User ID not found")) {
          errorTitle = "Authentication Issue";
          errorMessage = "Please sign in again to place your order.";
        } else if (
          error.message.includes("Network error") ||
          error.message.includes("fetch")
        ) {
          errorTitle = "Connection Issue";
          errorMessage = "Please check your internet connection and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      addNotification(createErrorNotification(errorTitle, errorMessage));
    } finally {
      setIsProcessingGlobalCheckout(false);
    }
  };

  // Show splash loader on initial load
  if (isInitialLoading) {
    return <LaundrifySplashLoader isVisible={true} message="Initializing Laundrify..." />;
  }

  return (
    <div className="min-h-screen">


      {currentView === "home" && (
        <>




          <ResponsiveLaundryHome
            currentUser={currentUser}
            userLocation={currentLocation}
            onLoginSuccess={handleLoginSuccess}
            onViewCart={handleViewCart}
            onViewBookings={handleViewBookings}
            onLogout={handleLogout}
          />
        </>
      )}

      {/* Authentication View */}
      {currentView === "auth" && (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <PhoneOtpAuthModal
              isOpen={true}
              onClose={() =>
                setCurrentView(previousView === "cart" ? "cart" : "home")
              }
              onSuccess={(user) => {
                handleLoginSuccess(user);
                // Return to the view they were trying to access
                setCurrentView(previousView);
              }}
            />
          </div>
        </div>
      )}

      {currentView === "bookings" && (
        <EnhancedBookingHistory
          currentUser={currentUser}
          onBack={() => setCurrentView("home")}
          onLoginRequired={() => handleLoginRequired("bookings")}
        />
      )}

      {currentView === "cart" && (
        <LaundryCart
          onBack={() => setCurrentView("home")}
          onProceedToCheckout={handleProceedToCheckout}
          onLoginRequired={() => handleLoginRequired("cart")}
          currentUser={currentUser}
        />
      )}

      {currentView === "booking-confirmed" && lastBookingData && (
        <BookingConfirmed
          bookingData={lastBookingData}
          onGoHome={() => setCurrentView("home")}
          onViewBookings={() => setCurrentView("bookings")}
        />
      )}
    </div>
  );
};

export default LaundryIndex;
