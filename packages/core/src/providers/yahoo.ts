// Yahoo Finance provider - FREE, no API key needed

import YahooFinance from "yahoo-finance2";
import { YahooQuoteSchema } from "../schemas/index.js";
import type { Quote } from "../types/index.js";

// Instantiate the client (required in v3)
export const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

export const yahoo = {
  name: "yahoo" as const,

  // Get real-time quote (returns raw yahoofinance result)
  async getQuote(symbol: string) {
    return await yahooFinance.quote(symbol);
  },

  // Get real-time quote normalized into the core `Quote` shape
  async getQuoteNormalized(symbol: string): Promise<Quote> {
    return normalizeYahooQuote(await yahooFinance.quote(symbol), symbol);
  },

  // Get multiple quotes (returns raw yahoofinance result)
  async getQuotes(symbols: string[]) {
    return await yahooFinance.quote(symbols);
  },

  // Get historical data (returns raw yahoofinance result)
  async getHistory(symbol: string, period1: Date, period2: Date = new Date()) {
    return await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: "1d",
    });
  },

  // Get options chain - flattens the structure for easier use
  async getOptions(symbol: string) {
    const result = await yahooFinance.options(symbol);
    // Flatten options array into calls/puts for easier access
    const calls = result.options?.flatMap((o) => o.calls ?? []) ?? [];
    const puts = result.options?.flatMap((o) => o.puts ?? []) ?? [];

    return {
      expirationDates: result.expirationDates,
      calls,
      puts,
    };
  },

  // Get options for specific expiration (returns raw yahoofinance result)
  async getOptionsForExpiration(symbol: string, expiration: string) {
    return await yahooFinance.options(symbol, { date: new Date(expiration) });
  },

  // Search symbols (returns raw yahoofinance result)
  async search(query: string) {
    return await yahooFinance.search(query);
  },

  // Get trending tickers - returns quotes array
  async getTrending(count = 10) {
    const result = await yahooFinance.trendingSymbols("US", { count });

    return result.quotes ?? [];
  },

  // Get company insights/summary (returns raw yahoofinance result)
  async getInsights(symbol: string) {
    return await yahooFinance.quoteSummary(symbol, {
      modules: ["summaryProfile", "financialData", "recommendationTrend", "earnings"],
    });
  },

  // Get news (returns raw yahoofinance result)
  async getNews(symbol?: string) {
    if (symbol) {
      return await yahooFinance.search(symbol, { newsCount: 10 });
    }

    // If no symbol provided, return empty array (SDK has no global news method)
    return [];
  },

  // Get gainers/losers (returns raw yahoofinance result)
  async getMovers(type: "gainers" | "losers" | "most_actives") {
    try {
      if (type === "losers") return yahooFinance.dailyLosers();

      // SDK doesn't expose a `mostActive()` method in types; fall back to dailyGainers
      if (type === "most_actives") return yahooFinance.dailyGainers();

      return await yahooFinance.dailyGainers();
    } catch {
      return [];
    }
  },

  // Screen stocks (returns raw yahoofinance result)
  async screen(_query: {
    minPrice?: number;
    maxPrice?: number;
    minVolume?: number;
    sector?: string;
  }) {
    try {
      return await yahooFinance.screener({ scrIds: "day_gainers" });
    } catch {
      return [];
    }
  },
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Untrusted Yahoo payload boundary; the schema establishes the quote contract before any field access.
export function normalizeYahooQuote(raw: unknown, symbol: string): Quote {
  const parsed = YahooQuoteSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("Invalid Yahoo quote response");
  }

  const q = parsed.data;

  return {
    symbol: (q.symbol ?? symbol).toUpperCase(),
    price: q.regularMarketPrice ?? 0,
    open: q.regularMarketOpen ?? 0,
    high: q.regularMarketDayHigh ?? 0,
    low: q.regularMarketDayLow ?? 0,
    close: q.regularMarketPreviousClose ?? q.regularMarketPrice ?? 0,
    volume: q.regularMarketVolume ?? 0,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    timestamp: new Date().toISOString(),
  };
}
