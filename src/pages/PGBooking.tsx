import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Phone,
  Home,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface PG {
  _id: string;
  name: string;
  address: string;
  phone_number: string;
  price_per_item: number;
  min_items: number;
  assignedVendorName?: string;
}

interface OrderInstructions {
  isOpen: boolean;
  orderId: string;
}

const PGBooking: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [cities, setCities] = useState<string[]>([]);
  const [pgs, setPGs] = useState<PG[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedPG, setSelectedPG] = useState<PG | null>(null);
  const [noOfItems, setNoOfItems] = useState(4);
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState<OrderInstructions>({
    isOpen: false,
    orderId: "",
  });

  const pricePerItem = selectedPG?.price_per_item || 25;
  const totalPrice = noOfItems * pricePerItem;

  // Fetch available cities from backend
  const fetchCities = async () => {
    try {
      const response = await apiClient.request<any>(
        "/pg-management/cities/list"
      );

      if (response.error) {
        console.warn("Failed to fetch cities:", response.error);
        setCities([]);
        return;
      }

      // Handle the response structure: backend returns {success: true, data: [cities]}
      const citiesData = response.data?.data || response.data || [];

      if (Array.isArray(citiesData)) {
        setCities(citiesData);
        console.log(`✅ Loaded ${citiesData.length} cities with active PGs`);
      } else {
        console.warn("Invalid cities response format:", response.data);
        setCities([]);
      }
    } catch (error) {
      console.error("Error fetching cities:", error);
      toast.error("Failed to load available cities");
      setCities([]);
    }
  };

  // Load cities on component mount
  useEffect(() => {
    fetchCities();
  }, []);

  // Fetch PGs when city is selected
  useEffect(() => {
    if (selectedCity) {
      fetchPGs(selectedCity);
      setSelectedPG(null);
    }
  }, [selectedCity]);

  const fetchPGs = async (city: string) => {
    try {
      setLoading(true);
      const response = await apiClient.request<any>(
        `/pg-management/city/${city}`
      );
      if (response.data) {
        setPGs(Array.isArray(response.data) ? response.data : []);
      } else if (response.status === 304) {
        // Handle 304 Not Modified - keep current data
        console.log("PG data cached (304 Not Modified)");
      } else {
        setPGs([]);
      }
    } catch (error) {
      console.error("Error fetching PGs:", error);
      toast.error("Failed to load PGs for " + city);
      setPGs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!selectedPG) {
      toast.error("Please select a PG");
      return;
    }

    if (noOfItems < (selectedPG.min_items || 4)) {
      toast.error(
        `Minimum ${selectedPG.min_items || 4} items required`
      );
      return;
    }

    if (!currentUser?.id && !currentUser?._id) {
      toast.error("Please login to create an order");
      return;
    }

    try {
      setLoading(true);

      const customerId = currentUser._id || currentUser.id;
      const pgOrderData = {
        customer_id: customerId,
        pg_id: selectedPG._id,
        pg_name: selectedPG.name,
        city: selectedCity,
        no_of_items: noOfItems,
        name: currentUser.full_name || currentUser.name || "N/A",
        phone: currentUser.phone || "N/A",
        address: selectedPG.address,
      };

      const response = await apiClient.request<any>("/pg-orders", {
        method: "POST",
        body: pgOrderData,
      });

      if (response.data) {
        const orderId = response.data.custom_order_id;
        toast.success(`Order created! Order ID: ${orderId}`);

        // Show instruction modal
        setInstructions({
          isOpen: true,
          orderId,
        });

        // Reset form
        setTimeout(() => {
          navigate("/");
        }, 3000);
      } else {
        toast.error("Failed to create order");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-laundrify-mint/10 to-laundrify-purple/10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="text-laundrify-blue hover:bg-laundrify-mint/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            PG Laundry & Iron Service
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Step 1: Select City */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-laundrify-mint/10">
              <CardTitle className="flex items-center gap-2 text-laundrify-blue">
                <MapPin className="h-5 w-5" />
                Step 1: Select Your City
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="w-full h-12 rounded-lg border-2 border-laundrify-mint focus:border-laundrify-purple">
                  <SelectValue placeholder="Select a city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Step 2: Select PG */}
          {selectedCity && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-laundrify-mint/10">
                <CardTitle className="flex items-center gap-2 text-laundrify-blue">
                  <Home className="h-5 w-5" />
                  Step 2: Select PG in {selectedCity}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin">
                      <div className="w-8 h-8 border-4 border-laundrify-mint border-t-laundrify-purple rounded-full"></div>
                    </div>
                    <span className="ml-3 text-gray-600">Loading PGs...</span>
                  </div>
                ) : pgs.length === 0 ? (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      No PGs available in {selectedCity}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pgs.map((pg) => (
                      <Card
                        key={pg._id}
                        onClick={() => setSelectedPG(pg)}
                        className={`cursor-pointer transition-all border-2 ${
                          selectedPG?._id === pg._id
                            ? "border-laundrify-purple bg-laundrify-purple/5 shadow-lg"
                            : "border-gray-200 hover:border-laundrify-mint"
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <h3 className="font-bold text-lg text-gray-900">
                              {pg.name}
                            </h3>
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-laundrify-purple" />
                              <span>{pg.address}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-4 w-4 flex-shrink-0 text-laundrify-purple" />
                              <span>{pg.phone_number}</span>
                            </div>
                            <div className="pt-2 border-t border-gray-100">
                              <p className="text-sm text-gray-700">
                                <span className="font-semibold text-laundrify-blue">
                                  ₹{pg.price_per_item}
                                </span>
                                {" "}per item • Min{" "}
                                <span className="font-semibold">
                                  {pg.min_items}
                                </span>
                                {" "}items
                              </p>
                            </div>
                            {pg.assignedVendorName && (
                              <div className="text-xs text-gray-500">
                                Vendor: {pg.assignedVendorName}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Select Items */}
          {selectedPG && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-laundrify-mint/10">
                <CardTitle className="flex items-center gap-2 text-laundrify-blue">
                  <Users className="h-5 w-5" />
                  Step 3: Select Number of Items
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">
                      Number of Items:
                    </label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setNoOfItems(
                            Math.max(
                              selectedPG.min_items || 4,
                              noOfItems - 1
                            )
                          )
                        }
                        className="h-10 w-10 p-0"
                      >
                        −
                      </Button>
                      <Input
                        type="number"
                        value={noOfItems}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 4;
                          setNoOfItems(
                            Math.max(selectedPG.min_items || 4, val)
                          );
                        }}
                        className="w-20 text-center h-10 border-2 border-laundrify-mint"
                        min={selectedPG.min_items || 4}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNoOfItems(noOfItems + 1)}
                        className="h-10 w-10 p-0"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {noOfItems < (selectedPG.min_items || 4) && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        Minimum {selectedPG.min_items || 4} items required
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Summary */}
          {selectedPG && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-laundrify-mint/20 to-laundrify-purple/10">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">PG Name:</span>
                    <span className="font-semibold text-gray-900">
                      {selectedPG.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Service:</span>
                    <span className="font-semibold text-gray-900">
                      Laundry and Iron
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Number of Items:</span>
                    <span className="font-semibold text-gray-900">
                      {noOfItems}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Price per Item:</span>
                    <span className="font-semibold text-gray-900">
                      ₹{pricePerItem}
                    </span>
                  </div>
                  <div className="border-t-2 border-laundrify-blue/20 pt-3 flex justify-between items-center">
                    <span className="text-lg font-bold text-laundrify-blue">
                      Total Amount:
                    </span>
                    <span className="text-3xl font-bold text-laundrify-blue">
                      ₹{totalPrice}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Confirm Order Button */}
          {selectedPG && (
            <Button
              onClick={handleCreateOrder}
              disabled={
                loading ||
                noOfItems < (selectedPG.min_items || 4) ||
                !currentUser
              }
              className="w-full h-14 bg-gradient-to-r from-laundrify-purple to-laundrify-pink hover:from-laundrify-purple/90 hover:to-laundrify-pink/90 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? "Creating Order..." : "Confirm Order"}
            </Button>
          )}

          {!currentUser && selectedPG && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Please login to create an order
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Instructions Modal */}
      <Dialog
        open={instructions.isOpen}
        onOpenChange={(open) =>
          setInstructions({ ...instructions, isOpen: open })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Booking Done!
            </DialogTitle>
            <DialogDescription>
              Order ID: {instructions.orderId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-3">
                📋 Next Steps:
              </h3>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="font-bold text-green-600 flex-shrink-0">
                    1.
                  </span>
                  <span>
                    Pack the order in a polybag kept near the box area of PG
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600 flex-shrink-0">
                    2.
                  </span>
                  <span>Paste sticker with Order ID: {instructions.orderId}</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-green-600 flex-shrink-0">
                    3.
                  </span>
                  <span>
                    Drop the packet inside the box which is put by Laundrify
                  </span>
                </li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() =>
                setInstructions({ ...instructions, isOpen: false })
              }
              className="w-full bg-laundrify-mint hover:bg-laundrify-mint/90 text-laundrify-blue font-semibold"
            >
              Got It!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PGBooking;
