// Unified data providers

export { yahoo } from "./yahoo.js";
export { polygon } from "./polygon.js";
export { finnhubProvider as finnhub } from "./finnhub.js";
export { fred, INDICATORS } from "./fred.js";
export { finviz } from "./finviz.js";

import { yahoo } from "./yahoo.js";
import { polygon } from "./polygon.js";
import { finnhubProvider as finnhub } from "./finnhub.js";
import { fred } from "./fred.js";
import { finviz } from "./finviz.js";
import { withTimeout } from "../lib/timeout.js";
import { ProviderError } from "../lib/errors.js";
import { providerLogger } from "../lib/logger.js";
import { createProviderMetrics } from "../lib/provider-metrics.js";
import { withRetry } from "../lib/retry.js";
import type { Quote } from "../types/index.js";
import type { NewsItem, SentimentData } from "../types/index.js";

export type UnifiedOptions = {
  quoteTimeoutMs: number;
  quoteRetries: number;
  quoteRetryMinDelayMs: number;
  metricsWindowMs: number;
};

const DEFAULT_UNIFIED_OPTIONS: UnifiedOptions = {
  quoteTimeoutMs: 2000,
  quoteRetries: 1,
  quoteRetryMinDelayMs: 125,
  metricsWindowMs: 5 * 60 * 1000,
};

type QuoteGetter = (symbol: string) => Promise<Quote>;

export function createUnified(options?: Partial<UnifiedOptions>) {
  const opt: UnifiedOptions = { ...DEFAULT_UNIFIED_OPTIONS, ...(options ?? {}) };
  const metrics = createProviderMetrics({ windowMs: opt.metricsWindowMs });

  const quoteProviders: Array<{ name: string; get: QuoteGetter }> = [
    { name: "yahoo", get: (symbol) => yahoo.getQuoteNormalized(symbol) },
    ...(finnhub.isConfigured()
      ? [
          {
            name: "finnhub",
            get: async (symbol: string): Promise<Quote> => {
              const q = await finnhub.getQuote(symbol);
              if (!q) throw new Error("No quote");
              return q;
            },
          },
        ]
      : []),
    ...(polygon.isConfigured()
      ? [
          {
            name: "polygon",
            get: async (symbol: string): Promise<Quote> => {
              const q = await polygon.getPreviousClose(symbol);
              if (!q) throw new Error("No quote");
              return q;
            },
          },
        ]
      : []),
    {
      name: "finviz",
      get: async (symbol: string): Promise<Quote> => {
        const q = await finviz.getQuote(symbol);
        if (!q) throw new Error("No quote");
        return q;
      },
    },
  ];

  // Unified data fetcher that tries multiple sources
  return {
    // Get quote - parallel providers with first-success semantics
    async getQuote(symbol: string) {
      const wrapped = quoteProviders.map(({ name, get }) => {
        const startedAt = Date.now();
        return withRetry(() => withTimeout(get(symbol), opt.quoteTimeoutMs), {
          retries: opt.quoteRetries,
          minDelayMs: opt.quoteRetryMinDelayMs,
        })
          .then((quote) => {
            metrics.recordSuccess({
              provider: name,
              operation: "getQuote",
              latencyMs: Date.now() - startedAt,
            });
            return quote;
          })
          .catch((err: unknown) => {
            metrics.recordFailure({
              provider: name,
              operation: "getQuote",
              latencyMs: Date.now() - startedAt,
              err,
            });

            const snap = metrics.snapshot();
            const providerSnap = snap.providers[name]?.getQuote;
            if (
              providerSnap &&
              providerSnap.rolling.total >= 5 &&
              providerSnap.rolling.errorRate >= 0.5
            ) {
              providerLogger.warn(
                { provider: name, operation: "getQuote", rolling: providerSnap.rolling },
                "Provider error rate elevated",
              );
            }

            throw new ProviderError({ provider: name, operation: "getQuote", cause: err });
          });
      });

      try {
        return await Promise.any(wrapped);
      } catch (err) {
        throw new ProviderError({ provider: "unified", operation: "getQuote", cause: err });
      }
    },

    getProviderMetrics() {
      return metrics.snapshot();
    },

    // Direct provider access - use these for explicit provider selection
    providers: {
      yahoo: {
        getQuote: (symbol: string) => yahoo.getQuote(symbol),
        getQuotes: (symbols: string[]) => yahoo.getQuotes(symbols),
        getHistory: (symbol: string, from: Date, to: Date) => yahoo.getHistory(symbol, from, to),
        getOptions: (symbol: string) => yahoo.getOptions(symbol),
        search: (query: string) => yahoo.search(query),
        getTrending: (count?: number) => yahoo.getTrending(count),
      },
      polygon: {
        getQuote: (symbol: string) => polygon.getPreviousClose(symbol),
        getBars: (symbol: string, from: string, to: string) =>
          polygon.getAggregates(symbol, 1, "day", from, to),
        getNews: (symbol: string | undefined, limit: number) => polygon.getNews(symbol, limit),
        getGainersLosers: (direction: "gainers" | "losers") => polygon.getGainersLosers(direction),
        isConfigured: () => polygon.isConfigured(),
      },
      finnhub: {
        getQuote: (symbol: string) => finnhub.getQuote(symbol),
        getNews: (symbol: string, from: string, to: string) => finnhub.getNews(symbol, from, to),
        getMarketNews: () => finnhub.getMarketNews(),
        getNewsSentiment: (symbol: string) => finnhub.getNewsSentiment(symbol),
        getSocialSentiment: (symbol: string) => finnhub.getSocialSentiment(symbol),
        getRecommendations: (symbol: string) => finnhub.getRecommendations(symbol),
        getEarningsCalendar: (from: string, to: string) => finnhub.getEarningsCalendar(from, to),
        isConfigured: () => finnhub.isConfigured(),
      },
      finviz: {
        getQuote: (symbol: string) => finviz.getQuote(symbol),
        screen: (filters: Parameters<typeof finviz.screen>[0]) => finviz.screen(filters),
        getGainers: () => finviz.getGainers(),
        getLosers: () => finviz.getLosers(),
      },
      fred: {
        getSeries: (id: string, limit?: number) => fred.getSeries(id, limit),
        getMacroSnapshot: () => fred.getMacroSnapshot(),
        isConfigured: () => fred.isConfigured(),
      },
    },

    // Get multiple quotes
    async getQuotes(symbols: string[]) {
      try {
        return await yahoo.getQuotes(symbols);
      } catch {
        // Fallback to individual requests
        const results: unknown[] = [];
        await Promise.all(
          symbols.map(async (s) => {
            try {
              const q = await this.getQuote(s);
              results.push(q);
            } catch {
              // Skip failed quotes
            }
          }),
        );
        return results;
      }
    },

    // Get historical bars - tries Yahoo, then Polygon
    async getBars(symbol: string, days = 100) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - days);

      try {
        return await yahoo.getHistory(symbol, from, to);
      } catch {
        // Try Polygon
        const fromStr = from.toISOString().slice(0, 10);
        const toStr = to.toISOString().slice(0, 10);
        return await polygon.getAggregates(symbol, 1, "day", fromStr, toStr);
      }
    },

    // Get news from all sources
    async getNews(symbol?: string): Promise<NewsItem[]> {
      const allNews: NewsItem[] = [];

      // Yahoo news (returns search result with news array)
      if (symbol) {
        try {
          const yahooResult = await yahoo.getNews(symbol);
          if (yahooResult && "news" in yahooResult && Array.isArray(yahooResult.news)) {
            for (const item of yahooResult.news) {
              allNews.push({
                id: item.uuid || "",
                symbol,
                headline: item.title || "",
                summary: "",
                source: item.publisher || "",
                url: item.link || "",
                publishedAt: item.providerPublishTime?.toISOString() || "",
              });
            }
          }
        } catch {
          // Skip failed source
        }
      }

      // Finnhub news
      if (symbol) {
        try {
          const to = new Date().toISOString().slice(0, 10);
          const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const fhNews = await finnhub.getNews(symbol, from, to);
          allNews.push(...fhNews);
        } catch {
          // Skip failed source
        }
      } else {
        try {
          const fhNews = await finnhub.getMarketNews();
          allNews.push(...fhNews);
        } catch {
          // Skip failed source
        }
      }

      // Polygon news
      try {
        const pgNews = await polygon.getNews(symbol, 10);
        allNews.push(...pgNews);
      } catch {
        // Skip failed source
      }

      // Dedupe by headline
      const seen = new Set<string>();
      return allNews.filter((n) => {
        if (seen.has(n.headline)) return false;
        seen.add(n.headline);
        return true;
      });
    },

    // Get movers
    async getMovers(direction: "gainers" | "losers"): Promise<
      Array<{
        ticker: string;
        todaysChange?: number;
        todaysChangePerc?: number;
      }>
    > {
      try {
        // Try Polygon first
        const pgMovers = await polygon.getGainersLosers(direction);
        if (pgMovers.length > 0) {
          return pgMovers.map((m) => ({
            ticker: m.ticker,
            todaysChange: m.todaysChange,
            todaysChangePerc: m.todaysChangePerc,
          }));
        }
      } catch {
        // Fall through to Finviz
      }

      // Fall back to Finviz
      try {
        const fvMovers =
          direction === "gainers" ? await finviz.getGainers() : await finviz.getLosers();
        return fvMovers.map((m) => ({
          ticker: m.symbol,
          todaysChangePerc: m.changePercent,
        }));
      } catch {
        return [];
      }
    },

    // Get sentiment data
    async getSentiment(symbol: string): Promise<SentimentData> {
      const results: SentimentData = {};

      try {
        results.finnhub = await finnhub.getNewsSentiment(symbol);
      } catch {
        // Skip failed source
      }

      try {
        results.social = await finnhub.getSocialSentiment(symbol);
      } catch {
        // Skip failed source
      }

      return results;
    },

    // Get macro/economic data
    async getMacro() {
      return await fred.getMacroSnapshot();
    },

    // Get recommendations/ratings
    async getRecommendations(symbol: string): Promise<unknown[]> {
      try {
        return await finnhub.getRecommendations(symbol);
      } catch {
        return [];
      }
    },

    // Get earnings calendar
    async getEarningsCalendar(days = 7): Promise<unknown[]> {
      const from = new Date().toISOString().slice(0, 10);
      const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      try {
        return await finnhub.getEarningsCalendar(from, to);
      } catch {
        return [];
      }
    },

    // Provider status
    getProviderStatus() {
      return {
        yahoo: { configured: true, rateLimit: "none" },
        polygon: { configured: polygon.isConfigured(), rateLimit: "5/min" },
        finnhub: { configured: finnhub.isConfigured(), rateLimit: "60/min" },
        fred: { configured: fred.isConfigured(), rateLimit: "none" },
        finviz: { configured: true, rateLimit: "web scraping" },
      };
    },

    async healthCheck(): Promise<ProviderHealthStatus> {
      const testSymbol = "AAPL";
      const healthCheckTimeoutMs = 3000;

      const check = async (fn: () => Promise<unknown>): Promise<ProviderHealth> => {
        const start = Date.now();
        try {
          await withTimeout(fn(), healthCheckTimeoutMs);
          return { healthy: true, latencyMs: Date.now() - start };
        } catch (err) {
          return {
            healthy: false,
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      };

      const [yahooHealth, polygonHealth, finnhubHealth, fredHealth, finvizHealth] =
        await Promise.all([
          check(() => yahoo.getQuote(testSymbol)),
          polygon.isConfigured()
            ? check(() => polygon.getPreviousClose(testSymbol))
            : Promise.resolve({ healthy: false, error: "Not configured" } satisfies ProviderHealth),
          finnhub.isConfigured()
            ? check(() => finnhub.getQuote(testSymbol))
            : Promise.resolve({ healthy: false, error: "Not configured" } satisfies ProviderHealth),
          fred.isConfigured()
            ? check(() => fred.getSeries("SP500", 1))
            : Promise.resolve({ healthy: false, error: "Not configured" } satisfies ProviderHealth),
          check(() => finviz.getQuote(testSymbol)),
        ]);

      const providers = {
        yahoo: yahooHealth,
        polygon: polygonHealth,
        finnhub: finnhubHealth,
        fred: fredHealth,
        finviz: finvizHealth,
      };

      const healthyCount = Object.values(providers).filter((p) => p.healthy).length;
      const status = healthyCount >= 2 ? "healthy" : healthyCount >= 1 ? "degraded" : "unhealthy";

      return {
        status,
        providers,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

export const unified = createUnified();

export interface ProviderHealth {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ProviderHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  providers: Record<string, ProviderHealth>;
  timestamp: string;
}
