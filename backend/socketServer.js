/**
 * socketServer.js  –  Real-time rider location tracking via Socket.io
 *
 * Architecture:
 *   Rider App ──ws──► /rider namespace ──► in-memory + optional Redis ──► /desk namespace
 *
 * Redis (optional):
 *   Set REDIS_URL in env to enable:
 *   • @socket.io/redis-adapter  →  scales across multiple server instances
 *   • ioredis state store       →  rider positions survive server restarts
 *   Falls back to in-memory Map if Redis is unavailable.
 *
 * Throttling:
 *   Server broadcasts EVERY location update to the desk immediately.
 *   MongoDB writes are throttled: skipped if rider moved < 10 m AND last write < 20 s ago.
 *   Stationary heartbeat: emitted to desk every 10 s even when rider hasn't moved.
 *
 * WebSocket tuning:
 *   pingInterval 5 s / pingTimeout 8 s  → dead connections detected within ~13 s.
 */

const { Server } = require("socket.io");
const jwt        = require("jsonwebtoken");
const Rider      = require("./models/Rider");

// ─── Optional Redis ────────────────────────────────────────────────────────────
let redisAdapter  = null;
let redisClient   = null; // ioredis client for state storage

async function initRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return;

  try {
    const Redis       = require("ioredis");
    const { createAdapter } = require("@socket.io/redis-adapter");

    const pub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    const sub = pub.duplicate();

    await Promise.all([pub.connect(), sub.connect()]);

    redisAdapter = createAdapter(pub, sub);
    redisClient  = pub;
    console.log("✅ Redis adapter connected:", url);
  } catch (err) {
    console.warn("⚠️  Redis unavailable, using in-memory adapter:", err.message);
    redisAdapter = null;
    redisClient  = null;
  }
}

// ─── State store (Redis when available, in-memory fallback) ───────────────────
const activeRiders = new Map(); // in-memory fallback

const REDIS_TTL = 10 * 60; // 10 min TTL in Redis

async function getRiderState(riderId) {
  const id = String(riderId);
  if (redisClient) {
    try {
      const raw = await redisClient.get(`rider:state:${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch { /* fall through */ }
  }
  return activeRiders.get(id) || null;
}

async function setRiderState(riderId, data) {
  const id       = String(riderId);
  const existing = await getRiderState(id) || {};
  const updated  = { ...existing, ...data, lastSeen: Date.now() };

  if (redisClient) {
    try {
      await redisClient.setex(`rider:state:${id}`, REDIS_TTL, JSON.stringify(updated));
      await redisClient.sadd("rider:active_ids", id);
      await redisClient.expire("rider:active_ids", REDIS_TTL);
    } catch { /* fall through */ }
  }
  activeRiders.set(id, updated); // always keep in-memory mirror
  return updated;
}

async function getAllRiders() {
  const now    = Date.now();
  const result = [];
  const STALE  = 10 * 60 * 1000; // 10 min

  if (redisClient) {
    try {
      const ids = await redisClient.smembers("rider:active_ids");
      for (const id of ids) {
        const raw = await redisClient.get(`rider:state:${id}`);
        if (!raw) continue;
        const state = JSON.parse(raw);
        if (now - state.lastSeen < STALE) {
          result.push({ rider_id: id, ...state });
        }
      }
      return result;
    } catch { /* fall through to in-memory */ }
  }

  activeRiders.forEach((state, id) => {
    if (now - state.lastSeen < STALE) {
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
  // Try Redis first (non-blocking — falls back if unavailable)
  await initRedis();

  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    // Tighter ping → dead connections detected in ~13 s instead of ~30 s
    pingInterval: 5000,
    pingTimeout:  8000,
    // Allow larger payloads for snapshot bursts
    maxHttpBufferSize: 2e6,
  });

  if (redisAdapter) {
    io.adapter(redisAdapter);
    console.log("🔌 Socket.io using Redis adapter");
  }

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

      // Preserve previous status/location — don't reset to idle on reconnect
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

      // Send the desk an immediate "online" signal.
      // If we have a previous location, send it as location_update so the desk
      // shows a real position immediately (not just a status badge with no coords).
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

      // ── Always broadcast to desk immediately ───────────────────────────────
      // Desk needs every update for real-time map. Don't throttle broadcasts.
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

      // ── Throttled MongoDB write (only on significant movement) ─────────────
      const hasPrev    = state?.lat && state?.lng;
      const dist       = hasPrev ? distanceMetres(state.lat, state.lng, lat, lng) : Infinity;
      const lastWrite  = state?.lastDbWrite || 0;
      const shouldWrite = dist >= 10 || (now - lastWrite) > 20000; // 10 m OR 20 s

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

      // Full snapshot of all currently tracked riders
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

  console.log("✅ Socket.io rider tracking initialised");
  return io;
}

// ─── HTTP fallback broadcast (called from riders.js route) ────────────────────
async function broadcastRiderLocation(riderId, lat, lng, status, orderId, name, phone) {
  if (!io) return;

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

module.exports = { initSocketServer, broadcastRiderLocation, getActiveRidersSnapshot };
