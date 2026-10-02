import { z } from "zod";
import { alpaca, yahoo, type Quote } from "@trading/core";

export type ScreenerProvider = "alpaca" | "yahoo";

export interface MarketDataClient {
  getSnapshots(symbols: string[]): Promise<Map<string, Quote>>;
  getBars(
    symbol: string,
    limit: number,
  ): Promise<Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>>;
}

const YahooQuoteSchema = z.object({
  symbol: z.string(),
  regularMarketPrice: z.number().optional(),
  regularMarketOpen: z.number().optional(),
  regularMarketDayHigh: z.number().optional(),
  regularMarketDayLow: z.number().optional(),
  regularMarketPreviousClose: z.number().optional(),
  regularMarketVolume: z.number().optional(),
  regularMarketChange: z.number().optional(),
  regularMarketChangePercent: z.number().optional(),
  regularMarketTime: z.union([z.number(), z.date()]).optional(),
});

function toIsoTimestamp(input: unknown): string {
  if (input instanceof Date) return input.toISOString();
  if (typeof input === "number") {
    // Yahoo sometimes uses epoch seconds.
    const ms = input > 10_000_000_000 ? input : input * 1000;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function toIsoDate(input: unknown): string | null {
  try {
    if (input instanceof Date) return input.toISOString();
    if (typeof input === "number") {
      const ms = input > 10_000_000_000 ? input : input * 1000;
      return new Date(ms).toISOString();
    }
    if (typeof input === "string") {
      const d = new Date(input);
      if (!Number.isFinite(d.getTime())) return null;
      return d.toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

function clampNumber(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

class AlpacaMarketDataClient implements MarketDataClient {
  async getSnapshots(symbols: string[]): Promise<Map<string, Quote>> {
    return await alpaca.getSnapshots(symbols);
  }

  async getBars(
    symbol: string,
    limit: number,
  ): Promise<Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>> {
    return await alpaca.getBars(symbol, "1Day", limit);
  }
}

const YahooChartSchema = z.object({
  quotes: z
    .array(
      z.object({
        date: z.union([z.date(), z.number(), z.string()]),
        open: z.number().nullable().optional(),
        high: z.number().nullable().optional(),
        low: z.number().nullable().optional(),
        close: z.number().nullable().optional(),
        volume: z.number().nullable().optional(),
      }),
    )
    .optional(),
});

class YahooMarketDataClient implements MarketDataClient {
  async getSnapshots(symbols: string[]): Promise<Map<string, Quote>> {
    const results = new Map<string, Quote>();
    if (symbols.length === 0) return results;

    let list: unknown[];
    try {
      const raw = (await yahoo.getQuotes(symbols)) as unknown;
      list = Array.isArray(raw) ? raw : [raw];
    } catch {
      const settled = await Promise.allSettled(
        symbols.map(async (s) => (await yahoo.getQuote(s)) as unknown),
      );
      list = settled
        .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled")
        .map((r) => r.value);
    }

    for (const item of list) {
      const parsed = YahooQuoteSchema.safeParse(item);
      if (!parsed.success) continue;

      const q = parsed.data;
      const price = clampNumber(q.regularMarketPrice);
      const prevClose = clampNumber(q.regularMarketPreviousClose, price);
      const open = clampNumber(q.regularMarketOpen, prevClose);
      const change = clampNumber(q.regularMarketChange, price - prevClose);
      const changePercent = clampNumber(
        q.regularMarketChangePercent,
        prevClose !== 0 ? (change / prevClose) * 100 : 0,
      );

      results.set(q.symbol.toUpperCase(), {
        symbol: q.symbol.toUpperCase(),
        price,
        open,
        high: clampNumber(q.regularMarketDayHigh, price),
        low: clampNumber(q.regularMarketDayLow, price),
        close: prevClose,
        volume: clampNumber(q.regularMarketVolume),
        change,
        changePercent,
        timestamp: toIsoTimestamp(q.regularMarketTime),
      });
    }

    return results;
  }

  async getBars(
    symbol: string,
    limit: number,
  ): Promise<Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>> {
    if (!Number.isInteger(limit) || limit < 1) return [];
    // `limit` counts observations, not calendar days. Allow for weekends and
    // holidays; newly listed/suspended symbols can still return fewer bars.
    const days = Math.min(Math.ceil((limit * 7) / 5) + 14, 3650);
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    const raw = (await yahoo.getHistory(symbol, period1)) as unknown;
    const parsed = YahooChartSchema.safeParse(raw);
    if (!parsed.success) return [];

    const quotes = parsed.data.quotes ?? [];
    const bars: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> = [];

    for (const q of quotes) {
      const date = toIsoDate(q.date);
      if (!date) continue;
      const c = q.close ?? null;
      if (c === null || !Number.isFinite(c)) continue;

      bars.push({
        t: date,
        o: clampNumber(q.open, c),
        h: clampNumber(q.high, c),
        l: clampNumber(q.low, c),
        c,
        v: clampNumber(q.volume),
      });
    }

    return bars.sort((a, b) => a.t.localeCompare(b.t)).slice(-limit);
  }
}

export function getMarketDataClient(): { provider: ScreenerProvider; client: MarketDataClient } {
  const raw = (process.env.SCREENER_PROVIDER || "").trim().toLowerCase();
  const provider = (raw === "yahoo" || raw === "alpaca" ? raw : "yahoo") satisfies ScreenerProvider;

  if (provider === "yahoo") return { provider, client: new YahooMarketDataClient() };
  return { provider: "alpaca", client: new AlpacaMarketDataClient() };
}
