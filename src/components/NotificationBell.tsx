import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing } from 'lucide-react';
import UserNotifications from './UserNotifications';

interface NotificationBellProps {
  userId?: string;
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, className = '' }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUnreadCount();
      // Poll for new notifications every 5 minutes (reduced from 30 seconds to prevent infinite refreshing)
      // Also only poll when page is visible
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchUnreadCount();
        }
      }, 300000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [userId]);

  const fetchUnreadCount = async () => {
    if (!userId || isLoading) return;

    // Add rate limiting to prevent excessive API calls
    const lastFetch = localStorage.getItem(`lastNotificationFetch_${userId}`);
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;

    if (lastFetch && parseInt(lastFetch) > twoMinutesAgo) {
      console.log('⏭️ Skipping notification count fetch - rate limited');
      return;
    }

    localStorage.setItem(`lastNotificationFetch_${userId}`, now.toString());

    setIsLoading(true);
    try {
      console.log('🔔 Fetching notification count for user:', userId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('/api/notifications/count', {
        headers: {
          'user-id': userId,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count || 0);
        console.log('✅ Notification count fetched:', data.unread_count);
      } else if (response.status >= 500) {
        console.warn('⚠️ Backend server error for notifications - using default count');
        setUnreadCount(0);
      } else {
        console.warn(`⚠️ Failed to fetch notification count: ${response.status}`);
        setUnreadCount(0);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('⚠️ Notification count fetch timed out');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        console.warn('⚠️ Network error fetching notification count:', error.message);
      } else {
        console.warn('⚠️ Error fetching notification count:', error);
      }
      setUnreadCount(0); // Fallback to 0 count
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (!userId) {
      console.warn('No user ID provided for notifications');
      return;
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Refresh count after closing notifications (but respect rate limiting)
    setTimeout(() => {
      // Clear rate limit for immediate refresh after user action
      localStorage.removeItem(`lastNotificationFetch_${userId}`);
      fetchUnreadCount();
    }, 500);
  };

  if (!userId) {
    return null; // Don't show bell if no user
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={`relative p-2 ${className}`}
        disabled={isLoading}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 text-blue-600" />
        ) : (
          <Bell className="h-5 w-5 text-gray-600" />
        )}
        
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      <UserNotifications
        userId={userId}
        isOpen={isOpen}
        onClose={handleClose}
      />
    </>
  );
};

export default NotificationBell;
