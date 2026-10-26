import { z } from "zod";
import { AlpacaMarketDataClient } from "./alpaca-market-data.js";
import {
  type YahooQuoteSchema,
  yahoo,
  normalizeYahooQuote,
  type alpaca,
  type Quote,
} from "@trading/core";

type PriceBar = Awaited<ReturnType<typeof alpaca.getBars>>[number];

export type ScreenerProvider = "alpaca" | "yahoo";

export interface MarketDataClient {
  getSnapshots(symbols: string[]): Promise<Map<string, Quote>>;
  getBars(symbol: string, limit: number): Promise<PriceBar[]>;
}

const EpochDateSchema = z
  .number()
  .transform((value) => new Date(value > 10_000_000_000 ? value : value * 1000));

function clampNumber(n: number | null | undefined, fallback = 0): number {
  return n !== null && n !== undefined && Number.isFinite(n) ? n : fallback;
}

const YahooChartSchema = z.object({
  quotes: z
    .array(
      z.object({
        date: z
          .union([z.date(), EpochDateSchema, z.string().pipe(z.coerce.date())])
          .nullable()
          .catch(null),
        open: z.number().nullable().optional(),
        high: z.number().nullable().optional(),
        low: z.number().nullable().optional(),
        close: z.number().nullable().optional(),
        volume: z.number().nullable().optional(),
      }),
    )
    .optional(),
});

type YahooQuotePayload =
  | Awaited<ReturnType<typeof yahoo.getQuote>>
  | z.input<typeof YahooQuoteSchema>;

export interface YahooMarketDataSource {
  getQuotes(symbols: string[]): Promise<YahooQuotePayload[]>;
  getQuote(symbol: string): Promise<YahooQuotePayload>;
  getHistory(symbol: string, from: Date): Promise<z.input<typeof YahooChartSchema>>;
}

class YahooMarketDataClient implements MarketDataClient {
  constructor(private readonly source: YahooMarketDataSource) {}

  async getSnapshots(symbols: string[]): Promise<Map<string, Quote>> {
    const results = new Map<string, Quote>();

    if (symbols.length === 0) {
      return results;
    }

    let list: YahooQuotePayload[];

    try {
      const raw = await this.source.getQuotes(symbols);
      list = Array.isArray(raw) ? raw : [raw];
    } catch {
      const settled = await Promise.allSettled(
        symbols.map(async (s) => {
          const quote = await this.source.getQuote(s);

          return quote;
        }),
      );

      list = settled
        .filter((r): r is PromiseFulfilledResult<YahooQuotePayload> => r.status === "fulfilled")
        .map((r) => r.value);
    }

    const requested = new Set(symbols.map((symbol) => symbol.toUpperCase()));

    for (const item of list) {
      try {
        const quote = normalizeYahooQuote(item);

        if (!requested.has(quote.symbol)) {
          continue;
        }

        results.set(quote.symbol, quote);
      } catch {
        // Invalid required data cannot become a synthetic zero-price screening candidate.
        continue;
      }
    }

    return results;
  }

  async getBars(symbol: string, limit: number): Promise<PriceBar[]> {
    if (!Number.isInteger(limit) || limit < 1) {
      return [];
    }

    // `limit` counts observations, not calendar days. Allow for weekends and
    // holidays; newly listed/suspended symbols can still return fewer bars.
    const days = Math.min(Math.ceil((limit * 7) / 5) + 14, 3650);
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    const raw = await this.source.getHistory(symbol, period1);
    const parsed = YahooChartSchema.safeParse(raw);

    if (!parsed.success) {
      return [];
    }

    const quotes = parsed.data.quotes ?? [];
    const bars: PriceBar[] = [];

    for (const q of quotes) {
      const date = q.date?.toISOString();

      if (!date) {
        continue;
      }

      const c = q.close ?? null;

      if (c === null || !Number.isFinite(c)) {
        continue;
      }

      bars.push({
        t: date,
        o: clampNumber(q.open, c),
        h: clampNumber(q.high, c),
        l: clampNumber(q.low, c),
        c,
        v: clampNumber(q.volume),
      });
    }

    return bars.toSorted((a, b) => a.t.localeCompare(b.t)).slice(-limit);
  }
}

export interface MarketDataSelection {
  provider: ScreenerProvider;
  client: MarketDataClient;
}

export function getMarketDataClient(source: YahooMarketDataSource = yahoo): MarketDataSelection {
  const raw = (process.env.SCREENER_PROVIDER ?? "").trim().toLowerCase();
  const provider = (raw === "yahoo" || raw === "alpaca" ? raw : "yahoo") satisfies ScreenerProvider;

  if (provider === "yahoo") {
    return { provider, client: new YahooMarketDataClient(source) };
  }

  return { provider: "alpaca", client: new AlpacaMarketDataClient() };
}
