import React from 'react';
import CustomerOrderVerification from '@/components/CustomerOrderVerification';

export default function OrderVerificationDemo() {
  const handleVerificationComplete = (approved: boolean) => {
    console.log('Verification completed:', approved);
    // In a real app, this would navigate to order details or dashboard
  };

  const sampleOrderData = {
    bookingId: 'LAU-001',
    customerName: 'John Doe',
    customerPhone: '+91 9876543210',
    address: 'D62, Extension, Chhawla, New Delhi, Delhi, 122101',
    pickupTime: '2:00 PM - 4:00 PM',
    riderName: 'Rajesh Kumar',
    updatedAt: new Date().toISOString(),
    status: 'pending_verification',
    isQuickPickup: false,
    originalItems: [
      {
        id: '1',
        serviceId: 'dry-clean-mens-shirt',
        name: "Men's Shirt/T-Shirt",
        description: "Professional dry cleaning for men's shirts and t-shirts.",
        price: 100,
        unit: 'PC',
        category: 'mens-dry-clean',
        quantity: 2,
        total: 200
      },
      {
        id: '2',
        serviceId: 'dry-clean-mens-trouser',
        name: 'Trouser/Jeans',
        description: "Expert dry cleaning for men's trousers and jeans.",
        price: 120,
        unit: 'PC',
        category: 'mens-dry-clean',
        quantity: 1,
        total: 120
      }
    ],
    updatedItems: [
      {
        id: '1',
        serviceId: 'dry-clean-mens-shirt',
        name: "Men's Shirt/T-Shirt",
        description: "Professional dry cleaning for men's shirts and t-shirts.",
        price: 100,
        unit: 'PC',
        category: 'mens-dry-clean',
        quantity: 3,
        total: 300
      },
      {
        id: '2',
        serviceId: 'dry-clean-mens-trouser',
        name: 'Trouser/Jeans',
        description: "Expert dry cleaning for men's trousers and jeans.",
        price: 120,
        unit: 'PC',
        category: 'mens-dry-clean',
        quantity: 1,
        total: 120
      },
      {
        id: '3',
        serviceId: 'dry-clean-mens-coat',
        name: 'Coat',
        description: "Premium dry cleaning for men's coats and blazers.",
        price: 240,
        unit: 'PC',
        category: 'mens-dry-clean',
        quantity: 1,
        total: 240
      }
    ],
    originalTotal: 320,
    updatedTotal: 660,
    priceChange: 340,
    riderNotes: 'Customer had additional items that needed cleaning. Added 1 extra shirt and 1 coat as requested during pickup.'
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Verification</h1>
          <p className="text-gray-600">Review changes made to your order by the rider</p>
        </div>

        <CustomerOrderVerification
          orderId="LAU-001"
          orderData={sampleOrderData}
          onVerificationComplete={handleVerificationComplete}
        />
      </div>
    </div>
  );
}
