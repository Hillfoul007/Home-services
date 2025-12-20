import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Minus, Plus, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createSuccessNotification, createErrorNotification } from "@/utils/notificationUtils";
import OTPAuthService from "@/services/otpAuthService";

interface PG {
  _id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
}

const PGBooking: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: City, 2: PG Selection, 3: Items, 4: Confirm
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [pgs, setPGs] = useState<PG[]>([]);
  const [selectedPG, setSelectedPG] = useState<PG | null>(null);
  const [numItems, setNumItems] = useState(4);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string>("");

  const authService = OTPAuthService.getInstance();
  const userId = authService.getCurrentUserId();

  const PRICE_PER_ITEM = 25;
  const MIN_ITEMS = 4;

  // Fetch cities on component mount
  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      const response = await fetch("/api/pg-orders/cities");
      const data = await response.json();

      if (data.success) {
        setCities(data.cities);
      }
    } catch (error) {
      console.error("Error fetching cities:", error);
      setErrors("Failed to load cities. Please try again.");
    }
  };

  const handleCitySelect = async (city: string) => {
    setSelectedCity(city);
    setSelectedPG(null);
    setSearchText("");
    setErrors("");

    try {
      setLoading(true);
      const response = await fetch(`/api/pg-orders/by-city/${city}`);
      const data = await response.json();

      if (data.success) {
        setPGs(data.pgs);
        setStep(2);
      }
    } catch (error) {
      console.error("Error fetching PGs:", error);
      setErrors("Failed to load PGs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePGSelect = (pg: PG) => {
    setSelectedPG(pg);
    setStep(3);
  };

  const filteredPGs = pgs.filter(
    (pg) =>
      pg.name.toLowerCase().includes(searchText.toLowerCase()) ||
      pg.address.toLowerCase().includes(searchText.toLowerCase())
  );

  const totalPrice = numItems * PRICE_PER_ITEM;

  const handleConfirmOrder = async () => {
    if (!userId || !selectedPG) {
      setErrors("Missing required information");
      return;
    }

    try {
      setLoading(true);
      const user = await authService.getCurrentUser();

      const response = await fetch("/api/pg-orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: userId,
          pg_id: selectedPG._id,
          customer_name: user?.name || "",
          customer_phone: user?.phone || "",
          num_items: numItems,
          pickup_date: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        createSuccessNotification("Order Created!", "Your PG order has been created successfully");
        navigate(`/pg-order-confirmation/${data.order._id}`, {
          state: { order: data.order },
        });
      } else {
        setErrors(data.message || "Failed to create order");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      setErrors("Failed to create order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-laundrify-purple/10 to-background p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">PG Laundry Service</h1>
          <p className="text-sm text-gray-600">Quick laundry & iron service for paying guests</p>
        </div>

        {errors && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-600">{errors}</span>
          </div>
        )}

        {step === 1 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Select City</h2>
            <div className="space-y-2">
              {cities.map((city) => (
                <Button
                  key={city}
                  onClick={() => handleCitySelect(city)}
                  variant="outline"
                  className="w-full justify-between"
                  disabled={loading}
                >
                  {city}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              ))}
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-6">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              className="mb-4 -ml-2"
            >
              ← Change City
            </Button>

            <h2 className="text-lg font-semibold mb-4">Select PG</h2>

            <Input
              placeholder="Search PG by name or address..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="mb-4"
            />

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredPGs.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No PGs found</p>
              ) : (
                filteredPGs.map((pg) => (
                  <Button
                    key={pg._id}
                    onClick={() => handlePGSelect(pg)}
                    variant="outline"
                    className="w-full text-left h-auto py-3 px-4 flex flex-col items-start"
                  >
                    <span className="font-semibold">{pg.name}</span>
                    <span className="text-xs text-gray-600">{pg.address}</span>
                    <span className="text-xs text-gray-500">📞 {pg.phone}</span>
                  </Button>
                ))
              )}
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-6">
            <Button
              variant="ghost"
              onClick={() => setStep(2)}
              className="mb-4 -ml-2"
            >
              ← Change PG
            </Button>

            <div className="mb-6 p-4 bg-laundrify-purple/10 rounded-lg">
              <p className="font-semibold text-gray-900">{selectedPG?.name}</p>
              <p className="text-sm text-gray-600">{selectedPG?.address}</p>
              <p className="text-xs text-gray-500 mt-1">📞 {selectedPG?.phone}</p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">Service Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Service</span>
                  <span className="font-medium">Laundry & Iron</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price per item</span>
                  <span className="font-medium">₹{PRICE_PER_ITEM}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Min items required</span>
                  <span>{MIN_ITEMS}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">Select Number of Items</h3>
              <div className="flex items-center justify-center gap-4 bg-gray-50 rounded-lg p-4">
                <Button
                  onClick={() => setNumItems(Math.max(MIN_ITEMS, numItems - 1))}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <p className="text-2xl font-bold text-laundrify-purple">{numItems}</p>
                  <p className="text-xs text-gray-500">items</p>
                </div>
                <Button
                  onClick={() => setNumItems(numItems + 1)}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="bg-laundrify-yellow/20 p-4 rounded-lg mb-6">
              <p className="text-lg font-bold text-gray-900">
                Total: ₹{totalPrice}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {numItems} items × ₹{PRICE_PER_ITEM}/item
              </p>
            </div>

            <Button
              onClick={handleConfirmOrder}
              className="w-full bg-laundrify-purple hover:bg-laundrify-purple/90 text-white"
              disabled={loading}
            >
              {loading ? "Creating Order..." : "Confirm Order"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PGBooking;
