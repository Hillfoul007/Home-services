import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Save, Search } from "lucide-react";
import { toast } from "sonner";

interface WebsiteService {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string;
}

interface Service {
  service_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderInputFormProps {
  onOrderCreated: () => void;
}

export default function OrderInputForm({ onOrderCreated }: OrderInputFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [services, setServices] = useState<Service[]>([
    { service_name: "", quantity: 1, unit_price: 0, total_price: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [websiteServices, setWebsiteServices] = useState<WebsiteService[]>([]);

  // Fetch website services on mount
  useEffect(() => {
    const fetchWebsiteServices = async () => {
      try {
        const response = await fetch("/api/services/dynamic");
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          // Flatten categories and services
          const flattened: WebsiteService[] = [];
          data.data.forEach((category: any) => {
            if (category.services && Array.isArray(category.services)) {
              category.services.forEach((s: any) => {
                flattened.push({
                  id: s.id,
                  name: s.name,
                  price: s.price,
                  unit: s.unit,
                  category: category.name,
                });
              });
            }
          });
          setWebsiteServices(flattened);
        }
      } catch (error) {
        console.error("Error fetching services:", error);
      }
    };

    fetchWebsiteServices();
  }, []);

  const handleServiceChange = (
    index: number,
    field: keyof Service,
    value: any
  ) => {
    const newServices = [...services];
    const service = newServices[index];

    if (field === "service_name") {
      service.service_name = value;
      // If the name matches one of our website services, auto-populate the price
      const matchedService = websiteServices.find(
        (ws) => ws.name.toLowerCase() === value.toLowerCase()
      );
      if (matchedService) {
        service.unit_price = matchedService.price;
        service.total_price = service.quantity * matchedService.price;
      }
    } else if (field === "quantity" || field === "unit_price") {
      const quantity = field === "quantity" ? value : service.quantity;
      const unitPrice = field === "unit_price" ? value : service.unit_price;
      service[field] = value;
      service.total_price = quantity * unitPrice;
    } else {
      service[field] = value;
    }

    setServices(newServices);
  };

  const addService = () => {
    setServices([
      ...services,
      { service_name: "", quantity: 1, unit_price: 0, total_price: 0 },
    ]);
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return services.reduce((sum, service) => sum + service.total_price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName || !customerPhone) {
      toast.error("Please enter customer name and phone");
      return;
    }

    if (services.length === 0 || services.some((s) => !s.service_name)) {
      toast.error("Please add at least one service");
      return;
    }

    const token = localStorage.getItem("offline_store_token");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/offline-store/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          services: services,
          address: address,
          total_price: calculateTotal(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Order created successfully!");
        // Reset form
        setCustomerName("");
        setCustomerPhone("");
        setAddress("");
        setServices([
          { service_name: "", quantity: 1, unit_price: 0, total_price: 0 },
        ]);
        onOrderCreated();
      } else {
        toast.error(data.error || "Failed to create order");
      }
    } catch (error: any) {
      toast.error(error.message || "Error creating order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">Create New Order</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-4">Customer Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <Input
                type="text"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <Input
                type="tel"
                placeholder="Enter 10-digit phone number"
                value={customerPhone}
                onChange={(e) =>
                  setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                maxLength={10}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <Input
                type="text"
                placeholder="Enter delivery address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Services</h3>
            <Button
              type="button"
              onClick={addService}
              variant="outline"
              className="flex items-center gap-2 h-9"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </Button>
          </div>

          <div className="space-y-3">
            {services.map((service, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-white p-4 rounded-lg border">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Service Name
                  </label>
                  <Input
                    list={`service-options-${index}`}
                    type="text"
                    placeholder="e.g., Shirt Wash"
                    value={service.service_name}
                    onChange={(e) =>
                      handleServiceChange(index, "service_name", e.target.value)
                    }
                    required
                  />
                  <datalist id={`service-options-${index}`}>
                    {websiteServices.map((ws) => (
                      <option key={ws.id} value={ws.name}>
                        {ws.category} - ₹{ws.price} {ws.unit}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Qty
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={service.quantity}
                    onChange={(e) =>
                      handleServiceChange(index, "quantity", parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Unit Price
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={service.unit_price}
                    onChange={(e) =>
                      handleServiceChange(index, "unit_price", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Total
                  </label>
                  <div className="px-3 py-2 border rounded-md bg-gray-100 text-sm font-semibold">
                    ₹{service.total_price.toFixed(2)}
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => removeService(index)}
                  variant="destructive"
                  size="sm"
                  className="h-10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-end">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 min-w-[250px]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-700">Subtotal:</span>
              <span className="font-semibold">₹{calculateTotal().toFixed(2)}</span>
            </div>
            <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
              <span className="text-lg font-bold text-blue-600">Total:</span>
              <span className="text-2xl font-bold text-blue-600">
                ₹{calculateTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 justify-end">
          <Button
            type="submit"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6"
            disabled={loading}
          >
            <Save className="w-4 h-4" />
            {loading ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
