import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Clock,
  Minus,
  Plus,
  ArrowRight,
  Phone,
  MapPin,
  Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { getCategoryDisplay } from '@/data/laundryServices';

interface OrderItem {
  id: string;
  serviceId?: string;
  name: string;
  description?: string;
  price: number;
  unit?: string;
  category?: string;
  quantity: number;
  total: number;
}

interface CustomerOrderVerificationProps {
  orderId: string;
  orderData: {
    bookingId: string;
    customerName: string;
    customerPhone: string;
    address: string;
    pickupTime: string;
    riderName: string;
    updatedAt: string;
    status: string;
    originalItems: OrderItem[];
    updatedItems: OrderItem[];
    originalTotal: number;
    updatedTotal: number;
    priceChange: number;
    riderNotes: string;
    isQuickPickup: boolean;
  };
  onVerificationComplete?: (approved: boolean) => void;
}

export default function CustomerOrderVerification({ 
  orderId, 
  orderData, 
  onVerificationComplete 
}: CustomerOrderVerificationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerification = async (approved: boolean) => {
    setIsSubmitting(true);
    try {
      // API call to approve/reject the order changes
      await new Promise(resolve => setTimeout(resolve, 1500)); // Mock delay
      
      if (approved) {
        toast.success('Order changes approved! The rider has been notified and can now complete the order.');
      } else {
        toast.success('Order changes rejected. The rider will be informed to modify the order.');
      }
      
      onVerificationComplete?.(approved);
    } catch (error) {
      toast.error('Failed to process verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getItemChanges = () => {
    const changes = [];
    const originalMap = new Map(orderData.originalItems.map((item) => [item.name, item]));
    const updatedMap = new Map(orderData.updatedItems.map((item) => [item.name, item]));

    // Check for added items
    for (const [name, item] of updatedMap) {
      if (!originalMap.has(name)) {
        changes.push({ type: 'added', item, original: null });
      }
    }

    // Check for removed items
    for (const [name, item] of originalMap) {
      if (!updatedMap.has(name)) {
        changes.push({ type: 'removed', item: null, original: item });
      }
    }

    // Check for modified items
    for (const [name, item] of updatedMap) {
      if (originalMap.has(name)) {
        const original = originalMap.get(name);
        if (original.quantity !== item.quantity) {
          changes.push({ type: 'modified', item, original });
        }
      }
    }

    return changes;
  };

  const itemChanges = getItemChanges();

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      {/* Header */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span>Order Verification Required</span>
          </CardTitle>
          <CardDescription>
            Your order has been updated by the rider. Please review and verify the changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Order ID</p>
              <p className="font-medium">{orderData.bookingId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rider</p>
              <p className="font-medium">{orderData.riderName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Updated</p>
              <p className="font-medium">{new Date(orderData.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Type Alert */}
      {orderData.isQuickPickup && (
        <Alert>
          <Package className="h-4 w-4" />
          <AlertDescription>
            <strong>Quick Pickup Order:</strong> The rider has created this order based on items collected from your location.
          </AlertDescription>
        </Alert>
      )}

      {/* Customer Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Order Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-medium">{orderData.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <div className="flex items-center space-x-1">
                <Phone className="h-3 w-3 text-gray-400" />
                <p className="font-medium">{orderData.customerPhone}</p>
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Pickup Address</p>
              <div className="flex items-start space-x-1">
                <MapPin className="h-3 w-3 text-gray-400 mt-1" />
                <p className="font-medium">{orderData.address}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pickup Time</p>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <p className="font-medium">{orderData.pickupTime}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rider Notes */}
      {orderData.riderNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Rider's Note</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{orderData.riderNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Complete Service List */}
      <Card>
        <CardHeader>
          <CardTitle>Updated Service List</CardTitle>
          <CardDescription>
            Review all services and their prices in your updated order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderData.updatedItems.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-4 border rounded-lg bg-gray-50">
                <div className="flex-1">
                  <h4 className="font-medium">{item.name}</h4>
                  {item.description && (
                    <p className="text-sm text-gray-600">{item.description}</p>
                  )}
                  {item.category && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {getCategoryDisplay(item.category)}
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {item.quantity} {item.unit || 'PC'} × ₹{item.price}
                  </p>
                  <p className="text-sm font-semibold text-green-600">
                    ₹{item.total || (item.quantity * item.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Changes Summary */}
      {itemChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Changes Made</CardTitle>
            <CardDescription>
              Summary of modifications made to your original order
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {itemChanges.map((change, index) => (
                <div key={index} className={`p-3 rounded-lg border ${
                  change.type === 'added' ? 'bg-green-50 border-green-200' :
                  change.type === 'removed' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {change.type === 'added' && <Plus className="h-4 w-4 text-green-600" />}
                      {change.type === 'removed' && <Minus className="h-4 w-4 text-red-600" />}
                      {change.type === 'modified' && <ArrowRight className="h-4 w-4 text-blue-600" />}
                      <span className="font-medium">
                        {change.type === 'added' && 'Added: '}
                        {change.type === 'removed' && 'Removed: '}
                        {change.type === 'modified' && 'Modified: '}
                        {change.item?.name || change.original?.name}
                      </span>
                    </div>
                    <div className="text-right">
                      {change.type === 'added' && (
                        <span className="text-green-700 font-medium">
                          +₹{change.item.quantity * change.item.price}
                        </span>
                      )}
                      {change.type === 'removed' && (
                        <span className="text-red-700 font-medium">
                          -₹{change.original.quantity * change.original.price}
                        </span>
                      )}
                      {change.type === 'modified' && (
                        <span className="text-blue-700">
                          {change.original.quantity} → {change.item.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Price Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {!orderData.isQuickPickup && (
              <div className="flex justify-between">
                <span>Original Total:</span>
                <span>₹{orderData.originalTotal}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Updated Total:</span>
              <span>₹{orderData.updatedTotal}</span>
            </div>
            {!orderData.isQuickPickup && (
              <div className={`flex justify-between font-semibold text-lg border-t pt-3 ${
                orderData.priceChange > 0 ? 'text-red-600' : 
                orderData.priceChange < 0 ? 'text-green-600' : 'text-gray-900'
              }`}>
                <span>Price Change:</span>
                <span>
                  {orderData.priceChange > 0 ? '+' : ''}₹{orderData.priceChange}
                  {orderData.priceChange !== 0 && (
                    <span className="text-sm font-normal text-gray-600 ml-1">
                      ({orderData.priceChange > 0 ? 'additional' : 'savings'})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Alert>
              <Bell className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Once you approve these changes, the rider will be able to complete your order. 
                If you reject them, the rider will need to modify the order according to your requirements.
              </AlertDescription>
            </Alert>
            
            <div className="flex space-x-4">
              <Button
                variant="destructive"
                onClick={() => handleVerification(false)}
                disabled={isSubmitting}
                className="flex-1"
                size="lg"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Changes
              </Button>
              <Button
                onClick={() => handleVerification(true)}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Processing...' : 'Approve Order'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
