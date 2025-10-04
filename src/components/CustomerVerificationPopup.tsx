import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Bell,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import CustomerVerificationService, { PendingVerification } from '@/services/customerVerificationService';
import { getCategoryDisplay } from '@/data/laundryServices';

interface CustomerVerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  verification?: PendingVerification | null;
  onVerificationComplete?: (approved: boolean, verificationId: string) => void;
}

export default function CustomerVerificationPopup({
  isOpen,
  onClose,
  verification,
  onVerificationComplete
}: CustomerVerificationPopupProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentVerification, setCurrentVerification] = useState<PendingVerification | null>(verification || null);
  const verificationService = CustomerVerificationService.getInstance();

  useEffect(() => {
    console.log('📱 CustomerVerificationPopup - isOpen changed:', isOpen);
    console.log('📱 CustomerVerificationPopup - verification prop:', verification);

    if (isOpen && !verification) {
      // Get the next pending verification
      const next = verificationService.getNextPendingVerification();
      console.log('📱 CustomerVerificationPopup - next verification:', next);
      setCurrentVerification(next);
      if (next) {
        console.log('✅ CustomerVerificationPopup - set current verification');
      } else {
        console.log('❌ CustomerVerificationPopup - no verification found');
      }
    } else {
      setCurrentVerification(verification || null);
      console.log('✅ CustomerVerificationPopup - set verification from prop or null');
    }
  }, [isOpen, verification]);

  // Validation effect to handle invalid verification data
  useEffect(() => {
    if (currentVerification && !isValidVerificationData(currentVerification)) {
      console.error('CustomerVerificationPopup: Invalid verification data detected', {
        verification: currentVerification
      });

      // Try to get the next valid verification
      const validVerifications = verificationService.getPendingVerifications()
        .filter(v => isValidVerificationData(v));

      if (validVerifications.length > 0) {
        setCurrentVerification(validVerifications[0]);
      } else {
        // No valid verifications found, close popup
        onClose();
      }
    }
  }, [currentVerification, onClose]);

  const handleVerification = async (approved: boolean) => {
    if (!currentVerification) return;

    setIsSubmitting(true);
    try {
      const result = await verificationService.processVerification(
        currentVerification.id,
        approved
      );

      if (result.success) {
        toast.success(result.message);
        onVerificationComplete?.(approved, currentVerification.id);
        
        // Check if there are more verifications to show
        const nextVerification = verificationService.getNextPendingVerification();
        if (nextVerification && nextVerification.id !== currentVerification.id) {
          setCurrentVerification(nextVerification);
        } else {
          onClose();
        }
      } else {
        toast.error(result.message || 'Failed to process verification');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to process verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Move to next verification or close
    const allVerifications = verificationService.getPendingVerifications();
    const currentIndex = allVerifications.findIndex(v => v.id === currentVerification?.id);

    if (currentIndex >= 0 && currentIndex < allVerifications.length - 1) {
      setCurrentVerification(allVerifications[currentIndex + 1]);
    } else {
      onClose();
    }
  };

  // Helper function to validate verification data structure
  const isValidVerificationData = (verification: any): boolean => {
    console.log('🔍 Validating verification data:', verification);

    if (!verification) {
      console.log('❌ Validation failed: No verification object');
      return false;
    }

    if (!verification.orderData) {
      console.log('❌ Validation failed: No orderData');
      return false;
    }

    if (!Array.isArray(verification.orderData.originalItems)) {
      console.log('❌ Validation failed: originalItems is not an array:', verification.orderData.originalItems);
      return false;
    }

    if (!Array.isArray(verification.orderData.updatedItems)) {
      console.log('❌ Validation failed: updatedItems is not an array:', verification.orderData.updatedItems);
      return false;
    }

    console.log('✅ Validation passed');
    return true;
  };

  const getItemChanges = (orderData: any) => {
    const changes = [];

    // Defensive checks for required arrays
    const originalItems = Array.isArray(orderData.originalItems) ? orderData.originalItems : [];
    const updatedItems = Array.isArray(orderData.updatedItems) ? orderData.updatedItems : [];

    const originalMap = new Map(originalItems.map((item: any) => [item.name, item]));
    const updatedMap = new Map(updatedItems.map((item: any) => [item.name, item]));

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'price_change': return <ArrowRight className="h-4 w-4" />;
      case 'items_change': return <Package className="h-4 w-4" />;
      case 'quick_pickup_created': return <Clock className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'price_change': return 'Price has been updated';
      case 'items_change': return 'Items have been modified';
      case 'quick_pickup_created': return 'New quick pickup order created';
      default: return 'Order requires verification';
    }
  };

  if (!currentVerification) {
    console.log('❌ CustomerVerificationPopup: No current verification, returning null');
    return null;
  }

  if (!isValidVerificationData(currentVerification)) {
    console.log('❌ CustomerVerificationPopup: Invalid verification data, returning null');
    return null;
  }

  console.log('��� CustomerVerificationPopup: Rendering popup with valid verification');

  const { orderData } = currentVerification;

  const itemChanges = getItemChanges(orderData);
  const pendingCount = verificationService.getPendingVerifications().length;

  console.log('📱 CustomerVerificationPopup render - isOpen:', isOpen, 'currentVerification:', currentVerification);

  // Mobile-specific debugging
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    console.log('📱 Mobile CustomerVerificationPopup render:', {
      isOpen,
      hasVerification: !!currentVerification,
      verificationId: currentVerification?.id,
      verificationType: currentVerification?.type,
      pendingCount,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        console.log('📱 Dialog onOpenChange called with:', open);
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-4xl w-[95vw] max-h-[95vh] overflow-y-auto sm:w-full p-3 sm:p-6 sm:m-4 m-2"
        onOpenAutoFocus={(e) => {
          console.log('📱 Dialog auto focus event');
        }}
        onInteractOutside={(e) => {
          console.log('📱 Dialog interact outside');
          // Prevent closing on mobile when clicking outside
          if (window.innerWidth < 768) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <DialogTitle className="text-base sm:text-lg">Customer Verification</DialogTitle>
            </div>
            <div className="flex items-center space-x-2 flex-wrap">
              {pendingCount > 1 && (
                <Badge variant="outline" className="text-xs">
                  {pendingCount} pending
                </Badge>
              )}
              <Badge className={getPriorityColor(currentVerification.priority)}>
                {currentVerification.priority.toUpperCase()}
              </Badge>
            </div>
          </div>
          <DialogDescription>
            Customer has been notified of the changes and needs to verify them before you can save the order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Verification Type Alert */}
          <Alert className={getPriorityColor(currentVerification.priority)}>
            {getTypeIcon(currentVerification.type)}
            <AlertDescription>
              <strong>{getTypeDescription(currentVerification.type)}</strong>
              {currentVerification.type === 'quick_pickup_created' && 
                ' - The customer needs to approve this new order.'
              }
            </AlertDescription>
          </Alert>

          {/* Order Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Order ID</p>
              <p className="font-medium">{orderData.bookingId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-medium">{orderData.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rider</p>
              <p className="font-medium">{orderData.riderName}</p>
            </div>
          </div>


          {/* Customer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <div className="flex items-center space-x-1">
                <Phone className="h-3 w-3 text-gray-400" />
                <p className="font-medium">{orderData.customerPhone}</p>
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

          <div>
            <p className="text-sm text-gray-600">Pickup Address</p>
            <div className="flex items-start space-x-1">
              <MapPin className="h-3 w-3 text-gray-400 mt-1" />
              <p className="font-medium">{orderData.address}</p>
            </div>
          </div>

          {/* Rider Notes */}
          {orderData.riderNotes && (
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                <strong>Rider's Note:</strong> {orderData.riderNotes}
              </AlertDescription>
            </Alert>
          )}

          {/* Updated Items List */}
          <div>
            <h3 className="font-semibold mb-3">Updated Service List</h3>
            <div className="space-y-3">
              {orderData.updatedItems.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50">
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
          </div>

          {/* Changes Summary */}
          {itemChanges.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Changes Made</h3>
              <div className="space-y-3">
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
            </div>
          )}

          {/* Price Comparison */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-3">Price Summary</h3>
            <div className="space-y-2">
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
              {!orderData.isQuickPickup && orderData.priceChange !== 0 && (
                <div className={`flex justify-between font-semibold text-lg border-t pt-2 ${
                  orderData.priceChange > 0 ? 'text-red-600' : 
                  orderData.priceChange < 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  <span>Price Change:</span>
                  <span>
                    {orderData.priceChange > 0 ? '+' : ''}₹{orderData.priceChange}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Customer Verification Actions */}
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              Verify Order Changes
            </h3>
            <p className="text-sm text-blue-800 mb-4">
              Please review the changes above and choose your action:
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => handleVerification(true)}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-white flex-1 h-12 text-base font-semibold"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Processing...' : 'Approve Changes'}
              </Button>
              <Button
                onClick={() => handleVerification(false)}
                disabled={isSubmitting}
                variant="destructive"
                className="flex-1 h-12 text-base font-semibold"
              >
                <XCircle className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Processing...' : 'Reject Changes'}
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              {pendingCount > 1 && `${pendingCount - 1} more verification(s) pending`}
            </div>

            <div className="flex space-x-3">
              {pendingCount > 1 && (
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                >
                  Skip for Now
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-1" />
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
