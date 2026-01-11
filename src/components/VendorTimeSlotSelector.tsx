import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Clock, CalendarDays } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';

interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  assigned_orders_count: number;
}

interface VendorTimeSlotSelectorProps {
  vendorId: string;
  selectedDate: Date;
  onSlotSelected: (slot: TimeSlot) => void;
  slotType?: 'pickup' | 'delivery'; // Distinguish between pickup and delivery slots
  maxOrdersPerSlot?: number;
}

const VendorTimeSlotSelector: React.FC<VendorTimeSlotSelectorProps> = ({
  vendorId,
  selectedDate,
  onSlotSelected,
  slotType = 'pickup',
  maxOrdersPerSlot = 3,
}) => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate time slots (9 AM to 8 PM, 30-minute intervals)
  const generateTimeSlots = (): TimeSlot[] => {
    const timeSlots: TimeSlot[] = [];
    for (let hour = 9; hour < 20; hour++) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        const startTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const endMinutes = minutes + 30;
        const endHour = hour + (endMinutes >= 60 ? 1 : 0);
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

        timeSlots.push({
          start_time: startTime,
          end_time: endTime,
          is_available: true,
          assigned_orders_count: 0,
        });
      }
    }
    return timeSlots;
  };

  // Fetch vendor's booked slots for the selected date
  useEffect(() => {
    const fetchVendorSlots = async () => {
      try {
        setLoading(true);
        setError(null);

        // Generate all available slots first
        const allSlots = generateTimeSlots();

        // Fetch vendor's existing orders for the selected date
        const response = await apiClient.adminRequest<{ orders: any[] }>(
          `/admin/vendors/${vendorId}/orders`,
          {
            method: 'GET',
          }
        );

        if (response.data?.orders) {
          const dateString = selectedDate.toISOString().split('T')[0];
          
          // Filter orders for the selected date and slot type
          const ordersForDate = response.data.orders.filter((order: any) => {
            const orderDate = slotType === 'pickup' 
              ? order.scheduled_time?.split(' ')[0] 
              : order.delivery_time?.split(' ')[0];
            return orderDate === dateString;
          });

          // Mark slots as unavailable if they have reached max orders
          const updatedSlots = allSlots.map((slot) => {
            const slotOrders = ordersForDate.filter((order: any) => {
              const orderTime = slotType === 'pickup' 
                ? order.scheduled_time?.split(' ')[1] 
                : order.delivery_time?.split(' ')[1];
              return orderTime?.substring(0, 5) === slot.start_time;
            });

            return {
              ...slot,
              assigned_orders_count: slotOrders.length,
              is_available: slotOrders.length < maxOrdersPerSlot,
            };
          });

          setSlots(updatedSlots);
        } else {
          setSlots(allSlots);
        }
      } catch (error) {
        console.error('Error fetching vendor slots:', error);
        setError('Failed to load available slots');
        // Fall back to all slots available
        setSlots(generateTimeSlots());
      } finally {
        setLoading(false);
      }
    };

    if (vendorId) {
      fetchVendorSlots();
    }
  }, [vendorId, selectedDate, slotType]);

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.is_available) {
      setSelectedSlot(slot);
      onSlotSelected(slot);
    }
  };

  const availableSlots = slots.filter((slot) => slot.is_available);
  const filledSlots = slots.filter((slot) => !slot.is_available);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {slotType === 'pickup' ? 'Pickup' : 'Delivery'} Time Slot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CalendarDays className="h-4 w-4" />
          <span>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-4 text-gray-600">
            Loading available slots...
          </div>
        )}

        {/* No Available Slots */}
        {!loading && availableSlots.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No available slots for {slotType} on this date. All slots are full.
            </AlertDescription>
          </Alert>
        )}

        {/* Available Slots Grid */}
        {!loading && availableSlots.length > 0 && (
          <div>
            <Label className="text-sm font-semibold mb-3 block">
              Available Slots ({availableSlots.length}/{slots.length})
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {availableSlots.map((slot) => (
                <Button
                  key={`${slot.start_time}-${slot.end_time}`}
                  onClick={() => handleSlotSelect(slot)}
                  variant={selectedSlot?.start_time === slot.start_time ? 'default' : 'outline'}
                  className="h-auto py-3 flex flex-col items-center justify-center gap-1 text-xs"
                >
                  <span className="font-semibold">{slot.start_time}</span>
                  <span className="text-xs opacity-75">- {slot.end_time}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Filled Slots Info */}
        {!loading && filledSlots.length > 0 && (
          <div className="pt-4 border-t">
            <Label className="text-xs font-semibold text-gray-500 mb-2 block">
              Filled Slots ({filledSlots.length})
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filledSlots.map((slot) => (
                <div
                  key={`${slot.start_time}-${slot.end_time}`}
                  className="border border-gray-300 rounded px-2 py-2 text-center cursor-not-allowed opacity-50"
                >
                  <div className="text-xs font-semibold text-gray-500">{slot.start_time}</div>
                  <div className="text-xs text-gray-400">Full</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Slot Display */}
        {selectedSlot && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
            <p className="text-sm font-semibold text-green-900">
              ✓ Selected: {selectedSlot.start_time} - {selectedSlot.end_time}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VendorTimeSlotSelector;
