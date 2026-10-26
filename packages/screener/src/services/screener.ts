import {
  forEachSequential,
  analyzeHistory,
  quoteChange,
  type Quote,
  type Signal,
} from "@trading/core";
import { getMarketDataClient, type MarketDataClient } from "./market-data.js";
import { z } from "zod";

export interface ScanCriteria {
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  minRsi?: number;
  maxRsi?: number;
  aboveSma20?: boolean;
  aboveSma50?: boolean;
  symbols?: string[];
}

export const ScanResultSchema = z.object({
  symbol: z.string(),
  price: z.number().positive(),
  volume: z.number().nonnegative().nullable(),
  change: z.number().nullable(),
  changePercent: z.number().nullable(),
  rsi: z.number().optional(),
  aboveSma20: z.boolean().optional(),
  aboveSma50: z.boolean().optional(),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

export const MoverResultSchema = ScanResultSchema.extend({ changePercent: z.number() });

type MoverResult = z.infer<typeof MoverResultSchema>;

type ScanTechnicals = {
  rsi: number | undefined;
  aboveSma20: boolean | undefined;
  aboveSma50: boolean | undefined;
};

function matchesQuote(quote: Quote, criteria: ScanCriteria): boolean {
  if (criteria.minPrice !== undefined && quote.price < criteria.minPrice) {
    return false;
  }

  if (criteria.maxPrice !== undefined && quote.price > criteria.maxPrice) {
    return false;
  }

  if (
    criteria.minVolume !== undefined &&
    (quote.volume === null || quote.volume < criteria.minVolume)
  ) {
    return false;
  }

  return true;
}

function withinBounds(
  value: number | undefined,
  minimum: number | undefined,
  maximum: number | undefined,
): boolean {
  if (minimum !== undefined && (value === undefined || value < minimum)) {
    return false;
  }

  if (maximum !== undefined && (value === undefined || value > maximum)) {
    return false;
  }

  return true;
}

function needsTechnicals(criteria: ScanCriteria): boolean {
  return (
    criteria.minRsi !== undefined ||
    criteria.maxRsi !== undefined ||
    criteria.aboveSma20 === true ||
    criteria.aboveSma50 === true
  );
}

function matchesTechnicals(values: ScanTechnicals, criteria: ScanCriteria): boolean {
  if (!withinBounds(values.rsi, criteria.minRsi, criteria.maxRsi)) {
    return false;
  }

  if (criteria.aboveSma20 && values.aboveSma20 !== true) {
    return false;
  }

  if (criteria.aboveSma50 && values.aboveSma50 !== true) {
    return false;
  }

  return true;
}

export class ScreenerService {
  constructor(private readonly marketData: MarketDataClient = getMarketDataClient().client) {}

  // Default universe if no symbols provided
  private defaultUniverse = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "NVDA",
    "META",
    "TSLA",
    "AMD",
    "NFLX",
    "CRM",
    "ORCL",
    "INTC",
    "QCOM",
    "AVGO",
    "TXN",
    "MU",
    "AMAT",
    "LRCX",
    "KLAC",
    "MRVL",
  ];

  async scan(criteria: ScanCriteria): Promise<ScanResult[]> {
    const symbols = criteria.symbols ?? this.defaultUniverse;
    const results: ScanResult[] = [];

    // Get snapshots for all symbols
    const quotes = await this.marketData.getSnapshots(symbols);

    await forEachSequential([...quotes], async ([symbol, quote]) => {
      const result = await this.scanQuote(symbol, quote, criteria);

      if (result) {
        results.push(result);
      }
    });

    return results;
  }

  private async scanQuote(
    symbol: string,
    quote: Quote,
    criteria: ScanCriteria,
  ): Promise<ScanResult | null> {
    if (!matchesQuote(quote, criteria)) {
      return null;
    }

    let technicals: Partial<ScanTechnicals> = {};

    if (needsTechnicals(criteria)) {
      try {
        const data = await this.technicalsFor(symbol, quote.price);

        if (!matchesTechnicals(data, criteria)) {
          return null;
        }

        technicals = data;
      } catch {
        return null;
      }
    }

    return {
      symbol,
      price: quote.price,
      volume: quote.volume,
      change: quote.change,
      changePercent: quote.changePercent,
      ...technicals,
    };
  }

  private async technicalsFor(symbol: string, price: number): Promise<ScanTechnicals> {
    const bars = await this.marketData.getBars(symbol, 60);
    const analysis = analyzeHistory(bars.map((bar) => bar.c));

    return {
      rsi: analysis.rsi14 ?? undefined,
      aboveSma20: analysis.sma20 === null ? undefined : price > analysis.sma20,
      aboveSma50: analysis.sma50 === null ? undefined : price > analysis.sma50,
    };
  }

  async getMovers(direction: "gainers" | "losers", limit = 10): Promise<MoverResult[]> {
    const quotes = await this.marketData.getSnapshots(this.defaultUniverse);
    const results: MoverResult[] = [];

    for (const [symbol, quote] of quotes) {
      // Use previous close as the base for daily movers.
      // `open` is frequently stale/out-of-session (e.g., pre-market at 06:00 UTC),
      // which makes "gainers/losers" look incorrect.
      const calculated = quoteChange(quote.price, quote.close);
      const change = calculated.change ?? quote.change;
      const changePercent = calculated.changePercent ?? quote.changePercent;

      if (changePercent === null) {
        continue;
      }

      if (direction === "gainers" ? changePercent <= 0 : changePercent >= 0) {
        continue;
      }

      results.push({ symbol, price: quote.price, volume: quote.volume, change, changePercent });
    }

    // Sort by change percent
    const sorted = results.toSorted((a, b) => {
      if (direction === "gainers") {
        return b.changePercent - a.changePercent;
      }

      return a.changePercent - b.changePercent;
    });

    return sorted.slice(0, limit);
  }

  async getSignals(symbols: string[]): Promise<Signal[]> {
    const signals: Signal[] = [];

    await forEachSequential(symbols, async (symbol) => {
      try {
        const bars = await this.marketData.getBars(symbol, 60);
        const closes = bars.map((b) => b.c);

        if (closes.length < 20) {
          return;
        }

        const currentPrice = closes.at(-1) ?? 0;
        const { rsi14: rsi, sma20, sma50 } = analyzeHistory(closes);

        // RSI signals
        if (rsi !== null && rsi < 30) {
          signals.push({
            symbol,
            type: "RSI_OVERSOLD",
            direction: "bullish",
            strength: (30 - rsi) / 30,
            timestamp: new Date().toISOString(),
            description: `RSI at ${rsi.toFixed(1)} - oversold`,
          });
        } else if (rsi !== null && rsi > 70) {
          signals.push({
            symbol,
            type: "RSI_OVERBOUGHT",
            direction: "bearish",
            strength: (rsi - 70) / 30,
            timestamp: new Date().toISOString(),
            description: `RSI at ${rsi.toFixed(1)} - overbought`,
          });
        }

        // MA signals
        if (sma20 !== null && sma50 !== null && currentPrice > sma20 && sma20 > sma50) {
          signals.push({
            symbol,
            type: "MA_BULLISH_ALIGNMENT",
            direction: "bullish",
            strength: 0.7,
            timestamp: new Date().toISOString(),
            description: "Price > SMA20 > SMA50",
          });
        }
      } catch {
        // Skip symbol on error
      }
    });

    return signals;
  }
}
