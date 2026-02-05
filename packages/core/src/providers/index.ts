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
};
