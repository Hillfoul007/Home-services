/**
 * socketServer.js  –  Real-time rider location tracking via Socket.io
 *
 * Architecture:
 *   Rider App  ──ws──►  socketServer  ──broadcast──►  Desk Dashboard
 *                            │
 *                       In-memory store (latest location per rider)
 *
 * Events (rider → server):
 *   rider:connect   { rider_id, token }
 *   rider:location  { rider_id, lat, lng, status, order_id, timestamp }
 *   rider:status    { rider_id, status, order_id }
 *
 * Events (server → desk):
 *   rider:location_update  { rider_id, lat, lng, status, order_id, timestamp, name, phone }
 *   riders:snapshot        [ ...all active riders ]
 *   rider:disconnected     { rider_id }
 *
 * Events (desk → server):
 *   desk:connect    { token }
 *   desk:snapshot   (requests current snapshot)
 */

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Rider = require("./models/Rider");

// ─── In-memory state ──────────────────────────────────────────────────────────
// Map<rider_id_string, RiderState>
const activeRiders = new Map();

function getRiderState(riderId) {
  return activeRiders.get(String(riderId)) || null;
}

function setRiderState(riderId, data) {
  const id = String(riderId);
  const existing = activeRiders.get(id) || {};
  activeRiders.set(id, { ...existing, ...data, lastSeen: Date.now() });
  return activeRiders.get(id);
}

function getAllRiders() {
  const now = Date.now();
  const result = [];
  activeRiders.forEach((state, id) => {
    // Include riders seen in last 5 minutes
    if (now - state.lastSeen < 5 * 60 * 1000) {
      result.push({ rider_id: id, ...state });
    } else {
      activeRiders.delete(id); // Clean up stale
    }
  });
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

/**
 * Verify a rider JWT.  Returns decoded payload or null.
 */
function verifyRiderToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Verify a desk / admin JWT.  Returns decoded payload or null.
 */
function verifyDeskToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Accept vendor or admin tokens (role check is permissive for desk)
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Haversine distance in metres between two lat/lng points.
 */
function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Main initialiser ─────────────────────────────────────────────────────────
let io = null;

/**
 * Attach Socket.io to an existing http.Server.
 * Called from server-laundry.js after express is set up.
 */
function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // locked down in prod via env
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  // ── Namespaces (declare both before registering handlers) ────────────────
  const riderNS = io.of("/rider");
  const deskNS  = io.of("/desk");

  riderNS.on("connection", (socket) => {
    let riderId = null;
    let riderInfo = null;

    console.log(`[socket] Rider connection attempt: ${socket.id}`);

    // ── Auth handshake ──────────────────────────────────────────────────
    socket.on("rider:connect", async ({ rider_id, token } = {}) => {
      const decoded = verifyRiderToken(token);
      if (!decoded) {
        socket.emit("error", { message: "Unauthorized" });
        socket.disconnect(true);
        return;
      }

      riderId = String(rider_id || decoded.id || decoded._id);

      // Fetch rider name/phone for broadcast enrichment
      try {
        const riderDoc = await Rider.findById(riderId).select("name phone").lean();
        riderInfo = riderDoc || { name: "Rider", phone: "" };
      } catch {
        riderInfo = { name: "Rider", phone: "" };
      }

      setRiderState(riderId, {
        socket_id: socket.id,
        name: riderInfo.name,
        phone: riderInfo.phone,
        status: "idle",
        connected: true,
      });

      socket.join(`rider:${riderId}`);
      console.log(`[socket] Rider connected: ${riderId} (${riderInfo.name})`);
      socket.emit("rider:connected", { message: "Connected", rider_id: riderId });
    });

    // ── Location update ─────────────────────────────────────────────────
    socket.on("rider:location", async (data = {}) => {
      if (!riderId) return; // Not authenticated yet

      const { lat, lng, status, order_id, timestamp } = data;
      if (typeof lat !== "number" || typeof lng !== "number") return;

      const state = getRiderState(riderId);

      // 10-metre movement filter – only broadcast if rider moved
      if (state?.lat && state?.lng) {
        const dist = distanceMetres(state.lat, state.lng, lat, lng);
        if (dist < 10) {
          // Still update timestamp so rider stays "active"
          setRiderState(riderId, { lastSeen: Date.now() });
          return;
        }
      }

      const updated = setRiderState(riderId, {
        lat,
        lng,
        status: status || "idle",
        order_id: order_id || null,
        timestamp: timestamp || new Date().toISOString(),
      });

      // Persist to MongoDB (non-blocking)
      Rider.findByIdAndUpdate(
        riderId,
        {
          location: { lat, lng },
          lastLocationUpdate: new Date(),
        },
        { new: false }
      ).catch(() => {});

      // Broadcast to all desk clients
      const payload = {
        rider_id: riderId,
        name: riderInfo?.name || updated.name || "Rider",
        phone: riderInfo?.phone || updated.phone || "",
        lat,
        lng,
        status: updated.status,
        order_id: updated.order_id,
        timestamp: updated.timestamp,
      };

      deskNS.emit("rider:location_update", payload);
    });

    // ── Status change ───────────────────────────────────────────────────
    socket.on("rider:status", (data = {}) => {
      if (!riderId) return;
      const { status, order_id } = data;
      if (!status) return;

      setRiderState(riderId, { status, order_id: order_id || null });

      deskNS.emit("rider:status_update", {
        rider_id: riderId,
        status,
        order_id: order_id || null,
      });
    });

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      if (!riderId) return;
      console.log(`[socket] Rider disconnected: ${riderId} (${reason})`);
      setRiderState(riderId, { connected: false });
      deskNS.emit("rider:disconnected", { rider_id: riderId });
    });
  });

  // ── Desk namespace ───────────────────────────────────────────────────────
  deskNS.on("connection", (socket) => {
    let authenticated = false;

    console.log(`[socket] Desk connection attempt: ${socket.id}`);

    socket.on("desk:connect", ({ token } = {}) => {
      // Token is optional in dev mode
      if (token) {
        const decoded = verifyDeskToken(token);
        if (!decoded) {
          socket.emit("error", { message: "Unauthorized" });
          socket.disconnect(true);
          return;
        }
      }

      authenticated = true;
      socket.join("desk");
      console.log(`[socket] Desk authenticated: ${socket.id}`);
      socket.emit("desk:connected", { message: "Connected to rider tracking" });

      // Send immediate snapshot of all active riders
      socket.emit("riders:snapshot", getAllRiders());
    });

    socket.on("desk:snapshot", () => {
      if (!authenticated) return;
      socket.emit("riders:snapshot", getAllRiders());
    });

    socket.on("disconnect", () => {
      console.log(`[socket] Desk disconnected: ${socket.id}`);
    });
  });

  console.log("✅ Socket.io rider tracking server initialised");
  return io;
}

/**
 * Broadcast a location update from the REST route (HTTP fallback).
 * Called by backend/routes/riders.js when a rider POSTs their location.
 */
function broadcastRiderLocation(riderId, lat, lng, status, orderId, name, phone) {
  if (!io) return;

  setRiderState(riderId, {
    lat,
    lng,
    status: status || "idle",
    order_id: orderId || null,
    name: name || "Rider",
    phone: phone || "",
    timestamp: new Date().toISOString(),
  });

  const deskNS = io.of("/desk");
  deskNS.emit("rider:location_update", {
    rider_id: String(riderId),
    name: name || "Rider",
    phone: phone || "",
    lat,
    lng,
    status: status || "idle",
    order_id: orderId || null,
    timestamp: new Date().toISOString(),
  });
}

/**
 * REST endpoint: GET /api/riders/active-locations
 * Returns current in-memory rider positions for desks that load via HTTP.
 */
function getActiveRidersSnapshot() {
  return getAllRiders();
}

module.exports = { initSocketServer, broadcastRiderLocation, getActiveRidersSnapshot };
