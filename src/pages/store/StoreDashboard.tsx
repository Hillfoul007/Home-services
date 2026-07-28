import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LogOut, Plus, Eye, Trash2, Phone, User, Clock, Calendar,
  Save, Store, Package, Search, Scale, Ban, Loader2, CheckCircle2, RefreshCw,
  MessageCircle, Printer, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/config/env";
import { getSortedServices } from "@/data/laundryServices";

interface StoreInfo {
  _id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  address: string;
  phone: string;
}

interface ServiceItem {
  service_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  piece_count?: number;
  // Set when this line was added via the "by piece (package)" option — the
  // catalog says this service is KG-priced, but this customer's package
  // covers it by piece count instead. Overrides the catalog-derived unit
  // for matching/display purposes on this line only.
  unit_override?: "PC";
}

interface PackageApplied {
  service_name: string;
  unit_type: "KG" | "PC";
  quantity: number;
  amount_covered?: number;
}

interface PackageConsumptionEntry {
  _id: string;
  order_id: string | null;
  order_custom_id: string;
  order_type: "store_order" | "booking";
  quantity: number;
  amount_covered: number;
  consumed_at: string;
}

interface CustomerPackageT {
  _id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  unit_type: "KG" | "PC";
  total_quantity: number;
  remaining_quantity: number;
  price: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  consumption_history?: PackageConsumptionEntry[];
}

interface PackageBalanceEntry {
  service_name: string;
  unit_type: "KG" | "PC";
  remaining_quantity: number;
}

interface Order {
  _id: string;
  custom_order_id: string;
  customer_name: string;
  customer_phone: string;
  services: string[];
  item_prices: ServiceItem[];
  total_price: number;
  discount_amount?: number;
  wallet_applied?: number;
  cashback?: number;
  final_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  riderStatus: string;
  is_store_order?: boolean;
  assigned_store_id?: string;
  package_applied?: PackageApplied;
  address?: string;
}

const STATUS_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  processing: "bg-orange-100 text-orange-800",
  ready: "bg-teal-100 text-teal-800",
  completed: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
  delivered: "bg-green-100 text-green-800",
  vendor_assigned: "bg-purple-100 text-purple-800",
};

const ALL_STATUSES = ["created", "pending", "confirmed", "processing", "ready", "completed", "delivered", "cancelled"];

const ACTIVE_STATUSES = new Set(["created", "pending", "confirmed", "processing", "ready", "vendor_assigned"]);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function toWhatsAppPhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function callHref(phone: string) {
  return `tel:${(phone || "").replace(/\D/g, "")}`;
}

function whatsAppHref(phone: string, message: string) {
  return `https://wa.me/${toWhatsAppPhone(phone)}?text=${encodeURIComponent(message)}`;
}

function buildOrderSummaryText(order: Order, storeName: string) {
  const lines = [
    `*${storeName}*`,
    `Order: ${order.custom_order_id}`,
    `Date: ${formatDate(order.created_at)} ${formatTime(order.created_at)}`,
    "",
    "Items:",
    ...order.item_prices.map(
      (i) =>
        `• ${i.service_name} x${i.quantity}${i.piece_count ? ` (${i.piece_count} pcs)` : ""} — ₹${i.total_price ?? i.unit_price * i.quantity}`
    ),
    "",
    `Subtotal: ₹${order.total_price}`,
  ];
  if (order.discount_amount) lines.push(`Discount: -₹${order.discount_amount}`);
  if (order.wallet_applied || order.cashback) lines.push(`Wallet Applied: -₹${order.wallet_applied || order.cashback}`);
  if (order.package_applied?.quantity) {
    lines.push(
      `Package (${order.package_applied.quantity} ${order.package_applied.unit_type} ${order.package_applied.service_name}): -₹${(order.package_applied.amount_covered || 0).toFixed(0)}`
    );
  }
  lines.push(`*Total: ₹${order.final_amount}*`, "", `Status: ${order.status}`);
  return lines.join("\n");
}

function printReceipt(order: Order, storeName: string) {
  const win = window.open("", "_blank", "width=380,height=600");
  if (!win) return;
  const itemRows = order.item_prices
    .map(
      (i) => `
      <tr>
        <td>${i.service_name}${i.piece_count ? `<br/><span class="muted">${i.piece_count} pcs</span>` : ""}</td>
        <td class="center">${i.quantity}</td>
        <td class="right">₹${i.total_price ?? i.unit_price * i.quantity}</td>
      </tr>`
    )
    .join("");

  win.document.write(`
    <html>
      <head>
        <title>Receipt ${order.custom_order_id}</title>
        <style>
          body { font-family: monospace; padding: 16px; max-width: 340px; margin: 0 auto; color: #111; }
          h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
          .center-text { text-align: center; font-size: 12px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 4px 2px; text-align: left; border-bottom: 1px dashed #ccc; }
          .center { text-align: center; }
          .right { text-align: right; }
          .muted { color: #777; font-size: 10px; }
          .totals td { border-bottom: none; padding-top: 6px; }
          .grand { font-weight: bold; font-size: 14px; border-top: 1px solid #000; }
          hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>${storeName}</h1>
        <div class="center-text">Order ${order.custom_order_id}<br/>${formatDate(order.created_at)} ${formatTime(order.created_at)}</div>
        <div>Customer: ${order.customer_name}<br/>Phone: ${order.customer_phone}</div>
        <hr/>
        <table>
          <thead><tr><th>Item</th><th class="center">Qty</th><th class="right">Amount</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tbody class="totals">
            <tr><td colspan="2">Subtotal</td><td class="right">₹${order.total_price}</td></tr>
            ${order.discount_amount ? `<tr><td colspan="2">Discount</td><td class="right">-₹${order.discount_amount}</td></tr>` : ""}
            ${order.wallet_applied || order.cashback ? `<tr><td colspan="2">Wallet</td><td class="right">-₹${order.wallet_applied || order.cashback}</td></tr>` : ""}
            ${order.package_applied?.quantity ? `<tr><td colspan="2">Package (${order.package_applied.quantity} ${order.package_applied.unit_type} ${order.package_applied.service_name})</td><td class="right">-₹${(order.package_applied.amount_covered || 0).toFixed(0)}</td></tr>` : ""}
            <tr class="grand"><td colspan="2">Total</td><td class="right">₹${order.final_amount}</td></tr>
          </tbody>
        </table>
        <hr/>
        <div class="center-text">Thank you!</div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

export default function StoreDashboard() {
  const navigate = useNavigate();
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "create" | "packages">("orders");

  // Orders tab state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editedOrder, setEditedOrder] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Packages tab state
  const [packages, setPackages] = useState<CustomerPackageT[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageSearch, setPackageSearch] = useState("");
  const [pkgCustomerName, setPkgCustomerName] = useState("");
  const [pkgCustomerPhone, setPkgCustomerPhone] = useState("");
  const [pkgServiceName, setPkgServiceName] = useState("");
  const [pkgQuantity, setPkgQuantity] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgStartDate, setPkgStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pkgValidityDays, setPkgValidityDays] = useState(30);
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  // Package balance lookup for the "Create Order" tab
  const [orderPhoneBalance, setOrderPhoneBalance] = useState<PackageBalanceEntry[]>([]);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [packageApplied, setPackageApplied] = useState<PackageApplied | null>(null);

  // Create order tab state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([
    { service_name: "", quantity: 1, unit_price: 0, total_price: 0 },
  ]);
  const [discountType, setDiscountType] = useState<"amount" | "percentage">("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("store_token");
    const info = localStorage.getItem("store_info");
    if (!token || !info) {
      navigate("/store");
      return;
    }
    try {
      setStoreInfo(JSON.parse(info));
    } catch {
      navigate("/store");
    }
  }, [navigate]);

  const ORDERS_PAGE_SIZE = 20;

  const fetchOrders = async (page = 1, append = false) => {
    const token = localStorage.getItem("store_token");
    if (!token) return;
    if (append) setLoadingMoreOrders(true); else setLoadingOrders(true);
    try {
      const params = new URLSearchParams({ sortBy, page: String(page), limit: String(ORDERS_PAGE_SIZE) });
      if (filterStatus) params.set("filterStatus", filterStatus);
      const res = await fetch(`${getApiUrl()}/store/orders/my-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => (append ? [...prev, ...(data.orders || [])] : data.orders || []));
        setOrdersHasMore(!!data.hasMore);
        setOrdersPage(page);
      } else {
        toast.error(data.error || "Failed to fetch orders");
      }
    } catch {
      toast.error("Error fetching orders");
    } finally {
      setLoadingOrders(false);
      setLoadingMoreOrders(false);
    }
  };

  useEffect(() => {
    if (storeInfo) fetchOrders(1, false);
  }, [storeInfo, sortBy, filterStatus]);

  const loadMoreOrders = () => {
    if (loadingMoreOrders || !ordersHasMore) return;
    fetchOrders(ordersPage + 1, true);
  };

  // Debounce the search box so typing doesn't re-filter on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const filteredOrders = orders.filter((o) => {
    if (!debouncedSearchTerm) return true;
    const s = debouncedSearchTerm.toLowerCase();
    return (
      o.custom_order_id?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s) ||
      o.customer_phone?.includes(debouncedSearchTerm)
    );
  });

  const activeOrders = filteredOrders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const inactiveOrders = filteredOrders.filter((o) => !ACTIVE_STATUSES.has(o.status));

  const handleLogout = () => {
    localStorage.removeItem("store_token");
    localStorage.removeItem("store_info");
    navigate("/store");
  };

  // ─── Order detail ──────────────────────────────────────────────────────────

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    setEditedOrder({ ...order });
    setIsEditMode(false);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedOrder) return;
    const token = localStorage.getItem("store_token");
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${getApiUrl()}/store/orders/${selectedOrder._id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Status updated");
        setSelectedOrder(data.order);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch {
      toast.error("Error updating status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!selectedOrder || !editedOrder) return;
    const token = localStorage.getItem("store_token");
    setSavingOrder(true);
    try {
      const res = await fetch(`${getApiUrl()}/store/orders/${selectedOrder._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: editedOrder.customer_name,
          customer_phone: editedOrder.customer_phone,
          item_prices: editedOrder.item_prices,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Order updated");
        setSelectedOrder(data.order);
        setEditedOrder(data.order);
        setIsEditMode(false);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to update order");
      }
    } catch {
      toast.error("Error updating order");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    if (!window.confirm("Delete this order? This cannot be undone.")) return;
    const token = localStorage.getItem("store_token");
    try {
      const res = await fetch(`${getApiUrl()}/store/orders/${selectedOrder._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Order deleted");
        setSelectedOrder(null);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to delete order");
      }
    } catch {
      toast.error("Error deleting order");
    }
  };

  // ─── Create order ──────────────────────────────────────────────────────────

  const handleServiceChange = (index: number, field: keyof ServiceItem, value: any) => {
    const items = [...serviceItems];
    const item = { ...items[index], [field]: value };
    if (field === "service_name") {
      item.unit_override = undefined;
      const match = getSortedServices().find((s) => s.name === value);
      if (match) {
        item.unit_price = match.price;
        item.total_price = item.quantity * match.price;
      }
    }
    if (field === "quantity" || field === "unit_price") {
      item.total_price = (field === "quantity" ? value : item.quantity) * (field === "unit_price" ? value : item.unit_price);
    }
    items[index] = item;
    setServiceItems(items);
  };

  const subtotal = serviceItems.reduce((s, i) => s + i.total_price, 0);
  const discountAmount = discountType === "percentage" ? (subtotal * discountValue) / 100 : discountValue;

  // ─── Package balance application ───────────────────────────────────────────

  const getServiceUnit = (name: string): "KG" | "PC" | "SET" | null => {
    const match = getSortedServices().find((s) => s.name === name);
    return (match?.unit as "KG" | "PC" | "SET") || null;
  };

  // A cart line's real unit — normally from the catalog, but a line added
  // via "by piece (package)" overrides it, since some customers have a
  // piece-count package for a service the catalog otherwise sells by kg.
  const getEffectiveUnit = (item: ServiceItem): "KG" | "PC" | "SET" | null =>
    item.unit_override || getServiceUnit(item.service_name);

  // Package balance entries whose service is normally KG-priced in the
  // catalog, but this customer has a PC (piece) package for it instead —
  // these get a special "by piece" quick-add option in the cart, scoped to
  // only the customers who actually have such a package.
  const pieceOverridePackages = orderPhoneBalance.filter(
    (entry) => entry.unit_type === "PC" && getServiceUnit(entry.service_name) === "KG"
  );

  const handleSelectPackagePieceService = (index: number, serviceName: string) => {
    const items = [...serviceItems];
    items[index] = {
      ...items[index],
      service_name: serviceName,
      unit_override: "PC",
      unit_price: 0,
      total_price: 0,
      piece_count: undefined,
    };
    setServiceItems(items);
  };

  // Services that can carry a quantity package — SET-unit services never can
  const PACKAGEABLE_SERVICES = getSortedServices().filter((s) => s.unit === "KG" || s.unit === "PC");

  // Cart quantity required per exact service name (a package only covers the
  // specific service it was sold for, since e.g. Laundry and Fold vs Laundry
  // and Iron are priced very differently despite both being KG-based)
  const requiredByService = serviceItems.reduce((acc: Record<string, number>, item) => {
    if (!item.service_name) return acc;
    acc[item.service_name] = (acc[item.service_name] || 0) + item.quantity;
    return acc;
  }, {});

  const packageCoveredAmount = packageApplied
    ? serviceItems
        .filter((item) => item.service_name === packageApplied.service_name)
        .reduce((s, i) => s + i.total_price, 0)
    : 0;

  const finalAmount = Math.max(0, subtotal - discountAmount - packageCoveredAmount);

  // Look up the customer's package balance once a full phone number is entered
  useEffect(() => {
    setPackageApplied(null);
    if (!/^\d{10}$/.test(customerPhone)) {
      setOrderPhoneBalance([]);
      return;
    }
    const token = localStorage.getItem("store_token");
    if (!token) return;
    const t = setTimeout(async () => {
      setCheckingBalance(true);
      try {
        const res = await fetch(`${getApiUrl()}/store/packages/balance/${customerPhone}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setOrderPhoneBalance(data.balance || []);
      } catch {
        // silent — package balance is an optional affordance
      } finally {
        setCheckingBalance(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [customerPhone]);

  const applyPackage = (entry: PackageBalanceEntry) => {
    const required = requiredByService[entry.service_name] || 0;
    if (required <= 0 || entry.remaining_quantity < required) return;
    setPackageApplied({ service_name: entry.service_name, unit_type: entry.unit_type, quantity: required });
  };

  const removePackage = () => setPackageApplied(null);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      toast.error("Customer name and phone are required");
      return;
    }
    if (serviceItems.some((s) => !s.service_name)) {
      toast.error("Please fill in all service names");
      return;
    }
    const token = localStorage.getItem("store_token");
    setCreatingOrder(true);
    try {
      const res = await fetch(`${getApiUrl()}/store/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          address,
          services: serviceItems,
          total_price: subtotal,
          discount_amount: discountAmount,
          final_amount: finalAmount,
          package_applied: packageApplied,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Order ${data.order.custom_order_id} created!`);
        setCustomerName("");
        setCustomerPhone("");
        setAddress("");
        setServiceItems([{ service_name: "", quantity: 1, unit_price: 0, total_price: 0 }]);
        setDiscountValue(0);
        setPackageApplied(null);
        setOrderPhoneBalance(null);
        setActiveTab("orders");
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to create order");
      }
    } catch {
      toast.error("Error creating order");
    } finally {
      setCreatingOrder(false);
    }
  };

  // ─── Packages tab ───────────────────────────────────────────────────────────

  const fetchPackages = async (search = packageSearch) => {
    const token = localStorage.getItem("store_token");
    if (!token) return;
    setLoadingPackages(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      const res = await fetch(`${getApiUrl()}/store/packages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPackages(data.packages || []);
      } else {
        toast.error(data.error || "Failed to fetch packages");
      }
    } catch {
      toast.error("Error fetching packages");
    } finally {
      setLoadingPackages(false);
    }
  };

  useEffect(() => {
    if (storeInfo && activeTab === "packages") fetchPackages();
  }, [storeInfo, activeTab]);

  useEffect(() => {
    if (activeTab !== "packages") return;
    const t = setTimeout(() => fetchPackages(packageSearch), 300);
    return () => clearTimeout(t);
  }, [packageSearch]);

  const packageEndDatePreview = (() => {
    const d = new Date(pkgStartDate);
    d.setDate(d.getDate() + (Number(pkgValidityDays) || 0));
    return d;
  })();

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgCustomerPhone || !/^\d{10}$/.test(pkgCustomerPhone)) {
      toast.error("A valid 10-digit customer phone is required");
      return;
    }
    if (!pkgServiceName) {
      toast.error("Please select a service for this package");
      return;
    }
    const pkgUnitType = getServiceUnit(pkgServiceName);
    if (!pkgUnitType || pkgUnitType === "SET") {
      toast.error("Selected service cannot carry a quantity package");
      return;
    }
    const quantity = parseFloat(pkgQuantity);
    const price = parseFloat(pkgPrice);
    if (!quantity || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (isNaN(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    const token = localStorage.getItem("store_token");
    setCreatingPackage(true);
    try {
      const res = await fetch(`${getApiUrl()}/store/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: pkgCustomerName,
          customer_phone: pkgCustomerPhone,
          service_name: pkgServiceName,
          unit_type: pkgUnitType,
          quantity,
          price,
          start_date: pkgStartDate,
          validity_days: pkgValidityDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Package created for ${pkgCustomerName || pkgCustomerPhone}`);
        setPkgCustomerName("");
        setPkgCustomerPhone("");
        setPkgServiceName("");
        setPkgQuantity("");
        setPkgPrice("");
        setPkgValidityDays(30);
        fetchPackages();
      } else {
        toast.error(data.error || "Failed to create package");
      }
    } catch {
      toast.error("Error creating package");
    } finally {
      setCreatingPackage(false);
    }
  };

  const handleCancelPackage = async (pkg: CustomerPackageT) => {
    if (!window.confirm(`Cancel this ${pkg.unit_type} package for ${pkg.customer_name || pkg.customer_phone}?`)) return;
    const token = localStorage.getItem("store_token");
    try {
      const res = await fetch(`${getApiUrl()}/store/packages/${pkg._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Package cancelled");
        fetchPackages();
      } else {
        toast.error(data.error || "Failed to cancel package");
      }
    } catch {
      toast.error("Error cancelling package");
    }
  };

  const packageStatus = (pkg: CustomerPackageT): "active" | "expired" | "used" | "cancelled" => {
    if (!pkg.is_active) return "cancelled";
    if (new Date(pkg.end_date) < new Date()) return "expired";
    if (pkg.remaining_quantity <= 0) return "used";
    return "active";
  };

  const PACKAGE_STATUS_COLORS: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    expired: "bg-gray-200 text-gray-700",
    used: "bg-orange-100 text-orange-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const renderPackageHistory = (pkg: CustomerPackageT) => {
    const history = pkg.consumption_history || [];
    if (history.length === 0) {
      return <p className="text-xs text-gray-500">No orders have used this package yet.</p>;
    }
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Consumption History</p>
        {[...history]
          .sort((a, b) => new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime())
          .map((entry) => (
            <div key={entry._id} className="flex items-center justify-between text-sm bg-white border rounded-lg px-3 py-2">
              <div>
                <span className="font-mono text-blue-600">{entry.order_custom_id || "Pending order"}</span>
                <span className="ml-2 text-xs text-gray-500 capitalize">{entry.order_type.replace("_", " ")}</span>
                <p className="text-xs text-gray-500">{formatDate(entry.consumed_at)} {formatTime(entry.consumed_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{entry.quantity} {pkg.unit_type}</p>
                <p className="text-xs text-gray-500">₹{entry.amount_covered.toFixed(0)} value</p>
              </div>
            </div>
          ))}
      </div>
    );
  };

  if (!storeInfo) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{storeInfo.store_name}</h1>
              <p className="text-xs text-gray-500">Code: {storeInfo.store_code} · ID: {storeInfo.store_id}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 flex gap-6 overflow-x-auto">
          {(["orders", "create", "packages"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 font-medium border-b-2 capitalize transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "orders" ? "📋 My Orders" : tab === "create" ? "➕ Create Order" : "🎟️ Packages"}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
        {/* ── Create Order Tab ── */}
        {activeTab === "create" && (
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleCreateOrder} className="space-y-4">
              {/* Customer Info */}
              <Card className="p-4">
                <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" /> Customer Info
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <Input
                      placeholder="Customer name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-11 text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="10-digit phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      className="h-11 text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <Input
                      placeholder="Delivery address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                </div>
              </Card>

              {/* Cart */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" /> Cart
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {serviceItems.length} item{serviceItems.length !== 1 ? "s" : ""}
                    </span>
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setServiceItems([...serviceItems, { service_name: "", quantity: 1, unit_price: 0, total_price: 0 }])}
                    className="h-9 text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {serviceItems.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
                      {/* Service dropdown — full width */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select
                            value={item.service_name || ""}
                            onValueChange={(value) => {
                              if (value === "__none__") {
                                handleServiceChange(idx, "service_name", "");
                                return;
                              }
                              if (value.endsWith("__pkg_pc")) {
                                handleSelectPackagePieceService(idx, value.replace(/__pkg_pc$/, ""));
                                return;
                              }
                              handleServiceChange(idx, "service_name", value);
                            }}
                          >
                            <SelectTrigger className="h-11 text-sm font-medium">
                              <SelectValue placeholder="Select service">
                                {item.service_name
                                  ? `${item.service_name}${item.unit_override === "PC" ? " (by piece — package)" : ""}`
                                  : "Select service"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select service</SelectItem>
                              {pieceOverridePackages.map((entry) => (
                                <SelectItem key={`${entry.service_name}__pkg_pc`} value={`${entry.service_name}__pkg_pc`}>
                                  🎟️ {entry.service_name} — by piece (Package, {entry.remaining_quantity} left)
                                </SelectItem>
                              ))}
                              {getSortedServices().map((svc) => (
                                <SelectItem key={svc.id || svc.name} value={svc.name}>
                                  {svc.name} — ₹{svc.price}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {item.unit_override === "PC" && (
                            <p className="text-xs text-indigo-600 mt-1">🎟️ Billed by piece from this customer's package</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={serviceItems.length === 1}
                          onClick={() => setServiceItems(serviceItems.filter((_, i) => i !== idx))}
                          className="h-11 w-11 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Qty + Rate + Total — 3 col row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            {getEffectiveUnit(item) === "PC" ? "Pieces" : "Qty"}
                          </label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0.01}
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => handleServiceChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                            className="h-10 text-center text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Rate ₹</label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => handleServiceChange(idx, "unit_price", parseFloat(e.target.value) || 0)}
                            className="h-10 text-center text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Total</label>
                          <div className="h-10 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-md text-sm font-bold text-blue-700">
                            ₹{item.total_price.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Pieces — optional, for reconciling garment count on kg-billed laundry */}
                      {getEffectiveUnit(item) === "KG" && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Pieces (optional garment count)</label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step="1"
                            placeholder="e.g. 12"
                            value={item.piece_count ?? ""}
                            onChange={(e) => handleServiceChange(idx, "piece_count", e.target.value === "" ? undefined : parseInt(e.target.value, 10) || 0)}
                            className="h-10 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Cart subtotal */}
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Subtotal</span>
                  <span className="font-bold text-gray-800">₹{subtotal.toFixed(2)}</span>
                </div>
              </Card>

              {/* Package Balance */}
              {customerPhone.length === 10 && (checkingBalance || orderPhoneBalance.length > 0) && (
                <Card className="p-4 border-indigo-200 bg-indigo-50">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-indigo-900">
                    <Scale className="w-4 h-4 text-indigo-600" /> Package Balance
                  </h3>
                  {checkingBalance ? (
                    <p className="text-sm text-indigo-700 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking balance...
                    </p>
                  ) : packageApplied ? (
                    <div className="flex items-center justify-between bg-white border border-indigo-300 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm text-indigo-800 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Applying {packageApplied.quantity} {packageApplied.unit_type} of {packageApplied.service_name}
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-red-500" onClick={removePackage}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orderPhoneBalance.map((entry) => {
                        const required = requiredByService[entry.service_name] || 0;
                        if (required <= 0) return null;
                        const sufficient = entry.remaining_quantity >= required;
                        return (
                          <div key={entry.service_name} className="flex items-center justify-between bg-white border border-indigo-200 rounded-lg p-3">
                            <div className="text-sm">
                              <p className="font-medium text-gray-800">{entry.remaining_quantity} {entry.unit_type} of {entry.service_name} available</p>
                              <p className={`text-xs ${sufficient ? "text-gray-500" : "text-red-500"}`}>
                                {sufficient
                                  ? `Order needs ${required} ${entry.unit_type}`
                                  : `Order needs ${required} ${entry.unit_type} — short by ${(required - entry.remaining_quantity).toFixed(2)}, top up to apply`}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!sufficient}
                              onClick={() => applyPackage(entry)}
                              className="h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                              Apply
                            </Button>
                          </div>
                        );
                      })}
                      {orderPhoneBalance.every((entry) => !requiredByService[entry.service_name]) && (
                        <p className="text-xs text-indigo-700">Customer has a package balance, but none of those services are in the cart yet.</p>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {/* Discount */}
              <Card className="p-4 border-orange-200 bg-orange-50">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Discount (optional)</label>
                <div className="flex gap-2 mb-3">
                  {(["amount", "percentage"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setDiscountType(t); setDiscountValue(0); }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        discountType === t ? "bg-orange-600 text-white" : "bg-white text-orange-600 border border-orange-300"
                      }`}
                    >
                      {t === "amount" ? "₹ Amount" : "% Percent"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={discountType === "percentage" ? 100 : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder={discountType === "percentage" ? "Enter %" : "Enter ₹ amount"}
                    className="h-11 text-base border-orange-300"
                  />
                  {discountAmount > 0 && (
                    <div className="px-3 py-2 bg-white border border-orange-300 rounded-lg text-sm font-bold text-orange-600 whitespace-nowrap">
                      −₹{discountAmount.toFixed(0)}
                    </div>
                  )}
                </div>
              </Card>

              {/* Summary + Submit — sticky bottom on mobile */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">₹{subtotal.toFixed(0)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Discount {discountType === "percentage" ? `(${discountValue}%)` : ""}</span>
                      <span className="font-medium">−₹{discountAmount.toFixed(0)}</span>
                    </div>
                  )}
                  {packageApplied && (
                    <div className="flex justify-between text-sm text-indigo-600">
                      <span>Package ({packageApplied.quantity} {packageApplied.unit_type} {packageApplied.service_name})</span>
                      <span className="font-medium">−₹{packageCoveredAmount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                    <span className="text-base font-bold text-blue-800">Final Amount</span>
                    <span className="text-2xl font-bold text-blue-700">₹{finalAmount.toFixed(0)}</span>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 font-semibold"
                  disabled={creatingOrder}
                >
                  <Save className="w-5 h-5 mr-2" />
                  {creatingOrder ? "Creating Order..." : "Create Order"}
                </Button>
              </Card>
            </form>
          </div>
        )}

        {/* ── Orders Tab ── */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <p className="text-sm text-gray-500">Total Orders</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-orange-600">{activeOrders.length}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-gray-500">Store Orders</p>
                <p className="text-2xl font-bold text-blue-600">{orders.filter((o) => o.is_store_order).length}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-gray-500">Assigned</p>
                <p className="text-2xl font-bold text-purple-600">{orders.filter((o) => !o.is_store_order).length}</p>
              </Card>
            </div>

            {/* Filters */}
            <Card className="p-3">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by ID, name or phone"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
                  >
                    <option value="">All Status</option>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "recent" | "oldest")}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
                  >
                    <option value="recent">Recent First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            </Card>

            {loadingOrders ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="flex justify-between items-start mb-2">
                      <div className="h-4 w-24 bg-gray-200 rounded" />
                      <div className="h-5 w-16 bg-gray-200 rounded-full" />
                    </div>
                    <div className="h-3 w-32 bg-gray-100 rounded mb-2" />
                    <div className="h-3 w-20 bg-gray-100 rounded" />
                  </Card>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No orders found</p>
                <Button onClick={() => setActiveTab("create")} className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create First Order
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Active Orders */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                      🔴 Active Orders ({activeOrders.length})
                    </span>
                  </div>
                  {activeOrders.length === 0 ? (
                    <Card className="p-6 text-center bg-green-50 border-green-200">
                      <p className="text-green-700 font-medium">✓ All caught up — no active orders!</p>
                    </Card>
                  ) : (
                    <OrderTable orders={activeOrders} onView={openOrder} storeName={storeInfo.store_name} />
                  )}
                </div>

                {/* Inactive (collapsed) */}
                {inactiveOrders.length > 0 && (
                  <div className="border-t pt-4">
                    <button
                      onClick={() => setShowInactive(!showInactive)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <span className="font-semibold text-gray-700">
                        📦 Inactive Orders ({inactiveOrders.length})
                      </span>
                      <span className={`text-gray-500 transition-transform ${showInactive ? "rotate-180" : ""}`}>▼</span>
                    </button>
                    {showInactive && (
                      <div className="mt-4">
                        <OrderTable orders={inactiveOrders} onView={openOrder} storeName={storeInfo.store_name} />
                      </div>
                    )}
                  </div>
                )}

                {ordersHasMore && !debouncedSearchTerm && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" onClick={loadMoreOrders} disabled={loadingMoreOrders} className="flex items-center gap-2">
                      {loadingMoreOrders ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {loadingMoreOrders ? "Loading..." : "Load More Orders"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Packages Tab ── */}
        {activeTab === "packages" && (
          <div className="space-y-6">
            {/* Create Package */}
            <Card className="p-4">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" /> Sell a Package
              </h3>
              <form onSubmit={handleCreatePackage} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                    <Input
                      placeholder="Customer name"
                      value={pkgCustomerName}
                      onChange={(e) => setPkgCustomerName(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="10-digit phone"
                      value={pkgCustomerPhone}
                      onChange={(e) => setPkgCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      className="h-11 text-base"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
                  <Select value={pkgServiceName} onValueChange={setPkgServiceName}>
                    <SelectTrigger className="h-11 text-sm font-medium">
                      <SelectValue placeholder="Select a service">
                        {pkgServiceName || "Select a service"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PACKAGEABLE_SERVICES.map((svc) => (
                        <SelectItem key={svc.id || svc.name} value={svc.name}>
                          {svc.name} — ₹{svc.price}/{svc.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity {getServiceUnit(pkgServiceName) ? `(${getServiceUnit(pkgServiceName)})` : ""} *
                    </label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step="0.01"
                      placeholder={getServiceUnit(pkgServiceName) === "PC" ? "e.g. 50" : "e.g. 20"}
                      value={pkgQuantity}
                      onChange={(e) => setPkgQuantity(e.target.value)}
                      className="h-11 text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price ₹ *</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 1500"
                      value={pkgPrice}
                      onChange={(e) => setPkgPrice(e.target.value)}
                      className="h-11 text-base"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <Input
                      type="date"
                      value={pkgStartDate}
                      onChange={(e) => setPkgStartDate(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validity</label>
                    <select
                      value={pkgValidityDays}
                      onChange={(e) => setPkgValidityDays(Number(e.target.value))}
                      className="w-full h-11 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {[7, 15, 30, 60, 90].map((d) => (
                        <option key={d} value={d}>{d} days</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Valid from {new Date(pkgStartDate).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })} until{" "}
                  <span className="font-medium text-gray-700">
                    {packageEndDatePreview.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </p>

                <Button type="submit" disabled={creatingPackage} className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 font-semibold">
                  {creatingPackage ? "Creating..." : "Create Package"}
                </Button>
              </form>
            </Card>

            {/* Package List */}
            <Card className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or phone"
                  value={packageSearch}
                  onChange={(e) => setPackageSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
            </Card>

            {loadingPackages ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="p-4 animate-pulse h-20" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <Card className="p-12 text-center">
                <Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No packages created yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Desktop table */}
                <Card className="hidden md:block overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["Customer", "Service", "Remaining", "Price", "Valid Until", "Status", ""].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {packages.map((pkg) => {
                        const status = packageStatus(pkg);
                        const isExpanded = expandedPackageId === pkg._id;
                        return (
                          <Fragment key={pkg._id}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-sm">{pkg.customer_name || "—"}</p>
                                <p className="text-xs text-gray-500">{pkg.customer_phone}</p>
                              </td>
                              <td className="px-4 py-3 text-sm">{pkg.service_name}</td>
                              <td className="px-4 py-3 text-sm font-semibold">{pkg.remaining_quantity} / {pkg.total_quantity} {pkg.unit_type}</td>
                              <td className="px-4 py-3 text-sm">₹{pkg.price}</td>
                              <td className="px-4 py-3 text-xs text-gray-500">{formatDate(pkg.end_date)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${PACKAGE_STATUS_COLORS[status]}`}>
                                  {status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setExpandedPackageId(isExpanded ? null : pkg._id)}
                                  >
                                    <ListChecks className="w-3 h-3 mr-1" /> History ({pkg.consumption_history?.length || 0})
                                  </Button>
                                  {status === "active" && (
                                    <Button variant="outline" size="sm" onClick={() => handleCancelPackage(pkg)} className="text-red-500 hover:bg-red-50">
                                      <Ban className="w-3 h-3 mr-1" /> Cancel
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-gray-50">
                                <td colSpan={7} className="px-4 py-3">
                                  {renderPackageHistory(pkg)}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {packages.map((pkg) => {
                    const status = packageStatus(pkg);
                    const isExpanded = expandedPackageId === pkg._id;
                    return (
                      <Card key={pkg._id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-sm">{pkg.customer_name || "—"}</p>
                            <p className="text-sm text-gray-500">{pkg.customer_phone}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${PACKAGE_STATUS_COLORS[status]}`}>
                            {status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 font-medium mb-1">{pkg.service_name}</p>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-600">{pkg.remaining_quantity} / {pkg.total_quantity} {pkg.unit_type} remaining</span>
                          <span className="font-bold">₹{pkg.price}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Valid until {formatDate(pkg.end_date)}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedPackageId(isExpanded ? null : pkg._id)}
                            className="flex-1"
                          >
                            <ListChecks className="w-3 h-3 mr-1" /> History ({pkg.consumption_history?.length || 0})
                          </Button>
                          {status === "active" && (
                            <Button variant="outline" size="sm" onClick={() => handleCancelPackage(pkg)} className="flex-1 text-red-500 hover:bg-red-50">
                              <Ban className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                          )}
                        </div>
                        {isExpanded && <div className="mt-3 pt-3 border-t">{renderPackageHistory(pkg)}</div>}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Order Detail Modal */}
      {selectedOrder && editedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <Card className="w-full sm:max-w-lg sm:mx-4 max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold font-mono text-blue-600">{selectedOrder.custom_order_id}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedOrder.is_store_order ? "Store Order" : "Assigned Order"}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedOrder(null); setIsEditMode(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-xl leading-none"
                >×</button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 mb-4">
                <a
                  href={callHref(selectedOrder.customer_phone)}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Phone className="w-4 h-4" /> Call
                </a>
                <a
                  href={whatsAppHref(selectedOrder.customer_phone, buildOrderSummaryText(selectedOrder, storeInfo.store_name))}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => printReceipt(selectedOrder, storeInfo.store_name)}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4" /> Receipt
                </button>
              </div>

              <div className="space-y-3">
                {/* Customer */}
                <div className={`p-3 rounded-xl ${isEditMode ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">Customer</h3>
                    {!isEditMode && selectedOrder.is_store_order && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsEditMode(true)}>Edit</Button>
                    )}
                  </div>
                  {isEditMode ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-500">Name</label>
                        <Input value={editedOrder.customer_name} onChange={(e) => setEditedOrder({ ...editedOrder, customer_name: e.target.value })} className="mt-1 h-10" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Phone</label>
                        <Input value={editedOrder.customer_phone} onChange={(e) => setEditedOrder({ ...editedOrder, customer_phone: e.target.value })} className="mt-1 h-10" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" /><span>{editedOrder.customer_name}</span></div>
                      <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" /><span>{editedOrder.customer_phone}</span></div>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className={`p-3 rounded-xl ${isEditMode ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">Items</h3>
                    {isEditMode && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditedOrder({ ...editedOrder, item_prices: [...(editedOrder.item_prices || []), { service_name: "", quantity: 1, unit_price: 0, total_price: 0 }] })}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {editedOrder.item_prices?.length > 0 ? editedOrder.item_prices.map((item: ServiceItem, i: number) => (
                      <div key={i}>
                        {isEditMode ? (
                          <div className="bg-white rounded-lg border p-2 space-y-2">
                            {/* Service select + delete */}
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Select
                                  value={item.service_name || ""}
                                  onValueChange={(value) => {
                                    const realValue = value === "__none__" ? "" : value;
                                    const items = [...editedOrder.item_prices];
                                    const matched = getSortedServices().find((s) => s.name === realValue);
                                    items[i] = {
                                      ...items[i],
                                      service_name: realValue,
                                      ...(matched ? { unit_price: matched.price, total_price: items[i].quantity * matched.price } : {}),
                                    };
                                    setEditedOrder({ ...editedOrder, item_prices: items });
                                  }}
                                >
                                  <SelectTrigger className="h-10 text-sm">
                                    <SelectValue placeholder="Select service">
                                      {item.service_name || "Select service"}
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
                              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setEditedOrder({ ...editedOrder, item_prices: editedOrder.item_prices.filter((_: any, j: number) => j !== i) })}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {/* Qty + Rate + Total */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs text-gray-400">Qty</label>
                                <Input type="number" inputMode="numeric" className="h-9 text-center text-sm mt-0.5" value={item.quantity}
                                  onChange={(e) => {
                                    const items = [...editedOrder.item_prices];
                                    items[i] = { ...items[i], quantity: +e.target.value || 1, total_price: (+e.target.value || 1) * items[i].unit_price };
                                    setEditedOrder({ ...editedOrder, item_prices: items });
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Rate ₹</label>
                                <Input type="number" inputMode="decimal" className="h-9 text-center text-sm mt-0.5" value={item.unit_price}
                                  onChange={(e) => {
                                    const items = [...editedOrder.item_prices];
                                    items[i] = { ...items[i], unit_price: +e.target.value || 0, total_price: items[i].quantity * (+e.target.value || 0) };
                                    setEditedOrder({ ...editedOrder, item_prices: items });
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Total</label>
                                <div className="h-9 mt-0.5 flex items-center justify-center bg-blue-50 border border-blue-200 rounded text-sm font-bold text-blue-700">
                                  ₹{(item.total_price ?? item.unit_price * item.quantity).toFixed(0)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center py-1.5 border-b last:border-0">
                            <div>
                              <span className="text-sm">{item.service_name} × {item.quantity}</span>
                              {typeof item.piece_count === "number" && item.piece_count > 0 && (
                                <span className="ml-2 text-xs text-gray-500">({item.piece_count} pcs)</span>
                              )}
                            </div>
                            <span className="font-semibold text-sm">₹{item.total_price ?? item.unit_price * item.quantity}</span>
                          </div>
                        )}
                      </div>
                    )) : (
                      <p className="text-sm text-gray-500">No items listed</p>
                    )}
                    {selectedOrder.package_applied?.quantity ? (
                      <div className="mt-2 pt-2 border-t flex justify-between items-center text-xs">
                        <span className="text-indigo-700 font-medium flex items-center gap-1">
                          <Scale className="w-3 h-3" /> Package: {selectedOrder.package_applied.quantity} {selectedOrder.package_applied.unit_type} {selectedOrder.package_applied.service_name}
                        </span>
                        <span className="text-indigo-700 font-semibold">
                          −₹{(selectedOrder.package_applied.amount_covered || 0).toFixed(0)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Amount & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                    <p className="text-xs text-gray-500">Final Amount</p>
                    <p className="text-xl font-bold text-blue-700 mt-0.5">₹{selectedOrder.final_amount || selectedOrder.total_price}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1.5">Status</p>
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => handleStatusUpdate(e.target.value)}
                      disabled={updatingStatus || isEditMode}
                      className="w-full border rounded-lg px-2 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 bg-white"
                    >
                      {ALL_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /><span>{formatDate(selectedOrder.created_at)}</span></div>
                  <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /><span>{formatTime(selectedOrder.created_at)}</span></div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {isEditMode ? (
                    <>
                      <Button variant="outline" className="flex-1 h-11" onClick={() => { setIsEditMode(false); setEditedOrder({ ...selectedOrder }); }}>Cancel</Button>
                      <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 font-semibold" onClick={handleSaveOrder} disabled={savingOrder}>
                        {savingOrder ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" className="flex-1 h-11" onClick={() => setSelectedOrder(null)}>Close</Button>
                      {selectedOrder.is_store_order && (
                        <Button variant="destructive" className="flex-1 h-11" onClick={handleDeleteOrder}>
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: order table ───────────────────────────────────────────────

function OrderTable({ orders, onView, storeName }: { orders: Order[]; onView: (o: Order) => void; storeName: string }) {
  return (
    <div className="space-y-3">
      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Order ID", "Customer", "Phone", "Items", "Amount", "Status", "Date", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-semibold text-blue-600">{o.custom_order_id}</span>
                  {!o.is_store_order && <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Assigned</span>}
                </td>
                <td className="px-4 py-3 font-medium text-sm">{o.customer_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{o.customer_phone}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {o.item_prices?.length > 0
                    ? o.item_prices.map((s) => `${s.service_name} ×${s.quantity}`).join(", ")
                    : (o.services || []).join(", ")}
                </td>
                <td className="px-4 py-3 font-bold text-sm">₹{o.final_amount || o.total_price}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-700"}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(o.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <a href={callHref(o.customer_phone)} title="Call customer" className="h-8 w-8 flex items-center justify-center rounded-md border text-gray-500 hover:bg-gray-100 hover:text-green-600">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a href={whatsAppHref(o.customer_phone, buildOrderSummaryText(o, storeName))} target="_blank" rel="noreferrer" title="WhatsApp customer" className="h-8 w-8 flex items-center justify-center rounded-md border text-gray-500 hover:bg-gray-100 hover:text-green-600">
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                    <Button variant="outline" size="sm" onClick={() => onView(o)}>
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {orders.map((o) => (
          <Card key={o._id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-mono font-bold text-blue-600 text-sm">{o.custom_order_id}</p>
                {!o.is_store_order && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Assigned</span>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-700"}`}>
                {o.status}
              </span>
            </div>
            <p className="font-medium text-sm">{o.customer_name}</p>
            <p className="text-sm text-gray-500">{o.customer_phone}</p>
            <div className="flex items-center justify-between mt-3 gap-2">
              <span className="font-bold">₹{o.final_amount || o.total_price}</span>
              <div className="flex items-center gap-1.5">
                <a href={callHref(o.customer_phone)} className="h-9 w-9 flex items-center justify-center rounded-lg border text-gray-500 active:bg-gray-100">
                  <Phone className="w-4 h-4" />
                </a>
                <a href={whatsAppHref(o.customer_phone, buildOrderSummaryText(o, storeName))} target="_blank" rel="noreferrer" className="h-9 w-9 flex items-center justify-center rounded-lg border text-gray-500 active:bg-gray-100">
                  <MessageCircle className="w-4 h-4" />
                </a>
                <Button variant="outline" size="sm" onClick={() => onView(o)}>View</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
