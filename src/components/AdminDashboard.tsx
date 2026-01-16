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
import { apiClient } from "@/lib/apiClient";

interface AdminDashboardProps {
  onLogout: () => void;
}

type TabValue = "overview" | "bookings" | "user-booking" | "locations" | "vendors" | "users" | "pgs" | "pg-orders" | "analytics" | "wallet" | "order-allocation" | "banners";

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
          </div>
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
              onClick={() => setActiveTab("users")}
              variant={activeTab === "users" ? "default" : "outline"}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
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

          <TabsContent value="pgs">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-900 text-sm"><strong>✓ PG Management:</strong> Create and manage paying guest (PG) locations. Assign vendors to PGs to handle all orders from that location. Set pricing and minimum items per order.</p>
            </div>
            <AdminPGManagement />
          </TabsContent>

          <TabsContent value="pg-orders">
            <AdminPGOrdersManagement />
          </TabsContent>

          <TabsContent value="wallet">
            <AdminWalletManagement />
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
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
