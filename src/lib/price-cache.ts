/**
 * Ephemeral in-process price cache.
 *
 * Lives for the life of the Fluid Compute instance (~15 min of inactivity
 * before a cold start). Good enough for the POC — a second user in the
 * same region hitting the same query within the TTL gets a ~5-10s response
 * instead of 40-70s. Upgrade path when we outgrow it: Vercel Runtime Cache
 * API (distributed, per-region, tag-invalidatable).
 *
 * Scope doc §A2 / §7 POC step 2.
 */

import { createHash } from "crypto";

type CacheEntry<T> = { data: T; expiresAt: number; createdAt: number };

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_ENTRIES = 100;                   // bound memory on a single instance

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Canonical cache key: sha1 of lowercased product + JSON-stringified profile.
 * Truncated to 16 hex chars — 64 bits of entropy is plenty for ~100 entries.
 */
export function makeKey(
  product: string,
  profile: Record<string, unknown> | undefined,
): string {
  const canonical = `${product.trim().toLowerCase()}|${JSON.stringify(profile ?? {})}`;
  return createHash("sha1").update(canonical).digest("hex").slice(0, 16);
}

export function get<T>(key: string): { data: T; ageMs: number } | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return { data: entry.data, ageMs: Date.now() - entry.createdAt };
}

export function set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    // Cheap LRU-ish eviction: drop the oldest-inserted entry. Map preserves insertion order.
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  const now = Date.now();
  store.set(key, { data, expiresAt: now + ttlMs, createdAt: now });
}

/** For tests and admin tooling. */
export function stats() {
  return { size: store.size, max: MAX_ENTRIES, ttlMs: DEFAULT_TTL_MS };
}

export function clear() {
  store.clear();
}
