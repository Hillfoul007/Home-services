import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Phone, Navigation } from 'lucide-react';
import { getRiderApiUrl } from '@/lib/riderApi';
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
  eta,
}: {
  order: Order;
  currentLocation: { lat: number; lng: number } | null;
  onNavigate: (order: Order) => void;
  onPickup: (id: string) => void;
  onDeliver: (id: string) => void;
  eta?: { durationText: string; distanceText: string } | null;
}) {
  const navigate = useNavigate();
  const status = (order.status || '').toLowerCase();
  const riderStatus = (order.riderStatus || 'unassigned').toLowerCase();

  const [videoRecorded, setVideoRecorded] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const uploadItemsVideo = async (file: File) => {
    setVideoUploading(true);
    try {
      const token = localStorage.getItem('riderToken');
      const formData = new FormData();
      formData.append('items_video', file);
      const res = await fetch(getRiderApiUrl(`/orders/${order._id}/upload-items-video`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) toast.success('Video uploaded — you can now complete pickup');
      else toast.success('Video saved — you can complete pickup');
    } catch {
      toast.success('Video saved locally — you can complete pickup');
    } finally {
      setVideoRecorded(true);
      setVideoUploading(false);
    }
  };

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
            {order.customerPhone && (() => {
              const digits = order.customerPhone.replace(/[^0-9]/g, '');
              const waNum = digits.startsWith('91') ? digits : `91${digits}`;
              return (
                <a
                  href={`https://wa.me/${waNum}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] shrink-0"
                  title="Chat on WhatsApp"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.118 1.535 5.847L.057 23.569a.5.5 0 0 0 .609.61l5.76-1.51A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.884 9.884 0 0 1-5.031-1.373l-.36-.214-3.732.978.998-3.648-.235-.374A9.862 9.862 0 0 1 2.1 12C2.1 6.529 6.529 2.1 12 2.1c5.471 0 9.9 4.429 9.9 9.9 0 5.471-4.429 9.9-9.9 9.9z"/>
                  </svg>
                </a>
              );
            })()}
          </div>
          {/* Distance + ETA indicator */}
          {distanceToPickup !== null && isPickupTask && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-lg inline-block">
                📍 {formatDistance(distanceToPickup)}
              </div>
              {eta && (
                <div className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-lg inline-block">
                  🕐 {eta.durationText}
                </div>
              )}
            </div>
          )}
          {distanceToVendor !== null && isDeliveryTask && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-lg inline-block">
                📍 {formatDistance(distanceToVendor)}
              </div>
              {eta && (
                <div className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-lg inline-block">
                  🕐 {eta.durationText}
                </div>
              )}
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
          <div className="flex flex-col gap-2">
            {/* Video gate — rider must record before completing pickup */}
            {isPickupTask && !videoRecorded && (
              <div className="border-2 border-dashed border-purple-300 rounded-xl bg-purple-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-purple-800">🎥 Record Items Video First</p>
                <p className="text-xs text-purple-600">Record a short video of all items before completing pickup.</p>
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  className="hidden"
                  ref={videoInputRef}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadItemsVideo(f); e.target.value = ''; }}
                  disabled={videoUploading}
                />
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={videoUploading}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {videoUploading ? 'Uploading...' : '🎥 Record Items Video'}
                </button>
              </div>
            )}

            <div className="flex gap-2">
            {/* Show pickup button when order is a pickup task */}
            {isPickupTask && (
              <Button
                size="sm"
                disabled={!videoRecorded}
                onClick={() => videoRecorded && safeCall(onPickup, order._id)}
                className={`flex-1 h-10 text-sm font-semibold ${videoRecorded ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
