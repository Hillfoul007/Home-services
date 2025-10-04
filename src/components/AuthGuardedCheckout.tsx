import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  User,
  ShoppingCart,
  CreditCard,
  ArrowRight,
  Lock,
  Package,
} from "lucide-react";
import PhoneOtpAuthModal from "./PhoneOtpAuthModal";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  createSuccessNotification,
  createWarningNotification,
} from "@/utils/notificationUtils";

interface AuthGuardedCheckoutProps {
  currentUser: any;
  cartData: any;
  onProceedToCheckout: (cartData: any) => void;
  onLoginRequired?: () => void;
  onBack?: () => void;
}

const AuthGuardedCheckout: React.FC<AuthGuardedCheckoutProps> = ({
  currentUser,
  cartData,
  onProceedToCheckout,
  onLoginRequired,
  onBack,
}) => {
  const { addNotification } = useNotifications();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAttempted, setAuthAttempted] = useState(false);

  // Check if user needs authentication when component mounts or user changes
  useEffect(() => {
    if (!currentUser && !authAttempted) {
      setShowAuthModal(true);
      setAuthAttempted(true);

      // Also trigger the parent's login required callback
      if (onLoginRequired) {
        onLoginRequired();
      }
    }
  }, [currentUser, authAttempted, onLoginRequired]);

  const handleAuthSuccess = (user: any) => {
    setShowAuthModal(false);
    addNotification(
      createSuccessNotification(
        "Welcome!",
        "You're now signed in and can proceed with your booking",
      ),
    );

    // Auto-proceed to checkout after successful auth
    setTimeout(() => {
      onProceedToCheckout(cartData);
    }, 1000);
  };

  const handleProceedClick = () => {
    if (!currentUser) {
      setShowAuthModal(true);
      addNotification(
        createWarningNotification(
          "Sign In Required",
          "Please sign in to complete your booking",
        ),
      );
      return;
    }

    onProceedToCheckout(cartData);
  };

  const calculateTotal = () => {
    if (cartData?.totalAmount) return cartData.totalAmount;
    if (cartData?.services && Array.isArray(cartData.services)) {
      return cartData.services.reduce((total: number, service: any) => {
        return total + (service.price || 0) * (service.quantity || 1);
      }, 0);
    }
    return 0;
  };

  // If user is not authenticated, show sign-in prompt instead of blank screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Cart Summary */}
          <Card className="border-2 border-blue-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
                Your Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {cartData?.services && Array.isArray(cartData.services) && (
                <div className="space-y-3 mb-6">
                  {cartData.services.map((service: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg"
                    >
                      {/* Service Image */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {service.image ? (
                          <img
                            src={service.image}
                            alt={service.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              target.nextElementSibling?.classList.remove(
                                "hidden",
                              );
                            }}
                          />
                        ) : null}
                        {/* Fallback icon */}
                        <div
                          className={`w-full h-full flex items-center justify-center text-gray-400 ${service.image ? "hidden" : ""}`}
                        >
                          <Package className="w-7 h-7" />
                        </div>
                      </div>

                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {service.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Qty: {service.quantity || 1}
                        </p>
                      </div>

                      <p className="font-semibold text-blue-600">
                        ₹{(service.price || 0) * (service.quantity || 1)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />

              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">
                  Total Amount
                </span>
                <Badge className="text-lg px-3 py-1 bg-green-100 text-green-800">
                  ₹{calculateTotal()}
                </Badge>
              </div>

              {cartData?.address && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Service Address:
                  </p>
                  <p className="text-sm text-gray-600">{cartData.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Authentication Required */}
          <Card className="border-2 border-orange-200 shadow-lg">
            <CardContent className="text-center py-12">
              <div className="mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="h-8 w-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Sign In Required
                </h2>
                <p className="text-gray-600 text-lg">
                  Please sign in to complete your booking and proceed to
                  checkout
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg transition-all duration-200"
                >
                  <User className="mr-2 h-5 w-5" />
                  Sign In to Continue
                </Button>

                {onBack && (
                  <Button
                    onClick={onBack}
                    variant="outline"
                    className="w-full py-4 text-lg font-medium rounded-xl"
                  >
                    Back to Cart
                  </Button>
                )}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Why sign in?</span>
                  <br />
                  We need your contact details to schedule pickup and delivery
                  for your laundry service.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Authentication Modal */}
        <PhoneOtpAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // User is authenticated, show checkout interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* User Greeting */}
        <Card className="border-2 border-green-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Welcome, {currentUser.full_name || currentUser.name || "User"}
                  !
                </h2>
                <p className="text-gray-600">{currentUser.phone}</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800">✓ Signed In</Badge>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="border-2 border-blue-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {cartData?.services && Array.isArray(cartData.services) && (
              <div className="space-y-3 mb-6">
                {cartData.services.map((service: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg"
                  >
                    {/* Service Image */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {service.image ? (
                        <img
                          src={service.image}
                          alt={service.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            target.nextElementSibling?.classList.remove(
                              "hidden",
                            );
                          }}
                        />
                      ) : null}
                      {/* Fallback icon */}
                      <div
                        className={`w-full h-full flex items-center justify-center text-gray-400 ${service.image ? "hidden" : ""}`}
                      >
                        <Package className="w-8 h-8" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {service.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Qty: {service.quantity || 1}
                      </p>
                    </div>

                    <p className="font-semibold text-blue-600">
                      ₹{(service.price || 0) * (service.quantity || 1)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-4" />

            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-semibold text-gray-900">
                Total Amount
              </span>
              <Badge className="text-xl px-4 py-2 bg-green-100 text-green-800">
                ₹{calculateTotal()}
              </Badge>
            </div>

            {cartData?.address && (
              <div className="p-4 bg-gray-50 rounded-lg mb-6">
                <p className="font-medium text-gray-900 mb-2">
                  Service Address:
                </p>
                <p className="text-gray-600">{cartData.address}</p>
              </div>
            )}

            <Button
              onClick={handleProceedClick}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg transition-all duration-200"
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Proceed to Checkout
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthGuardedCheckout;
