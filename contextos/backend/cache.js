/**
 * cache.js — Simple in-memory TTL cache
 * Used by: signals (5m), pressure (3m), timecontext (1m)
 */

const store = new Map();

export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
  return entry.value;
}

export function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidate(key) {
  store.delete(key);
}

export function clear() {
  store.clear();
}
