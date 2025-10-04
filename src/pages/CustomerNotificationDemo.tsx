import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Bell,
  Package,
  Clock,
  User,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerNotificationDemo() {
  const [notificationView, setNotificationView] = useState<'list' | 'detail'>('list');
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const notifications = [
    {
      id: '1',
      type: 'order_verification_required',
      title: 'Order Changes Need Your Approval',
      message: 'Your order A20250800050 has been updated by the rider and requires your approval.',
      time: 'Just now',
      read: false,
      priority: 'high',
      orderData: {
        bookingId: 'A20250800050',
        customerName: 'John Doe',
        riderName: 'Rajesh Kumar',
        originalTotal: 470,
        updatedTotal: 796.40,
        priceChange: 326.40,
        changes: [
          { type: 'updated', item: "Men's Suit / Lehenga / Heavy Dresses", quantity: 1, price: 150 },
          { type: 'updated', item: 'Ladies Suit / Kurta & Pyjama / Saree', quantity: 1, price: 100 },
          { type: 'updated', item: 'Laundry and Iron', quantity: 1, price: 120 },
          { type: 'updated', item: "Men's Shirt/T-Shirt", quantity: 1, price: 100 },
          { type: 'updated', item: 'Kurta Pyjama (2 PC)', quantity: 1, price: 220 }
        ]
      }
    },
    {
      id: '2',
      type: 'order_update',
      title: 'Order Updated by Rider',
      message: 'Your order LAU-001 has been updated with additional items',
      time: '5 minutes ago',
      read: false,
      priority: 'high',
      orderData: {
        bookingId: 'LAU-001',
        customerName: 'John Doe',
        riderName: 'Rajesh Kumar',
        originalTotal: 220,
        updatedTotal: 660,
        priceChange: 440,
        changes: [
          { type: 'added', item: 'Coat - Dry Clean', price: 240 },
          { type: 'modified', item: "Men's Shirt", from: 2, to: 3, price: 100 }
        ]
      }
    },
    {
      id: '2',
      type: 'quick_pickup_order',
      title: 'Quick Pickup Order Created',
      message: 'Rider has created your order QP-002 based on collected items',
      time: '5 minutes ago',
      read: false,
      priority: 'high',
      orderData: {
        bookingId: 'QP-002',
        customerName: 'Sarah Johnson',
        riderName: 'Rajesh Kumar',
        originalTotal: 0,
        updatedTotal: 480,
        priceChange: 480,
        isQuickPickup: true,
        changes: [
          { type: 'added', item: 'Laundry and Iron (2 KG)', price: 240 },
          { type: 'added', item: "Women's Dress - Dry Clean", price: 240 }
        ]
      }
    },
    {
      id: '3',
      type: 'order_confirmed',
      title: 'Order Confirmed',
      message: 'Your order LAU-003 has been confirmed and rider assigned',
      time: '1 hour ago',
      read: true,
      priority: 'normal'
    }
  ];

  const handleNotificationClick = (notification: any) => {
    if (notification.orderData) {
      setSelectedNotification(notification);
      setNotificationView('detail');
    } else {
      toast.info('Simple notification - no action needed');
    }
  };

  const handleVerification = (approved: boolean) => {
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});

    toast.success(
      approved
        ? `Order changes approved at ${currentTime} (IST)! Rider has been notified.`
        : `Order changes rejected at ${currentTime} (IST). Rider will modify the order.`
    );
    setNotificationView('list');
    setSelectedNotification(null);
  };

  if (notificationView === 'detail' && selectedNotification) {
    const { orderData } = selectedNotification;
    
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center space-x-4 mb-6">
            <Button
              variant="ghost"
              onClick={() => setNotificationView('list')}
            >
              ← Back to Notifications
            </Button>
            <h1 className="text-xl font-bold">Order Verification</h1>
          </div>

          {/* Alert */}
          <Alert className="border-orange-500 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>{orderData.isQuickPickup ? 'Quick Pickup Order Created' : 'Order Updated'}</strong>
              <br />
              {orderData.isQuickPickup 
                ? 'Rider has created your order based on items collected from your location.'
                : 'Rider has made changes to your order. Please review and verify.'
              }
            </AlertDescription>
          </Alert>

          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Order {orderData.bookingId}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium">{orderData.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Rider</p>
                  <p className="font-medium">{orderData.riderName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Changes */}
          <Card>
            <CardHeader>
              <CardTitle>
                {orderData.isQuickPickup ? 'Services Added' : 'Changes Made'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orderData.changes.map((change: any, index: number) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      change.type === 'added' ? 'bg-green-50 border border-green-200' :
                      change.type === 'modified' ? 'bg-blue-50 border border-blue-200' :
                      'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {change.type === 'added' && '+ '}
                          {change.type === 'modified' && '~ '}
                          {change.type === 'removed' && '- '}
                          {change.item}
                        </p>
                        {change.type === 'modified' && (
                          <p className="text-sm text-gray-600">
                            Quantity: {change.from} → {change.to}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold text-green-600">
                        {change.type === 'added' && '+'}₹{change.price}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Price Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Price Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {!orderData.isQuickPickup && (
                  <div className="flex justify-between">
                    <span>Original Total:</span>
                    <span>₹{orderData.originalTotal}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>New Total:</span>
                  <span>₹{orderData.updatedTotal}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>
                      {orderData.isQuickPickup ? 'Total Amount:' : 'Price Change:'}
                    </span>
                    <span className={
                      orderData.isQuickPickup ? 'text-blue-600' :
                      orderData.priceChange > 0 ? 'text-red-600' : 'text-green-600'
                    }>
                      {orderData.isQuickPickup ? '' : '+'}₹{orderData.priceChange}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex space-x-4">
                <Button
                  variant="destructive"
                  onClick={() => handleVerification(false)}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Changes
                </Button>
                <Button
                  onClick={() => handleVerification(true)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Order
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* App Header */}
        <div className="bg-white rounded-t-lg p-4 border-b">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Laundrify</h1>
            <div className="relative">
              <Bell className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                2
              </span>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-b-lg">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Notifications</h2>
          </div>
          
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start space-x-3">
                  <div className={`rounded-full p-2 ${
                    notification.type === 'order_update' ? 'bg-orange-100' :
                    notification.type === 'quick_pickup_order' ? 'bg-blue-100' :
                    'bg-green-100'
                  }`}>
                    {notification.type === 'order_update' && <AlertTriangle className="h-4 w-4 text-orange-600" />}
                    {notification.type === 'quick_pickup_order' && <Package className="h-4 w-4 text-blue-600" />}
                    {notification.type === 'order_confirmed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{notification.title}</h3>
                      <div className="flex items-center space-x-2">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        {notification.priority === 'high' && (
                          <Badge variant="destructive" className="text-xs">High</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-2">{notification.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demo Info */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Demo:</strong> Click on order notification items to see the verification interface
          </p>
        </div>
      </div>
    </div>
  );
}
