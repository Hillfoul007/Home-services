import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Clock, Truck } from "lucide-react";
import {
  format,
  addDays,
  addHours,
  isSameDay,
  isAfter,
  isBefore,
} from "date-fns";
import { cn } from "@/lib/utils";

interface CartItem {
  service: {
    id: string;
    name: string;
    category: string;
  };
  quantity: number;
}

interface DeliveryDateTimePickerProps {
  cartItems: CartItem[];
  pickupDate?: Date;
  pickupTime?: string;
  selectedDeliveryDate?: Date;
  selectedDeliveryTime?: string;
  onDeliveryDateChange: (date: Date | undefined) => void;
  onDeliveryTimeChange: (time: string) => void;
  className?: string;
}

const DeliveryDateTimePicker: React.FC<DeliveryDateTimePickerProps> = ({
  cartItems,
  pickupDate,
  pickupTime,
  selectedDeliveryDate,
  selectedDeliveryTime,
  onDeliveryDateChange,
  onDeliveryTimeChange,
  className,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  // Determine minimum delivery time based on cart contents
  const getMinimumDeliveryTime = (): { hours: number; description: string } => {
    if (!cartItems || cartItems.length === 0) {
      return { hours: 24, description: "24 hours for standard items" };
    }

    // Check if cart contains dry clean items
    const hasDryCleanItems = cartItems.some((item) =>
      item.service.category.includes("dry-clean"),
    );

    if (hasDryCleanItems) {
      return {
        hours: 48,
        description: "48 hours required for dry clean items",
      };
    }

    // For laundry and iron items
    return { hours: 24, description: "24 hours for laundry and iron items" };
  };

  // Calculate earliest delivery date/time based on pickup and service type
  const getEarliestDeliveryDateTime = (): Date => {
    if (!pickupDate || !pickupTime) {
      // If no pickup scheduled yet, start from current time
      const now = new Date();
      const minTime = getMinimumDeliveryTime();
      return addHours(now, minTime.hours);
    }

    // Parse pickup date and time
    const [time, period] = pickupTime.split(" ");
    const [hourStr, minuteStr] = time.split(":");
    let hour = parseInt(hourStr);

    if (period === "PM" && hour !== 12) {
      hour += 12;
    } else if (period === "AM" && hour === 12) {
      hour = 0;
    }

    const pickupDateTime = new Date(pickupDate);
    pickupDateTime.setHours(hour, parseInt(minuteStr) || 0, 0, 0);

    // Add minimum processing time
    const minTime = getMinimumDeliveryTime();
    return addHours(pickupDateTime, minTime.hours);
  };

  // Generate available delivery dates (next 14 days from earliest possible)
  const generateAvailableDeliveryDates = () => {
    const earliestDateTime = getEarliestDeliveryDateTime();
    const dates = [];

    for (let i = 0; i < 14; i++) {
      const date = addDays(earliestDateTime, i);

      // For the first day, check if it's the same day as earliest
      let isEarliest = false;
      if (i === 0 && isSameDay(date, earliestDateTime)) {
        isEarliest = true;
      }

      dates.push({
        date,
        label: i === 0 ? "Earliest" : format(date, "EEE"),
        shortDate: format(date, "dd MMM"),
        fullDate: format(date, "dd"),
        month: format(date, "MMM"),
        day: format(date, "EEE"),
        isEarliest,
        minTimeForDay: isEarliest ? earliestDateTime : null,
      });
    }
    return dates;
  };

  // Generate time slots for delivery (8 AM to 9 PM, 1-hour intervals)
  const generateDeliveryTimeSlots = () => {
    const slots = [];
    const earliestDateTime = getEarliestDeliveryDateTime();
    const selectedIsEarliest =
      selectedDeliveryDate && isSameDay(selectedDeliveryDate, earliestDateTime);

    // Generate slots from 8 AM to 9 PM (1-hour intervals)
    for (let hour = 8; hour <= 21; hour++) {
      const timeString = `${hour.toString().padStart(2, "0")}:00`;
      const displayTime = format(
        new Date(`2000-01-01T${timeString}`),
        "h:mm a",
      );

      // For earliest delivery date, skip times before minimum delivery time
      let isDisabled = false;
      if (selectedIsEarliest) {
        const slotDateTime = new Date(selectedDeliveryDate);
        slotDateTime.setHours(hour, 0, 0, 0);
        isDisabled = isBefore(slotDateTime, earliestDateTime);
      }

      if (!isDisabled) {
        let period = "Morning";
        if (hour >= 12 && hour < 17) period = "Afternoon";
        if (hour >= 17) period = "Evening";

        slots.push({
          value: displayTime,
          label: displayTime,
          period,
          groupLabel: `${displayTime} (${period})`,
        });
      }
    }

    return slots;
  };

  const minDeliveryInfo = getMinimumDeliveryTime();
  const availableDates = generateAvailableDeliveryDates();
  const timeSlots = generateDeliveryTimeSlots();
  const earliestDateTime = getEarliestDeliveryDateTime();

  // Clear delivery date and time when pickup date/time changes
  useEffect(() => {
    if (selectedDeliveryDate || selectedDeliveryTime) {
      // Only clear if there was something selected before
      onDeliveryDateChange(undefined);
      onDeliveryTimeChange("");
      console.log("🗓️ Cleared delivery date/time due to pickup date change");
    }
  }, [pickupDate, pickupTime]);

  // Don't auto-select delivery date - let user choose manually
  // This ensures user makes a conscious choice for delivery date

  // Show warning if no pickup is scheduled
  if (!pickupDate || !pickupTime) {
    return (
      <div
        className={cn(
          "space-y-3 p-4 bg-amber-50 border border-amber-200 sm:border-amber-200 border-amber-600 rounded-lg",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-amber-600" />
          <Label className="text-sm font-medium text-amber-800">
            Delivery Schedule
          </Label>
        </div>
        <p className="text-sm text-amber-700">
          Please select pickup date and time first to choose delivery schedule.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Delivery Requirements Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Delivery Time
          </span>
        </div>
        <p className="text-xs text-blue-700">{minDeliveryInfo.description}</p>
        <p className="text-xs text-blue-600 mt-1">
          Earliest delivery:{" "}
          {format(earliestDateTime, "EEE, MMM dd 'at' h:mm a")}
        </p>
      </div>

      {/* Date Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Delivery Date</Label>
          {availableDates.length > 0 && (
            <Button
              variant={
                selectedDeliveryDate &&
                isSameDay(selectedDeliveryDate, availableDates[0].date)
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => onDeliveryDateChange(availableDates[0].date)}
              className="text-xs"
            >
              Earliest
            </Button>
          )}
        </div>

        {/* Horizontal scrollable date grid */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {availableDates.slice(0, 7).map((dateItem) => {
              const isSelected =
                selectedDeliveryDate &&
                isSameDay(dateItem.date, selectedDeliveryDate);

              return (
                <button
                  key={dateItem.date.toISOString()}
                  type="button"
                  onClick={() => onDeliveryDateChange(dateItem.date)}
                  className={cn(
                    "flex-shrink-0 p-3 rounded-lg transition-colors border min-w-[80px] text-center",
                    isSelected
                      ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                      : "hover:bg-gray-50 border-gray-200 bg-white",
                  )}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500 uppercase">
                      {dateItem.isEarliest ? "EARLIEST" : dateItem.day}
                    </div>
                    <div
                      className={cn(
                        "text-2xl font-bold",
                        isSelected ? "text-white" : "text-gray-900",
                      )}
                    >
                      {dateItem.fullDate}
                    </div>
                    <div
                      className={cn(
                        "text-xs",
                        isSelected ? "text-white/70" : "text-gray-500",
                      )}
                    >
                      {dateItem.month}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        

        {showDropdown && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Choose from extended options:
            </Label>
            <Select
              value={selectedDeliveryDate?.toISOString() || ""}
              onValueChange={(value) => {
                if (value) {
                  onDeliveryDateChange(new Date(value));
                  setShowDropdown(false);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose any delivery date" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map((dateItem, index) => (
                  <SelectItem
                    key={dateItem.date.toISOString()}
                    value={dateItem.date.toISOString()}
                  >
                    {index === 0
                      ? `${format(dateItem.date, "EEE, MMM dd")} (Earliest)`
                      : format(dateItem.date, "EEE, MMM dd")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Time Selection */}
      {selectedDeliveryDate && (
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Delivery Time
          </Label>
          <select
            value={selectedDeliveryTime}
            onChange={(e) => onDeliveryTimeChange(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>
              Choose delivery time
            </option>
            {timeSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.groupLabel}
              </option>
            ))}
          </select>

          {timeSlots.length === 0 && (
            <p className="text-xs text-red-600">
              No delivery slots available for this date. Please select a
              different date.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryDateTimePicker;
