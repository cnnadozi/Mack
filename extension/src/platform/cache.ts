// A small in-memory cache: entries expire after a while, and the least recently
// used one is dropped when it is full. It lives only as long as the document that
// created it, so nothing a user asked is written to disk.

export interface Cache<Value> {
  get(key: string): Value | undefined;
  set(key: string, value: Value): void;
}

export function createCache<Value>(options: {
  maxEntries: number;
  ttlMs: number;
  /** Replaceable so tests can move time forward. */
  now?: () => number;
}): Cache<Value> {
  const now = options.now ?? Date.now;
  // A Map keeps insertion order, so the first key is always the oldest.
  const entries = new Map<string, { value: Value; expires: number }>();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      if (entry.expires <= now()) return undefined;
      // Re-inserted so a value that keeps being used is the last to be dropped.
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expires: now() + options.ttlMs });
      if (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    },
  };
}
