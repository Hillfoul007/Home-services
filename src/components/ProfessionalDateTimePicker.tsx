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
import { CalendarIcon, Clock } from "lucide-react";
import { format, addDays, isSameDay, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";

interface ProfessionalDateTimePickerProps {
  selectedDate?: Date;
  selectedTime?: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
  className?: string;
}

const ProfessionalDateTimePicker: React.FC<ProfessionalDateTimePickerProps> = ({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  className,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeSelectOpen, setTimeSelectOpen] = useState(false);

  // Generate dates for next 7 days starting from today (no past dates)
  const generateAvailableDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(new Date(), i);
      dates.push({
        date,
        label: isToday(date)
          ? "Today"
          : isTomorrow(date)
            ? "Tomorrow"
            : format(date, "EEE"),
        shortDate: format(date, "dd MMM"),
        fullDate: format(date, "dd"),
        month: format(date, "MMM"),
        day: format(date, "EEE"),
        isPast: false, // No past dates in this list
      });
    }
    return dates;
  };

  // Generate extended date options for dropdown (same as available dates)
  const generateExtendedDates = () => {
    return generateAvailableDates().map((dateItem) => ({
      ...dateItem,
      label: isToday(dateItem.date)
        ? "Today"
        : isTomorrow(dateItem.date)
          ? "Tomorrow"
          : format(dateItem.date, "EEE, MMM dd"),
      value: dateItem.date.toISOString(),
    }));
  };

  // No week navigation needed - we always show next 7 days from today

  // Generate time slots with 1-hour intervals
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    const currentTime = new Date();

    // Generate slots from 8 AM to 9 PM (1-hour intervals)
    for (let hour = 8; hour <= 21; hour++) {
      const timeString = `${hour.toString().padStart(2, "0")}:00`;
      const displayTime = format(
        new Date(`2000-01-01T${timeString}`),
        "h:mm a",
      );

      // Skip slots that are less than 30 minutes from current time for today
      let isDisabled = false;
      if (selectedDate && isToday(selectedDate)) {
        const slotTime = new Date();
        slotTime.setHours(hour, 0, 0, 0);

        // Calculate the difference in minutes between slot time and current time
        const timeDifferenceMinutes = (slotTime.getTime() - currentTime.getTime()) / (1000 * 60);

        // Disable if slot is in the past or less than 30 minutes from now
        isDisabled = timeDifferenceMinutes < 30;
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

  const availableDates = generateAvailableDates();
  const extendedDates = generateExtendedDates();
  const timeSlots = generateTimeSlots();

  return (
    <div className={cn("space-y-6", className)}>
      {/* Date Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2" />
          <div className="flex items-center gap-2" />
        </div>

        {/* Dropdown for extended date selection */}
        {showDropdown && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Choose from next 7 days:
            </Label>
            <Select
              value={selectedDate?.toISOString() || ""}
              onValueChange={(value) => {
                if (value) {
                  onDateChange(new Date(value));
                  setShowDropdown(false);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose any date" />
              </SelectTrigger>
              <SelectContent>
                {extendedDates.map((dateItem) => (
                  <SelectItem key={dateItem.value} value={dateItem.value}>
                    {dateItem.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Available dates (next 7 days) - Horizontal Scrollable */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Select Date</Label>
            <div className="flex gap-2">
              <Button
                variant={
                  !selectedDate || isToday(selectedDate) ? "default" : "outline"
                }
                size="sm"
                onClick={() => onDateChange(new Date())}
                className="text-xs"
              >
                Today
              </Button>
            </div>
          </div>

          {/* Horizontal scrollable date grid */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {availableDates.map((dateItem) => {
                const isSelected =
                  selectedDate && isSameDay(dateItem.date, selectedDate);

                return (
                  <button
                    key={dateItem.date.toISOString()}
                    type="button"
                    onClick={() => onDateChange(dateItem.date)}
                    className={cn(
                      "flex-shrink-0 p-3 rounded-lg transition-colors border min-w-[80px] text-center",
                      isSelected
                        ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                        : "hover:bg-gray-50 border-gray-200 bg-white",
                    )}
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-500 uppercase">
                        {dateItem.day}
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
        </div>
      </div>

      {/* Time Selection */}
      {selectedDate && (
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Select Time
          </Label>
          <div>
            {/* Use native select on mobile to prevent scroll issues */}
            <select
              value={selectedTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Choose pickup time
              </option>
              {timeSlots.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.groupLabel}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalDateTimePicker;
