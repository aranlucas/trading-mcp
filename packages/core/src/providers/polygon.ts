// Polygon.io provider - Free tier: 5 API calls/min
// Using direct fetch for better type control

import { z } from "zod";
import type { Quote, NewsItem } from "../types/index.js";
import {
  PolygonAggregatesResponseSchema,
  PolygonNewsResponseSchema,
  PolygonSnapshotResponseSchema,
  PolygonTickerDetailsResponseSchema,
  PolygonMarketStatusResponseSchema,
  PolygonSplitsResponseSchema,
  PolygonDividendsResponseSchema,
  PolygonRelatedResponseSchema,
  type PolygonTickerDetails,
  type PolygonSplit,
  type PolygonDividend,
  type PolygonRelatedCompany,
  type Bar,
  type PolygonTickerSnapshot,
} from "../schemas/index.js";

const apiKey = process.env.POLYGON_API_KEY || "";

const BASE_URL = "https://api.polygon.io";

async function polygonFetch<T>(endpoint: string, schema: z.ZodType<T>): Promise<T | null> {
  if (!apiKey) return null;

  try {
    const url = `${BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}apiKey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) return null;

    return schema.parse(await response.json());
  } catch {
    return null;
  }
}

export const polygon = {
  name: "polygon" as const,

  isConfigured(): boolean {
    return !!apiKey;
  },

  // Get previous day close
  async getPreviousClose(symbol: string): Promise<Quote | null> {
    const raw = await polygonFetch(
      `/v2/aggs/ticker/${symbol}/prev`,
      PolygonAggregatesResponseSchema,
    );

    if (!raw) return null;

    const result = PolygonAggregatesResponseSchema.safeParse(raw);

    if (!result.success || !result.data.results?.[0]) return null;

    const bar = result.data.results[0];

    return {
      symbol: bar.T ?? symbol,
      price: bar.c ?? 0,
      open: bar.o ?? 0,
      high: bar.h ?? 0,
      low: bar.l ?? 0,
      close: bar.c ?? 0,
      volume: bar.v ?? 0,
      change: 0,
      changePercent: 0,
      timestamp: new Date(bar.t ?? 0).toISOString(),
    };
  },

  // Get aggregates (OHLCV bars)
  async getAggregates(
    symbol: string,
    multiplier: number,
    timespan: "minute" | "hour" | "day" | "week" | "month",
    from: string,
    to: string,
  ): Promise<Bar[]> {
    const raw = await polygonFetch(
      `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`,
      PolygonAggregatesResponseSchema,
    );

    if (!raw) return [];

    const result = PolygonAggregatesResponseSchema.safeParse(raw);

    if (!result.success) return [];

    return (result.data.results ?? []).map((bar) => ({
      t: new Date(bar.t ?? 0).toISOString(),
      o: bar.o ?? 0,
      h: bar.h ?? 0,
      l: bar.l ?? 0,
      c: bar.c ?? 0,
      v: bar.v ?? 0,
    }));
  },

  // Get ticker details
  async getTickerDetails(symbol: string): Promise<PolygonTickerDetails | null> {
    const raw = await polygonFetch(
      `/v3/reference/tickers/${symbol}`,
      PolygonTickerDetailsResponseSchema,
    );

    if (!raw) return null;

    const result = PolygonTickerDetailsResponseSchema.safeParse(raw);

    return result.success ? (result.data.results ?? null) : null;
  },

  // Get news
  async getNews(symbol?: string, limit = 10): Promise<NewsItem[]> {
    const tickerParam = symbol ? `&ticker=${symbol}` : "";

    const raw = await polygonFetch(
      `/v2/reference/news?limit=${limit}${tickerParam}`,
      PolygonNewsResponseSchema,
    );

    if (!raw) return [];

    const result = PolygonNewsResponseSchema.safeParse(raw);

    if (!result.success) return [];

    return (result.data.results ?? []).map((n) => ({
      id: n.id ?? "",
      symbol: n.tickers?.[0] ?? symbol ?? "",
      headline: n.title ?? "",
      summary: n.description ?? "",
      source: n.publisher?.name ?? "",
      url: n.article_url ?? "",
      publishedAt: n.published_utc ?? "",
      sentiment: n.insights?.[0]?.sentiment,
    }));
  },

  // Get market status
  async getMarketStatus(): Promise<z.infer<typeof PolygonMarketStatusResponseSchema> | null> {
    const raw = await polygonFetch(`/v1/marketstatus/now`, PolygonMarketStatusResponseSchema);

    if (!raw) return null;

    const result = PolygonMarketStatusResponseSchema.safeParse(raw);

    return result.success ? result.data : null;
  },

  // Get stock splits
  async getSplits(symbol: string): Promise<PolygonSplit[]> {
    const raw = await polygonFetch(
      `/v3/reference/splits?ticker=${symbol}`,
      PolygonSplitsResponseSchema,
    );

    if (!raw) return [];

    const result = PolygonSplitsResponseSchema.safeParse(raw);

    return result.success ? (result.data.results ?? []) : [];
  },

  // Get dividends
  async getDividends(symbol: string): Promise<PolygonDividend[]> {
    const raw = await polygonFetch(
      `/v3/reference/dividends?ticker=${symbol}`,
      PolygonDividendsResponseSchema,
    );

    if (!raw) return [];

    const result = PolygonDividendsResponseSchema.safeParse(raw);

    return result.success ? (result.data.results ?? []) : [];
  },

  // Get snapshot (all tickers)
  async getAllTickersSnapshot(): Promise<PolygonTickerSnapshot[]> {
    const raw = await polygonFetch(
      `/v2/snapshot/locale/us/markets/stocks/tickers`,
      PolygonSnapshotResponseSchema,
    );

    if (!raw) return [];

    const result = PolygonSnapshotResponseSchema.safeParse(raw);

    return result.success ? (result.data.tickers ?? []) : [];
  },

  // Get gainers/losers
  async getGainersLosers(direction: "gainers" | "losers"): Promise<PolygonTickerSnapshot[]> {
    const raw = await polygonFetch(
      `/v2/snapshot/locale/us/markets/stocks/${direction}`,
      PolygonSnapshotResponseSchema,
    );

    if (!raw) return [];

    const result = PolygonSnapshotResponseSchema.safeParse(raw);

    return result.success ? (result.data.tickers ?? []) : [];
  },

  // Get ticker snapshot
  async getTickerSnapshot(symbol: string): Promise<PolygonTickerSnapshot | null> {
    const raw = await polygonFetch(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`,
      PolygonSnapshotResponseSchema,
    );

    if (!raw) return null;

    const result = PolygonSnapshotResponseSchema.safeParse(raw);

    return result.success ? (result.data.ticker ?? null) : null;
  },

  // Get related companies
  async getRelatedCompanies(symbol: string): Promise<PolygonRelatedCompany[]> {
    const raw = await polygonFetch(`/v1/related-companies/${symbol}`, PolygonRelatedResponseSchema);

    if (!raw) return [];

    const result = PolygonRelatedResponseSchema.safeParse(raw);

    return result.success ? (result.data.results ?? []) : [];
  },
};
