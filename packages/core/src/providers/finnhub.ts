import { z } from "zod";
import type { Quote, NewsItem, Signal } from "../types/index.js";
import {
  FinnhubQuoteSchema,
  FinnhubNewsArticleSchema,
  FinnhubPatternResponseSchema,
  FinnhubEarningsResponseSchema,
  FinnhubInsiderResponseSchema,
} from "../schemas/index.js";
import * as finnhub from "finnhub";

const apiKey = process.env.FINNHUB_API_KEY || "";

// Configure clientb
const client = new finnhub.DefaultApi(apiKey);

// Promisify callback-based API
function promisify<T>(
  fn: (callback: (err: Error | null, data: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

export const finnhubProvider = {
  name: "finnhub" as const,

  isConfigured(): boolean {
    return !!apiKey;
  },

  // Get quote
  async getQuote(symbol: string): Promise<Quote | null> {
    if (!apiKey) return null;
    try {
      const raw = await promisify<unknown>((cb) => client.quote(symbol, cb));
      const data = FinnhubQuoteSchema.parse(raw);
      return {
        symbol,
        price: data.c ?? 0,
        open: data.o ?? 0,
        high: data.h ?? 0,
        low: data.l ?? 0,
        close: data.pc ?? 0,
        volume: 0,
        change: data.d ?? 0,
        changePercent: data.dp ?? 0,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  // Get company profile
  async getCompanyProfile(symbol: string): Promise<unknown> {
    if (!apiKey) return null;
    try {
      return await promisify<unknown>((cb) =>
        client.companyProfile2({ symbol }, cb),
      );
    } catch {
      return null;
    }
  },

  // Get company news
  async getNews(symbol: string, from: string, to: string): Promise<NewsItem[]> {
    if (!apiKey) return [];
    try {
      const raw = await promisify<unknown[]>((cb) =>
        client.companyNews(symbol, from, to, cb),
      );
      const articles = z.array(FinnhubNewsArticleSchema).safeParse(raw);
      if (!articles.success) return [];

      return articles.data.map((n) => ({
        id: String(n.id),
        symbol,
        headline: n.headline ?? "",
        summary: n.summary ?? "",
        source: n.source ?? "",
        url: n.url ?? "",
        publishedAt: n.datetime
          ? new Date(n.datetime * 1000).toISOString()
          : "",
        sentiment: undefined,
      }));
    } catch {
      return [];
    }
  },

  // Get market news (general)
  async getMarketNews(category = "general"): Promise<NewsItem[]> {
    if (!apiKey) return [];
    try {
      const raw = await promisify<unknown[]>((cb) =>
        client.marketNews(category, {}, cb),
      );
      const articles = z.array(FinnhubNewsArticleSchema).safeParse(raw);
      if (!articles.success) return [];

      return articles.data.map((n) => ({
        id: String(n.id),
        headline: n.headline ?? "",
        summary: n.summary ?? "",
        source: n.source ?? "",
        url: n.url ?? "",
        publishedAt: n.datetime
          ? new Date(n.datetime * 1000).toISOString()
          : "",
      }));
    } catch {
      return [];
    }
  },

  // Get news sentiment
  async getNewsSentiment(symbol: string): Promise<unknown> {
    if (!apiKey) return null;
    try {
      return await promisify<unknown>((cb) => client.newsSentiment(symbol, cb));
    } catch {
      return null;
    }
  },

  // Get recommendation trends
  async getRecommendations(symbol: string): Promise<unknown[]> {
    if (!apiKey) return [];
    try {
      const raw = await promisify<unknown[]>((cb) =>
        client.recommendationTrends(symbol, cb),
      );
      return raw ?? [];
    } catch {
      return [];
    }
  },

  // Get price target
  async getPriceTarget(symbol: string): Promise<unknown> {
    if (!apiKey) return null;
    try {
      return await promisify<unknown>((cb) => client.priceTarget(symbol, cb));
    } catch {
      return null;
    }
  },

  // Get earnings calendar
  async getEarningsCalendar(from: string, to: string): Promise<unknown[]> {
    if (!apiKey) return [];
    try {
      const raw = await promisify<unknown>((cb) =>
        client.earningsCalendar({ from, to }, cb),
      );
      const result = FinnhubEarningsResponseSchema.safeParse(raw);
      return result.success ? (result.data.earningsCalendar ?? []) : [];
    } catch {
      return [];
    }
  },

  // Get insider transactions
  async getInsiderTransactions(symbol: string): Promise<unknown[]> {
    if (!apiKey) return [];
    try {
      const raw = await promisify<unknown>((cb) =>
        client.insiderTransactions(symbol, {}, cb),
      );
      const result = FinnhubInsiderResponseSchema.safeParse(raw);
      return result.success ? (result.data.data ?? []) : [];
    } catch {
      return [];
    }
  },

  // Get peers (similar companies)
  async getPeers(symbol: string): Promise<string[]> {
    if (!apiKey) return [];
    try {
      const raw = await promisify<string[]>((cb) =>
        client.companyPeers(symbol, cb),
      );
      return z.array(z.string()).parse(raw);
    } catch {
      return [];
    }
  },

  // Get basic financials
  async getBasicFinancials(symbol: string): Promise<unknown> {
    if (!apiKey) return null;
    try {
      return await promisify<unknown>((cb) =>
        client.companyBasicFinancials(symbol, "all", cb),
      );
    } catch {
      return null;
    }
  },

  // Get pattern recognition (technical)
  async getPatternRecognition(
    symbol: string,
    resolution: string,
  ): Promise<Signal[]> {
    if (!apiKey) return [];
    try {
      const raw = await promisify<unknown>((cb) =>
        client.patternRecognition(symbol, resolution, cb),
      );
      const result = FinnhubPatternResponseSchema.safeParse(raw);
      if (!result.success) return [];

      return (result.data.points ?? []).map((p) => ({
        symbol,
        type: p.patternname ?? "PATTERN",
        direction: p.patterntype === "bullish" ? "bullish" : "bearish",
        strength: 0.5,
        timestamp: new Date().toISOString(),
        description: `${p.patternname ?? "Unknown"} pattern detected`,
      }));
    } catch {
      return [];
    }
  },

  // Get support/resistance levels
  async getSupportResistance(
    symbol: string,
    resolution: string,
  ): Promise<unknown> {
    if (!apiKey) return null;
    try {
      return await promisify<unknown>((cb) =>
        client.supportResistance(symbol, resolution, cb),
      );
    } catch {
      return null;
    }
  },

  // Get social sentiment
  async getSocialSentiment(symbol: string): Promise<unknown> {
    if (!apiKey) return null;
    try {
      return await promisify<unknown>((cb) =>
        client.socialSentiment(symbol, {}, cb),
      );
    } catch {
      return null;
    }
  },
};
