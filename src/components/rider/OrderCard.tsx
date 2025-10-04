import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Phone, CheckCircle, XCircle, Navigation } from 'lucide-react';

type Order = {
  _id: string;
  bookingId?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  pickupTime?: string;
  type?: string;
  riderStatus?: string;
};

import { toast } from 'sonner';

export default function OrderCard({
  order,
  onAccept,
  onReject,
  onStart,
  onComplete,
  onNavigate,
  onEditCart,
}: {
  order: Order;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onNavigate: (order: Order) => void;
  onEditCart: (order: Order) => void;
}) {
  const statusLabel = order.riderStatus || 'unassigned';

  const safeCall = async (fn: Function, ...args: any[]) => {
    try {
      await Promise.resolve(fn(...args));
    } catch (err) {
      console.error('OrderCard action error:', err);
      toast.error('Action failed. Please try again.');
    }
  };

  return (
    <Card className="mb-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <div className="font-medium">{order.customerName || 'Customer'}</div>
            <div className="text-xs text-muted-foreground">{order.bookingId || ''} • {order.type || ''}</div>
          </div>
          <div className="text-sm text-gray-600">{order.pickupTime || ''}</div>
        </CardTitle>
        <CardDescription className="mt-2 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-1 text-gray-500" />
            <div className="text-sm">{order.address}</div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Phone className="h-4 w-4 text-gray-500" />
            <div className="text-sm break-words">{order.customerPhone}</div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {statusLabel && (
            <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{statusLabel}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => safeCall(onNavigate, order)} className="flex-1">
            <Navigation className="mr-2 h-4 w-4" /> Navigate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => safeCall(onEditCart, order)}>
            Edit Cart
          </Button>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {statusLabel === 'assigned' && (
            <>
              <Button size="sm" onClick={() => safeCall(onAccept, order._id)}>
                <CheckCircle className="mr-2 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="destructive" onClick={() => safeCall(onReject, order._id)}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
            </>
          )}

          {statusLabel === 'accepted' && (
            <Button size="sm" onClick={() => safeCall(onStart, order._id)}>
              Start
            </Button>
          )}

          {(statusLabel === 'on_the_way' || statusLabel === 'picked_up') && (
            <Button size="sm" onClick={() => safeCall(onComplete, order._id)}>
              Delivered
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
