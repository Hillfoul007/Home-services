import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Star,
  Clock,
  DollarSign,
  Zap,
  Home,
  Car,
  Wrench,
  Briefcase,
  Heart,
  Scissors,
  Package,
  Plus,
  Minus,
  ShoppingCart,
} from "lucide-react";
import analyticsService from "@/services/analyticsService";

interface ServiceCategoriesProps {
  onServiceSelect: (service: any) => void;
  onMultipleServicesSelect: (services: any[]) => void;
}

const ServiceCategories: React.FC<ServiceCategoriesProps> = ({
  onServiceSelect,
  onMultipleServicesSelect,
}) => {
  const [cart, setCart] = useState<any[]>([]);

  // Load cart from localStorage on component mount
  useEffect(() => {
    const savedCart = localStorage.getItem("service_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error("Error loading cart:", error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("service_cart", JSON.stringify(cart));
  }, [cart]);

  // Listen for cart clearing events
  useEffect(() => {
    const handleClearCart = () => {
      console.log("🧹 ServiceCategories: Received cart clear event");
      setCart([]);
      localStorage.removeItem("service_cart");
      localStorage.removeItem("laundry_cart");
      localStorage.removeItem("mobile_service_cart");
      localStorage.removeItem("cleancare_cart");
    };

    window.addEventListener("clearCart", handleClearCart);
    return () => {
      window.removeEventListener("clearCart", handleClearCart);
    };
  }, []);

  const categories = [
    {
      name: "Household Services",
      icon: Home,
      services: [
        {
          id: "house-cleaning",
          name: "House Cleaning",
          price: 50,
          duration: "2-3 hours",
          rating: 4.8,
          provider: "CleanPro Services",
          description: "Professional deep cleaning of your entire home",
          image: "/placeholder.svg",
        },
        {
          id: "kitchen-cleaning",
          name: "Kitchen Deep Clean",
          price: 80,
          duration: "3-4 hours",
          rating: 4.9,
          provider: "Kitchen Masters",
          description: "Complete kitchen sanitization and organization",
          image: "/placeholder.svg",
        },
        {
          id: "bathroom-cleaning",
          name: "Bathroom Sanitization",
          price: 40,
          duration: "1-2 hours",
          rating: 4.7,
          provider: "Fresh Bath Co.",
          description: "Deep cleaning and sanitization of bathrooms",
          image: "/placeholder.svg",
        },
      ],
    },
    {
      name: "Vehicle Services",
      icon: Car,
      services: [
        {
          id: "car-wash",
          name: "Car Wash & Detail",
          price: 25,
          duration: "1-2 hours",
          rating: 4.6,
          provider: "Auto Shine",
          description: "Complete exterior and interior car cleaning",
          image: "/placeholder.svg",
        },
        {
          id: "bike-service",
          name: "Bike Maintenance",
          price: 35,
          duration: "2-3 hours",
          rating: 4.5,
          provider: "Bike Care Pro",
          description: "Complete bike servicing and maintenance",
          image: "/placeholder.svg",
        },
      ],
    },
    {
      name: "Repair & Maintenance",
      icon: Wrench,
      services: [
        {
          id: "plumbing",
          name: "Plumbing Service",
          price: 60,
          duration: "1-3 hours",
          rating: 4.7,
          provider: "Fix It Fast",
          description: "Professional plumbing repairs and installations",
          image: "/placeholder.svg",
        },
        {
          id: "electrical",
          name: "Electrical Work",
          price: 70,
          duration: "2-4 hours",
          rating: 4.8,
          provider: "Power Pro",
          description: "Safe and reliable electrical services",
          image: "/placeholder.svg",
        },
        {
          id: "appliance-repair",
          name: "Appliance Repair",
          price: 55,
          duration: "1-2 hours",
          rating: 4.6,
          provider: "Appliance Doctor",
          description: "Expert repair for all home appliances",
          image: "/placeholder.svg",
        },
      ],
    },
    {
      name: "Professional Services",
      icon: Briefcase,
      services: [
        {
          id: "tutoring",
          name: "Home Tutoring",
          price: 45,
          duration: "1-2 hours",
          rating: 4.9,
          provider: "EduPro",
          description: "Personalized tutoring sessions at home",
          image: "/placeholder.svg",
        },
        {
          id: "pet-care",
          name: "Pet Care Service",
          price: 30,
          duration: "2-3 hours",
          rating: 4.8,
          provider: "Pet Love",
          description: "Professional pet care and walking services",
          image: "/placeholder.svg",
        },
      ],
    },
    {
      name: "Health & Beauty",
      icon: Heart,
      services: [
        {
          id: "massage",
          name: "Home Massage",
          price: 85,
          duration: "1-2 hours",
          rating: 4.9,
          provider: "Relax Spa",
          description: "Therapeutic massage in the comfort of your home",
          image: "/placeholder.svg",
        },
        {
          id: "haircut",
          name: "Home Salon",
          price: 40,
          duration: "1-2 hours",
          rating: 4.7,
          provider: "Style Studio",
          description: "Professional hair styling at your doorstep",
          image: "/placeholder.svg",
        },
      ],
    },
    {
      name: "Delivery & Logistics",
      icon: Package,
      services: [
        {
          id: "grocery-delivery",
          name: "Grocery Shopping",
          price: 15,
          duration: "1-2 hours",
          rating: 4.5,
          provider: "Quick Shop",
          description: "Personal grocery shopping and delivery",
          image: "/placeholder.svg",
        },
        {
          id: "package-delivery",
          name: "Package Delivery",
          price: 20,
          duration: "30 min - 1 hour",
          rating: 4.6,
          provider: "Fast Courier",
          description: "Same-day package pickup and delivery",
          image: "/placeholder.svg",
        },
      ],
    },
  ];

  const getCartItemQuantity = (serviceId: string) => {
    const cartItem = cart.find((item) => item.id === serviceId);
    return cartItem ? cartItem.quantity : 0;
  };

  const addToCart = (service: any) => {
    // Track add to cart event
    analyticsService.trackEvent('add_to_cart', {
      event_category: 'ecommerce',
      item_id: service.id,
      item_name: service.name,
      currency: 'INR',
      value: service.price || 0
    });

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === service.id);

      if (existingItem) {
        return prevCart.map((item) =>
          item.id === service.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      } else {
        return [...prevCart, { ...service, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (serviceId: string) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === serviceId);

      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map((item) =>
          item.id === serviceId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        );
      } else {
        return prevCart.filter((item) => item.id !== serviceId);
      }
    });
  };

  const getTotalCartItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleBookServices = () => {
    if (cart.length > 0) {
      onMultipleServicesSelect(cart);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="text-center bg-gradient-to-r from-slate-900 to-blue-900 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-12 rounded-b-3xl shadow-2xl">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            Professional Services
          </h1>
          <p className="text-xl text-blue-200 max-w-3xl mx-auto leading-relaxed">
            Experience premium home services delivered by verified
            professionals. Your satisfaction is our guarantee.
          </p>
          <div className="flex justify-center items-center gap-6 mt-8 text-blue-200">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-current text-yellow-400" />
              <span className="font-semibold">4.9/5 Rating</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <span className="font-semibold">Same Day Service</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <span className="font-semibold">Best Prices</span>
            </div>
          </div>
        </div>
      </div>

      {categories.map((category) => {
        const Icon = category.icon;
        return (
          <div key={category.name} className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-100 to-blue-100 rounded-2xl border border-slate-200">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                {category.name}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {category.services.map((service) => {
                const quantity = getCartItemQuantity(service.id);

                return (
                  <Card
                    key={service.id}
                    className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-0 bg-white shadow-lg rounded-2xl overflow-hidden"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                          {service.name}
                        </CardTitle>
                        <Badge variant="secondary" className="ml-2">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          {service.rating}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {service.description}
                      </p>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{service.duration}</span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-green-600">
                          <DollarSign className="h-4 w-4" />
                          <span>${service.price}</span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        by {service.provider}
                      </div>

                      <div className="space-y-2">
                        {quantity === 0 ? (
                          <Button
                            onClick={() => addToCart(service)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                        ) : (
                          <div className="flex items-center justify-between bg-blue-50 rounded-lg p-2">
                            <Button
                              onClick={() => removeFromCart(service.id)}
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>

                            <span className="font-semibold text-blue-600 mx-3">
                              {quantity}
                            </span>

                            <Button
                              onClick={() => addToCart(service)}
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Floating Book Services Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <div className="max-w-sm mx-auto">
            <Button
              onClick={handleBookServices}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold shadow-lg"
              size="lg"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Book {getTotalCartItems()} Service
              {getTotalCartItems() > 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceCategories;
