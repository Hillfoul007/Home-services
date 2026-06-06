/**
 * locationQueue.ts — IndexedDB-backed offline location queue.
 *
 * Survives page refresh and app crashes unlike a plain JS array.
 * Falls back silently to in-memory if IndexedDB is unavailable (private browsing, etc.).
 */

export interface QueuedLocation {
  lat: number;
  lng: number;
  status: string;
  order_id: string | null;
  timestamp: string;
}

// ─── IndexedDB setup ─────────────────────────────────────────────────────────
const DB_NAME    = 'laundrify_rider';
const DB_VERSION = 1;
const STORE      = 'location_queue';
const MAX_QUEUE  = 200; // cap to avoid unbounded growth

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────
const memQueue: QueuedLocation[] = [];
let useMemory = false; // switched to true if IDB unavailable

// ─── Public API ───────────────────────────────────────────────────────────────

/** Add a location to the offline queue. */
export async function enqueue(loc: QueuedLocation): Promise<void> {
  if (useMemory) {
    if (memQueue.length >= MAX_QUEUE) memQueue.shift();
    memQueue.push(loc);
    return;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    // Enforce max size — delete oldest entries if needed
    const countReq = store.count();
    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count >= MAX_QUEUE) {
        // Delete the oldest (first) entry
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) cursor.delete();
        };
      }
    };

    store.add(loc);
  } catch {
    useMemory = true;
    memQueue.push(loc);
  }
}

/** Drain the entire queue and return all entries. Empties the queue. */
export async function dequeueAll(): Promise<QueuedLocation[]> {
  if (useMemory) {
    const items = [...memQueue];
    memQueue.length = 0;
    return items;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    return new Promise((resolve, reject) => {
      const items: QueuedLocation[] = [];
      const keysToDelete: IDBValidKey[] = [];

      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          items.push(cursor.value as QueuedLocation);
          keysToDelete.push(cursor.primaryKey);
          cursor.continue();
        } else {
          // Delete all collected keys
          keysToDelete.forEach((k) => store.delete(k));
          resolve(items);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch {
    useMemory = true;
    const items = [...memQueue];
    memQueue.length = 0;
    return items;
  }
}

/** How many items are queued (approximate — memory path is exact, IDB is async). */
export async function queueSize(): Promise<number> {
  if (useMemory) return memQueue.length;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    return new Promise((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
