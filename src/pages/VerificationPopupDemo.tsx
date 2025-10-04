import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Bell,
  Package,
  ArrowRight,
  Phone,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Minus
} from 'lucide-react';
import CustomerVerificationPopup from '@/components/CustomerVerificationPopup';
import { useCustomerVerification } from '@/hooks/useCustomerVerification';
import CustomerVerificationService from '@/services/customerVerificationService';

const VerificationPopupDemo: React.FC = () => {
  const {
    isPopupOpen,
    currentVerification,
    pendingCount,
    showVerificationPopup,
    hideVerificationPopup,
    handleVerificationComplete
  } = useCustomerVerification();

  const [demoScenario, setDemoScenario] = useState<string>('');

  const createSpecificDemo = (type: 'price_change' | 'items_change' | 'quick_pickup_created') => {
    const verificationService = CustomerVerificationService.getInstance();
    
    let demoData;
    
    if (type === 'price_change') {
      demoData = {
        type: 'price_change',
        priority: 'high',
        orderData: {
          bookingId: 'BOOK12345',
          customerName: 'Rahul Kumar',
          customerPhone: '+91 9876543210',
          riderName: 'Vijay Singh',
          address: 'A-123, Sector 45, Gurugram, Haryana 122003',
          pickupTime: 'Today 2:00 PM',
          originalItems: [
            { name: 'Men\'s Shirt', quantity: 2, price: 25, total: 50 },
            { name: 'Jeans', quantity: 1, price: 35, total: 35 }
          ],
          updatedItems: [
            { name: 'Men\'s Shirt', quantity: 2, price: 30, total: 60 },
            { name: 'Jeans', quantity: 1, price: 40, total: 40 },
            { name: 'T-Shirt', quantity: 1, price: 20, total: 20 }
          ],
          originalTotal: 85,
          updatedTotal: 120,
          priceChange: 35,
          riderNotes: 'Added extra T-Shirt due to stains found'
        }
      };
    } else if (type === 'items_change') {
      demoData = {
        type: 'items_change',
        priority: 'medium',
        orderData: {
          bookingId: 'BOOK67890',
          customerName: 'Priya Sharma',
          customerPhone: '+91 8765432109',
          riderName: 'Amit Verma',
          address: 'B-456, Sector 28, Gurugram, Haryana 122002',
          pickupTime: 'Tomorrow 10:00 AM',
          originalItems: [
            { name: 'Saree', quantity: 2, price: 50, total: 100 },
            { name: 'Blouse', quantity: 2, price: 25, total: 50 }
          ],
          updatedItems: [
            { name: 'Saree', quantity: 1, price: 50, total: 50 },
            { name: 'Blouse', quantity: 1, price: 25, total: 25 }
          ],
          originalTotal: 150,
          updatedTotal: 75,
          priceChange: -75,
          riderNotes: 'Customer decided to reduce quantity'
        }
      };
    } else {
      demoData = {
        type: 'quick_pickup_created',
        priority: 'high',
        orderData: {
          bookingId: 'QUICK789',
          customerName: 'Ankit Gupta',
          customerPhone: '+91 7654321098',
          riderName: 'Rajesh Kumar',
          address: 'C-789, Sector 56, Gurugram, Haryana 122011',
          pickupTime: 'Today 4:00 PM',
          originalItems: [],
          updatedItems: [
            { name: 'Quick Wash & Fold', quantity: 5, price: 15, total: 75 },
            { name: 'Express Delivery', quantity: 1, price: 25, total: 25 }
          ],
          originalTotal: 0,
          updatedTotal: 100,
          priceChange: 0,
          isQuickPickup: true,
          riderNotes: 'Emergency pickup requested by customer'
        }
      };
    }

    const verificationId = verificationService.createCustomVerification(demoData);
    setDemoScenario(type);
    
    setTimeout(() => {
      showVerificationPopup();
    }, 500);
    
    return verificationId;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-6 w-6 text-blue-600" />
              <span>Customer Verification Popup Demo</span>
              {pendingCount > 0 && (
                <Badge className="bg-red-500 text-white">
                  {pendingCount} pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              This demo shows how riders and customers interact with order verification popups.
              When a rider makes changes to an order, the customer receives a notification and must approve the changes.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Demo Scenarios */}
        <Card>
          <CardHeader>
            <CardTitle>Demo Scenarios</CardTitle>
            <CardDescription>
              Try different verification scenarios to see how the popup works in various situations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Price Change Scenario */}
              <div className="p-4 border rounded-lg bg-red-50 border-red-200">
                <div className="flex items-center space-x-2 mb-2">
                  <ArrowRight className="h-4 w-4 text-red-600" />
                  <h3 className="font-semibold text-red-800">Price Change</h3>
                </div>
                <p className="text-sm text-red-700 mb-3">
                  Rider updates pricing due to additional items or service upgrades
                </p>
                <Button
                  size="sm"
                  onClick={() => createSpecificDemo('price_change')}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  Demo Price Change
                </Button>
              </div>

              {/* Items Change Scenario */}
              <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Items Change</h3>
                </div>
                <p className="text-sm text-blue-700 mb-3">
                  Rider modifies items list due to customer requests or unavailable services
                </p>
                <Button
                  size="sm"
                  onClick={() => createSpecificDemo('items_change')}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Demo Items Change
                </Button>
              </div>

              {/* Quick Pickup Scenario */}
              <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Plus className="h-4 w-4 text-green-600" />
                  <h3 className="font-semibold text-green-800">Quick Pickup</h3>
                </div>
                <p className="text-sm text-green-700 mb-3">
                  New quick pickup order created by rider for immediate service
                </p>
                <Button
                  size="sm"
                  onClick={() => createSpecificDemo('quick_pickup_created')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Demo Quick Pickup
                </Button>
              </div>
            </div>

            {/* Random Demo */}
            <div className="flex justify-center pt-4 border-t">
              <Button
                disabled
                variant="outline"
                className="bg-gray-400 cursor-not-allowed text-gray-600"
                title="Demo verification creation has been disabled"
              >
                <Bell className="h-4 w-4 mr-2" />
                Demo Creation Disabled
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How Customer Verification Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center">
                  <User className="h-4 w-4 mr-2 text-blue-600" />
                  Rider Side
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Rider visits customer location</li>
                  <li>Rider identifies need for changes (pricing, items, etc.)</li>
                  <li>Rider updates order in the app</li>
                  <li>System automatically sends verification request to customer</li>
                  <li>Rider waits for customer approval before proceeding</li>
                </ol>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-green-600" />
                  Customer Side
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Customer receives notification about changes</li>
                  <li>Verification popup appears in their app</li>
                  <li>Customer reviews the changes and pricing</li>
                  <li>Customer approves or rejects the changes</li>
                  <li>Response is sent back to rider immediately</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Demo Status */}
        {demoScenario && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Demo Active:</strong> Currently showing "{demoScenario.replace('_', ' ')}" scenario. 
              {pendingCount > 0 && ` ${pendingCount} verification(s) pending.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Features Highlight */}
        <Card>
          <CardHeader>
            <CardTitle>Key Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Real-time notifications</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Detailed change breakdown</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Price impact calculation</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Customer contact information</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Rider notes and explanations</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Priority-based notifications</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Popup */}
      <CustomerVerificationPopup
        isOpen={isPopupOpen}
        onClose={hideVerificationPopup}
        verification={currentVerification}
        onVerificationComplete={handleVerificationComplete}
      />
    </div>
  );
};

export default VerificationPopupDemo;
