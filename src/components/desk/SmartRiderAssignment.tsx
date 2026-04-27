/**
 * SmartRiderAssignment
 *
 * Comprehensive rider assignment dashboard:
 *  1. Rider State Overview (Idle / Assigned / Back-to-Factory / Offline) + shift management
 *  2. Workload distribution with balance warning
 *  3. Smart geo-cluster suggestions (≤2.5 km, 2–4 orders) with one-click multi-assign
 *  4. Rider performance table with ETA, efficiency score, completed-today
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { getApiUrl } from '@/config/env';
import type { RiderSocketState } from '@/hooks/useRiderSocket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiderRef {
  _id: string;
  name: string;
  phone: string;
  isActive?: boolean;
  location?: { lat: number; lng: number };
  lastLocationUpdate?: string;
}

interface Order {
  _id: string;
  custom_order_id?: string;
  name?: string;
  status?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  final_amount?: number;
  total_price?: number;
  assignedRider?: RiderRef | string | null;
  created_at?: string;
}

interface DashboardSections {
  created: Order[];
  picked_up: Order[];
  processing: Order[];
  ready_for_delivery: Order[];
  delivered: Order[];
  completed: Order[];
  cancelled: Order[];
}

type RiderState = 'idle' | 'assigned' | 'back_to_factory' | 'offline';

interface RiderWorkload {
  rider: RiderRef;
  liveState: RiderSocketState | undefined;
  state: RiderState;
  activeOrders: number;
  completedToday: number;
  idleMinutes: number;
}

interface OrderCluster {
  id: string;
  area: string;
  orders: Order[];
  type: 'pickup' | 'delivery' | 'mixed';
  centerLat?: number;
  centerLng?: number;
}

interface RiderShift {
  riderId: string;
  startTime: string;
  endTime: string;
}

interface Props {
  sections: DashboardSections;
  riders: RiderRef[];
  riderMap: Map<string, RiderSocketState>;
  token: string;
  fetchDashboard: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLUSTER_RADIUS_KM = 2.5;
const MAX_PER_CLUSTER = 4;
const AVG_SPEED_KMH = 20; // urban motorcycle

const STATE_STYLES: Record<RiderState, { bg: string; border: string; text: string; label: string; icon: string }> = {
  idle:            { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  label: 'Idle',            icon: '🟢' },
  assigned:        { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Delivering',      icon: '🛵' },
  back_to_factory: { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   label: 'Back to Base',   icon: '🏭' },
  offline:         { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500',   label: 'Offline',         icon: '⚫' },
};

const CLUSTER_STYLES = {
  pickup:   { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: '🧺', label: 'Pickup'   },
  delivery: { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: '🚚', label: 'Delivery' },
  mixed:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   icon: '🔄', label: 'Mixed'    },
};

// ─── Geo helpers ──────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinutes(distKm: number): number {
  return Math.round((distKm / AVG_SPEED_KMH) * 60);
}

function extractArea(address?: string): string {
  if (!address) return 'Unknown';
  const parts = address.split(',').map((p) => p.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0]?.substring(0, 30) || 'Unknown';
}

// ─── Clustering ───────────────────────────────────────────────────────────────

function clusterOrders(orders: Order[], type: 'pickup' | 'delivery'): OrderCluster[] {
  const withCoords  = orders.filter((o) => o.coordinates?.lat && o.coordinates?.lng);
  const withoutCoords = orders.filter((o) => !o.coordinates?.lat || !o.coordinates?.lng);
  const usedIds = new Set<string>();
  const result: OrderCluster[] = [];

  for (const seed of withCoords) {
    if (usedIds.has(seed._id)) continue;
    const cluster: Order[] = [seed];
    usedIds.add(seed._id);

    for (const other of withCoords) {
      if (usedIds.has(other._id) || cluster.length >= MAX_PER_CLUSTER) continue;
      const dist = haversineKm(
        seed.coordinates!.lat, seed.coordinates!.lng,
        other.coordinates!.lat, other.coordinates!.lng,
      );
      if (dist <= CLUSTER_RADIUS_KM) {
        cluster.push(other);
        usedIds.add(other._id);
      }
    }

    const centerLat = cluster.reduce((s, o) => s + (o.coordinates?.lat || 0), 0) / cluster.length;
    const centerLng = cluster.reduce((s, o) => s + (o.coordinates?.lng || 0), 0) / cluster.length;

    result.push({
      id: `${type}_geo_${seed._id}`,
      area: extractArea(seed.address),
      orders: cluster,
      type,
      centerLat,
      centerLng,
    });
  }

  // Text-based fallback for orders without GPS coords
  const textGroups: Record<string, Order[]> = {};
  for (const o of withoutCoords) {
    const area = extractArea(o.address).toLowerCase().trim();
    if (!textGroups[area]) textGroups[area] = [];
    if (textGroups[area].length < MAX_PER_CLUSTER) textGroups[area].push(o);
  }
  for (const [area, grpOrders] of Object.entries(textGroups)) {
    if (grpOrders.length >= 2) {
      result.push({ id: `${type}_text_${area}`, area, orders: grpOrders, type });
    }
  }

  return result.sort((a, b) => b.orders.length - a.orders.length);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SmartRiderAssignment({
  sections,
  riders,
  riderMap,
  token,
  fetchDashboard,
}: Props) {
  // Cluster-level rider selection & assignment state
  const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState<string | null>(null);

  // Shift management (persisted in localStorage)
  const [shifts, setShifts] = useState<Record<string, RiderShift>>(() => {
    try { return JSON.parse(localStorage.getItem('rider_shifts') || '{}'); } catch { return {}; }
  });
  const [editingShift, setEditingShift] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState({ startTime: '09:00', endTime: '18:00' });

  // Expanded cluster for detail view
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  // Live clock for idle-minutes computation
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Derive rider workloads ─────────────────────────────────────────────────

  const allOrders = useMemo(() => Object.values(sections).flat() as Order[], [sections]);

  const riderWorkloads = useMemo((): RiderWorkload[] => {
    return riders.map((rider) => {
      const live = riderMap.get(rider._id);

      const activeOrders = allOrders.filter((o) => {
        const ar = o.assignedRider;
        if (!ar) return false;
        const matched = typeof ar === 'string' ? ar === rider._id : ar._id === rider._id;
        return matched && !['delivered', 'completed', 'cancelled'].includes(o.status || '');
      }).length;

      const completedToday = allOrders.filter((o) => {
        const ar = o.assignedRider;
        if (!ar) return false;
        const matched = typeof ar === 'string' ? ar === rider._id : ar._id === rider._id;
        return matched && ['delivered', 'completed'].includes(o.status || '');
      }).length;

      let state: RiderState = 'offline';
      let idleMinutes = 0;

      if (live) {
        if (live.connected === false) {
          state = 'offline';
        } else if (live.status === 'assigned' || live.status === 'delivering') {
          state = 'assigned';
        } else {
          // Rider is online but idle — infer "back to factory" if they had active deliveries
          const hadActiveDelivery = allOrders.some((o) => {
            const ar = o.assignedRider;
            if (!ar) return false;
            const matched = typeof ar === 'string' ? ar === rider._id : ar._id === rider._id;
            return matched && o.status === 'delivered';
          });
          state = (hadActiveDelivery && completedToday > 0) ? 'back_to_factory' : 'idle';

          // How long since status became idle (approximated via timestamp)
          if (live.timestamp) {
            idleMinutes = Math.floor((now - new Date(live.timestamp).getTime()) / 60_000);
          }
        }
      }

      return { rider, liveState: live, state, activeOrders, completedToday, idleMinutes };
    });
  }, [riders, riderMap, allOrders, now]);

  // ── Build clusters ─────────────────────────────────────────────────────────

  const clusters = useMemo((): OrderCluster[] => {
    const pickupOrders   = sections.created.filter((o) => o.address);
    const deliveryOrders = sections.ready_for_delivery.filter((o) => o.address);

    return [
      ...clusterOrders(pickupOrders, 'pickup'),
      ...clusterOrders(deliveryOrders, 'delivery'),
    ];
  }, [sections]);

  // ── Suggest nearest idle rider for a cluster ───────────────────────────────

  const suggestRider = useCallback(
    (cluster: OrderCluster): RiderRef | null => {
      const idle = riderWorkloads.filter((rw) => rw.state === 'idle');
      if (idle.length === 0) return null;

      if (!cluster.centerLat || !cluster.centerLng) {
        return idle.sort((a, b) => a.activeOrders - b.activeOrders)[0].rider;
      }

      const withGps = idle.filter((rw) => rw.liveState?.lat && rw.liveState?.lng);
      const pool = withGps.length > 0 ? withGps : idle;

      return pool
        .map((rw) => ({
          rider: rw.rider,
          dist: rw.liveState?.lat && cluster.centerLat
            ? haversineKm(rw.liveState.lat, rw.liveState.lng, cluster.centerLat, cluster.centerLng!)
            : Infinity,
        }))
        .sort((a, b) => a.dist - b.dist)[0].rider;
    },
    [riderWorkloads],
  );

  // ── Assign selected rider to all orders in a cluster ──────────────────────

  const applyClusterAssignment = async (cluster: OrderCluster) => {
    const riderId = selectedRiders[cluster.id] || suggestRider(cluster)?._id;
    if (!riderId) { toast.error('Select a rider first'); return; }

    const rider = riders.find((r) => r._id === riderId);
    if (!rider) return;

    setApplying(cluster.id);
    const assignType = cluster.type === 'delivery' ? 'delivery' : 'pickup';
    let successes = 0;

    for (const order of cluster.orders) {
      try {
        const res = await fetch(`${getApiUrl()}/vendor/orders/orders/${order._id}/assign-rider`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ riderId, assignmentType: assignType }),
        });
        if (res.ok) successes++;
      } catch { /* continue */ }
    }

    if (successes > 0) {
      toast.success(`Assigned ${rider.name} to ${successes}/${cluster.orders.length} orders`);
      fetchDashboard();
    } else {
      toast.error('Assignment failed — check rider status');
    }
    setApplying(null);
  };

  // ── Shift helpers ──────────────────────────────────────────────────────────

  const openShiftEdit = (riderId: string) => {
    const existing = shifts[riderId];
    setShiftForm(existing ? { startTime: existing.startTime, endTime: existing.endTime } : { startTime: '09:00', endTime: '18:00' });
    setEditingShift(riderId);
  };

  const saveShift = (riderId: string) => {
    const updated = { ...shifts, [riderId]: { riderId, ...shiftForm } };
    setShifts(updated);
    localStorage.setItem('rider_shifts', JSON.stringify(updated));
    setEditingShift(null);
    toast.success('Shift saved');
  };

  // ── Derived stats ──────────────────────────────────────────────────────────

  const maxActiveOrders = Math.max(...riderWorkloads.map((rw) => rw.activeOrders), 1);

  const overloadedRider = (() => {
    const active = riderWorkloads.filter((rw) => rw.state !== 'offline');
    if (active.length < 2) return null;
    const loads = active.map((rw) => rw.activeOrders);
    const mx = Math.max(...loads);
    const mn = Math.min(...loads);
    return mx - mn >= 3 ? active.find((rw) => rw.activeOrders === mx)! : null;
  })();

  // Efficiency score: simple formula 0–100
  const efficiency = (rw: RiderWorkload): number => {
    if (rw.state === 'offline') return 0;
    const base = Math.min(60, rw.completedToday * 10);
    const actBonus = rw.activeOrders > 0 ? 20 : 0;
    const idlePenalty = rw.state === 'idle' && rw.idleMinutes > 30 ? Math.min(20, rw.idleMinutes / 3) : 0;
    return Math.max(0, Math.min(100, Math.round(base + actBonus + 20 - idlePenalty)));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ══ 1. Rider State Overview ══════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="font-semibold text-gray-800 mb-3">🚴 Rider Status & Workload</h2>

        {riderWorkloads.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No riders added yet</p>
        ) : (
          <div className="space-y-2.5">
            {riderWorkloads.map((rw) => {
              const s      = STATE_STYLES[rw.state];
              const shift  = shifts[rw.rider._id];
              const isEdit = editingShift === rw.rider._id;

              return (
                <div key={rw.rider._id} className={`rounded-xl border p-3 ${s.bg} ${s.border}`}>
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-white border ${s.border} ${s.text}`}>
                        {rw.rider.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm ${s.text}`}>{rw.rider.name}</p>
                        <a href={`tel:${rw.rider.phone}`} className="text-xs opacity-60">{rw.rider.phone}</a>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xs font-bold ${s.text}`}>{s.icon} {s.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {rw.activeOrders} active · {rw.completedToday} done
                      </p>
                      {rw.state === 'idle' && rw.idleMinutes > 5 && (
                        <p className="text-[10px] text-amber-600">Idle {rw.idleMinutes}m</p>
                      )}
                    </div>
                  </div>

                  {/* Workload progress bar */}
                  {rw.activeOrders > 0 && (
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] mb-0.5 opacity-60">
                        <span>Workload</span>
                        <span>{rw.activeOrders}/{maxActiveOrders}</span>
                      </div>
                      <div className="w-full bg-white/60 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${s.text} bg-current opacity-50`}
                          style={{ width: `${(rw.activeOrders / maxActiveOrders) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Shift row */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] opacity-60">
                      {shift ? `Shift: ${shift.startTime}–${shift.endTime}` : 'No shift set'}
                    </span>
                    <button
                      onClick={() => openShiftEdit(rw.rider._id)}
                      className={`text-[11px] underline ${s.text} opacity-70`}
                    >
                      {shift ? 'Edit' : 'Set shift'}
                    </button>
                  </div>

                  {/* Inline shift editor */}
                  {isEdit && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <input
                        type="time" value={shiftForm.startTime}
                        onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                      />
                      <span className="text-xs opacity-60">to</span>
                      <input
                        type="time" value={shiftForm.endTime}
                        onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                      />
                      <button
                        onClick={() => saveShift(rw.rider._id)}
                        className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1 font-semibold text-gray-700"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingShift(null)} className="text-xs opacity-60">Cancel</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Workload balance warning */}
        {overloadedRider && (
          <div className="mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <span className="shrink-0 text-base">⚖️</span>
            <span>
              <strong>{overloadedRider.rider.name}</strong> has {overloadedRider.activeOrders} active orders
              while others have fewer. Consider reassigning.
            </span>
          </div>
        )}
      </div>

      {/* ══ 2. Smart Cluster Suggestions ═════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="font-semibold text-gray-800 mb-1">🎯 Smart Cluster Assignment</h2>
        <p className="text-xs text-gray-400 mb-4">
          Nearby orders (≤{CLUSTER_RADIUS_KM} km, max {MAX_PER_CLUSTER}/cluster). Assign one rider for the whole group.
        </p>

        {clusters.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📍</div>
            <p className="text-sm font-medium">No clusters yet</p>
            <p className="text-xs mt-1">Clusters form when 2+ orders share a location within {CLUSTER_RADIUS_KM} km</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clusters.map((cluster) => {
              const cs        = CLUSTER_STYLES[cluster.type];
              const suggested = suggestRider(cluster);
              const selId     = selectedRiders[cluster.id] || suggested?._id || '';
              const selRW     = riderWorkloads.find((rw) => rw.rider._id === selId);
              const isExpanded = expandedCluster === cluster.id;
              const isApplying = applying === cluster.id;

              // ETA from selected rider to cluster center
              const etaChip = selRW?.liveState?.lat && cluster.centerLat
                ? `~${etaMinutes(haversineKm(selRW.liveState.lat, selRW.liveState.lng, cluster.centerLat, cluster.centerLng!))} min`
                : null;

              return (
                <div key={cluster.id} className={`rounded-xl border p-3 ${cs.bg} ${cs.border}`}>
                  {/* Cluster header */}
                  <div className="flex items-center justify-between mb-2">
                    <button
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      onClick={() => setExpandedCluster(isExpanded ? null : cluster.id)}
                    >
                      <span className={`font-semibold text-sm ${cs.text}`}>
                        {cs.icon} {cluster.area}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {cluster.orders.length} orders · {cs.label}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    {/* Route button */}
                    {cluster.orders.length >= 2 && (
                      <button
                        onClick={() => {
                          const locStr = (o: Order) =>
                            o.coordinates?.lat
                              ? `${o.coordinates.lat},${o.coordinates.lng}`
                              : encodeURIComponent(o.address || '');
                          const dest = locStr(cluster.orders[cluster.orders.length - 1]);
                          const wps  = cluster.orders.slice(0, -1).map(locStr).join('|');
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving${wps ? `&waypoints=${wps}` : ''}`,
                            '_blank',
                          );
                        }}
                        className="ml-2 shrink-0 text-xs bg-white/70 border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
                      >
                        🗺️ Route
                      </button>
                    )}
                  </div>

                  {/* Order list (collapsible) */}
                  {isExpanded && (
                    <div className="space-y-1 mb-3">
                      {cluster.orders.map((o) => (
                        <div
                          key={o._id}
                          className="flex items-center justify-between bg-white/70 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-gray-900">
                              {o.custom_order_id || o._id.slice(-6).toUpperCase()}
                            </span>
                            <span className="text-gray-500 truncate">{o.name}</span>
                            {o.coordinates?.lat && (
                              <span className="text-gray-300 text-[10px]">📍</span>
                            )}
                          </div>
                          <span className="text-gray-400 shrink-0">₹{o.final_amount ?? o.total_price ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rider selector + Assign button */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selId}
                      onChange={(e) =>
                        setSelectedRiders((prev) => ({ ...prev, [cluster.id]: e.target.value }))
                      }
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    >
                      <option value="">Choose rider…</option>
                      {riderWorkloads.map((rw) => {
                        const dist = rw.liveState?.lat && cluster.centerLat
                          ? haversineKm(rw.liveState.lat, rw.liveState.lng, cluster.centerLat, cluster.centerLng!).toFixed(1) + ' km'
                          : '';
                        return (
                          <option key={rw.rider._id} value={rw.rider._id}>
                            {STATE_STYLES[rw.state].icon} {rw.rider.name}
                            {dist ? ` · ${dist}` : ''} ({rw.activeOrders} active)
                          </option>
                        );
                      })}
                    </select>
                    <button
                      onClick={() => applyClusterAssignment(cluster)}
                      disabled={!selId || isApplying}
                      className="shrink-0 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 font-semibold"
                    >
                      {isApplying ? '…' : 'Assign All'}
                    </button>
                  </div>

                  {/* ETA + suggestion chips */}
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {etaChip && (
                      <span className="text-[11px] bg-white/70 rounded-full px-2 py-0.5 text-gray-600">
                        ⏱ ETA {etaChip}
                      </span>
                    )}
                    {suggested && !selectedRiders[cluster.id] && (
                      <span className="text-[11px] bg-white/70 rounded-full px-2 py-0.5 text-blue-700">
                        ✨ Suggested: {suggested.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ 3. Rider Performance Table ═══════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="font-semibold text-gray-800 mb-3">📊 Rider Performance</h2>

        {riderWorkloads.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No riders to show</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[380px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 text-left">
                  <th className="py-2 px-2">Rider</th>
                  <th className="py-2 px-2 text-center">State</th>
                  <th className="py-2 px-2 text-center">Active</th>
                  <th className="py-2 px-2 text-center">Done</th>
                  <th className="py-2 px-2 text-center">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...riderWorkloads]
                  .sort((a, b) => b.completedToday - a.completedToday || b.activeOrders - a.activeOrders)
                  .map((rw) => {
                    const eff      = efficiency(rw);
                    const effColor =
                      eff >= 70 ? 'text-green-600' : eff >= 40 ? 'text-yellow-600' : 'text-red-500';
                    const s = STATE_STYLES[rw.state];

                    return (
                      <tr key={rw.rider._id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-2">
                          <p className="font-semibold text-gray-900">{rw.rider.name}</p>
                          <a href={`tel:${rw.rider.phone}`} className="text-blue-500">
                            {rw.rider.phone}
                          </a>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.text}`}
                          >
                            {s.icon} {s.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-gray-900">
                          {rw.activeOrders}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-blue-700">
                          {rw.completedToday}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`font-bold ${effColor}`}>{eff}%</span>
                            <div className="w-12 bg-gray-100 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${eff >= 70 ? 'bg-green-500' : eff >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${eff}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ 4. Route Analytics (live riders with GPS) ════════════════════════ */}
      {riderWorkloads.some((rw) => rw.liveState?.lat) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-800 mb-3">📡 Live Position & ETA</h2>
          <div className="space-y-2">
            {riderWorkloads
              .filter((rw) => rw.liveState?.lat && rw.liveState?.lng)
              .map((rw) => {
                const s   = STATE_STYLES[rw.state];
                const spd = rw.liveState?.speed_ms ? Math.round(rw.liveState.speed_ms * 3.6) : null;
                return (
                  <div
                    key={rw.rider._id}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${s.bg} ${s.border}`}
                  >
                    <div>
                      <p className={`font-semibold text-sm ${s.text}`}>{rw.rider.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {rw.liveState!.lat.toFixed(5)}, {rw.liveState!.lng.toFixed(5)}
                      </p>
                      {spd !== null && spd > 2 && (
                        <p className="text-[11px] text-gray-500">{spd} km/h</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <a
                        href={`https://www.google.com/maps?q=${rw.liveState!.lat},${rw.liveState!.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] bg-white/70 border border-gray-200 rounded-lg px-2 py-1 text-blue-700 font-medium"
                      >
                        🗺️ Open
                      </a>
                      {rw.liveState!.order_id && (
                        <span className="text-[10px] text-gray-500">
                          Order: {rw.liveState!.order_id.slice(-6).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
