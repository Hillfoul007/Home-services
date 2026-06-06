import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { getSortedServices } from "@/data/laundryServices";

interface Service {
  service_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CustomerData {
  _id: string;
  phone: string;
  name: string;
  wallet_balance: number;
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
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [usedWalletAmount, setUsedWalletAmount] = useState(0);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [discountType, setDiscountType] = useState<"amount" | "percentage">("amount");
  const [discountValue, setDiscountValue] = useState(0);

  // Lookup customer by phone to get wallet balance
  const lookupCustomer = async (phone: string) => {
    if (!phone || phone.length !== 10) {
      setCustomerData(null);
      return;
    }

    setSearchingCustomer(true);
    try {
      const response = await fetch(`/api/offline-store/customer-lookup?phone=${phone}`);
      const data = await response.json();

      if (data.success && data.customer) {
        setCustomerData(data.customer);
        if (data.customer.wallet_balance > 0) {
          toast.success(`Customer found! Wallet: ₹${data.customer.wallet_balance}`);
        } else {
          toast.info("Customer found but no wallet balance");
        }
      } else {
        setCustomerData(null);
      }
    } catch (error) {
      console.error("Error looking up customer:", error);
      setCustomerData(null);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const handleServiceChange = (
    index: number,
    field: keyof Service,
    value: any
  ) => {
    const newServices = [...services];
    const service = newServices[index];

    if (field === "service_name") {
      service.service_name = value;
      const matched = getSortedServices().find((s) => s.name === value);
      if (matched) {
        service.unit_price = matched.price;
        service.total_price = service.quantity * matched.price;
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

  const getDiscountAmount = () => {
    const subtotal = calculateTotal();
    if (discountType === "percentage") {
      return (subtotal * discountValue) / 100;
    }
    return discountValue;
  };

  const calculateFinalAmount = () => {
    const subtotal = calculateTotal();
    const discount = getDiscountAmount();
    const afterDiscount = subtotal - discount;
    const final = afterDiscount - usedWalletAmount;
    return Math.max(0, final);
  };

  const handleCustomerPhoneChange = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "").slice(0, 10);
    setCustomerPhone(cleaned);

    // Lookup customer after 10 digits are entered
    if (cleaned.length === 10) {
      lookupCustomer(cleaned);
    } else {
      setCustomerData(null);
    }
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
      const subtotal = calculateTotal();
      const discount = getDiscountAmount();
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
          total_price: subtotal,
          discount_amount: discount,
          discount_percent: discountType === "percentage" ? discountValue : 0,
          wallet_applied: usedWalletAmount,
          final_amount: calculateFinalAmount(),
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
        setDiscountValue(0);
        setDiscountType("amount");
        setUsedWalletAmount(0);
        setCustomerData(null);
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
                Phone Number * <span className="text-xs text-gray-500">(Auto-lookup wallet)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="Enter 10-digit phone number"
                  value={customerPhone}
                  onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                  maxLength={10}
                  required
                />
                {searchingCustomer && <Button disabled type="button" className="px-4">Searching...</Button>}
              </div>
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
                  <Select
                    value={service.service_name || ""}
                    onValueChange={(value) => {
                      const realValue = value === "__none__" ? "" : value;
                      handleServiceChange(index, "service_name", realValue);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select service">
                        {service.service_name ? (
                          <>{service.service_name} — ₹{service.unit_price || 0}</>
                        ) : (
                          "Select service"
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select service</SelectItem>
                      {getSortedServices().map((svc) => (
                        <SelectItem key={svc.id || svc.name} value={svc.name}>
                          {svc.name} — ₹{svc.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

        {/* Wallet and Discount Section */}
        <div className="space-y-4">
          {customerData && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-700">Customer Wallet</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Balance: ₹{customerData.wallet_balance.toFixed(2)}
                </label>
                <Input
                  type="number"
                  min="0"
                  max={customerData.wallet_balance}
                  value={usedWalletAmount}
                  onChange={(e) => setUsedWalletAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="Amount to use from wallet"
                  className="border-green-300"
                />
              </div>
            </div>
          )}

          {!customerData && customerPhone.length === 10 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600">No wallet found for this customer</p>
            </div>
          )}

          {/* Discount with Amount/Percentage Toggle */}
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Apply Discount
            </label>
            <div className="flex gap-3 mb-3">
              <button
                type="button"
                onClick={() => { setDiscountType("amount"); setDiscountValue(0); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  discountType === "amount"
                    ? "bg-orange-600 text-white"
                    : "bg-white text-orange-600 border border-orange-300"
                }`}
              >
                Amount (₹)
              </button>
              <button
                type="button"
                onClick={() => { setDiscountType("percentage"); setDiscountValue(0); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  discountType === "percentage"
                    ? "bg-orange-600 text-white"
                    : "bg-white text-orange-600 border border-orange-300"
                }`}
              >
                Percentage (%)
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                max={discountType === "percentage" ? 100 : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder={discountType === "percentage" ? "Enter percentage (0-100)" : "Enter discount amount"}
                className="border-orange-300"
              />
              <div className="px-4 py-2 bg-white border border-orange-300 rounded-lg text-sm font-semibold text-orange-600 whitespace-nowrap">
                ₹{getDiscountAmount().toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-end">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 min-w-[300px]">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-semibold">₹{calculateTotal().toFixed(2)}</span>
              </div>
              {getDiscountAmount() > 0 && (
                <div className="flex justify-between items-center text-orange-600">
                  <span className="text-sm">
                    Discount {discountType === "percentage" ? `(${discountValue}%)` : ""}:
                  </span>
                  <span className="font-semibold">-₹{getDiscountAmount().toFixed(2)}</span>
                </div>
              )}
              {usedWalletAmount > 0 && (
                <div className="flex justify-between items-center text-green-600">
                  <span className="text-sm">Wallet Used:</span>
                  <span className="font-semibold">-₹{usedWalletAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                <span className="text-lg font-bold text-blue-600">Final Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₹{calculateFinalAmount().toFixed(2)}
                </span>
              </div>
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
