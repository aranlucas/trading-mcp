import { z } from "zod";
import type { Quote, NewsItem, Signal } from "../types/index.js";
import {
  FinnhubCompanyProfileSchema,
  type FinnhubCompanyProfile,
  FinnhubNewsSentimentSchema,
  type FinnhubNewsSentiment,
  FinnhubRecommendationSchema,
  type FinnhubRecommendation,
  FinnhubPriceTargetSchema,
  type FinnhubPriceTarget,
  FinnhubBasicFinancialsSchema,
  type FinnhubBasicFinancials,
  FinnhubSupportResistanceSchema,
  type FinnhubSupportResistance,
  FinnhubSocialSentimentSchema,
  type FinnhubSocialSentiment,
  type FinnhubEarning,
  type FinnhubInsiderTransaction,
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

// Finnhub has no TypeScript response contract. Validate at the callback boundary.
function promisify<T>(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Untrusted SDK callback data is parsed by the supplied endpoint schema before resolution.
  fn: (callback: (err: Error | null, data?: unknown) => void) => void,
  schema: z.ZodType<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, data) => {
      if (err) reject(err);
      else if (data === undefined) reject(new Error("Finnhub callback returned no data"));
      else {
        const parsed = schema.safeParse(data);

        if (parsed.success) resolve(parsed.data);
        else reject(parsed.error);
      }
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
      const raw = await promisify((cb) => client.quote(symbol, cb), FinnhubQuoteSchema);
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
  async getCompanyProfile(symbol: string): Promise<FinnhubCompanyProfile | null> {
    if (!apiKey) return null;

    try {
      return await promisify(
        (cb) => client.companyProfile2({ symbol }, cb),
        FinnhubCompanyProfileSchema,
      );
    } catch {
      return null;
    }
  },

  // Get company news
  async getNews(symbol: string, from: string, to: string): Promise<NewsItem[]> {
    if (!apiKey) return [];

    try {
      const raw = await promisify(
        (cb) => client.companyNews(symbol, from, to, cb),
        z.array(FinnhubNewsArticleSchema),
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
        publishedAt: n.datetime ? new Date(n.datetime * 1000).toISOString() : "",
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
      const raw = await promisify(
        (cb) => client.marketNews(category, {}, cb),
        z.array(FinnhubNewsArticleSchema),
      );

      const articles = z.array(FinnhubNewsArticleSchema).safeParse(raw);

      if (!articles.success) return [];

      return articles.data.map((n) => ({
        id: String(n.id),
        headline: n.headline ?? "",
        summary: n.summary ?? "",
        source: n.source ?? "",
        url: n.url ?? "",
        publishedAt: n.datetime ? new Date(n.datetime * 1000).toISOString() : "",
      }));
    } catch {
      return [];
    }
  },

  // Get news sentiment
  async getNewsSentiment(symbol: string): Promise<FinnhubNewsSentiment | null> {
    if (!apiKey) return null;

    try {
      return await promisify((cb) => client.newsSentiment(symbol, cb), FinnhubNewsSentimentSchema);
    } catch {
      return null;
    }
  },

  // Get recommendation trends
  async getRecommendations(symbol: string): Promise<FinnhubRecommendation[]> {
    if (!apiKey) return [];

    try {
      const raw = await promisify(
        (cb) => client.recommendationTrends(symbol, cb),
        z.array(FinnhubRecommendationSchema),
      );

      return raw ?? [];
    } catch {
      return [];
    }
  },

  // Get price target
  async getPriceTarget(symbol: string): Promise<FinnhubPriceTarget | null> {
    if (!apiKey) return null;

    try {
      return await promisify((cb) => client.priceTarget(symbol, cb), FinnhubPriceTargetSchema);
    } catch {
      return null;
    }
  },

  // Get earnings calendar
  async getEarningsCalendar(from: string, to: string): Promise<FinnhubEarning[]> {
    if (!apiKey) return [];

    try {
      const raw = await promisify(
        (cb) => client.earningsCalendar({ from, to }, cb),
        FinnhubEarningsResponseSchema,
      );

      const result = FinnhubEarningsResponseSchema.safeParse(raw);

      return result.success ? (result.data.earningsCalendar ?? []) : [];
    } catch {
      return [];
    }
  },

  // Get insider transactions
  async getInsiderTransactions(symbol: string): Promise<FinnhubInsiderTransaction[]> {
    if (!apiKey) return [];

    try {
      const raw = await promisify(
        (cb) => client.insiderTransactions(symbol, {}, cb),
        FinnhubInsiderResponseSchema,
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
      const raw = await promisify((cb) => client.companyPeers(symbol, cb), z.array(z.string()));

      return z.array(z.string()).parse(raw);
    } catch {
      return [];
    }
  },

  // Get basic financials
  async getBasicFinancials(symbol: string): Promise<FinnhubBasicFinancials | null> {
    if (!apiKey) return null;

    try {
      return await promisify(
        (cb) => client.companyBasicFinancials(symbol, "all", cb),
        FinnhubBasicFinancialsSchema,
      );
    } catch {
      return null;
    }
  },

  // Get pattern recognition (technical)
  async getPatternRecognition(symbol: string, resolution: string): Promise<Signal[]> {
    if (!apiKey) return [];

    try {
      const raw = await promisify(
        (cb) => client.patternRecognition(symbol, resolution, cb),
        FinnhubPatternResponseSchema,
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
  ): Promise<FinnhubSupportResistance | null> {
    if (!apiKey) return null;

    try {
      return await promisify(
        (cb) => client.supportResistance(symbol, resolution, cb),
        FinnhubSupportResistanceSchema,
      );
    } catch {
      return null;
    }
  },

  // Get social sentiment
  async getSocialSentiment(symbol: string): Promise<FinnhubSocialSentiment | null> {
    if (!apiKey) return null;

    try {
      return await promisify(
        (cb) => client.socialSentiment(symbol, {}, cb),
        FinnhubSocialSentimentSchema,
      );
    } catch {
      return null;
    }
  },
};
