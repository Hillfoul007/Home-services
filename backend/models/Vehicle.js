const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    // VEHICLE IDENTIFICATION
    name: {
      type: String,
      required: [true, "Vehicle name is required"],
      trim: true,
      index: true,
    },
    number_plate: {
      type: String,
      required: [true, "Vehicle number plate is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    vehicle_type: {
      type: String,
      enum: ["bike", "auto", "van", "car", "truck"],
      default: "auto",
    },

    // VENDOR ASSIGNMENT
    assigned_vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assigned_vendor_name: {
      type: String,
      default: null,
    },

    // VEHICLE DRIVER INFO
    driver_name: {
      type: String,
      default: null,
    },
    driver_phone: {
      type: String,
      default: null,
    },

    // CURRENT LOCATION
    current_location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
      last_updated_at: {
        type: Date,
        default: null,
      },
    },

    // STATUS
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["available", "on_route", "busy", "maintenance"],
      default: "available",
    },

    // CAPACITY
    max_orders_per_trip: {
      type: Number,
      default: 10,
    },
    current_orders_count: {
      type: Number,
      default: 0,
    },

    // AVAILABILITY SLOTS (9 AM to 8 PM, 30 min slots)
    availability_slots: [
      {
        start_time: String, // "09:00", "09:30", etc.
        end_time: String,
        is_available: {
          type: Boolean,
          default: true,
        },
        assigned_orders_count: {
          type: Number,
          default: 0,
        },
      },
    ],

    // ORDERS FOR TODAY
    today_orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],

    // METADATA
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Pre-save hook to generate availability slots
vehicleSchema.pre("save", function (next) {
  if (!this.availability_slots || this.availability_slots.length === 0) {
    const slots = [];
    // Generate slots from 9 AM to 8 PM, every 30 minutes
    for (let hour = 9; hour < 20; hour++) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        const startTime = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        const endMinutes = minutes + 30;
        const endHour = hour + (endMinutes >= 60 ? 1 : 0);
        const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

        slots.push({
          start_time: startTime,
          end_time: endTime,
          is_available: true,
          assigned_orders_count: 0,
        });
      }
    }
    this.availability_slots = slots;
  }

  // Update timestamp
  this.updated_at = new Date();
  next();
});

// Instance method to get available slots for a given date
vehicleSchema.methods.getAvailableSlots = function () {
  return this.availability_slots.filter((slot) => slot.is_available);
};

// Instance method to assign an order to a slot
vehicleSchema.methods.assignOrderToSlot = function (slotStartTime) {
  const slot = this.availability_slots.find((s) => s.start_time === slotStartTime);
  if (slot) {
    slot.assigned_orders_count = (slot.assigned_orders_count || 0) + 1;
    if (slot.assigned_orders_count >= this.max_orders_per_trip) {
      slot.is_available = false;
    }
  }
};

// Instance method to remove order from slot
vehicleSchema.methods.removeOrderFromSlot = function (slotStartTime) {
  const slot = this.availability_slots.find((s) => s.start_time === slotStartTime);
  if (slot) {
    slot.assigned_orders_count = Math.max(0, (slot.assigned_orders_count || 1) - 1);
    slot.is_available = true; // Re-enable if we freed up space
  }
};

// Instance method to update live location
vehicleSchema.methods.updateLocation = function (lat, lng) {
  this.current_location = {
    lat,
    lng,
    last_updated_at: new Date(),
  };
};

module.exports = mongoose.model("Vehicle", vehicleSchema);
