import React, { useState, useEffect } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderVerificationProps {
  orderId: string;
  onVerificationComplete?: (approved: boolean) => void;
}

export default function OrderVerification({ orderId, onVerificationComplete }: OrderVerificationProps) {
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOrderVerificationData();
  }, [orderId]);

  const fetchOrderVerificationData = async () => {
    try {
      setIsLoading(true);
      // This would be an API call to get order verification details
      // For now, using mock data
      setTimeout(() => {
        setOrderData({
          orderId: orderId,
          bookingId: 'LAU-001',
          customerName: 'John Doe',
          riderName: 'Rajesh Kumar',
          updatedAt: new Date().toISOString(),
          status: 'pending_verification',
          originalItems: [
            { name: 'Cotton Shirt', quantity: 2, price: 50 },
            { name: 'Denim Jeans', quantity: 1, price: 80 }
          ],
          updatedItems: [
            { name: 'Cotton Shirt', quantity: 3, price: 50 },
            { name: 'Denim Jeans', quantity: 1, price: 80 },
            { name: 'Silk Tie', quantity: 1, price: 120 }
          ],
          originalTotal: 180,
          updatedTotal: 350,
          priceChange: 170,
          riderNotes: 'Customer had additional items that needed cleaning. Added 1 extra shirt and 1 silk tie as requested.'
        });
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      toast.error('Failed to load order verification details');
      setIsLoading(false);
    }
  };

  const handleVerification = async (approved: boolean) => {
    setIsSubmitting(true);
    try {
      // API call to approve/reject the order changes
      await new Promise(resolve => setTimeout(resolve, 1500)); // Mock delay
      
      if (approved) {
        toast.success('Order changes approved! The rider has been notified.');
      } else {
        toast.success('Order changes rejected. The rider will be informed.');
      }
      
      onVerificationComplete?.(approved);
    } catch (error) {
      toast.error('Failed to process verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Package className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p>Loading order verification details...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orderData) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <XCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
            <p>Order verification data not found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getItemChanges = () => {
    const changes = [];
    const originalMap = new Map(orderData.originalItems.map((item: any) => [item.name, item]));
    const updatedMap = new Map(orderData.updatedItems.map((item: any) => [item.name, item]));

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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <Card>
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
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge variant="secondary">Pending Verification</Badge>
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

      {/* Changes Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Changes Made</CardTitle>
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
                      <span className="text-green-700">
                        Qty: {change.item.quantity} × ₹{change.item.price} = ₹{change.item.quantity * change.item.price}
                      </span>
                    )}
                    {change.type === 'removed' && (
                      <span className="text-red-700">
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

      {/* Price Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Price Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Original Total:</span>
              <span>₹{orderData.originalTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated Total:</span>
              <span>₹{orderData.updatedTotal}</span>
            </div>
            <div className={`flex justify-between font-semibold text-lg border-t pt-3 ${
              orderData.priceChange > 0 ? 'text-red-600' : orderData.priceChange < 0 ? 'text-green-600' : 'text-gray-900'
            }`}>
              <span>Price Change:</span>
              <span>
                {orderData.priceChange > 0 ? '+' : ''}₹{orderData.priceChange}
                {orderData.priceChange !== 0 && (
                  <span className="text-sm font-normal text-gray-600 ml-1">
                    ({orderData.priceChange > 0 ? 'increase' : 'saving'})
                  </span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please carefully review the changes above. Once you approve or reject, the rider will be notified immediately.
              </AlertDescription>
            </Alert>
            
            <div className="flex space-x-4">
              <Button
                variant="destructive"
                onClick={() => handleVerification(false)}
                disabled={isSubmitting}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Changes
              </Button>
              <Button
                onClick={() => handleVerification(true)}
                disabled={isSubmitting}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Processing...' : 'Approve Changes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
