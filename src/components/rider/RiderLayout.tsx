import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  User,
  MapPin,
  Package,
  LogOut,
  Shield,
  Activity,
  Bell,
  WifiOff,
  Wifi,
  Menu,
  X
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import ErrorBoundary from '@/components/ErrorBoundary';
import { riderApiGet, checkRiderApiHealth } from '@/lib/riderApi';

interface RiderLayoutProps {
  children?: React.ReactNode;
}

export default function RiderLayout({ children }: RiderLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [rider, setRider] = React.useState<any>(null);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { isOnline } = useNetworkStatus();

  React.useEffect(() => {
    // Check if rider is logged in
    const riderData = localStorage.getItem('riderAuth');
    if (riderData) {
      setRider(JSON.parse(riderData));
      fetchUnreadCount();
    } else if (location.pathname !== '/rider/register' && location.pathname !== '/rider/login') {
      navigate('/rider/login');
    }
  }, [navigate, location.pathname]);

  React.useEffect(() => {
    if (rider) {
      // Initial fetch with delay to allow component to mount
      setTimeout(fetchUnreadCount, 1000);

      // Set up periodic fetch with error handling and exponential backoff
      let failureCount = 0;
      const interval = setInterval(() => {
        // Only fetch if we're still authenticated and online
        if (localStorage.getItem('riderToken') && navigator.onLine) {
          // Exponential backoff: increase interval after failures
          const backoffMultiplier = Math.min(failureCount + 1, 4); // Max 4x interval
          if (failureCount === 0 || Date.now() % (30000 * backoffMultiplier) === 0) {
            fetchUnreadCount()
              .then(() => {
                failureCount = 0; // Reset on success
              })
              .catch(() => {
                failureCount++;
                console.log(`📊 Fetch failure count: ${failureCount}`);
              });
          }
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [rider]);

  // Using centralized rider API configuration

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('riderToken');
      if (!token) {
        console.log('📝 No rider token found, skipping unread count fetch');
        return;
      }

      // Check network connectivity before making request
      if (!navigator.onLine) {
        console.log('📱 Offline mode: Skipping unread count fetch');
        return;
      }

      // Use centralized rider API

      // First check if the rider API is available
      const isApiHealthy = await checkRiderApiHealth();
      if (!isApiHealthy) {
        console.log('🚫 Rider API not available - using demo mode');

        // Use demo data when API is not available
        if (import.meta.env.DEV) {
          const demoCount = Math.floor(Math.random() * 5); // Random 0-4 for demo
          setUnreadCount(demoCount);
          console.log('🎭 Demo mode: Set unread count to', demoCount);
        }
        return;
      }

      const data = await riderApiGet<{ count: number }>('/notifications/unread-count');

      if (data && typeof data.count === 'number') {
        setUnreadCount(data.count);
        console.log('✅ Unread count updated:', data.count);
      } else if (data === null) {
        console.warn('⚠️ Failed to fetch unread count - API returned null');
        // Keep existing count, don't update on API failure
      } else {
        console.warn('⚠️ Invalid unread count response format:', data);
        setUnreadCount(0); // Reset if response format is unexpected
      }
    } catch (error: any) {
      console.error('❌ Error fetching unread count:', error);

      // Handle specific error types with user-friendly logging
      if (error.name === 'AbortError') {
        console.log('⏰ Unread count fetch timeout');
      } else if (error.message?.includes('Failed to fetch')) {
        console.log('🌐 Network error - backend may be unreachable. Using fallback.');

        // Fallback to demo mode on network errors
        if (import.meta.env.DEV) {
          console.log('🎭 Falling back to demo mode due to network error');
          const fallbackCount = 2; // Fixed fallback count
          setUnreadCount(fallbackCount);
        }
      } else {
        console.warn('❌ Unexpected error fetching unread count:', error.message || error);
      }

      // Don't reset count on network errors to avoid UI flicker
      // Keep the existing unreadCount value
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('riderAuth');
    localStorage.removeItem('riderToken');
    setRider(null);
    setMobileMenuOpen(false);
    navigate('/rider/login');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
    if (path === '/rider/notifications') {
      setUnreadCount(0);
    }
  };

  const isActive = location.pathname;

  return (
    <div className="min-h-screen bg-gray-50 rider-mobile-layout">
      {rider && (
        <header className="bg-white shadow-sm border-b sticky top-0 z-50 rider-header-mobile rider-safe-area-top">
          <div className="px-3 sm:px-4 lg:px-8">
            <div className="flex justify-between items-center h-14 sm:h-16">
              {/* Left section */}
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-white lg:text-laundrify-purple" />
                <h1 className="text-lg sm:text-xl font-bold text-white lg:text-gray-900 rider-heading-medium-mobile">Rider Portal</h1>
              </div>

              {/* Desktop Navigation - Hidden on mobile */}
              <nav className="hidden lg:flex space-x-2">
                <Button
                  variant={isActive === '/rider/dashboard' ? 'default' : 'ghost'}
                  onClick={() => handleNavigation('/rider/dashboard')}
                  className="flex items-center space-x-2 text-sm"
                  size="sm"
                >
                  <Activity className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>

                <Button
                  variant={isActive === '/rider/orders' ? 'default' : 'ghost'}
                  onClick={() => handleNavigation('/rider/orders')}
                  className="flex items-center space-x-2 text-sm"
                  size="sm"
                >
                  <Package className="h-4 w-4" />
                  <span>Orders</span>
                </Button>

                <Button
                  variant={isActive === '/rider/notifications' ? 'default' : 'ghost'}
                  onClick={() => handleNavigation('/rider/notifications')}
                  className="flex items-center space-x-2 relative text-sm"
                  size="sm"
                >
                  <Bell className="h-4 w-4" />
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>

                <Button
                  variant={isActive === '/rider/profile' ? 'default' : 'ghost'}
                  onClick={() => handleNavigation('/rider/profile')}
                  className="flex items-center space-x-2 text-sm"
                  size="sm"
                >
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </Button>
              </nav>

              {/* Right section */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                {/* Network Status - Always visible on mobile */}
                <div className="flex items-center">
                  {isOnline ? (
                    <div className="rider-network-status-mobile rider-network-online-mobile hidden sm:flex">
                      <Wifi className="h-3 w-3" />
                      <span className="hidden md:inline">Online</span>
                    </div>
                  ) : (
                    <div className="rider-network-status-mobile rider-network-offline-mobile hidden sm:flex">
                      <WifiOff className="h-3 w-3" />
                      <span className="hidden md:inline">Offline</span>
                    </div>
                  )}
                </div>

                {/* Welcome text - Hidden on small mobile */}
                <div className="hidden md:block text-sm text-gray-600 truncate max-w-32">
                  Welcome, {rider.name}
                </div>

                {/* Desktop Logout */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="hidden lg:flex items-center space-x-1 text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>

                {/* Mobile Menu Trigger */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="lg:hidden rider-mobile-menu-trigger rider-touch-target"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                    <SheetHeader className="text-left">
                      <SheetTitle className="flex items-center space-x-2">
                        <Shield className="h-6 w-6 text-laundrify-purple" />
                        <span>Rider Menu</span>
                      </SheetTitle>
                      <SheetDescription>
                        Welcome, {rider.name}
                      </SheetDescription>
                    </SheetHeader>

                    <div className="mt-6 space-y-1">
                      {/* Network Status in Mobile Menu */}
                      <div className="p-3 rounded-lg border bg-gray-50 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Connection Status</span>
                          {isOnline ? (
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                              <Wifi className="h-3 w-3 mr-1" />
                              Online
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                              <WifiOff className="h-3 w-3 mr-1" />
                              Offline
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Navigation Links */}
                      <Button
                        variant={isActive === '/rider/dashboard' ? 'default' : 'ghost'}
                        onClick={() => handleNavigation('/rider/dashboard')}
                        className="w-full justify-start h-12 text-base rider-touch-target"
                      >
                        <Activity className="h-5 w-5 mr-3" />
                        Dashboard
                      </Button>

                      <Button
                        variant={isActive === '/rider/orders' ? 'default' : 'ghost'}
                        onClick={() => handleNavigation('/rider/orders')}
                        className="w-full justify-start h-12 text-base rider-touch-target"
                      >
                        <Package className="h-5 w-5 mr-3" />
                        My Orders
                      </Button>

                      <Button
                        variant={isActive === '/rider/notifications' ? 'default' : 'ghost'}
                        onClick={() => handleNavigation('/rider/notifications')}
                        className="w-full justify-start h-12 text-base relative rider-touch-target"
                      >
                        <Bell className="h-5 w-5 mr-3" />
                        Notifications
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto text-xs px-2 py-0 rider-badge-mobile">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </Badge>
                        )}
                      </Button>

                      <Button
                        variant={isActive === '/rider/profile' ? 'default' : 'ghost'}
                        onClick={() => handleNavigation('/rider/profile')}
                        className="w-full justify-start h-12 text-base rider-touch-target"
                      >
                        <User className="h-5 w-5 mr-3" />
                        Profile
                      </Button>

                      {/* Logout in Mobile Menu */}
                      <div className="pt-4 mt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={handleLogout}
                          className="w-full justify-start h-12 text-base text-red-600 border-red-200 hover:bg-red-50 rider-touch-target"
                        >
                          <LogOut className="h-5 w-5 mr-3" />
                          Logout
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="mx-auto py-3 sm:py-6 px-3 sm:px-4 lg:px-8 rider-main-content rider-safe-area-bottom">
        <ErrorBoundary>
          {children || <Outlet />}
        </ErrorBoundary>
      </main>

      {/* Mobile bottom nav - simple and always visible on small screens */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t lg:hidden z-50">
        <div className="max-w-screen-xl mx-auto px-3 py-2 flex items-center justify-between">
          <button onClick={() => handleNavigation('/rider/dashboard')} className="flex-1 text-center text-sm py-2">
            <Activity className="mx-auto" />
            <div className="text-xs mt-1">Home</div>
          </button>
          <button onClick={() => handleNavigation('/rider/orders')} className="flex-1 text-center text-sm py-2">
            <Package className="mx-auto" />
            <div className="text-xs mt-1">Orders</div>
          </button>
          <button onClick={() => handleNavigation('/rider/notifications')} className="flex-1 text-center text-sm py-2">
            <Bell className="mx-auto" />
            <div className="text-xs mt-1">Alerts</div>
          </button>
          <button onClick={() => handleNavigation('/rider/profile')} className="flex-1 text-center text-sm py-2">
            <User className="mx-auto" />
            <div className="text-xs mt-1">Profile</div>
          </button>
        </div>
      </nav>

    </div>
  );
}
