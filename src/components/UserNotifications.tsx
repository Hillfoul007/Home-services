import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Bell,
  BellRing,
  Check,
  X,
  Package,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  action_required: boolean;
  action_type: string;
  priority: string;
  data: {
    changes?: any;
    old_items?: any[];
    new_items?: any[];
    price_change?: number;
    old_total?: number;
    new_total?: number;
    item_changes?: any;
    rider_name?: string;
    rider_phone?: string;
    approved?: boolean;
  };
  related_order?: {
    bookingId: string;
    status: string;
  };
  related_rider?: {
    name: string;
    phone: string;
  };
  createdAt: string;
  time_ago: string;
}

interface UserNotificationsProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const UserNotifications: React.FC<UserNotificationsProps> = ({ userId, isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && userId) {
      fetchNotifications();
    }
  }, [isOpen, userId]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'user-id': userId,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      } else {
        toast.error('Failed to load notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Network error while loading notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'user-id': userId,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif._id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const approveChanges = async (notificationId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/approve`, {
        method: 'POST',
        headers: {
          'user-id': userId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif._id === notificationId 
              ? { 
                  ...notif, 
                  read: true, 
                  action_required: false,
                  data: { ...notif.data, approved, approved_at: new Date().toISOString() }
                } 
              : notif
          )
        );
        toast.success(`Changes ${approved ? 'approved' : 'rejected'} successfully`);
      } else {
        toast.error('Failed to process approval');
      }
    } catch (error) {
      console.error('Error approving changes:', error);
      toast.error('Network error while processing approval');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'user-id': userId,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
        toast.success('Notification deleted');
      } else {
        toast.error('Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Network error while deleting notification');
    }
  };

  const toggleExpanded = (notificationId: string) => {
    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const renderItemChanges = (notification: Notification) => {
    const { data } = notification;
    if (!data.item_changes) return null;

    const { added, removed, modified } = data.item_changes;

    return (
      <div className="space-y-3 mt-4 p-4 bg-gray-50 rounded-lg">
        <h5 className="font-medium text-sm">Order Changes:</h5>
        
        {added?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-green-700 mb-1">✅ Added Items:</p>
            {added.map((item: any, index: number) => (
              <p key={index} className="text-xs text-green-600">
                + {item.name} (Qty: {item.quantity}, Price: ₹{item.price})
              </p>
            ))}
          </div>
        )}

        {removed?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-700 mb-1">❌ Removed Items:</p>
            {removed.map((item: any, index: number) => (
              <p key={index} className="text-xs text-red-600">
                - {item.name} (Qty: {item.quantity}, Price: ₹{item.price})
              </p>
            ))}
          </div>
        )}

        {modified?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-blue-700 mb-1">📝 Modified Items:</p>
            {modified.map((change: any, index: number) => (
              <div key={index} className="text-xs text-blue-600">
                <p>{change.name}:</p>
                <p className="ml-2">
                  Qty: {change.old.quantity} → {change.new.quantity}, 
                  Price: ₹{change.old.price} → ₹{change.new.price}
                </p>
              </div>
            ))}
          </div>
        )}

        {data.price_change !== 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium">
              Total Price Change: 
              <span className={data.price_change > 0 ? 'text-red-600' : 'text-green-600'}>
                {data.price_change > 0 ? '+' : ''}₹{data.price_change}
              </span>
            </p>
            <p className="text-xs text-gray-600">
              ₹{data.old_total} → ₹{data.new_total}
            </p>
          </div>
        )}
      </div>
    );
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Stay updated with your order changes and important updates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No notifications yet</p>
              <p className="text-gray-500 text-sm">You'll see updates about your orders here</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card 
                key={notification._id} 
                className={`${!notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {getPriorityIcon(notification.priority)}
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-medium">
                          {notification.title}
                          {!notification.read && (
                            <Badge variant="secondary" className="ml-2 text-xs">New</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {notification.time_ago} • {notification.related_rider?.name}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {!notification.read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsRead(notification._id)}
                          className="h-6 w-6 p-0"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteNotification(notification._id)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <p className="text-sm text-gray-700 mb-3">{notification.message}</p>

                  {notification.related_order && (
                    <p className="text-xs text-gray-600 mb-3">
                      Order: #{notification.related_order.bookingId} • Status: {notification.related_order.status}
                    </p>
                  )}

                  {notification.type === 'rider_edit' && notification.data.changes && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(notification._id)}
                        className="mb-2"
                      >
                        <span className="text-xs">View Details</span>
                        {expandedNotifications.has(notification._id) ? (
                          <ChevronUp className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        )}
                      </Button>

                      {expandedNotifications.has(notification._id) && renderItemChanges(notification)}
                    </div>
                  )}

                  {notification.action_required && notification.action_type === 'approve_changes' && !notification.data.approved && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => approveChanges(notification._id, true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Approve Changes
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => approveChanges(notification._id, false)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Reject Changes
                      </Button>
                    </div>
                  )}

                  {notification.data.approved !== undefined && (
                    <div className="mt-2">
                      <Badge 
                        variant={notification.data.approved ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {notification.data.approved ? '✅ Changes Approved' : '❌ Changes Rejected'}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              notifications.filter(n => !n.read).forEach(n => markAsRead(n._id));
            }}
            disabled={unreadCount === 0}
          >
            Mark All as Read
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserNotifications;
