import type { AiSettings } from "@/shared/utils/aiSettings";

/** How long a cached model list stays fresh. A provider can add or
 *  rename models, so the cache is a soft hint, not a contract. The
 *  Refresh button on the Model field always bypasses it. */
export const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

interface CacheEntry {
  /** Keyed by `baseUrl|apiKey` so different providers / users get
   *  separate caches. */
  key: string;
  /** Sorted, deduped list of model ids. */
  models: string[];
  /** `Date.now()` at write time. Compared against `MODEL_CACHE_TTL_MS`. */
  fetchedAt: number;
}

const STORAGE_KEY = "gitako.ai.models-cache";

/** FNV-1a 32-bit hash. Good enough for a cache key, no need for crypto. */
function hashKey(parts: string[]): string {
  let h = 0x811c9dc5;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  // Force unsigned hex, 8 chars.
  return (h >>> 0).toString(16).padStart(8, "0");
}

function cacheKey(baseUrl: string, apiKey: string): string {
  return hashKey([baseUrl.trim(), apiKey.trim()]);
}

function readStore(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    // Drop entries missing required fields rather than crash.
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, v]) =>
          v &&
          typeof v.models !== "undefined" &&
          Array.isArray(v.models) &&
          typeof v.fetchedAt === "number",
      ),
    );
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, CacheEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* localStorage unavailable (private mode etc.) — non-fatal. */
  }
}

/** Returns a fresh-enough cached model list for the given settings, or
 *  `null` when the cache is empty / stale. The caller decides whether
 *  to fall back to a network refresh. */
export function readModelCache(settings: AiSettings): string[] | null {
  const store = readStore();
  const key = cacheKey(settings.baseUrl, settings.apiKey);
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > MODEL_CACHE_TTL_MS) return null;
  return entry.models.slice();
}

/** Persists the model list for the given settings. Overwrites any
 *  existing entry with the same `(baseUrl, apiKey)` pair. */
export function writeModelCache(settings: AiSettings, models: string[]): void {
  const store = readStore();
  const key = cacheKey(settings.baseUrl, settings.apiKey);
  store[key] = { key, models: models.slice(), fetchedAt: Date.now() };
  writeStore(store);
}

/** Drops cached entries whose key pair is no longer in the user's
 *  saved settings. Called on Save so we don't grow the cache forever
 *  for keys the user has rotated out. */
export function pruneModelCache(activeSettings: AiSettings[]): void {
  if (activeSettings.length === 0) return;
  const store = readStore();
  const activeKeys = new Set(
    activeSettings.map((s) => cacheKey(s.baseUrl, s.apiKey)),
  );
  let changed = false;
  for (const k of Object.keys(store)) {
    if (!activeKeys.has(k)) {
      delete store[k];
      changed = true;
    }
  }
  if (changed) writeStore(store);
}