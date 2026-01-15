const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Vehicle = require("../models/Vehicle");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

// Helper: Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ============================================================================
// ADMIN ROUTES - VEHICLE MANAGEMENT
// ============================================================================

// GET all vehicles with details (optionally filtered by vendor_id)
router.get("/vehicles", async (req, res) => {
  try {
    const { vendor_id } = req.query;

    let query = {};
    if (vendor_id) {
      // Check if vendor_id looks like a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(vendor_id)) {
        // Try to match by ObjectId first
        query.assigned_vendor_id = vendor_id;
      } else {
        // If it's not an ObjectId, treat it as a vendor name (string)
        query.assigned_vendor_name = vendor_id;
      }
    }

    const vehicles = await Vehicle.find(query)
      .populate("assigned_vendor_id", "name phone email")
      .sort({ created_at: -1 });

    res.json({ vehicles });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

// GET single vehicle with today's orders
router.get("/vehicles/:vehicleId", async (req, res) => {
  try {
    const { vehicleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const vehicle = await Vehicle.findById(vehicleId)
      .populate("assigned_vendor_id", "name phone email")
      .populate({
        path: "today_orders",
        model: "Booking",
        select: "custom_order_id name phone address scheduled_time delivery_time coordinates status",
      });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({ vehicle });
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    res.status(500).json({ error: "Failed to fetch vehicle" });
  }
});

// CREATE new vehicle
router.post("/vehicles", async (req, res) => {
  try {
    const { name, number_plate, vehicle_type, driver_name, driver_phone } = req.body;

    if (!name || !number_plate) {
      return res.status(400).json({ error: "Name and number plate are required" });
    }

    const existingVehicle = await Vehicle.findOne({
      number_plate: number_plate.toUpperCase(),
    });
    if (existingVehicle) {
      return res.status(400).json({ error: "Vehicle with this number plate already exists" });
    }

    const vehicle = new Vehicle({
      name,
      number_plate: number_plate.toUpperCase(),
      vehicle_type: vehicle_type || "auto",
      driver_name: driver_name || null,
      driver_phone: driver_phone || null,
    });

    await vehicle.save();
    res.status(201).json({ vehicle });
  } catch (error) {
    console.error("Error creating vehicle:", error);
    res.status(500).json({ error: "Failed to create vehicle" });
  }
});

// UPDATE vehicle
router.put("/vehicles/:vehicleId", async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { name, vehicle_type, driver_name, driver_phone, is_active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        name: name || undefined,
        vehicle_type: vehicle_type || undefined,
        driver_name: driver_name || undefined,
        driver_phone: driver_phone || undefined,
        is_active: is_active !== undefined ? is_active : undefined,
      },
      { new: true }
    ).populate("assigned_vendor_id", "name phone email");

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({ vehicle });
  } catch (error) {
    console.error("Error updating vehicle:", error);
    res.status(500).json({ error: "Failed to update vehicle" });
  }
});

// ASSIGN vendor to vehicle
router.post("/vehicles/:vehicleId/assign-vendor", async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { vendor_id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(vehicleId) || !mongoose.Types.ObjectId.isValid(vendor_id)) {
      return res.status(400).json({ error: "Invalid IDs" });
    }

    // First try to find vendor in Vendor (laundry) collection
    let vendor = await Vendor.findById(vendor_id);

    // Fall back to User collection if not found
    if (!vendor) {
      vendor = await User.findById(vendor_id);
    }

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        assigned_vendor_id: vendor_id,
        assigned_vendor_name: vendor.name,
      },
      { new: true }
    ).populate("assigned_vendor_id", "name phone email");

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({ vehicle });
  } catch (error) {
    console.error("Error assigning vendor:", error);
    res.status(500).json({ error: "Failed to assign vendor" });
  }
});

// UNASSIGN vendor from vehicle
router.post("/vehicles/:vehicleId/unassign-vendor", async (req, res) => {
  try {
    const { vehicleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        assigned_vendor_id: null,
        assigned_vendor_name: null,
      },
      { new: true }
    ).populate("assigned_vendor_id", "name phone email");

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({ vehicle });
  } catch (error) {
    console.error("Error unassigning vendor:", error);
    res.status(500).json({ error: "Failed to unassign vendor" });
  }
});

// ADD order to vehicle for specific date and slot
router.post("/vehicles/:vehicleId/add-order", async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { booking_id, slot_start_time } = req.body;

    if (!mongoose.Types.ObjectId.isValid(vehicleId) || !mongoose.Types.ObjectId.isValid(booking_id)) {
      return res.status(400).json({ error: "Invalid IDs" });
    }

    const booking = await Booking.findById(booking_id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    // Check if order is already assigned
    if (vehicle.today_orders.includes(booking_id)) {
      return res.status(400).json({ error: "Order already assigned to this vehicle" });
    }

    // Assign to slot
    if (slot_start_time) {
      vehicle.assignOrderToSlot(slot_start_time);
    }

    // Add order to vehicle
    vehicle.today_orders.push(booking_id);
    vehicle.current_orders_count = vehicle.today_orders.length;

    // Update booking with vehicle info
    booking.assigned_vehicle_id = vehicleId;
    booking.vehicle_time_slot = slot_start_time;

    await vehicle.save();
    await booking.save();

    const updatedVehicle = await Vehicle.findById(vehicleId)
      .populate("assigned_vendor_id", "name phone email")
      .populate({
        path: "today_orders",
        model: "Booking",
      });

    res.json({ vehicle: updatedVehicle });
  } catch (error) {
    console.error("Error adding order to vehicle:", error);
    res.status(500).json({ error: "Failed to add order to vehicle" });
  }
});

// REMOVE order from vehicle
router.post("/vehicles/:vehicleId/remove-order", async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { booking_id, slot_start_time } = req.body;

    if (!mongoose.Types.ObjectId.isValid(vehicleId) || !mongoose.Types.ObjectId.isValid(booking_id)) {
      return res.status(400).json({ error: "Invalid IDs" });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    // Remove from slot
    if (slot_start_time) {
      vehicle.removeOrderFromSlot(slot_start_time);
    }

    // Remove order from vehicle
    vehicle.today_orders = vehicle.today_orders.filter((id) => !id.equals(booking_id));
    vehicle.current_orders_count = vehicle.today_orders.length;

    // Update booking
    const booking = await Booking.findById(booking_id);
    if (booking) {
      booking.assigned_vehicle_id = null;
      booking.vehicle_time_slot = null;
      await booking.save();
    }

    await vehicle.save();

    const updatedVehicle = await Vehicle.findById(vehicleId)
      .populate("assigned_vendor_id", "name phone email")
      .populate({
        path: "today_orders",
        model: "Booking",
      });

    res.json({ vehicle: updatedVehicle });
  } catch (error) {
    console.error("Error removing order from vehicle:", error);
    res.status(500).json({ error: "Failed to remove order from vehicle" });
  }
});

// ============================================================================
// DRIVER/VEHICLE ROUTES - LIVE TRACKING & ROUTE MANAGEMENT
// ============================================================================

// GET vehicle route for today (orders + optimized path)
router.get("/vehicle/route/:vehicleId", async (req, res) => {
  try {
    const { vehicleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const vehicle = await Vehicle.findById(vehicleId)
      .populate({
        path: "today_orders",
        model: "Booking",
        select:
          "custom_order_id name phone address coordinates scheduled_time delivery_time status special_instructions scheduled_date",
      })
      .populate("assigned_vendor_id", "name phone email");

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    // Filter orders to show only today's orders
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const todaysOrders = vehicle.today_orders.filter(order => {
      const orderDate = order.scheduled_date ? order.scheduled_date.substring(0, 10) : null;
      return orderDate === today;
    });

    // Optimize route: Sort orders by distance from current location
    const orders = todaysOrders;
    let optimizedOrders = [...orders];

    if (vehicle.current_location && vehicle.current_location.lat && vehicle.current_location.lng) {
      optimizedOrders.sort((a, b) => {
        const distA = a.coordinates
          ? calculateDistance(
              vehicle.current_location.lat,
              vehicle.current_location.lng,
              a.coordinates.lat,
              a.coordinates.lng
            )
          : Infinity;

        const distB = b.coordinates
          ? calculateDistance(
              vehicle.current_location.lat,
              vehicle.current_location.lng,
              b.coordinates.lat,
              b.coordinates.lng
            )
          : Infinity;

        return distA - distB;
      });
    }

    // Check for nearby orders (within 1 km)
    const suggestionPairs = [];
    for (let i = 0; i < optimizedOrders.length - 1; i++) {
      for (let j = i + 1; j < optimizedOrders.length; j++) {
        const orderA = optimizedOrders[i];
        const orderB = optimizedOrders[j];

        if (orderA.coordinates && orderB.coordinates) {
          const distance = calculateDistance(
            orderA.coordinates.lat,
            orderA.coordinates.lng,
            orderB.coordinates.lat,
            orderB.coordinates.lng
          );

          if (distance < 1) {
            // Within 1 km
            suggestionPairs.push({
              order1_id: orderA._id,
              order1_name: orderA.custom_order_id,
              order2_id: orderB._id,
              order2_name: orderB.custom_order_id,
              distance_km: distance.toFixed(2),
              suggestion: `You can collect ${orderB.custom_order_id} from nearby!`,
            });
          }
        }
      }
    }

    res.json({
      vehicle: {
        _id: vehicle._id,
        name: vehicle.name,
        number_plate: vehicle.number_plate,
        current_location: vehicle.current_location,
        assigned_vendor: vehicle.assigned_vendor_id,
        status: vehicle.status,
      },
      route: {
        total_orders: optimizedOrders.length,
        orders: optimizedOrders.map((order) => ({
          _id: order._id,
          custom_order_id: order.custom_order_id,
          customer_name: order.name,
          customer_phone: order.phone,
          address: order.address,
          coordinates: order.coordinates,
          scheduled_time: order.scheduled_time,
          delivery_time: order.delivery_time,
          status: order.status,
          special_instructions: order.special_instructions,
        })),
        suggestions: suggestionPairs,
      },
    });
  } catch (error) {
    console.error("Error fetching vehicle route:", error);
    res.status(500).json({ error: "Failed to fetch route" });
  }
});

// UPDATE vehicle live location (from driver)
router.post("/vehicle/update-location/:vehicleId", async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { lat, lng } = req.body;

    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    vehicle.updateLocation(lat, lng);
    await vehicle.save();

    res.json({ success: true, location: vehicle.current_location });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
});

// UPDATE order status (pickup complete / delivery complete)
router.post("/vehicle/order-status/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, vehicle_id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    const validStatuses = ["pickup_completed", "delivered", "completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { status },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({ booking });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// GET available vehicles with slots for a given time
router.get("/vehicles/available-slots", async (req, res) => {
  try {
    const { date, time_slot } = req.query;

    if (!time_slot) {
      return res.status(400).json({ error: "Time slot is required" });
    }

    const vehicles = await Vehicle.find({
      is_active: true,
      "availability_slots.start_time": time_slot,
      "availability_slots.is_available": true,
    });

    const availableVehicles = vehicles.map((v) => ({
      _id: v._id,
      name: v.name,
      vehicle_type: v.vehicle_type,
      number_plate: v.number_plate,
      assigned_vendor: v.assigned_vendor_name,
      current_orders: v.current_orders_count,
      max_orders: v.max_orders_per_trip,
      available_slot: time_slot,
    }));

    res.json({ vehicles: availableVehicles });
  } catch (error) {
    console.error("Error fetching available vehicles:", error);
    res.status(500).json({ error: "Failed to fetch available vehicles" });
  }
});

module.exports = router;
