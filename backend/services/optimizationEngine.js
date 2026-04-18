/**
 * optimizationEngine.js — Rider task optimization service
 *
 * Provides:
 *  - smartAssignment: nearest idle rider for unassigned orders
 *  - routeCombining:  orders in the same area assigned to different riders
 *  - idleAlerts:      riders idle > 15 min
 *  - riderKPIs:       on-time %, avg delivery time, breach count (rolling window)
 */

const Booking = require("../models/Booking");
const Rider = require("../models/Rider");

// ─── Haversine ────────────────────────────────────────────────────────────────
function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMin(km) {
  return Math.max(3, Math.round((km / 25) * 60)); // 25 km/h city speed, min 3 min
}

// ─── Merge DB riders with live socket state ───────────────────────────────────
function buildRidersWithState(dbRiders, socketSnapshot) {
  const socketMap = new Map(socketSnapshot.map((r) => [String(r.rider_id), r]));

  return dbRiders.map((r) => {
    const live = socketMap.get(String(r._id)) || null;
    return {
      _id: String(r._id),
      name: r.name,
      phone: r.phone,
      dbLocation: r.location || null,
      lat: live?.lat ?? r.location?.lat ?? null,
      lng: live?.lng ?? r.location?.lng ?? null,
      socketStatus: live?.status ?? "offline",
      connected: live?.connected ?? false,
      lastSeen: live?.lastSeen ?? null,
      assignedOrders: (r.assignedOrders || []).map(String),
    };
  });
}

// ─── Smart assignment suggestions ────────────────────────────────────────────
async function getAssignmentSuggestions(socketSnapshot) {
  // Orders ready to be dispatched to a rider for delivery
  const readyStatuses = ["pickup_completed", "ready_for_delivery", "rider_pickup_done"];
  const pendingOrders = await Booking.find({
    status: { $in: readyStatuses },
    assignedRider: null,
    "coordinates.lat": { $ne: null },
  })
    .select("_id custom_order_id name address coordinates status assignedRider")
    .lean();

  if (!pendingOrders.length) return [];

  const dbRiders = await Rider.find({ isActive: true, status: "approved" })
    .select("_id name phone location assignedOrders")
    .lean();

  const riders = buildRidersWithState(dbRiders, socketSnapshot);

  // Only consider riders with known GPS location and not overloaded (≤ 2 active orders)
  const availableRiders = riders.filter(
    (r) =>
      r.lat !== null &&
      r.lng !== null &&
      (r.socketStatus === "idle" || r.socketStatus === "assigned") &&
      r.assignedOrders.length < 3
  );

  if (!availableRiders.length) return [];

  const suggestions = [];
  for (const order of pendingOrders) {
    const { lat: oLat, lng: oLng } = order.coordinates || {};
    if (!oLat || !oLng) continue;

    let bestRider = null;
    let bestDist = Infinity;

    for (const rider of availableRiders) {
      const d = distKm(rider.lat, rider.lng, oLat, oLng);
      if (d < bestDist) {
        bestDist = d;
        bestRider = rider;
      }
    }

    if (bestRider && bestDist < 30) {
      // Only suggest if rider is within 30 km
      suggestions.push({
        type: "assign",
        orderId: String(order._id),
        orderCustomId: order.custom_order_id || String(order._id).slice(-6).toUpperCase(),
        customerName: order.name || "Customer",
        address: order.address || "",
        riderId: bestRider._id,
        riderName: bestRider.name,
        riderPhone: bestRider.phone,
        distanceKm: Math.round(bestDist * 10) / 10,
        etaMinutes: etaMin(bestDist),
        reason: `Nearest available rider — ${Math.round(bestDist * 10) / 10} km away`,
      });
    }
  }

  return suggestions;
}

// ─── Route combining: active delivery orders in same area, different riders ──
async function getRouteCombiningSuggestions() {
  const deliveryOrders = await Booking.find({
    status: { $in: ["delivery_assigned", "in_transit"] },
    assignedRider: { $ne: null },
    "coordinates.lat": { $ne: null },
  })
    .select("_id custom_order_id name assignedRider coordinates")
    .lean();

  if (deliveryOrders.length < 2) return [];

  const CLUSTER_KM = 2.0;
  const suggestions = [];
  const usedIdx = new Set();

  for (let i = 0; i < deliveryOrders.length; i++) {
    if (usedIdx.has(i)) continue;
    const a = deliveryOrders[i];
    const cluster = [a];
    usedIdx.add(i);

    for (let j = i + 1; j < deliveryOrders.length; j++) {
      if (usedIdx.has(j)) continue;
      const b = deliveryOrders[j];
      const d = distKm(
        a.coordinates.lat, a.coordinates.lng,
        b.coordinates.lat, b.coordinates.lng
      );
      if (d <= CLUSTER_KM) {
        cluster.push(b);
        usedIdx.add(j);
      }
    }

    if (cluster.length < 2) continue;

    // Check if assigned to multiple different riders
    const riderIds = [...new Set(cluster.map((o) => String(o.assignedRider)).filter(Boolean))];
    if (riderIds.length < 2) continue; // Already on same rider

    suggestions.push({
      type: "combine",
      orderIds: cluster.map((o) => String(o._id)),
      orderCustomIds: cluster.map(
        (o) => o.custom_order_id || String(o._id).slice(-6).toUpperCase()
      ),
      customerNames: cluster.map((o) => o.name || "Customer"),
      riderCount: riderIds.length,
      orderCount: cluster.length,
      reason: `${cluster.length} orders within ${CLUSTER_KM} km assigned to ${riderIds.length} different riders`,
      savings: `Merge to 1 rider — saves ~${cluster.length * 8} min`,
    });
  }

  return suggestions;
}

// ─── Idle alerts: riders connected but idle > 15 min ─────────────────────────
function getIdleAlerts(socketSnapshot) {
  const now = Date.now();
  const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 min

  return socketSnapshot
    .filter((r) => {
      if (!r.connected) return false;
      if (r.status !== "idle") return false;
      const idleMs = now - (r.lastSeen || now);
      return idleMs > IDLE_THRESHOLD_MS;
    })
    .map((r) => ({
      riderId: String(r.rider_id),
      name: r.name || "Rider",
      phone: r.phone || "",
      idleMinutes: Math.round((now - r.lastSeen) / 60000),
    }));
}

// ─── Rider KPIs (last N days) ─────────────────────────────────────────────────
async function getRiderKPIs(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [allRiders, recentOrders] = await Promise.all([
    Rider.find({ status: "approved" }).select("_id name phone completedOrders").lean(),
    Booking.find({
      status: { $in: ["delivered", "completed"] },
      $or: [{ deliveredAt: { $gte: since } }, { completedAt: { $gte: since } }],
      assignedRider: { $ne: null },
    })
      .select("_id assignedRider pickedUpAt deliveredAt completedAt sla_breach")
      .lean(),
  ]);

  // Build stats per rider
  const statsMap = new Map();
  for (const order of recentOrders) {
    const rid = String(order.assignedRider);
    if (!statsMap.has(rid)) {
      statsMap.set(rid, {
        completed: 0,
        onTime: 0,
        breaches: 0,
        totalDeliveryMs: 0,
        deliveryCount: 0,
      });
    }
    const s = statsMap.get(rid);
    s.completed++;

    // Delivery speed: pickedUpAt → deliveredAt
    if (order.pickedUpAt && order.deliveredAt) {
      const ms = new Date(order.deliveredAt) - new Date(order.pickedUpAt);
      if (ms > 0) {
        s.totalDeliveryMs += ms;
        s.deliveryCount++;
      }
    }

    if (order.sla_breach) s.breaches++;
    else s.onTime++;
  }

  // Merge with rider names; include all riders (even those with 0 orders)
  return allRiders.map((r) => {
    const rid = String(r._id);
    const s = statsMap.get(rid) || {
      completed: 0,
      onTime: 0,
      breaches: 0,
      totalDeliveryMs: 0,
      deliveryCount: 0,
    };
    const totalWithSLA = s.onTime + s.breaches;
    return {
      riderId: rid,
      name: r.name,
      phone: r.phone,
      completedAllTime: r.completedOrders || 0,
      completedInPeriod: s.completed,
      onTimePercent: totalWithSLA > 0 ? Math.round((s.onTime / totalWithSLA) * 100) : null,
      avgDeliveryMinutes:
        s.deliveryCount > 0
          ? Math.round(s.totalDeliveryMs / s.deliveryCount / 60000)
          : null,
      breaches: s.breaches,
    };
  });
}

// ─── Master: return all suggestions at once ───────────────────────────────────
async function getOptimizationSuggestions(socketSnapshot = []) {
  const [assignments, combining, kpis] = await Promise.all([
    getAssignmentSuggestions(socketSnapshot),
    getRouteCombiningSuggestions(),
    getRiderKPIs(7),
  ]);

  const idleAlerts = getIdleAlerts(socketSnapshot);

  return { assignments, combining, idleAlerts, kpis };
}

module.exports = {
  getOptimizationSuggestions,
  getAssignmentSuggestions,
  getRouteCombiningSuggestions,
  getIdleAlerts,
  getRiderKPIs,
};
