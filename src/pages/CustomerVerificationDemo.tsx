import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Bell,
  Package,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Smartphone,
  Eye,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import CustomerVerificationPopup from '@/components/CustomerVerificationPopup';
import { useCustomerVerification } from '@/hooks/useCustomerVerification';
import CustomerVerificationService from '@/services/customerVerificationService';

export default function CustomerVerificationDemo() {
  const [selectedDemo, setSelectedDemo] = useState<'price_change' | 'items_change' | 'quick_pickup'>('price_change');
  const [autoShowPopup, setAutoShowPopup] = useState(true);
  
  const {
    isPopupOpen,
    currentVerification,
    pendingCount,
    showVerificationPopup,
    hideVerificationPopup,
    handleVerificationComplete,
    verificationService
  } = useCustomerVerification();

  const createDemoVerification = (type: 'price_change' | 'items_change' | 'quick_pickup') => {
    const baseOrderData = {
      bookingId: `DEMO-${type.toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      customerName: 'Demo Customer',
      customerPhone: '+91 9999999999',
      address: 'Demo Address, Sector 123, Demo City, 122001',
      pickupTime: '2:00 PM - 4:00 PM',
      riderName: 'Demo Rider',
      updatedAt: new Date().toISOString(),
      status: 'pending',
    };

    let orderData;
    let verificationType: 'price_change' | 'items_change' | 'quick_pickup_created';
    let priority: 'high' | 'medium' | 'low' = 'medium';

    switch (type) {
      case 'price_change':
        orderData = {
          ...baseOrderData,
          originalItems: [
            { id: '1', name: 'Shirt', price: 50, quantity: 2, total: 100, unit: 'PC' },
            { id: '2', name: 'Trouser', price: 80, quantity: 1, total: 80, unit: 'PC' }
          ],
          updatedItems: [
            { id: '1', name: 'Shirt', price: 60, quantity: 2, total: 120, unit: 'PC' }, // Price increased
            { id: '2', name: 'Trouser', price: 80, quantity: 1, total: 80, unit: 'PC' }
          ],
          originalTotal: 180,
          updatedTotal: 200,
          priceChange: 20,
          riderNotes: 'Price increased due to premium fabric care required.',
          isQuickPickup: false
        };
        verificationType = 'price_change';
        priority = 'high';
        break;

      case 'items_change':
        orderData = {
          ...baseOrderData,
          originalItems: [
            { id: '1', name: 'Shirt', price: 50, quantity: 2, total: 100, unit: 'PC' },
            { id: '2', name: 'Trouser', price: 80, quantity: 1, total: 80, unit: 'PC' }
          ],
          updatedItems: [
            { id: '1', name: 'Shirt', price: 50, quantity: 3, total: 150, unit: 'PC' }, // Quantity increased
            { id: '2', name: 'Trouser', price: 80, quantity: 1, total: 80, unit: 'PC' },
            { id: '3', name: 'Jacket', price: 120, quantity: 1, total: 120, unit: 'PC' } // New item added
          ],
          originalTotal: 180,
          updatedTotal: 350,
          priceChange: 170,
          riderNotes: 'Found additional items that need cleaning. Customer requested to add jacket and one more shirt.',
          isQuickPickup: false
        };
        verificationType = 'items_change';
        priority = 'high';
        break;

      case 'quick_pickup':
        orderData = {
          ...baseOrderData,
          originalItems: [],
          updatedItems: [
            { id: '1', name: 'Mixed Garments', price: 0, quantity: 8, total: 0, unit: 'PC', description: 'Assorted clothing items collected' },
            { id: '2', name: 'Bedsheet', price: 0, quantity: 2, total: 0, unit: 'PC', description: 'Large bedsheets' }
          ],
          originalTotal: 0,
          updatedTotal: 450,
          priceChange: 450,
          riderNotes: 'Quick pickup completed. Found 8 regular garments and 2 bedsheets. Estimated cost based on item types and fabric condition.',
          isQuickPickup: true
        };
        verificationType = 'quick_pickup_created';
        priority = 'high';
        break;
    }

    const verificationId = verificationService.addPendingVerification({
      orderId: `demo-order-${Date.now()}`,
      orderData,
      type: verificationType,
      priority,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
    });

    if (autoShowPopup) {
      setTimeout(() => {
        showVerificationPopup();
      }, 500);
    }

    toast.success(`Created ${type.replace('_', ' ')} verification demo`);
    return verificationId;
  };

  const clearAllVerifications = () => {
    verificationService.clearAllVerifications();
    hideVerificationPopup();
    toast.success('All verifications cleared');
  };

  const refreshVerifications = async () => {
    await verificationService.refreshVerifications();
    toast.success('Verifications refreshed');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-6 w-6 text-blue-600" />
              <span>Customer Verification System Demo</span>
            </CardTitle>
            <CardDescription>
              This demonstrates the customer verification popup that appears when riders make changes to orders.
              In a real scenario, customers would see this popup on their mobile app when they open it.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Demo Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Demo Controls</span>
              <div className="flex items-center space-x-2">
                {pendingCount > 0 && (
                  <Badge className="bg-red-500 text-white">
                    {pendingCount} pending
                  </Badge>
                )}
                <Badge variant="outline">
                  Auto-show: {autoShowPopup ? 'ON' : 'OFF'}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-show toggle */}
            <div className="flex items-center space-x-2">
              <Button
                variant={autoShowPopup ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoShowPopup(!autoShowPopup)}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Auto-show popup
              </Button>
              <p className="text-sm text-gray-600">
                When enabled, popup appears automatically after creating verification
              </p>
            </div>

            {/* Demo type selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant={selectedDemo === 'price_change' ? "default" : "outline"}
                onClick={() => setSelectedDemo('price_change')}
                className="p-4 h-auto flex-col"
              >
                <AlertTriangle className="h-6 w-6 mb-2 text-orange-500" />
                <span className="font-medium">Price Change</span>
                <span className="text-xs text-gray-600 mt-1">Service price modified by rider</span>
              </Button>
              
              <Button
                variant={selectedDemo === 'items_change' ? "default" : "outline"}
                onClick={() => setSelectedDemo('items_change')}
                className="p-4 h-auto flex-col"
              >
                <Package className="h-6 w-6 mb-2 text-blue-500" />
                <span className="font-medium">Items Change</span>
                <span className="text-xs text-gray-600 mt-1">Items added/removed/modified</span>
              </Button>
              
              <Button
                variant={selectedDemo === 'quick_pickup' ? "default" : "outline"}
                onClick={() => setSelectedDemo('quick_pickup')}
                className="p-4 h-auto flex-col"
              >
                <Clock className="h-6 w-6 mb-2 text-green-500" />
                <span className="font-medium">Quick Pickup</span>
                <span className="text-xs text-gray-600 mt-1">New order created by rider</span>
              </Button>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled
                className="bg-gray-400 cursor-not-allowed"
                title="Demo verification creation has been disabled"
              >
                <Bell className="h-4 w-4 mr-2" />
                Demo Creation Disabled
              </Button>
              
              {pendingCount > 0 && (
                <Button
                  onClick={() => showVerificationPopup()}
                  variant="outline"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Show Popup ({pendingCount})
                </Button>
              )}
              
              <Button
                onClick={refreshVerifications}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              
              {pendingCount > 0 && (
                <Button
                  onClick={clearAllVerifications}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How the Customer Verification System Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Alert>
                <User className="h-4 w-4" />
                <AlertDescription>
                  <strong>1. Rider Makes Changes</strong><br/>
                  Rider modifies order items, quantities, or prices during pickup/service
                </AlertDescription>
              </Alert>
              
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertDescription>
                  <strong>2. Customer Gets Notified</strong><br/>
                  Customer receives notification and sees popup when opening the app
                </AlertDescription>
              </Alert>
              
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>3. Customer Responds</strong><br/>
                  Customer approves or rejects changes, and rider is notified of the decision
                </AlertDescription>
              </Alert>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Real-world Scenarios:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Price Changes:</strong> Special fabric requiring premium care</li>
                <li>• <strong>Item Changes:</strong> Customer forgot items, or rider found additional items</li>
                <li>• <strong>Quick Pickups:</strong> Rider creates order on-site based on collected items</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Current Status */}
        {pendingCount > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800">Pending Verifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-700">
                You have {pendingCount} pending verification{pendingCount > 1 ? 's' : ''} waiting for customer response.
              </p>
              {currentVerification && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <p className="font-medium">Next: {currentVerification.orderData.bookingId}</p>
                  <p className="text-sm text-gray-600">{currentVerification.type.replace('_', ' ')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Customer Verification Popup */}
      <CustomerVerificationPopup
        isOpen={isPopupOpen}
        onClose={hideVerificationPopup}
        verification={currentVerification}
        onVerificationComplete={handleVerificationComplete}
      />
    </div>
  );
}
