import type { Signal } from "@trading/core";
import { getMarketDataClient } from "./market-data.js";

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

// Simple RSI calculation
function calculateRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const curr = closes[i];
    const prev = closes[i - 1];
    if (curr !== undefined && prev !== undefined) {
      changes.push(curr - prev);
    }
  }

  const gains = changes.slice(-period).map((c) => (c > 0 ? c : 0));
  const losses = changes.slice(-period).map((c) => (c < 0 ? -c : 0));

  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Simple SMA
function sma(data: number[], period: number): number {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export class ScreenerService {
  private marketData = getMarketDataClient().client;

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
    const symbols = criteria.symbols || this.defaultUniverse;
    const results: ScanResult[] = [];

    // Get snapshots for all symbols
    const quotes = await this.marketData.getSnapshots(symbols);

    for (const [symbol, quote] of quotes) {
      // Apply price filters
      if (criteria.minPrice && quote.price < criteria.minPrice) continue;
      if (criteria.maxPrice && quote.price > criteria.maxPrice) continue;
      if (criteria.minVolume && quote.volume < criteria.minVolume) continue;

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

          if (closes.length >= 20) {
            rsi = calculateRsi(closes, 14);
            const sma20 = sma(closes, 20);
            const sma50 = closes.length >= 50 ? sma(closes, 50) : undefined;

            aboveSma20 = quote.price > sma20;
            aboveSma50 = sma50 ? quote.price > sma50 : undefined;

            // Apply RSI filters
            if (criteria.minRsi && rsi < criteria.minRsi) continue;
            if (criteria.maxRsi && rsi > criteria.maxRsi) continue;
            if (criteria.aboveSma20 && !aboveSma20) continue;
            if (criteria.aboveSma50 && !aboveSma50) continue;
          }
        } catch {
          // Skip symbol if we can't get technicals
          continue;
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
    }

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
      if (prevClose <= 0) continue;

      const change = quote.price - prevClose;
      const changePercent = (change / prevClose) * 100;

      if (direction === "gainers" && changePercent <= 0) continue;
      if (direction === "losers" && changePercent >= 0) continue;

      results.push({ symbol, price: quote.price, volume: quote.volume, change, changePercent });
    }

    // Sort by change percent
    results.sort((a, b) => {
      if (direction === "gainers") {
        return b.changePercent - a.changePercent;
      }
      return a.changePercent - b.changePercent;
    });

    return results.slice(0, limit);
  }

  async getSignals(symbols: string[]): Promise<Signal[]> {
    const signals: Signal[] = [];

    for (const symbol of symbols) {
      try {
        const bars = await this.marketData.getBars(symbol, 60);
        const closes = bars.map((b) => b.c);

        if (closes.length < 20) continue;

        const currentPrice = closes[closes.length - 1] ?? 0;
        const rsi = calculateRsi(closes, 14);
        const sma20 = sma(closes, 20);
        const sma50 = closes.length >= 50 ? sma(closes, 50) : undefined;

        // RSI signals
        if (rsi < 30) {
          signals.push({
            symbol,
            type: "RSI_OVERSOLD",
            direction: "bullish",
            strength: (30 - rsi) / 30,
            timestamp: new Date().toISOString(),
            description: `RSI at ${rsi.toFixed(1)} - oversold`,
          });
        } else if (rsi > 70) {
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
        if (sma50 && currentPrice > sma20 && sma20 > sma50) {
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
    }

    return signals;
  }
}
