import { LRUCache } from "lru-cache";
import type { Quote } from "../types/index.js";

// Quote cache: short TTL since prices change frequently
export const quoteCache = new LRUCache<string, Quote>({
  max: 500,
  ttl: 5 * 1000, // 5 seconds
});

// Bars/historical data cache: longer TTL since historical data doesn't change
// Using Record<string, unknown> to satisfy LRU cache type constraints
export const barsCache = new LRUCache<string, Record<string, unknown>[]>({
  max: 100,
  ttl: 60 * 1000, // 1 minute
});

// Market status cache: moderate TTL
export const marketStatusCache = new LRUCache<string, Record<string, unknown>>({
  max: 10,
  ttl: 30 * 1000, // 30 seconds
});

// News cache
export const newsCache = new LRUCache<string, Record<string, unknown>[]>({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
});

// Generic cache helper
export function getCached<T extends object>(
  cache: LRUCache<string, T>,
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  return fetcher().then((result) => {
    cache.set(key, result);
    return result;
  });
}
