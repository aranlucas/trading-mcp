import Bottleneck from "bottleneck";

// Rate limiters for each provider based on their API limits
export const rateLimiters = {
  // Polygon.io: 5 requests per minute (free tier)
  polygon: new Bottleneck({
    reservoir: 5,
    reservoirRefreshAmount: 5,
    reservoirRefreshInterval: 60 * 1000, // 1 minute
    maxConcurrent: 1,
  }),

  // Finnhub: 60 requests per minute
  finnhub: new Bottleneck({
    reservoir: 60,
    reservoirRefreshAmount: 60,
    reservoirRefreshInterval: 60 * 1000, // 1 minute
    maxConcurrent: 5,
  }),

  // Alpaca: 200 requests per minute
  alpaca: new Bottleneck({
    reservoir: 200,
    reservoirRefreshAmount: 200,
    reservoirRefreshInterval: 60 * 1000, // 1 minute
    maxConcurrent: 10,
  }),

  // Yahoo Finance: No official limit, but be conservative
  yahoo: new Bottleneck({
    reservoir: 100,
    reservoirRefreshAmount: 100,
    reservoirRefreshInterval: 60 * 1000, // 1 minute
    maxConcurrent: 5,
  }),

  // FRED: 120 requests per minute
  fred: new Bottleneck({
    reservoir: 120,
    reservoirRefreshAmount: 120,
    reservoirRefreshInterval: 60 * 1000, // 1 minute
    maxConcurrent: 5,
  }),

  // Finviz: Conservative since it's web scraping
  finviz: new Bottleneck({
    reservoir: 10,
    reservoirRefreshAmount: 10,
    reservoirRefreshInterval: 60 * 1000, // 1 minute
    maxConcurrent: 1,
    minTime: 2000, // At least 2 seconds between requests
  }),
};

// Helper to wrap a function with rate limiting
export function withRateLimit<TArgs extends unknown[], TReturn>(
  limiter: Bottleneck,
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => limiter.schedule(() => Promise.resolve(fn(...args)));
}
