/**
 * socketServer.js  –  Real-time rider location tracking via Socket.io
 *
 * State is kept in-memory (Maps). Data survives as long as the process is up.
 * No Redis dependency.
 *
 * Throttling:
 *   Broadcasts EVERY location update to desk immediately.
 *   MongoDB writes throttled: skipped if rider moved < 10 m AND last write < 20 s ago.
 *   Stationary heartbeat: emitted to desk every 10 s even when rider hasn't moved.
 */

const { Server } = require("socket.io");
const jwt        = require("jsonwebtoken");
const Rider      = require("./models/Rider");

// ─── In-memory state ──────────────────────────────────────────────────────────
const activeRiders  = new Map(); // riderId → state object
const locationHistory = new Map(); // riderId → [{lat, lng, ts}, ...]

const HISTORY_MAX_POINTS = 2000;
const STALE_MS           = 24 * 60 * 60 * 1000; // 24 hr

// ─── State helpers ────────────────────────────────────────────────────────────
async function getRiderState(riderId) {
  return activeRiders.get(String(riderId)) || null;
}

async function setRiderState(riderId, data) {
  const id       = String(riderId);
  const existing = activeRiders.get(id) || {};
  const updated  = { ...existing, ...data, lastSeen: Date.now() };
  activeRiders.set(id, updated);
  return updated;
}

function appendLocationHistory(riderId, lat, lng, ts) {
  const id   = String(riderId);
  const list = locationHistory.get(id) || [];
  list.push({ lat, lng, ts: ts || Date.now() });
  if (list.length > HISTORY_MAX_POINTS) list.splice(0, list.length - HISTORY_MAX_POINTS);
  locationHistory.set(id, list);
}

async function getRiderLocationHistory(riderId, sinceMs, untilMs) {
  const id   = String(riderId);
  const list = locationHistory.get(id) || [];
  const from = sinceMs || 0;
  const to   = untilMs || Infinity;
  return list.filter(p => p.ts >= from && p.ts <= to);
}

async function getAllRiders() {
  const now    = Date.now();
  const result = [];
  activeRiders.forEach((state, id) => {
    if (now - state.lastSeen < STALE_MS) {
      result.push({ rider_id: id, ...state });
    } else {
      activeRiders.delete(id);
    }
  });
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getJwtSecret() {
  return process.env.JWT_SECRET || "fallback_secret";
}

function verifyRiderToken(token) {
  try { return jwt.verify(token, getJwtSecret()); } catch { return null; }
}

function verifyDeskToken(token) {
  try { return jwt.verify(token, getJwtSecret()); } catch { return null; }
}

function distanceMetres(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Main initialiser ─────────────────────────────────────────────────────────
let io = null;

async function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    pingInterval: 10000,
    pingTimeout:  5000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 2e6,
    allowEIO3: true,
  });

  const riderNS = io.of("/rider");
  const deskNS  = io.of("/desk");

  // ── Rider namespace ────────────────────────────────────────────────────────
  riderNS.on("connection", (socket) => {
    let riderId   = null;
    let riderInfo = null;

    console.log(`[socket] Rider connect attempt: ${socket.id}`);

    socket.on("rider:connect", async ({ rider_id, token } = {}) => {
      const decoded = verifyRiderToken(token);
      if (!decoded) {
        socket.emit("error", { message: "Unauthorized" });
        socket.disconnect(true);
        return;
      }

      riderId = String(rider_id || decoded.riderId || decoded.id || decoded._id);

      try {
        const doc = await Rider.findById(riderId).select("name phone").lean();
        riderInfo = doc || { name: "Rider", phone: "" };
      } catch {
        riderInfo = { name: "Rider", phone: "" };
      }

      const prevState = await getRiderState(riderId);

      await setRiderState(riderId, {
        socket_id: socket.id,
        name:      riderInfo.name,
        phone:     riderInfo.phone,
        status:    prevState?.status || "idle",
        connected: true,
      });

      socket.join(`rider:${riderId}`);
      console.log(`[socket] Rider authenticated: ${riderId} (${riderInfo.name})`);
      socket.emit("rider:connected", { message: "Connected", rider_id: riderId });

      if (prevState?.lat && prevState?.lng) {
        deskNS.emit("rider:location_update", {
          rider_id:  riderId,
          name:      riderInfo.name,
          phone:     riderInfo.phone,
          lat:       prevState.lat,
          lng:       prevState.lng,
          status:    prevState.status || "idle",
          order_id:  prevState.order_id || null,
          timestamp: new Date().toISOString(),
          speed_ms:  0,
          connected: true,
        });
      } else {
        deskNS.emit("rider:status_update", {
          rider_id: riderId,
          status:   prevState?.status || "idle",
          order_id: prevState?.order_id || null,
          connected: true,
        });
      }
    });

    // ── Location update ────────────────────────────────────────────────────
    socket.on("rider:location", async (data = {}) => {
      if (!riderId) return;
      const { lat, lng, status, order_id, timestamp, speed_ms } = data;
      if (typeof lat !== "number" || typeof lng !== "number") return;

      const state = await getRiderState(riderId);
      const now   = Date.now();
      const ts    = timestamp || new Date().toISOString();

      const payload = {
        rider_id: riderId,
        name:     riderInfo?.name || state?.name || "Rider",
        phone:    riderInfo?.phone || state?.phone || "",
        lat,
        lng,
        status:   status || state?.status || "idle",
        order_id: order_id || state?.order_id || null,
        timestamp: ts,
        speed_ms:  speed_ms || 0,
        connected: true,
      };
      deskNS.emit("rider:location_update", payload);

      const hasPrev    = state?.lat && state?.lng;
      const dist       = hasPrev ? distanceMetres(state.lat, state.lng, lat, lng) : Infinity;
      const lastWrite  = state?.lastDbWrite || 0;
      const shouldWrite = dist >= 10 || (now - lastWrite) > 20000;

      if (shouldWrite) {
        Rider.findByIdAndUpdate(
          riderId,
          { location: { lat, lng }, lastLocationUpdate: new Date() },
          { new: false }
        ).catch(() => {});
      }

      await setRiderState(riderId, {
        lat,
        lng,
        status:     status || "idle",
        order_id:   order_id || null,
        timestamp:  ts,
        speed_ms:   speed_ms || 0,
        lastDbWrite: shouldWrite ? now : (state?.lastDbWrite || 0),
      });

      appendLocationHistory(riderId, lat, lng, now);
    });

    // ── Status change ──────────────────────────────────────────────────────
    socket.on("rider:status", async (data = {}) => {
      if (!riderId) return;
      const { status, order_id } = data;
      if (!status) return;

      await setRiderState(riderId, { status, order_id: order_id || null });

      deskNS.emit("rider:status_update", {
        rider_id: riderId,
        status,
        order_id: order_id || null,
      });
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      if (!riderId) return;
      console.log(`[socket] Rider disconnected: ${riderId} (${reason})`);
      await setRiderState(riderId, { connected: false });
      deskNS.emit("rider:disconnected", { rider_id: riderId });
    });
  });

  // ── Desk namespace ─────────────────────────────────────────────────────────
  deskNS.on("connection", (socket) => {
    let authenticated = false;
    console.log(`[socket] Desk connect: ${socket.id}`);

    socket.on("desk:connect", async ({ token } = {}) => {
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
      socket.emit("desk:connected", { message: "Connected" });

      const snapshot = await getAllRiders();
      socket.emit("riders:snapshot", snapshot);
    });

    socket.on("desk:snapshot", async () => {
      if (!authenticated) return;
      const snapshot = await getAllRiders();
      socket.emit("riders:snapshot", snapshot);
    });

    socket.on("disconnect", () => {
      console.log(`[socket] Desk disconnected: ${socket.id}`);
    });
  });

  console.log("✅ Socket.io rider tracking initialised (in-memory)");
  return io;
}

// ─── HTTP fallback broadcast (called from riders.js route) ────────────────────
async function broadcastRiderLocation(riderId, lat, lng, status, orderId, name, phone) {
  if (!io) return;

  const now = Date.now();
  await setRiderState(riderId, {
    lat,
    lng,
    status:   status || "idle",
    order_id: orderId || null,
    name:     name   || "Rider",
    phone:    phone  || "",
    timestamp: new Date().toISOString(),
    connected: true,
  });

  appendLocationHistory(riderId, lat, lng, now);

  io.of("/desk").emit("rider:location_update", {
    rider_id:  String(riderId),
    name:      name   || "Rider",
    phone:     phone  || "",
    lat,
    lng,
    status:    status || "idle",
    order_id:  orderId || null,
    timestamp: new Date().toISOString(),
    connected: true,
  });
}

async function getActiveRidersSnapshot() {
  return getAllRiders();
}

module.exports = { initSocketServer, broadcastRiderLocation, getActiveRidersSnapshot, getRiderState, getRiderLocationHistory };
