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
} from "lucide-react";
import { AdminAuth, ADMIN_CONFIG } from "@/config/adminConfig";
import AdminBookingManagement from "./AdminBookingManagement";
import AdminUserBooking from "./AdminUserBooking";
import AdminServiceLocations from "./AdminServiceLocations";
import AdminRiderManagement from "./AdminRiderManagement";
import { apiClient } from "@/lib/apiClient";

interface AdminDashboardProps {
  onLogout: () => void;
}

type TabValue = "overview" | "bookings" | "user-booking" | "locations" | "riders" | "analytics";

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
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="user-booking" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Book for User
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="riders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Riders
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="riders">
            <AdminRiderManagement />
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
