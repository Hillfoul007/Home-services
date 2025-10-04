import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  createSuccessNotification,
  createErrorNotification,
  createWarningNotification,
} from "@/utils/notificationUtils";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Clock,
  User,
  Phone,
  Calendar,
  Loader2,
  CreditCard,
  Home,
} from "lucide-react";
import {
  laundryServices,
  LaundryService,
  getCategoryDisplay,
} from "@/data/laundryServices";
import { OTPAuthService } from "@/services/otpAuthService";

import {
  saveBookingFormData,
  getBookingFormData,
  saveCartData,
  getCartData,
} from "@/utils/formPersistence";
import SimplifiedAddressForm from "./SimplifiedAddressForm";
import ProfessionalDateTimePicker from "./ProfessionalDateTimePicker";
import DeliveryDateTimePicker from "./DeliveryDateTimePicker";
import {
  FormValidation,
  validateCheckoutForm,
  validateCheckoutFormWithLocation,
} from "./FormValidation";
import LocationUnavailableModal from "./LocationUnavailableModal";
import SavedAddressesModal from "./SavedAddressesModal";
import ZomatoAddressSelector from "./ZomatoAddressSelector";
import ZomatoAddAddressPage from "./ZomatoAddAddressPage";
import { AddressService } from "@/services/addressService";
import { SessionManager } from "@/utils/sessionManager";
import { CouponService } from "@/services/couponService";


interface LaundryCartProps {
  onBack: () => void;
  onProceedToCheckout: (cartData: any) => void;
  onLoginRequired?: () => void;
  currentUser?: any;
}

const LaundryCart: React.FC<LaundryCartProps> = ({
  onBack,
  onProceedToCheckout,
  onLoginRequired,
  currentUser,
}) => {
  const { addNotification } = useNotifications();
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [addressData, setAddressData] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [deliveryTime, setDeliveryTime] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    maxDiscount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");


  // Location availability modal state
  const [showLocationUnavailable, setShowLocationUnavailable] = useState(false);
  const [unavailableLocationText, setUnavailableLocationText] = useState("");

  const authService = OTPAuthService.getInstance();
  const couponService = CouponService.getInstance();


  // Load saved form data on component mount (excluding date autofill)
  useEffect(() => {
    const savedFormData = getBookingFormData();

    // Don't autofill date - let user select fresh
    if (savedFormData.selectedTime) setSelectedTime(savedFormData.selectedTime);
    if (savedFormData.deliveryDate)
      setDeliveryDate(new Date(savedFormData.deliveryDate));
    if (savedFormData.deliveryTime) setDeliveryTime(savedFormData.deliveryTime);
    if (savedFormData.additionalDetails)
      setSpecialInstructions(savedFormData.additionalDetails);
    if (savedFormData.couponCode) setCouponCode(savedFormData.couponCode);
    if (savedFormData.appliedCoupon) setAppliedCoupon(savedFormData.appliedCoupon);

  }, []);

  // Auto-save form data when it changes
  useEffect(() => {
    saveBookingFormData({
      selectedDate,
      selectedTime,
      deliveryDate,
      deliveryTime,
      additionalDetails: specialInstructions,
      couponCode,
      appliedCoupon,

    });
  }, [
    selectedDate,
    selectedTime,
    deliveryDate,
    deliveryTime,
    specialInstructions,
    couponCode,
    appliedCoupon,
  ]);

  // Listen for cart clearing events
  useEffect(() => {
    const handleClearCart = () => {
      console.log("🧹 Received cart clear event");
      setCart({});
      localStorage.removeItem("laundry_cart");
      localStorage.removeItem("mobile_service_cart");
      localStorage.removeItem("service_cart");
      localStorage.removeItem("cleancare_cart");
    };

    const handleLogout = () => {
      console.log("🚪 Logout detected - clearing cart and form data");
      setCart({});
      setAddressData(null);
      setPhoneNumber("");
      setSpecialInstructions("");
      setSelectedDate(undefined);
      setSelectedTime("");
      setDeliveryDate(undefined);
      setDeliveryTime("");
      setCouponCode("");
      setAppliedCoupon(null);
      setSelectedSavedAddress(null);
    };

    window.addEventListener("clearCart", handleClearCart);
    window.addEventListener("auth-logout", handleLogout);

    return () => {
      window.removeEventListener("clearCart", handleClearCart);
      window.removeEventListener("auth-logout", handleLogout);
    };
  }, []);

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem("laundry_cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    // Pre-fill user data
    if (currentUser) {
      setPhoneNumber(currentUser.phone || "");

      // Restore checkout form state after login
      const savedState = localStorage.getItem("checkout_form_state");
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          // Only restore if saved within last 30 minutes
          if (Date.now() - state.timestamp < 30 * 60 * 1000) {
            if (state.addressData) setAddressData(state.addressData);
            if (state.phoneNumber && !phoneNumber)
              setPhoneNumber(state.phoneNumber);
            if (state.selectedDate)
              setSelectedDate(new Date(state.selectedDate));
            if (state.selectedTime) setSelectedTime(state.selectedTime);
            if (state.deliveryDate)
              setDeliveryDate(new Date(state.deliveryDate));
            if (state.deliveryTime) setDeliveryTime(state.deliveryTime);
            if (state.specialInstructions)
              setSpecialInstructions(state.specialInstructions);


            console.log("���� Restored checkout form state after login");
          }
          localStorage.removeItem("checkout_form_state");
        } catch (error) {
          console.error("Failed to restore checkout state:", error);
        }
      }

      // Handle address flow after login
      const addressFlowState = localStorage.getItem("address_flow_state");
      if (addressFlowState) {
        try {
          const state = JSON.parse(addressFlowState);
          // Only restore if saved within last 30 minutes
          if (Date.now() - state.timestamp < 30 * 60 * 1000) {
            if (state.addressData) setAddressData(state.addressData);
            if (state.phoneNumber && !phoneNumber)
              setPhoneNumber(state.phoneNumber);
            if (state.selectedDate)
              setSelectedDate(new Date(state.selectedDate));
            if (state.selectedTime) setSelectedTime(state.selectedTime);
            if (state.deliveryDate)
              setDeliveryDate(new Date(state.deliveryDate));
            if (state.deliveryTime) setDeliveryTime(state.deliveryTime);
            if (state.specialInstructions)
              setSpecialInstructions(state.specialInstructions);


            // If redirectToAddress flag is set, open address page
            if (state.redirectToAddress) {
              console.log("🏠 Redirecting to address page after login");
              setTimeout(() => {
                setEditingAddress(null);
                setShowZomatoAddressSelector(false);
                setShowZomatoAddAddressPage(true);
              }, 500); // Small delay to ensure UI is ready
            }

            console.log("🔄 Restored address flow state after login");
          }
          localStorage.removeItem("address_flow_state");
        } catch (error) {
          console.error("Failed to restore address flow state:", error);
        }
      }
    }
  }, [currentUser]);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem("laundry_cart", JSON.stringify(cart));
  }, [cart]);

  // Auto-load saved address when cart opens
  useEffect(() => {
    if (currentUser && !addressData) {
      loadDefaultAddress();
    }
  }, [currentUser, addressData]);

  const loadDefaultAddress = () => {
    if (!currentUser) return;

    const userId = currentUser._id || currentUser.id || currentUser.phone;
    const savedAddressesKey = `addresses_${userId}`;
    const addresses = JSON.parse(
      localStorage.getItem(savedAddressesKey) || "[]",
    );

    if (addresses.length > 0) {
      // Use the most recent address or the first home address
      const defaultAddress =
        addresses.find((addr: any) => addr.type === "home") || addresses[0];
      setSelectedSavedAddress(defaultAddress);
      setAddressData(defaultAddress);
      console.log(
        "✅ Auto-loaded saved address:",
        defaultAddress.label || defaultAddress.type,
      );
    }
  };

  const getAllServices = (): LaundryService[] => {
    return laundryServices;
  };

  const getServiceById = (id: string): LaundryService | undefined => {
    return getAllServices().find((service) => service.id === id);
  };

  const getCartItems = () => {
    return Object.entries(cart)
      .map(([serviceId, quantity]) => ({
        service: getServiceById(serviceId),
        quantity,
      }))
      .filter((item) => item.service && item.quantity > 0);
  };

  const getSubtotal = () => {
    return getCartItems().reduce((total, item) => {
      return total + item.service!.price * item.quantity;
    }, 0);
  };

  const getDeliveryCharge = () => {
    return 0; // Free delivery
  };

  const getHandlingFee = () => {
    return 0; // Free handling fee as shown in UI
  };

  

  const getCouponDiscount = () => {
    if (!appliedCoupon) return 0;
    const subtotal = getSubtotal();
    return couponService.calculateDiscount(subtotal, appliedCoupon);
  };

  const getTotal = () => {
    return (
      getSubtotal() +
      getDeliveryCharge() +
      getHandlingFee() -
      getCouponDiscount()
    );
  };

  const applyCoupon = async () => {
    console.log("applyCoupon function called with code:", couponCode);
    setCouponError(""); // Clear any previous errors

    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    try {
      const sessionManager = SessionManager.getInstance();
      const session = sessionManager.ensureValidSession();
      const userId = session.userId || "guest";

      console.log("🎫 Validating coupon:", { couponCode, userId, subtotal: getSubtotal() });

      const validation = couponService.validateCoupon(couponCode, userId, getSubtotal());

      if (validation.valid && validation.coupon) {
        const coupon = validation.coupon;

        setAppliedCoupon({
          code: coupon.code,
          discount: coupon.discount,
          maxDiscount: coupon.maxDiscount,
        });

        addNotification(
          createSuccessNotification(
            "Coupon Applied!",
            `${coupon.discount}% discount applied (up to ₹${coupon.maxDiscount})`,
          ),
        );
        console.log("✅ Coupon applied successfully:", coupon.code);
      } else {
        setCouponError(validation.error || "Invalid coupon code");
        console.log("❌ Invalid coupon:", validation.error);
      }
    } catch (error) {
      console.error("Error in applyCoupon:", error);
      setCouponError("Something went wrong while applying the coupon.");
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };







  const updateQuantity = (serviceId: string, change: number) => {
    setCart((prev) => {
      const newCart = { ...prev };
      const currentQuantity = newCart[serviceId] || 0;
      const newQuantity = Math.max(0, currentQuantity + change);

      if (newQuantity === 0) {
        delete newCart[serviceId];
      } else {
        newCart[serviceId] = newQuantity;
      }

      return newCart;
    });
  };

  const removeItem = (serviceId: string) => {
    setCart((prev) => {
      const newCart = { ...prev };
      delete newCart[serviceId];
      return newCart;
    });
  };

  const clearCart = () => {
    setCart({});
    localStorage.removeItem("laundry_cart");
  };

  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [showZomatoAddressSelector, setShowZomatoAddressSelector] =
    useState(false);
  const [showZomatoAddAddressPage, setShowZomatoAddAddressPage] =
    useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<any>(null);

  const handleProceedToCheckout = async () => {
    // Prevent multiple submissions
    if (isProcessingCheckout) {
      console.log(
        "⚠���� Checkout already in progress, ignoring duplicate click",
      );
      return;
    }

    console.log("🛒 Checkout button clicked!");
    setIsProcessingCheckout(true);

    // Add additional UI feedback
    addNotification(
      createWarningNotification(
        "Processing Order",
        "Please wait while we process your booking...",
      ),
    );

    try {
      console.log("📝 Current form data:", {
        currentUser: !!currentUser,
        addressData: !!addressData,
        phoneNumber,
        selectedDate,
        selectedTime,
        addressFullAddress: addressData?.fullAddress,
        flatNo: addressData?.flatNo,
      });

      // Handle authentication with guest session support
      const sessionManager = SessionManager.getInstance();
      const session = sessionManager.ensureValidSession();

      if (!session.isAuthenticated) {
        console.log("❌ Unable to create session, redirecting to login");

        // Save current cart state for post-login restore
        const currentCartState = {
          addressData,
          phoneNumber,
          selectedDate: selectedDate?.toISOString(),
          selectedTime,
          deliveryDate: deliveryDate?.toISOString(),
          deliveryTime,
          specialInstructions,

          timestamp: Date.now(),
        };
        localStorage.setItem(
          "checkout_form_state",
          JSON.stringify(currentCartState),
        );

        if (onLoginRequired) {
          onLoginRequired();
        } else {
          addNotification(
            createWarningNotification(
              "Login Required",
              "Please sign in to complete your booking",
            ),
          );
        }
        return;
      }

      // Use session user if no currentUser provided
      const effectiveUser = currentUser || session.user;
      console.log(`✅ Using ${session.isGuest ? 'guest' : 'authenticated'} session for checkout`);

      if (session.isGuest && !currentUser) {
        console.log("👤 Proceeding with guest checkout (limited functionality)");
      }

      // Validate form with location availability checking
      console.log("🔍 Starting form validation with location check...");

      let errors;
      let locationUnavailable = false;
      try {
        const validationResult = await validateCheckoutFormWithLocation(
          currentUser,
          addressData,
          phoneNumber,
          selectedDate,
          selectedTime,
          deliveryDate,
          deliveryTime,
        );
        errors = validationResult.errors;
        locationUnavailable = validationResult.locationUnavailable;
        console.log("📋 Validation results:", { errors, locationUnavailable });
      } catch (validationError) {
        console.error("❌ Validation function failed:", validationError);
        addNotification(
          createErrorNotification(
            "Validation Error",
            "There was an error checking your form. Please try again.",
          ),
        );
        return;
      }

      // Handle location unavailable case
      if (locationUnavailable && addressData?.fullAddress) {
        console.log(
          "🚫 Location not available for service:",
          addressData.fullAddress,
        );
        setUnavailableLocationText(addressData.fullAddress);
        setShowLocationUnavailable(true);
        setValidationErrors(errors);
        return;
      }

      if (errors.length > 0) {
        console.log("❌ Validation failed with errors:", errors);
        setValidationErrors(errors);

        // Scroll to validation errors
        const errorElement = document.getElementById("validation-errors");
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        return;
      }

      console.log("✅ Validation passed, proceeding to checkout...");

      // Clear validation errors
      setValidationErrors([]);

      // Structure data to match booking service requirements
      const cartItems = getCartItems();
      console.log("Cart items:", cartItems);

      const services = cartItems
        .map((item) => {
          if (!item.service) {
            console.error("Service not found for cart item:", item);
            return null;
          }

          // Validate price and quantity
          const price = Number(item.service.price) || 0;
          const quantity = Number(item.quantity) || 1;

          if (price === 0) {
            console.warn("Service has zero price:", item.service);
          }

          return {
            id: item.service.id,
            name: item.service.name,
            category: item.service.category,
            price: price,
            quantity: quantity,
          };
        })
        .filter(Boolean);

      console.log("Formatted services:", services);

      // Use selected delivery date/time or calculate defaults
      const finalDeliveryDate =
        deliveryDate ||
        (() => {
          const defaultDeliveryDate = new Date(selectedDate);
          defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 2);
          return defaultDeliveryDate;
        })();
      // Set delivery time to either selected delivery time or default to 6 PM (not pickup time)
      const finalDeliveryTime = deliveryTime || "6:00 PM";

      // Calculate total from services to ensure consistency
      const serviceTotal = services.reduce((total, service) => {
        const itemTotal = service.price * service.quantity || 0;
        return total + itemTotal;
      }, 0);

      const deliveryCharge = getDeliveryCharge() || 0;
      const handlingFee = getHandlingFee() || 0;
      const couponDiscount = getCouponDiscount() || 0;
      const finalTotal = serviceTotal + deliveryCharge + handlingFee - couponDiscount;

      console.log("Price breakdown:", {
        serviceTotal,
        deliveryCharge,
        handlingFee,
        couponDiscount,
        appliedCoupon: appliedCoupon?.code,
        finalTotal,
      });

      const orderData = {
        services,
        totalAmount: finalTotal,
        pickupDate: selectedDate.toISOString().split("T")[0],
        deliveryDate: finalDeliveryDate.toISOString().split("T")[0],
        pickupTime: selectedTime,
        deliveryTime: finalDeliveryTime,
        address: addressData,
        phone: phoneNumber || currentUser?.phone,
        instructions: specialInstructions,
        // Explicit coupon information
        coupon_code: appliedCoupon?.code || null,
        discount_amount: couponDiscount,
        original_total: serviceTotal + deliveryCharge + handlingFee,
        charges_breakdown: {
          base_price: serviceTotal,
          delivery_fee: deliveryCharge,
          handling_fee: handlingFee,
          discount: couponDiscount,
        },
      };

      console.log("Final order data:", orderData);

      // Show confirmation dialog
      const confirmationMessage = `
Booking Confirmation:

Services: ${services.length} items
${services.map((s) => `• ${s.name} x${s.quantity} - ₹${s.price * s.quantity}`).join("\n")}

Pickup: ${selectedDate.toLocaleDateString()} at ${selectedTime}
Delivery: ${finalDeliveryDate.toLocaleDateString()} at ${finalDeliveryTime}

${appliedCoupon ? `Coupon Applied: ${appliedCoupon.code} (-₹${couponDiscount})` : ""}
Total Amount: ₹${finalTotal}

Confirm this booking?`;

      if (confirm(confirmationMessage)) {
        try {
          console.log("💰 User confirmed order, processing...");

          // Save address for future use before processing order
          saveAddressAfterBooking(addressData);

          // Call the parent's checkout handler
          console.log("📤 Calling onProceedToCheckout with order data");
          await onProceedToCheckout(orderData);

          console.log("✅ Checkout initiated successfully");

          // Track coupon usage if a coupon was applied
          if (appliedCoupon) {
            const sessionManager = SessionManager.getInstance();
            const session = sessionManager.ensureValidSession();
            const userId = session.userId || "guest";

            couponService.markCouponAsUsed(
              appliedCoupon.code,
              userId,
              serviceTotal,
              couponDiscount
            );
            console.log(`✅ Marked coupon ${appliedCoupon.code} as used`);
          }

          // Mark user as having made an order (no longer first-time)
          const sessionManager = SessionManager.getInstance();
          const session = sessionManager.ensureValidSession();
          const userId = session.userId || "guest";
          if (userId !== "guest") {
            localStorage.setItem(`has_ordered_${userId}`, "true");
            console.log(`✅ Marked user ${userId} as having order history`);
          }



          // Clear cart after successful booking
          console.log("🧹 Clearing cart after successful booking");
          localStorage.removeItem("laundry_cart");
          setCart({});

          // Clear form data
          localStorage.removeItem("laundry_booking_form");
          setSpecialInstructions("");
          setCouponCode("");
          setAppliedCoupon(null);

          addNotification(
            createSuccessNotification(
              "Cart Cleared",
              "Your order has been placed and cart has been cleared.",
            ),
          );
        } catch (checkoutError) {
          console.error("��� Checkout process failed:", checkoutError);
          addNotification(
            createErrorNotification(
              "Checkout Failed",
              "Failed to process your order. Please try again.",
            ),
          );
          // Don't clear cart on error so user can retry
        }
      } else {
        console.log("❌ User cancelled the order");
      }
    } catch (error) {
      console.error("����� Checkout failed:", error);
      addNotification(
        createErrorNotification(
          "Checkout Failed",
          "Unable to process your order. Please try again.",
        ),
      );
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Handle address selection from Zomato selector
  const handleAddressSelect = (address: any) => {
    setSelectedSavedAddress(address);
    setAddressData(address);
    setShowZomatoAddressSelector(false);
    console.log("✅ Address selected:", address.label || address.type);
  };

  // Handle new address creation
  const handleNewAddressSave = async (newAddress: any) => {
    if (!currentUser) return;

    try {
      const addressService = AddressService.getInstance();
      const result = await addressService.saveAddress(newAddress);

      if (result.success) {
        // Auto-select the new address
        setSelectedSavedAddress(result.data || newAddress);
        setAddressData(result.data || newAddress);

        addNotification(
          createSuccessNotification(
            "Address Saved",
            "New address has been saved successfully",
          ),
        );

        console.log("��� New address saved to backend and selected");
      } else {
        // Still save locally and proceed
        const addressWithId = {
          ...newAddress,
          id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
        };

        setSelectedSavedAddress(addressWithId);
        setAddressData(addressWithId);

        addNotification(
          createWarningNotification(
            "Address Saved Locally",
            "Address saved locally, will sync when online",
          ),
        );

        console.log("⚠️ Address saved locally only");
      }

      setShowZomatoAddAddressPage(false);

      // Add success notification for the completed address flow
      addNotification(
        createSuccessNotification(
          "Address Added",
          "You can now proceed with your booking",
        ),
      );
    } catch (error) {
      console.error("Failed to save new address:", error);

      addNotification(
        createErrorNotification(
          "Save Failed",
          "Failed to save address. Please try again.",
        ),
      );
    }
  };

  const handleEditAddress = (address: any) => {
    setEditingAddress(address);
    setShowZomatoAddressSelector(false);
    setShowZomatoAddAddressPage(true);
  };

  const saveAddressAfterBooking = async (orderAddress: any) => {
    if (!currentUser || !orderAddress) return;

    try {
      const userId = currentUser._id || currentUser.id || currentUser.phone;
      const savedAddressesKey = `addresses_${userId}`;
      const existingAddresses = JSON.parse(
        localStorage.getItem(savedAddressesKey) || "[]",
      );

      // Function to normalize address for comparison (removes minor variations)
      const normalizeAddress = (address: string) => {
        return address
          .toLowerCase()
          .replace(/\s+/g, ' ') // Multiple spaces to single space
          .replace(/,\s*,/g, ',') // Remove empty comma sections
          .replace(/[.,\s]+$/, '') // Remove trailing punctuation and spaces
          .replace(/^[.,\s]+/, '') // Remove leading punctuation and spaces
          .trim();
      };

      // Check if this address already exists (smart comparison including type)
      const normalizedNewAddress = normalizeAddress(orderAddress.fullAddress);
      const newAddressType = orderAddress.type || "other";

      const addressExists = existingAddresses.some((addr: any) => {
        if (!addr.fullAddress) return false;
        const normalizedExisting = normalizeAddress(addr.fullAddress);
        const existingType = addr.type || "other";

        // Same address AND same type = duplicate
        return normalizedExisting === normalizedNewAddress && existingType === newAddressType;
      });

      // Only save if it's a genuinely different address
      if (!addressExists && orderAddress.fullAddress) {
        const newAddress = {
          ...orderAddress,
          id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          label: orderAddress.label || "Recent Order Address",
          type: orderAddress.type || "other",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updatedAddresses = [...existingAddresses, newAddress];
        localStorage.setItem(
          savedAddressesKey,
          JSON.stringify(updatedAddresses),
        );
        console.log("�� Address saved after booking");
      }
    } catch (error) {
      console.error("Failed to save address after booking:", error);
    }
  };

  const cartItems = getCartItems();

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="p-0 h-8 w-8">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Cart</h1>
        </div>

        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-6xl mb-4">🛍️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-600 mb-6">Add some items to get started</p>
          <Button onClick={onBack} className="bg-laundrify-mint hover:bg-laundrify-mint/90 text-laundrify-blue">
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-3 sm:px-4 py-4 flex items-center sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" onClick={onBack} className="p-0 h-8 w-8">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base sm:text-lg font-semibold">
            Cart ({cartItems.length} items)
          </h1>
        </div>
      </div>

      <div className={`p-2 space-y-2 ${validationErrors.length > 0 ? 'pb-56' : 'pb-24'}`}>
        {/* Cart Items - Compact View */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 px-3 py-1">
            <CardTitle className="text-sm font-medium">
              Items ({cartItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 px-3 pb-2">
            {cartItems.map(({ service, quantity }) => (
              <div
                key={service!.id}
                className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-md"
              >
                <div className="w-12 h-12 rounded-md overflow-hidden bg-gradient-to-br from-laundrify-mint/20 to-laundrify-mint/40 flex items-center justify-center flex-shrink-0">
                  {service!.image ? (
                    <img
                      src={service!.image}
                      alt={service!.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  {/* Fallback to emoji/icon */}
                  <span className={`text-sm ${service!.image ? "hidden" : ""}`}>
                    {getCategoryDisplay(service!.category).split(" ")[0]}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-xs break-words leading-tight">
                    {service!.name}
                  </h4>
                  <p className="text-xs text-laundrify-red">₹{service!.price}</p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(service!.id, -1)}
                    className="h-5 w-5 p-0 text-xs"
                  >
                    <Minus className="h-2 w-2" />
                  </Button>
                  <span className="w-4 text-center font-medium text-xs">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(service!.id, 1)}
                    className="h-5 w-5 p-0 text-xs"
                  >
                    <Plus className="h-2 w-2" />
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <span className="font-semibold text-xs text-laundrify-red">
                    ₹{service!.price * quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(service!.id)}
                    className="h-5 w-5 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Zomato-style Address Section */}
        <Card className="shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-gray-600" />
                <span className="font-medium">
                  Delivery at{" "}
                  {selectedSavedAddress?.type === "home"
                    ? "Home"
                    : selectedSavedAddress?.type === "office"
                      ? "Work"
                      : addressData?.type === "home"
                        ? "Home"
                        : addressData?.type === "office"
                          ? "Work"
                          : "Location"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-laundrify-blue"
                onClick={() => setShowZomatoAddressSelector(true)}
              >
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>

            {selectedSavedAddress || addressData?.fullAddress ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  {selectedSavedAddress
                    ? selectedSavedAddress.fullAddress
                    : addressData.fullAddress}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-3">
                  No address selected
                </p>
                <Button
                  onClick={() => {
                    if (!currentUser) {
                      // Save current cart state with specific flag for address flow
                      const addressFlowState = {
                        addressData,
                        phoneNumber,
                        selectedDate: selectedDate?.toISOString(),
                        selectedTime,
                        deliveryDate: deliveryDate?.toISOString(),
                        deliveryTime,
                        specialInstructions,
              
                        timestamp: Date.now(),
                        redirectToAddress: true, // Flag to indicate address flow
                      };
                      localStorage.setItem(
                        "address_flow_state",
                        JSON.stringify(addressFlowState),
                      );

                      if (onLoginRequired) {
                        onLoginRequired();
                      } else {
                        addNotification(
                          createWarningNotification(
                            "Login Required",
                            "Please sign in to add an address",
                          ),
                        );
                      }
                    } else {
                      setShowZomatoAddressSelector(true);
                    }
                  }}
                  variant="outline"
                  className="w-full border-laundrify-blue text-laundrify-blue hover:bg-laundrify-mint/20"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {!currentUser ? "Login to Add Address" : "Select Address"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact & Schedule Details - Compact */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 px-3 py-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-2 pt-0">
            <div>
              <Label htmlFor="phone" className="text-xs">
                Phone *
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pickup Schedule *</Label>
              <ProfessionalDateTimePicker
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onDateChange={setSelectedDate}
                onTimeChange={setSelectedTime}
              />
            </div>

            {/* Delivery Date/Time Selection */}
            <div className="space-y-1">
              <DeliveryDateTimePicker
                cartItems={getCartItems()}
                pickupDate={selectedDate}
                pickupTime={selectedTime}
                selectedDeliveryDate={deliveryDate}
                selectedDeliveryTime={deliveryTime}
                onDeliveryDateChange={setDeliveryDate}
                onDeliveryTimeChange={setDeliveryTime}
              />
            </div>

            <div>
              <Label htmlFor="instructions" className="text-xs">
                Instructions (Optional)
              </Label>
              <Textarea
                id="instructions"
                placeholder="Special instructions..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bill Summary - Compact */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 px-3 py-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-3 w-3" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 px-3 pb-2 pt-0">
            <div className="flex justify-between text-sm">
              <span>Subtotal ({cartItems.length} items)</span>
              <span>₹{getSubtotal()}</span>
            </div>

            <div className="flex justify-between text-sm text-laundrify-blue">
              <span>Delivery Fee</span>
              <div className="flex items-center gap-2">
                <span className="line-through text-gray-400 text-xs">₹30</span>
                <span className="font-medium">FREE</span>
              </div>
            </div>

            <div className="flex justify-between text-sm text-laundrify-blue">
              <span>Handling Fee</span>
              <div className="flex items-center gap-2">
                <span className="line-through text-gray-400 text-xs">
                  <p>
                    <span style={{fontSize: '12px'}}>₹</span>9
                  </p>
                </span>
                <span className="font-medium">FREE</span>
              </div>
            </div>

            {/* Coupon Section */}
            <div className="space-y-2 pt-2 border-t">
              {!appliedCoupon ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (couponCode.trim()) {
                            applyCoupon();
                          }
                        }
                      }}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyCoupon();
                      }}
                      variant="outline"
                      disabled={!couponCode.trim()}
                      className="h-8 px-3 text-sm"
                      type="button"
                    >
                      Apply
                    </Button>
                  </div>

                  {/* Available coupons info */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>FIRST30 - 30% off for first order only (up to ₹200)</div>
                    <div>NEW20 - 20% off on all orders (up to ₹200)</div>
                  </div>

                  {/* Coupon Error Message */}
                  {couponError && (
                    <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      {couponError}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-green-600 font-medium text-xs">
                      ✓ {appliedCoupon.code}
                    </span>
                    <span className="text-xs text-green-600">
                      ({appliedCoupon.discount}% off)
                    </span>
                  </div>
                  <Button
                    onClick={removeCoupon}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                  >
                    ✕
                  </Button>
                </div>
              )}
            </div>

            {/* Show discount if coupon is applied */}
            {appliedCoupon && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-₹{getCouponDiscount()}</span>
              </div>
            )}

            <hr className="my-2" />

            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-laundrify-red">₹{getTotal()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 safe-area-bottom">
        <div className="space-y-2">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div id="validation-errors">
              <FormValidation errors={validationErrors} />
            </div>
          )}

          <Button
            onClick={(e) => {
              console.log("�� Button clicked event triggered");
              e.preventDefault();
              e.stopPropagation();
              try {
                handleProceedToCheckout();
              } catch (error) {
                console.error("��� Checkout handler failed:", error);
                addNotification(
                  createErrorNotification(
                    "Checkout Error",
                    "An unexpected error occurred. Please try again.",
                  ),
                );
              }
            }}
            disabled={cartItems.length === 0 || isProcessingCheckout}
            className="w-full bg-laundrify-mint hover:bg-laundrify-mint/90 text-laundrify-blue py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessingCheckout ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : cartItems.length === 0 ? (
              "Add items to cart"
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Proceed to Book • ₹{getTotal()}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Zomato Address Selector */}
      <ZomatoAddressSelector
        isOpen={showZomatoAddressSelector}
        onClose={() => setShowZomatoAddressSelector(false)}
        onSelectAddress={handleAddressSelect}
        onAddNewAddress={() => {
          setEditingAddress(null);
          setShowZomatoAddressSelector(false);
          setShowZomatoAddAddressPage(true);
        }}
        onEditAddress={handleEditAddress}
        currentUser={currentUser}
        selectedAddressId={selectedSavedAddress?.id}
      />

      {/* Zomato Add Address Page */}
      <ZomatoAddAddressPage
        isOpen={showZomatoAddAddressPage}
        onClose={() => {
          setShowZomatoAddAddressPage(false);
          setEditingAddress(null);
        }}
        onSave={(address) => {
          handleNewAddressSave(address);
          setEditingAddress(null);
        }}
        currentUser={currentUser}
        editingAddress={editingAddress}
      />

      {/* Saved Addresses Modal (fallback) */}
      <SavedAddressesModal
        isOpen={showSavedAddresses}
        onClose={() => setShowSavedAddresses(false)}
        onSelectAddress={(address) => {
          setAddressData(address);
          setShowSavedAddresses(false);
        }}
        currentUser={currentUser}
      />

      {/* Location Unavailable Modal */}
      <LocationUnavailableModal
        isOpen={showLocationUnavailable}
        onClose={() => setShowLocationUnavailable(false)}
        detectedLocation={unavailableLocationText}
        onExplore={() => {
          console.log(
            "🔍 User chose to explore available services instead of booking",
          );
          // Clear the problematic address to allow user to select a different one
          setAddressData(null);
          setValidationErrors([]);
        }}
      />
    </div>
  );
};

export default LaundryCart;
