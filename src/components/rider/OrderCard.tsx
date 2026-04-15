import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Phone, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type Order = {
  _id: string;
  bookingId?: string;
  custom_order_id?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  pickupTime?: string;
  deliveryTime?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  delivery_date?: string;
  delivery_time?: string;
  type?: string;
  status?: string;
  riderStatus?: string;
  coordinates?: { lat?: number; lng?: number };
  vendorCoordinates?: { lat?: number; lng?: number } | null;
  // Pricing fields
  final_amount?: number;
  total_price?: number;
  item_prices?: { service_name: string; quantity: number; unit_price: number; total_price: number }[];
  discount_amount?: number;
  cashback?: number;
  wallet_applied?: number;
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

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
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
  const navigate = useNavigate();
  const status = (order.status || '').toLowerCase();
  const riderStatus = (order.riderStatus || 'unassigned').toLowerCase();

  // Determine task type
  const isPickupTask = status === 'pickup_assigned' || status === 'created' || status === 'vendor_assigned';
  const isDeliveryTask = status === 'delivery_assigned' || status === 'in_transit' || status === 'ready_for_delivery';
  const isCompleted = status === 'delivered' || status === 'completed' || status === 'pickup_completed' || status === 'in_progress';

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
  const deliverEnabled = (riderStatus === 'picked_up' || isDeliveryTask) && (vendorCoords ? (distanceToVendor !== null ? distanceToVendor <= 200 : false) : true);

  const orderLabel = order.custom_order_id || order.bookingId || '';

  // Color coding
  const borderColor = isPickupTask ? 'border-l-purple-500' : isDeliveryTask ? 'border-l-orange-500' : isCompleted ? 'border-l-green-400' : 'border-l-gray-300';
  const bgColor = isCompleted ? 'bg-gray-50/50' : 'bg-white';

  return (
    <Card className={`mb-3 border-l-4 ${borderColor} ${bgColor} shadow-sm`}>
      <CardHeader className="pb-2 px-3 pt-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isPickupTask && <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">🧺 PICKUP</span>}
              {isDeliveryTask && <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap">🚚 DELIVERY</span>}
              {isCompleted && <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">✅ DONE</span>}
              <div className="font-medium text-sm truncate">{order.customerName || 'Customer'}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{orderLabel} {order.type ? `• ${order.type}` : ''}</div>
          </div>
          <div className="text-xs text-gray-600 text-right space-y-1 shrink-0">
            {order.pickupTime && (
              <div className="bg-purple-50 px-2 py-0.5 rounded"><span className="font-semibold text-purple-600">P:</span> {order.pickupTime}</div>
            )}
            {(order.deliveryTime || order.delivery_date) && (
              <div className="bg-orange-50 px-2 py-0.5 rounded"><span className="font-semibold text-orange-600">D:</span> {order.deliveryTime || `${order.delivery_date || ''} ${order.delivery_time || ''}`.trim() || 'TBD'}</div>
            )}
          </div>
        </CardTitle>
        <CardDescription className="mt-2 text-sm space-y-1.5">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
            <div className="text-xs leading-relaxed break-words">{order.address}</div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400 shrink-0" />
            <a href={`tel:${order.customerPhone}`} className="text-xs text-blue-600 underline">{order.customerPhone}</a>
          </div>
          {/* Distance indicator */}
          {distanceToPickup !== null && isPickupTask && (
            <div className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-lg inline-block">
              📍 {formatDistance(distanceToPickup)}
            </div>
          )}
          {distanceToVendor !== null && isDeliveryTask && (
            <div className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-lg inline-block">
              📍 {formatDistance(distanceToVendor)}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-1 space-y-2">
        {/* Price breakdown */}
        {(() => {
          const subtotal = (order.item_prices?.length ?? 0) > 0
            ? order.item_prices!.reduce((s, i) => s + (i.total_price || 0), 0)
            : (order.total_price || 0);
          const discount = order.discount_amount || 0;
          const cashback = order.cashback || 0;
          const wallet = order.wallet_applied || 0;
          const final = order.final_amount ?? order.total_price ?? 0;
          const hasDeductions = discount > 0 || cashback > 0 || wallet > 0;
          if (!final) return null;
          return (
            <div className="rounded-lg border bg-gray-50 text-xs divide-y divide-gray-100 mb-1">
              {(order.item_prices?.length ?? 0) > 0 && order.item_prices!.map((item, i) => (
                <div key={i} className="flex justify-between px-3 py-1">
                  <span className="text-gray-600">{item.service_name} × {item.quantity}</span>
                  <span>₹{item.total_price}</span>
                </div>
              ))}
              {hasDeductions && (
                <div className="flex justify-between px-3 py-1 text-gray-500">
                  <span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between px-3 py-1 text-green-700">
                  <span>Discount</span><span>−₹{discount.toLocaleString()}</span>
                </div>
              )}
              {cashback > 0 && (
                <div className="flex justify-between px-3 py-1 text-purple-700">
                  <span>Cashback</span><span>−₹{cashback.toLocaleString()}</span>
                </div>
              )}
              {wallet > 0 && (
                <div className="flex justify-between px-3 py-1 text-green-700">
                  <span>Wallet</span><span>−₹{wallet.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between px-3 py-1.5 font-bold bg-gray-100 rounded-b-lg">
                <span>{hasDeductions ? 'Final Amount' : 'Total'}</span>
                <span className={hasDeductions ? 'text-green-700' : ''}>{`₹${Number(final).toLocaleString()}`}</span>
              </div>
            </div>
          );
        })()}

        {/* Navigate button - full width, prominent */}
        <Button size="sm" onClick={() => safeCall(onNavigate, order)} className="w-full h-10 text-sm font-medium">
          <Navigation className="mr-2 h-4 w-4" /> Navigate to Location
        </Button>

        {/* Action buttons */}
        {!isCompleted && (
          <div className="flex gap-2">
            {/* Show pickup button when order is a pickup task */}
            {isPickupTask && (
              <Button
                size="sm"
                onClick={() => safeCall(onPickup, order._id)}
                className="flex-1 h-10 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white"
              >
                ✓ Picked Up
              </Button>
            )}

            {/* Show deliver button when order is a delivery task — navigates to detail for QR payment flow */}
            {isDeliveryTask && (
              <Button
                size="sm"
                onClick={() => navigate(`/rider/orders/${order._id}`)}
                className="flex-1 h-10 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white"
              >
                Collect Payment & Deliver
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
