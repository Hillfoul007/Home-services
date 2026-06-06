import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Shield,
  Users,
  Calendar,
  MapPin,
  Settings,
  BarChart3,
  Clock,
  ChevronDown,
  User,
  Building,
  Package,
  Home,
  Truck,
  Image,
  MapPin as MapIcon,
  Bell,
  Trash2,
} from "lucide-react";
import { AdminAuth, ADMIN_CONFIG } from "@/config/adminConfig";
import AdminBookingManagement from "./AdminBookingManagement";
import AdminUserBooking from "./AdminUserBooking";
import AdminServiceLocations from "./AdminServiceLocations";
import AdminVendorManagement from "./AdminVendorManagement";
import AdminWalletManagement from "./AdminWalletManagement";
import AdminPGManagement from "./AdminPGManagement";
import AdminPGOrdersManagement from "./AdminPGOrdersManagement";
import AdminUsersManagement from "./AdminUsersManagement";
import AdminOrderAllocation from "./AdminOrderAllocation";
import AdminBannerManagement from "./AdminBannerManagement";
import AdminMapAnalytics from "./AdminMapAnalytics";
import AdminRiderManagement from "./AdminRiderManagement";
import AdminDailyOrdersView from "./AdminDailyOrdersView";
import AdminPackages from "../pages/AdminPackages";
import AdminAssignedPackages from "./AdminAssignedPackages";
import AdminPushNotifications from "./AdminPushNotifications";
import AdminSchoolManagement from "./AdminSchoolManagement";
import AdminSchoolBooking from "./AdminSchoolBooking";
import AdminHotelManagement from "./AdminHotelManagement";
import AdminHotelInvoice from "./AdminHotelInvoice";
import AdminSchoolInvoice from "./AdminSchoolInvoice";
import AdminStoreManagement from "./AdminStoreManagement";
import AdminStoreOrders from "./AdminStoreOrders";
import AdminVendorOrders from "./AdminVendorOrders";
import { apiClient } from "@/lib/apiClient";

interface AdminDashboardProps {
  onLogout: () => void;
}

type TabValue = "overview" | "bookings" | "user-booking" | "vendor-orders" | "locations" | "vendors" | "packages" | "assigned-packages" | "users" | "pgs" | "pg-orders" | "analytics" | "map-analytics" | "wallet" | "order-allocation" | "banners" | "riders" | "daily-orders" | "push-notifications" | "schools" | "school-orders" | "school-invoices" | "hotels" | "hotel-invoices" | "stores" | "store-orders";

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabValue>("overview");
  const [sessionInfo, setSessionInfo] = useState<{
    username: string;
    timeRemaining: string;
  } | null>(null);

  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    activeUsers: 0,
    totalRevenue: "₹0",
    loading: true,
  });

  const [cleanupState, setCleanupState] = useState<{ running: boolean; result: string | null }>({ running: false, result: null });

  const runMediaCleanup = async () => {
    setCleanupState({ running: true, result: null });
    try {
      const res = await apiClient.adminRequest<any>("/admin/cleanup-media", { method: "POST" });
      const body = res.data;
      const storage = body?.storage;
      const storageNote = storage ? ` | ☁️ Cloudinary: ${storage.used_mb} MB / ${storage.limit_gb} GB (${storage.pct}%)` : "";
      setCleanupState({ running: false, result: (body?.message || "Done") + storageNote });
    } catch {
      setCleanupState({ running: false, result: "Cleanup failed — check server logs" });
    }
  };

  // Fetch real statistics from API
  const fetchStats = async () => {
    try {
      const response = await apiClient.adminRequest<any>("/admin/stats");

      if (response.data) {
        const statsData = response.data.stats;
        setStats({
          totalBookings: statsData.bookings?.total || 0,
          pendingBookings: statsData.bookings?.pending || 0,
          activeUsers: statsData.users?.active || 0,
          totalRevenue: `₹${statsData.revenue?.total || 0}`,
          loading: false,
        });
      } else {
        // No fallback data - keep zeros if API returns no data
        setStats({
          totalBookings: 0,
          pendingBookings: 0,
          activeUsers: 0,
          totalRevenue: "₹0",
          loading: false,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Keep loading state or show error - no fake data
      setStats({
        totalBookings: 0,
        pendingBookings: 0,
        activeUsers: 0,
        totalRevenue: "₹0",
        loading: false,
      });
    }
  };

  // Update session info periodically
  useEffect(() => {
    const updateSessionInfo = () => {
      const session = AdminAuth.getSession();
      if (session) {
        const remaining = AdminAuth.getRemainingTime();
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        setSessionInfo({
          username: session.username,
          timeRemaining: `${hours}h ${minutes}m`,
        });
      }
    };

    updateSessionInfo();
    fetchStats(); // Fetch stats on component mount
    const interval = setInterval(updateSessionInfo, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    AdminAuth.logout();
    onLogout();
  };

  // stats is now managed by state

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingBookings}</div>
            <p className="text-xs text-muted-foreground">
              Needs attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              +5% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalRevenue}</div>
            <p className="text-xs text-muted-foreground">
              +8% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => setActiveTab("bookings")}
              className="h-20 flex flex-col items-center justify-center space-y-2"
              variant="outline"
            >
              <Calendar className="h-6 w-6" />
              <span>Manage Bookings</span>
            </Button>
            
            <Button 
              onClick={() => setActiveTab("user-booking")}
              className="h-20 flex flex-col items-center justify-center space-y-2"
              variant="outline"
            >
              <User className="h-6 w-6" />
              <span>Book for User</span>
            </Button>
            
            <Button
              onClick={() => setActiveTab("locations")}
              className="h-20 flex flex-col items-center justify-center space-y-2"
              variant="outline"
            >
              <MapPin className="h-6 w-6" />
              <span>Service Locations</span>
            </Button>

            <Button
              onClick={runMediaCleanup}
              disabled={cleanupState.running}
              className="h-20 flex flex-col items-center justify-center space-y-2 border-red-200 text-red-700 hover:bg-red-50"
              variant="outline"
            >
              <Trash2 className="h-6 w-6" />
              <span>{cleanupState.running ? "Cleaning…" : "Free DB Space"}</span>
            </Button>
          </div>
          {cleanupState.result && (
            <p className={`mt-3 text-sm px-1 ${cleanupState.result.includes("failed") ? "text-red-600" : "text-green-700"}`}>
              🧹 {cleanupState.result}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8">
              <p className="text-gray-500">Recent activity will appear here when data is available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">
                {ADMIN_CONFIG.PORTAL_TITLE}
              </h1>
            </div>
            <Badge variant="secondary" className="text-xs">
              Admin
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            {sessionInfo && (
              <div className="hidden md:flex flex-col text-right text-sm">
                <span className="font-medium text-gray-700">
                  Welcome, {sessionInfo.username}
                </span>
                <span className="text-xs text-gray-500">
                  Session: {sessionInfo.timeRemaining}
                </span>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <Button
              onClick={() => setActiveTab("overview")}
              variant={activeTab === "overview" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </Button>
            <Button
              onClick={() => setActiveTab("bookings")}
              variant={activeTab === "bookings" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Bookings</span>
            </Button>
            <Button
              onClick={() => setActiveTab("user-booking")}
              variant={activeTab === "user-booking" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Book User</span>
            </Button>
            <Button
              onClick={() => setActiveTab("vendor-orders")}
              variant={activeTab === "vendor-orders" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0 bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 data-[state=active]:bg-amber-600 data-[state=active]:text-white"
            >
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Vendor Orders</span>
            </Button>
            <Button
              onClick={() => setActiveTab("locations")}
              variant={activeTab === "locations" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Locations</span>
            </Button>
            <Button
              onClick={() => setActiveTab("vendors")}
              variant={activeTab === "vendors" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Vendors</span>
            </Button>
            <Button
              onClick={() => setActiveTab("order-allocation")}
              variant={activeTab === "order-allocation" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Allocate Orders</span>
            </Button>
            <Button
              onClick={() => setActiveTab("riders")}
              variant={activeTab === "riders" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Riders</span>
            </Button>
            <Button
              onClick={() => setActiveTab("daily-orders")}
              variant={activeTab === "daily-orders" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Daily Orders</span>
            </Button>
            <Button
              onClick={() => setActiveTab("users")}
              variant={activeTab === "users" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </Button>
            <Button
              onClick={() => setActiveTab("packages")}
              variant={activeTab === "packages" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Packages</span>
            </Button>
            <Button
              onClick={() => setActiveTab("assigned-packages")}
              variant={activeTab === "assigned-packages" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">User Packages</span>
            </Button>
            <Button
              onClick={() => setActiveTab("pgs")}
              variant={activeTab === "pgs" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">PGs</span>
            </Button>
            <Button
              onClick={() => setActiveTab("pg-orders")}
              variant={activeTab === "pg-orders" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">PG Orders</span>
            </Button>
            <Button
              onClick={() => setActiveTab("schools")}
              variant={activeTab === "schools" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span>🏫</span>
              <span className="hidden sm:inline">Schools</span>
            </Button>
            <Button
              onClick={() => setActiveTab("school-orders")}
              variant={activeTab === "school-orders" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span>📋</span>
              <span className="hidden sm:inline">School Orders</span>
            </Button>
            <Button
              onClick={() => setActiveTab("school-invoices")}
              variant={activeTab === "school-invoices" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0 bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200"
            >
              <span>🧾</span>
              <span className="hidden sm:inline">School Invoices</span>
            </Button>
            <Button
              onClick={() => setActiveTab("hotels")}
              variant={activeTab === "hotels" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span>🏨</span>
              <span className="hidden sm:inline">Hotels</span>
            </Button>
            <Button
              onClick={() => setActiveTab("hotel-invoices")}
              variant={activeTab === "hotel-invoices" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0 bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200"
            >
              <span>🧾</span>
              <span className="hidden sm:inline">Hotel Invoices</span>
            </Button>
            <Button
              onClick={() => setActiveTab("stores")}
              variant={activeTab === "stores" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span>🏪</span>
              <span className="hidden sm:inline">Stores</span>
            </Button>
            <Button
              onClick={() => setActiveTab("store-orders")}
              variant={activeTab === "store-orders" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span>🛒</span>
              <span className="hidden sm:inline">Store Orders</span>
            </Button>
            <Button
              onClick={() => setActiveTab("wallet")}
              variant={activeTab === "wallet" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span>💰</span>
              <span className="hidden sm:inline">Wallet</span>
            </Button>
            <Button
              onClick={() => setActiveTab("banners")}
              variant={activeTab === "banners" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Banners</span>
            </Button>
            <Button
              onClick={() => setActiveTab("push-notifications")}
              variant={activeTab === "push-notifications" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0 bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-200"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Push Alerts</span>
            </Button>
            <Button
              onClick={() => setActiveTab("map-analytics")}
              variant={activeTab === "map-analytics" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <MapIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Map</span>
            </Button>
            <Button
              onClick={() => setActiveTab("analytics")}
              variant={activeTab === "analytics" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </Button>
          </div>

          <TabsContent value="overview">
            {renderOverview()}
          </TabsContent>

          <TabsContent value="bookings">
            <AdminBookingManagement />
          </TabsContent>

          <TabsContent value="user-booking">
            <AdminUserBooking />
          </TabsContent>

          <TabsContent value="vendor-orders">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-amber-900 text-sm"><strong>🏢 Vendor / Corporate Orders:</strong> Create laundry orders for bulk clients like hotels, apartments, and corporates — no mobile number needed. Each order is tagged with the client name. View and manage all vendor orders with full status control. These orders also appear in Booking Management tagged with the vendor name.</p>
            </div>
            <AdminVendorOrders />
          </TabsContent>

          <TabsContent value="locations">
            <AdminServiceLocations />
          </TabsContent>

          <TabsContent value="vendors">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-900 text-sm"><strong>✓ Vendor Management:</strong> Create and manage vendor accounts. Each vendor gets auto-generated login credentials (ID & password) for portal access.</p>
            </div>
            <AdminVendorManagement />
          </TabsContent>

          <TabsContent value="order-allocation">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-900 text-sm"><strong>✓ Order Allocation:</strong> Manage vehicle allocation for orders. Filter orders by vendor, check vehicle availability and time slots, and allocate orders to vehicles for optimized delivery.</p>
            </div>
            <AdminOrderAllocation />
          </TabsContent>

          <TabsContent value="users">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <p className="text-purple-900 text-sm"><strong>✓ Users Management:</strong> View all customer accounts and delete users if needed. Deleting a user will also remove all associated bookings.</p>
            </div>
            <AdminUsersManagement />
          </TabsContent>

          <TabsContent value="packages">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-orange-900 text-sm"><strong>✓ Packages:</strong> Create and manage subscription packages. Assign packages to users to add wallet balance with a strict validity period.</p>
            </div>
            <AdminPackages />
          </TabsContent>

          <TabsContent value="assigned-packages">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
              <p className="text-indigo-900 text-sm"><strong>✓ User Packages:</strong> View all assigned subscription packages. Check active balances and validity dates for users.</p>
            </div>
            <AdminAssignedPackages />
          </TabsContent>

          <TabsContent value="pgs">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-900 text-sm"><strong>✓ PG Management:</strong> Create and manage paying guest (PG) locations. Assign vendors to PGs to handle all orders from that location. Set pricing and minimum items per order.</p>
            </div>
            <AdminPGManagement />
          </TabsContent>

          <TabsContent value="pg-orders">
            <AdminPGOrdersManagement />
          </TabsContent>

          <TabsContent value="schools">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-900 text-sm"><strong>🏫 School Management:</strong> Create and manage schools with their students/members. Each school has a dedicated manager login, custom pricing for Wash & Iron and Wash & Fold, and separate order tracking with IDs like <code>SCH01-0426-0001</code>.</p>
            </div>
            <AdminSchoolManagement />
          </TabsContent>

          <TabsContent value="school-orders">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
              <p className="text-indigo-900 text-sm"><strong>📋 School Orders:</strong> Book laundry orders for school members. Select school → search member by name or ID → choose service (Wash & Iron / Wash & Fold) → set items count and custom price. Orders are saved in a separate collection and visible to the school manager portal.</p>
            </div>
            <AdminSchoolBooking />
          </TabsContent>

          <TabsContent value="school-invoices">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <p className="text-purple-900 text-sm"><strong>🧾 School Invoices:</strong> Create digital Laundrify invoices for school clients. Enter school name, invoice number, service period, then add date-wise piece counts with price per piece. Preview a live summary and open the formatted print-ready invoice.</p>
            </div>
            <AdminSchoolInvoice />
          </TabsContent>

          <TabsContent value="hotels">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
              <p className="text-indigo-900 text-sm"><strong>🏨 Hotel Management:</strong> Add hotels and create laundry entries using the item list from the physical slip. Input quantities for each article, optionally set prices to calculate amounts, generate a bill, mark payments as paid (with paid-till date), and export to Excel.</p>
            </div>
            <AdminHotelManagement />
          </TabsContent>

          <TabsContent value="hotel-invoices">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <p className="text-purple-900 text-sm"><strong>🧾 Hotel Invoices:</strong> Create digital Laundrify invoices for hotel clients. Enter hotel name, invoice number, service period, set custom per-piece rates (Hotel / DC / Guest — can differ per hotel), then add day-by-day piece counts. Preview a live summary and open or download the formatted invoice PDF-ready HTML.</p>
            </div>
            <AdminHotelInvoice />
          </TabsContent>

          <TabsContent value="stores">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-900 text-sm"><strong>🏪 Store Management:</strong> Create and manage store accounts. Each store gets a unique Store ID for login and a 5-letter code used in order IDs. Order ID format: <code className="bg-blue-100 px-1 rounded">STORE{"{CODE}"}JanA0001</code> — letter increments A→B after 9999 orders.</p>
            </div>
            <AdminStoreManagement />
          </TabsContent>

          <TabsContent value="store-orders">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-900 text-sm"><strong>🛒 Store Orders:</strong> View all orders created by stores (with STORE… IDs) and all orders assigned to stores by admin. All order statuses (created → pending → confirmed → processing → ready → completed → delivered) work identically to normal orders.</p>
            </div>
            <AdminStoreOrders />
          </TabsContent>

          <TabsContent value="wallet">
            <AdminWalletManagement />
          </TabsContent>

          <TabsContent value="banners">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-900 text-sm"><strong>✓ Banner Management:</strong> Create and manage website banners. Set custom display durations, redirect URLs, and track clicks and impressions. Banners rotate automatically on the homepage.</p>
            </div>
            <AdminBannerManagement />
          </TabsContent>

          <TabsContent value="push-notifications">
            <AdminPushNotifications />
          </TabsContent>

          <TabsContent value="map-analytics">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-900 text-sm"><strong>✓ Map Analytics:</strong> Visualize all orders on an interactive map. Filter by month and status, draw custom areas to analyze order density and revenue, and get detailed statistics for selected regions.</p>
            </div>
            <AdminMapAnalytics />
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Analytics and reporting features coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="riders">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-900 text-sm"><strong>✓ Rider Management:</strong> Add and manage delivery riders. Set live location links for real-time tracking during orders.</p>
            </div>
            <AdminRiderManagement />
          </TabsContent>

          <TabsContent value="daily-orders">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-900 text-sm"><strong>✓ Daily Orders:</strong> View vendor orders grouped by day. Today's orders appear first, with option to view previous days.</p>
            </div>
            <AdminDailyOrdersView />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
