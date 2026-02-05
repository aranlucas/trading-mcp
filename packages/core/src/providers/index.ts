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
import type { NewsItem, SentimentData } from "../types/index.js";

// Unified data fetcher that tries multiple sources
export const unified = {
  // Get quote - tries Yahoo first (free), falls back to others
  async getQuote(symbol: string) {
    try {
      return await yahoo.getQuote(symbol);
    } catch {
      // Try Finnhub
      const fhQuote = await finnhub.getQuote(symbol);
      if (fhQuote) return fhQuote;

      // Try Polygon
      const pgQuote = await polygon.getPreviousClose(symbol);
      if (pgQuote) return pgQuote;

      // Try Finviz
      const fvQuote = await finviz.getQuote(symbol);
      if (fvQuote) return fvQuote;

      throw new Error(`Could not get quote for ${symbol}`);
    }
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

  /**
   * Health check for all providers.
   * Tests each configured provider with a quick request and returns health status.
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const testSymbol = "AAPL";
    const healthCheckTimeout = 3000; // 3 seconds

    const checkProvider = async (
      name: string,
      fn: () => Promise<unknown>,
    ): Promise<ProviderHealth> => {
      const start = Date.now();
      try {
        await withTimeout(fn(), healthCheckTimeout);
        return {
          healthy: true,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    };

    const [yahooHealth, polygonHealth, finnhubHealth, fredHealth, finvizHealth] = await Promise.all(
      [
        checkProvider("yahoo", () => yahoo.getQuote(testSymbol)),
        polygon.isConfigured()
          ? checkProvider("polygon", () => polygon.getPreviousClose(testSymbol))
          : Promise.resolve({ healthy: false, error: "Not configured" } as ProviderHealth),
        finnhub.isConfigured()
          ? checkProvider("finnhub", () => finnhub.getQuote(testSymbol))
          : Promise.resolve({ healthy: false, error: "Not configured" } as ProviderHealth),
        fred.isConfigured()
          ? checkProvider("fred", () => fred.getSeries("SP500", 1))
          : Promise.resolve({ healthy: false, error: "Not configured" } as ProviderHealth),
        checkProvider("finviz", () => finviz.getQuote(testSymbol)),
      ],
    );

    const providers = {
      yahoo: yahooHealth,
      polygon: polygonHealth,
      finnhub: finnhubHealth,
      fred: fredHealth,
      finviz: finvizHealth,
    };

    const healthyCount = Object.values(providers).filter((p) => p.healthy).length;

    return {
      status: healthyCount >= 2 ? "healthy" : healthyCount >= 1 ? "degraded" : "unhealthy",
      providers,
      timestamp: new Date().toISOString(),
    };
  },
};

// Types for health check
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
