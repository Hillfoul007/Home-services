import React from 'react';
import RiderLayout from '@/components/rider/RiderLayout';
import RiderNotifications from '@/components/rider/RiderNotifications';

export default function RiderNotificationsPage() {
  return (
    <RiderLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        </div>
        
        <RiderNotifications compact={false} />
      </div>
    </RiderLayout>
  );
}
