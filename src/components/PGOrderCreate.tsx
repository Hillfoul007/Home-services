import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Plus,
  Minus,
  CheckCircle,
  AlertCircle,
  Phone,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface City {
  _id?: string;
  name?: string;
}

interface PG {
  _id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  contact_person?: string;
  item_price: number;
  min_items: number;
  services_offered: string[];
}

interface PGOrderCreateProps {
  currentUser?: any;
  onOrderCreated?: (order: any) => void;
  onBack: () => void;
}

const PGOrderCreate: React.FC<PGOrderCreateProps> = ({
  currentUser,
  onOrderCreated,
  onBack,
}) => {
  const [step, setStep] = useState<"city" | "pg" | "items" | "confirmation">(
    "city"
  );
  const [cities, setCities] = useState<string[]>([]);
  const [pgs, setPgs] = useState<PG[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingPGs, setLoadingPGs] = useState(false);

  // Form state
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedPG, setSelectedPG] = useState<PG | null>(null);
  const [numberOfItems, setNumberOfItems] = useState(4);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch cities on mount
  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      setLoadingCities(true);
      const response = await apiClient.request<any>("/pg/cities");
      if (response.data.success) {
        setCities(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching cities:", error);
      toast.error("Failed to load cities");
    } finally {
      setLoadingCities(false);
    }
  };

  const handleCitySelect = async (city: string) => {
    setSelectedCity(city);
    setSelectedPG(null);
    setLoadingPGs(true);

    try {
      const response = await apiClient.request<any>(`/pg/city/${city}`);
      if (response.data.success) {
        setPgs(response.data.data || []);
        if (response.data.data && response.data.data.length > 0) {
          setStep("pg");
        } else {
          toast.error("No PGs available in this city");
        }
      }
    } catch (error) {
      console.error("Error fetching PGs:", error);
      toast.error("Failed to load PGs");
    } finally {
      setLoadingPGs(false);
    }
  };

  const handlePGSelect = (pg: PG) => {
    setSelectedPG(pg);
    setNumberOfItems(pg.min_items);
    setStep("items");
  };

  const handleItemsChange = (value: number) => {
    if (value >= (selectedPG?.min_items || 4)) {
      setNumberOfItems(value);
    }
  };

  const handleCreateOrder = async () => {
    if (!selectedPG || numberOfItems < (selectedPG.min_items || 4)) {
      toast.error(
        `Minimum ${selectedPG?.min_items || 4} items required`
      );
      return;
    }

    setLoading(true);
    try {
      const itemPrice = selectedPG.item_price || 25;
      const totalPrice = numberOfItems * itemPrice;

      const response = await apiClient.request<any>("/pg/create", "POST", {
        pg_id: selectedPG._id,
        number_of_items: numberOfItems,
        special_instructions: specialInstructions,
      });

      if (response.data.success) {
        const order = response.data.data;
        toast.success("PG Order created successfully!");

        // Show instruction book
        setStep("confirmation");

        // Call callback after short delay
        setTimeout(() => {
          if (onOrderCreated) {
            onOrderCreated(order);
          }
        }, 2000);
      } else {
        toast.error(response.data.message || "Failed to create order");
      }
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error(error.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const itemPrice = selectedPG?.item_price || 25;
  const totalPrice = numberOfItems * itemPrice;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 p-4">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4"
        >
          ← Back
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">Laundrify PG Orders</h1>
        <p className="text-gray-600 mt-2">
          Fast laundry & iron service for paying guests
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex gap-2 mb-6 justify-center">
        {["city", "pg", "items", "confirmation"].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded ${
              step === s
                ? "bg-laundrify-purple"
                : ["city", "pg", "items", "confirmation"].indexOf(s) <
                  ["city", "pg", "items", "confirmation"].indexOf(step)
                ? "bg-green-500"
                : "bg-gray-300"
            }`}
          />
        ))}
      </div>

      {/* Step 1: City Selection */}
      {step === "city" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Select Your City
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingCities ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading cities...</p>
              </div>
            ) : cities.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No cities available</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {cities.map((city) => (
                  <Button
                    key={city}
                    variant={selectedCity === city ? "default" : "outline"}
                    onClick={() => handleCitySelect(city)}
                    className="h-20 flex flex-col items-center justify-center"
                  >
                    <MapPin className="h-5 w-5 mb-2" />
                    <span className="text-sm">{city}</span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: PG Selection */}
      {step === "pg" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Select PG in {selectedCity}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("city")}
              className="mt-2"
            >
              ← Change City
            </Button>
          </CardHeader>
          <CardContent>
            {loadingPGs ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading PGs...</p>
              </div>
            ) : pgs.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No PGs available in this city</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pgs.map((pg) => (
                  <div
                    key={pg._id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => handlePGSelect(pg)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-800">{pg.name}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <MapPin className="h-4 w-4" />
                          {pg.address}
                        </p>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <Phone className="h-4 w-4" />
                          {pg.phone}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-laundrify-purple">
                          ₹{pg.item_price}/item
                        </p>
                        <p className="text-xs text-gray-600">Min {pg.min_items} items</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {pg.services_offered?.map((service) => (
                        <Badge key={service} variant="secondary">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Items Selection */}
      {step === "items" && selectedPG && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>How many items? ({selectedPG.name})</CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              ₹{selectedPG.item_price} per item • Minimum {selectedPG.min_items} items
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Items Counter */}
            <div className="bg-purple-50 rounded-lg p-6">
              <div className="flex items-center justify-center gap-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() =>
                    handleItemsChange(numberOfItems - 1)
                  }
                  disabled={numberOfItems <= (selectedPG.min_items || 4)}
                >
                  <Minus className="h-5 w-5" />
                </Button>

                <div className="text-center">
                  <div className="text-5xl font-bold text-laundrify-purple">
                    {numberOfItems}
                  </div>
                  <p className="text-gray-600 mt-2">Items</p>
                </div>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleItemsChange(numberOfItems + 1)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Services */}
            <div>
              <h3 className="font-semibold mb-3">Services Included</h3>
              <div className="flex gap-2">
                {selectedPG.services_offered?.map((service) => (
                  <Badge key={service} className="bg-laundrify-purple">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Special Instructions (Optional)
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full border rounded-lg p-3 text-sm"
                rows={3}
                placeholder="e.g., Extra care for delicate items"
              />
            </div>

            {/* Price Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-600">
                  {numberOfItems} items × ₹{selectedPG.item_price}
                </span>
                <span className="font-semibold">₹{totalPrice}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold text-lg">Total</span>
                <span className="text-2xl font-bold text-laundrify-purple">
                  ₹{totalPrice}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("pg")} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleCreateOrder}
                disabled={loading}
                className="flex-1 bg-laundrify-purple"
              >
                {loading ? "Creating..." : "Confirm Order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirmation & Instruction Book */}
      {step === "confirmation" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Booking Done!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Details */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-700 mb-3">Order Confirmed</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-600">PG:</span>{" "}
                  <span className="font-semibold">{selectedPG?.name}</span>
                </p>
                <p>
                  <span className="text-gray-600">Items:</span>{" "}
                  <span className="font-semibold">{numberOfItems}</span>
                </p>
                <p>
                  <span className="text-gray-600">Total Amount:</span>{" "}
                  <span className="font-semibold text-laundrify-purple">
                    ₹{totalPrice}
                  </span>
                </p>
              </div>
            </div>

            {/* Instruction Book */}
            <div className="border-2 border-laundrify-purple rounded-lg p-6 bg-purple-50">
              <h3 className="font-bold text-lg mb-4 text-laundrify-purple">
                📋 How to Use Laundrify PG Box
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-laundrify-purple text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Booking Done</p>
                    <p className="text-sm text-gray-600">
                      Order ID Created: Order tracking started
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-laundrify-purple text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Pack Your Clothes</p>
                    <p className="text-sm text-gray-600">
                      Place clothes in polybag kept near the box area of your PG
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-laundrify-purple text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      Sticker & Order ID
                    </p>
                    <p className="text-sm text-gray-600">
                      Paste the sticker and write your Order ID on the polybag
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-laundrify-purple text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Drop in Box</p>
                    <p className="text-sm text-gray-600">
                      Drop the packet inside the Laundrify box placed by your PG
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setStep("city");
                  setSelectedCity("");
                  setSelectedPG(null);
                  setNumberOfItems(4);
                }}
                className="flex-1 bg-laundrify-purple"
              >
                Create Another Order
              </Button>
              <Button variant="outline" onClick={onBack} className="flex-1">
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PGOrderCreate;
