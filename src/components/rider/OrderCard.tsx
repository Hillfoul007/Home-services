import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Phone, Navigation } from 'lucide-react';
import { toast } from 'sonner';

type Order = {
  _id: string;
  bookingId?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  pickupTime?: string;
  type?: string;
  status?: string;
  riderStatus?: string;
  coordinates?: { lat?: number; lng?: number };
  vendorCoordinates?: { lat?: number; lng?: number } | null;
};

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const aHarv = sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
  return R * c;
}

export default function OrderCard({
  order,
  currentLocation,
  onNavigate,
  onPickup,
  onDeliver,
}: {
  order: Order;
  currentLocation: { lat: number; lng: number } | null;
  onNavigate: (order: Order) => void;
  onPickup: (id: string) => void;
  onDeliver: (id: string) => void;
}) {
  const statusLabel = order.riderStatus || 'unassigned';
  const isPickup = order.status === 'pickup_assigned';
  const isDelivery = order.status === 'delivery_assigned' || order.status === 'in_transit';

  const safeCall = async (fn: Function, ...args: any[]) => {
    try {
      await Promise.resolve(fn(...args));
    } catch (err) {
      console.error('OrderCard action error:', err);
      toast.error('Action failed. Please try again.');
    }
  };

  const pickupCoords = order.coordinates && typeof order.coordinates.lat === 'number' && typeof order.coordinates.lng === 'number'
    ? { lat: order.coordinates.lat, lng: order.coordinates.lng }
    : null;

  const vendorCoords = order.vendorCoordinates && typeof order.vendorCoordinates.lat === 'number' && typeof order.vendorCoordinates.lng === 'number'
    ? { lat: order.vendorCoordinates.lat, lng: order.vendorCoordinates.lng }
    : null;

  const distanceToPickup = (currentLocation && pickupCoords) ? Math.round(haversineMeters(currentLocation, pickupCoords)) : null;
  const distanceToVendor = (currentLocation && vendorCoords) ? Math.round(haversineMeters(currentLocation, vendorCoords)) : null;

  // Enabled when within 200 meters
  const pickupEnabled = distanceToPickup !== null ? distanceToPickup <= 200 : false;
  // For delivery: require pickup already happened (status picked_up) and either vendor coords are unknown (allow) or within 200m
  const deliverEnabled = statusLabel === 'picked_up' && (vendorCoords ? (distanceToVendor !== null ? distanceToVendor <= 200 : false) : true);

  return (
    <Card className={`mb-3 border-l-4 ${isPickup ? 'border-l-purple-500' : isDelivery ? 'border-l-orange-500' : 'border-l-gray-300'}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {isPickup && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🧺 PICKUP</span>}
              {isDelivery && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🚚 DELIVERY</span>}
              <div className="font-medium">{order.customerName || 'Customer'}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{order.bookingId || ''} • {order.type || ''}</div>
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
        </div>

        <div className="flex items-center gap-2 justify-end">
          {/* Show pickup button when order not yet picked up */}
          {statusLabel !== 'picked_up' && (
            <Button size="sm" onClick={() => safeCall(onPickup, order._id)} disabled={!pickupEnabled}>
              {pickupEnabled ? 'Mark Picked Up' : `Reach customer to enable`}
            </Button>
          )}

          {/* After picked up, show deliver button */}
          {statusLabel === 'picked_up' && (
            <Button size="sm" onClick={() => safeCall(onDeliver, order._id)} disabled={!deliverEnabled}>
              {deliverEnabled ? 'Mark Delivered' : 'Reach vendor to enable'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
