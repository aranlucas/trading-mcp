// Yahoo Finance provider - FREE, no API key needed

import YahooFinance from "yahoo-finance2";
import { YahooQuoteSchema } from "../schemas/index.js";
import type { Quote } from "../types/index.js";
import { parseQuote, quoteChange, QuoteSchema } from "../lib/quote.js";

type StockScreenQuery = {
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  sector?: string;
};

// Instantiate the client (required in v3)
export const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const YahooSnapshotSchema = YahooQuoteSchema.extend({
  regularMarketPrice: QuoteSchema.shape.price,
});

export const yahoo = {
  name: "yahoo" as const,

  // Get the provider's quote snapshot (returns the raw Yahoo Finance result).
  async getQuote(symbol: string) {
    const quote = await yahooFinance.quote(symbol);

    return quote;
  },

  // Normalize the provider's market snapshot without implying a live tick or fresh timestamp.
  async getQuoteNormalized(symbol: string): Promise<Quote> {
    return normalizeYahooQuote(await yahooFinance.quote(symbol), symbol);
  },

  // Get multiple quotes (returns raw yahoofinance result)
  async getQuotes(symbols: string[]) {
    const quotes = await yahooFinance.quote(symbols);

    return quotes;
  },

  // Get historical data (returns raw yahoofinance result)
  async getHistory(symbol: string, period1: Date, period2: Date = new Date()) {
    const history = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: "1d",
    });

    return history;
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
    const options = await yahooFinance.options(symbol, { date: new Date(expiration) });

    return options;
  },

  // Search symbols (returns raw yahoofinance result)
  async search(query: string) {
    const results = await yahooFinance.search(query);

    return results;
  },

  // Get trending tickers - returns quotes array
  async getTrending(count = 10) {
    const result = await yahooFinance.trendingSymbols("US", { count });

    return result.quotes ?? [];
  },

  // Get company insights/summary (returns raw yahoofinance result)
  async getInsights(symbol: string) {
    const insights = await yahooFinance.quoteSummary(symbol, {
      modules: ["summaryProfile", "financialData", "recommendationTrend", "earnings"],
    });

    return insights;
  },

  // Get news (returns raw yahoofinance result)
  async getNews(symbol?: string) {
    if (symbol) {
      const results = await yahooFinance.search(symbol, { newsCount: 10 });

      return results;
    }

    // If no symbol provided, return empty array (SDK has no global news method)
    return [];
  },

  // Get gainers/losers (returns raw yahoofinance result)
  getMovers(type: "gainers" | "losers" | "most_actives") {
    try {
      if (type === "losers") {
        return Promise.resolve(yahooFinance.dailyLosers());
      }

      // SDK doesn't expose a `mostActive()` method in types; fall back to dailyGainers
      if (type === "most_actives") {
        return Promise.resolve(yahooFinance.dailyGainers());
      }

      return Promise.resolve(yahooFinance.dailyGainers());
    } catch {
      return Promise.resolve([]);
    }
  },

  // Screen stocks (returns raw yahoofinance result)
  async screen(_query: StockScreenQuery) {
    try {
      return await yahooFinance.screener({ scrIds: "day_gainers" });
    } catch {
      return [];
    }
  },
};

// Yahoo response payloads are untrusted and are parsed by YahooQuoteSchema at this boundary.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function normalizeYahooQuote(raw: unknown, symbol?: string): Quote {
  const parsed = YahooSnapshotSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("Invalid Yahoo quote response");
  }

  const q = parsed.data;

  const changes = quoteChange(q.regularMarketPrice, q.regularMarketPreviousClose);

  return parseQuote(
    {
      symbol: q.symbol,
      price: q.regularMarketPrice,
      open: q.regularMarketOpen,
      high: q.regularMarketDayHigh,
      low: q.regularMarketDayLow,
      close: q.regularMarketPreviousClose,
      volume: q.regularMarketVolume,
      change: q.regularMarketChange ?? changes.change,
      changePercent: q.regularMarketChangePercent ?? changes.changePercent,
      timestamp: q.regularMarketTime,
      source: "yahoo",
      kind: "market_snapshot",
      retrievedAt: new Date().toISOString(),
    },
    symbol ?? q.symbol,
  );
}
