import { forEachSequential, analyzeHistory, type Signal } from "@trading/core";
import { getMarketDataClient, type MarketDataClient } from "./market-data.js";

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

export interface ScanResult {
  symbol: string;
  price: number;
  volume: number;
  change: number;
  changePercent: number;
  rsi?: number;
  aboveSma20?: boolean;
  aboveSma50?: boolean;
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
      // Apply price filters
      if (criteria.minPrice !== undefined && quote.price < criteria.minPrice) {
        return;
      }

      if (criteria.maxPrice !== undefined && quote.price > criteria.maxPrice) {
        return;
      }

      if (criteria.minVolume !== undefined && quote.volume < criteria.minVolume) {
        return;
      }

      let rsi: number | undefined;
      let aboveSma20: boolean | undefined;
      let aboveSma50: boolean | undefined;

      // Calculate technicals if needed
      if (
        criteria.minRsi !== undefined ||
        criteria.maxRsi !== undefined ||
        criteria.aboveSma20 ||
        criteria.aboveSma50
      ) {
        try {
          const bars = await this.marketData.getBars(symbol, 60);
          const closes = bars.map((b) => b.c);

          const analysis = analyzeHistory(closes);
          rsi = analysis.rsi14 ?? undefined;
          aboveSma20 = analysis.sma20 === null ? undefined : quote.price > analysis.sma20;
          aboveSma50 = analysis.sma50 === null ? undefined : quote.price > analysis.sma50;

          // Every requested predicate must be available and true.
          if (criteria.minRsi !== undefined && (rsi === undefined || rsi < criteria.minRsi)) {
            return;
          }

          if (criteria.maxRsi !== undefined && (rsi === undefined || rsi > criteria.maxRsi)) {
            return;
          }

          if (criteria.aboveSma20 && aboveSma20 !== true) {
            return;
          }

          if (criteria.aboveSma50 && aboveSma50 !== true) {
            return;
          }
        } catch {
          // Skip symbol if we can't get technicals
          return;
        }
      }

      results.push({
        symbol,
        price: quote.price,
        volume: quote.volume,
        change: quote.change,
        changePercent: quote.changePercent,
        rsi,
        aboveSma20,
        aboveSma50,
      });
    });

    return results;
  }

  async getMovers(direction: "gainers" | "losers", limit = 10): Promise<ScanResult[]> {
    const quotes = await this.marketData.getSnapshots(this.defaultUniverse);
    const results: ScanResult[] = [];

    for (const [symbol, quote] of quotes) {
      // Use previous close as the base for daily movers.
      // `open` is frequently stale/out-of-session (e.g., pre-market at 06:00 UTC),
      // which makes "gainers/losers" look incorrect.
      const prevClose = quote.close > 0 ? quote.close : quote.price;

      if (prevClose <= 0) {
        continue;
      }

      const change = quote.price - prevClose;
      const changePercent = (change / prevClose) * 100;

      if (direction === "gainers" && changePercent <= 0) {
        continue;
      }

      if (direction === "losers" && changePercent >= 0) {
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
