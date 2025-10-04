import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Package,
  Clock,
  MapPin,
  AlertCircle,
  RefreshCw,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

// Using centralized rider API configuration
import { getRiderApiUrl } from '@/lib/riderApi';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'order_assigned' | 'order_updated' | 'order_cancelled' | 'general' | 'location_request';
  read: boolean;
  createdAt: string;
  data: {
    order_id?: string;
    booking_id?: string;
    customer_name?: string;
    customer_phone?: string;
    address?: string;
    pickup_time?: string;
    estimated_cost?: number;
    [key: string]: any;
  };
  action_required: boolean;
  action_type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  time_ago?: string;
}

interface RiderNotificationsProps {
  compact?: boolean;
}

export default function RiderNotifications({ compact = false }: RiderNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showOnlyUnread, setShowOnlyUnread] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    // Initial fetch with slight delay
    setTimeout(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 500);

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        // Only auto-refresh if online and authenticated
        if (navigator.onLine && localStorage.getItem('riderToken')) {
          fetchNotifications();
          fetchUnreadCount();
        } else {
          console.log('⏸️ Skipping auto-refresh: offline or not authenticated');
        }
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showOnlyUnread, autoRefresh]);

  // Listen for verification completion events to refresh notifications immediately
  useEffect(() => {
    const handleVerificationCompleted = (event: CustomEvent) => {
      console.log('🔔 RiderNotifications: Verification completed, refreshing notifications');
      // Refresh notifications immediately when a verification is completed
      fetchNotifications();
      fetchUnreadCount();
    };

    // Add event listener
    window.addEventListener('verificationCompleted', handleVerificationCompleted as EventListener);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('verificationCompleted', handleVerificationCompleted as EventListener);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('riderToken');

      if (!token) {
        console.log('📝 No rider token found, using demo notifications');
        setDemoNotifications();
        return;
      }

      // Check network connectivity
      if (!navigator.onLine) {
        console.log('📱 Offline mode: Using cached/demo notifications');
        if (notifications.length === 0) {
          setDemoNotifications();
        }
        return;
      }

      // Use centralized rider API with demo mode fallback
      const { riderApiGet } = await import('@/lib/riderApi');
      const endpoint = showOnlyUnread ? '/notifications' : '/notifications?includeRead=true';
      const data = await riderApiGet<Notification[]>(endpoint);

      if (data && Array.isArray(data)) {
        setNotifications(data);
        console.log('✅ Notifications loaded:', data.length);
      } else {
        console.warn('⚠️ No notifications data received');
        // Only set demo notifications if we don't have existing ones
        if (notifications.length === 0) {
          setDemoNotifications();
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⏰ Notifications request timed out');
      } else if (error.message?.includes('Failed to fetch')) {
        console.log('🌐 Network error loading notifications - using fallback');
      } else {
        console.warn('❌ Unexpected error:', error.message);
      }

      // Only set demo notifications if we don't have any existing ones
      if (notifications.length === 0) {
        setDemoNotifications();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoNotifications = () => {
    const demoNotifications: Notification[] = [
      {
        _id: 'demo_1',
        title: 'Welcome to Rider Portal',
        message: 'Your rider account is ready. Start accepting orders now!',
        type: 'general',
        read: false,
        createdAt: new Date().toISOString(),
        data: {},
        action_required: false,
        action_type: '',
        priority: 'medium',
        time_ago: 'Just now'
      }
    ];
    setNotifications(demoNotifications);
    setUnreadCount(1);
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('riderToken');

      if (!token) {
        setUnreadCount(0);
        return;
      }

      // Check if online before making request
      if (!navigator.onLine) {
        console.log('📱 Offline mode: Skipping unread count fetch');
        return;
      }

      const apiUrl = getRiderApiUrl('/notifications/unread-count');
      console.log('🔄 Fetching unread count from:', apiUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout

      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
        console.log('✅ Unread count updated:', data.count || 0);
      } else {
        console.warn('⚠️ API returned error:', response.status, response.statusText);
        // Don't set to 0 on server errors, keep existing count
        if (response.status >= 500) {
          console.log('🔧 Server error detected, keeping existing count');
        } else {
          setUnreadCount(0);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⏰ Request timed out - network may be slow');
      } else if (error.message?.includes('Failed to fetch')) {
        console.log('🌐 Network error - backend may be unreachable');
      } else {
        console.warn('❌ Unexpected error fetching unread count:', error.message);
      }
      // Don't change count on network errors - avoid UI flicker
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('riderToken');
      const apiUrl = getRiderApiUrl(`/notifications/${notificationId}/read`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(notif => 
            notif._id === notificationId 
              ? { ...notif, read: true }
              : notif
          )
        );
        
        // Refresh unread count
        fetchUnreadCount();
        
        if (!showOnlyUnread) {
          // If showing all notifications, keep the notification but mark as read
        } else {
          // If showing only unread, remove it from the list
          setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
        }
      } else {
        toast.error('Failed to mark notification as read');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('riderToken');
      const apiUrl = getRiderApiUrl('/notifications/mark-all-read');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Marked ${data.markedCount} notifications as read`);
        
        if (showOnlyUnread) {
          setNotifications([]);
        } else {
          setNotifications(prev => 
            prev.map(notif => ({ ...notif, read: true }))
          );
        }
        
        setUnreadCount(0);
      } else {
        toast.error('Failed to mark all notifications as read');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_assigned':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'order_updated':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'order_cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'location_request':
        return <MapPin className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50';
      case 'high':
        return 'border-l-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-blue-500 bg-blue-50';
      case 'low':
        return 'border-l-gray-500 bg-gray-50';
      default:
        return 'border-l-gray-500 bg-white';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  if (compact) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="rounded-full px-2 py-0">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlyUnread(!showOnlyUnread)}
            >
              {showOnlyUnread ? 'Show All' : 'Unread Only'}
            </Button>
          </div>
          
          {notifications.length > 0 ? (
            <div className="mt-3 space-y-2">
              {notifications.slice(0, 3).map((notification) => (
                <div
                  key={notification._id}
                  className={`p-2 rounded border-l-4 ${getPriorityColor(notification.priority)} cursor-pointer`}
                  onClick={() => markAsRead(notification._id)}
                >
                  <div className="flex items-start space-x-2">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{notification.title}</p>
                      <p className="text-xs text-gray-600 truncate">{notification.message}</p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(notification.createdAt)}</p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))}
              {notifications.length > 3 && (
                <p className="text-center text-sm text-gray-500">
                  +{notifications.length - 3} more notifications
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              No {showOnlyUnread ? 'unread ' : ''}notifications
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="rounded-full">
                  {unreadCount}
                </Badge>
              )}
              {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />}
            </CardTitle>
            <CardDescription>
              Stay updated with order assignments and important updates
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNotifications}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-unread"
                  checked={showOnlyUnread}
                  onCheckedChange={setShowOnlyUnread}
                />
                <Label htmlFor="show-unread">Show unread only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh">Auto refresh</Label>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <Card 
                key={notification._id} 
                className={`border-l-4 ${getPriorityColor(notification.priority)} cursor-pointer transition-all hover:shadow-md ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => markAsRead(notification._id)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start space-x-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-sm">{notification.title}</h4>
                          <p className="text-sm text-gray-700">{notification.message}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {notification.priority}
                          </Badge>
                        </div>
                      </div>
                      
                      {notification.data && Object.keys(notification.data).length > 0 && (
                        <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
                          {notification.data.booking_id && (
                            <p><strong>Order:</strong> #{notification.data.booking_id}</p>
                          )}
                          {notification.data.customer_name && (
                            <p><strong>Customer:</strong> {notification.data.customer_name}</p>
                          )}
                          {notification.data.address && (
                            <p><strong>Address:</strong> {notification.data.address}</p>
                          )}
                          {notification.data.pickup_time && (
                            <p><strong>Pickup Time:</strong> {notification.data.pickup_time}</p>
                          )}
                          {notification.data.estimated_cost && (
                            <p><strong>Estimated Cost:</strong> ₹{notification.data.estimated_cost}</p>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(notification.createdAt)}</span>
                        </div>
                        {notification.action_required && (
                          <Badge variant="destructive" className="text-xs">
                            Action Required
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {notifications.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BellOff className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No {showOnlyUnread ? 'unread ' : ''}notifications</p>
                <p className="text-sm">You'll be notified when new orders are assigned</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
