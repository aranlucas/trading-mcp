// Finviz scraper - FREE, no API key (rate limited)

import type { Quote, Signal } from "../types/index.js";
import {
  FinvizScreenerResultSchema,
  FinvizScreenFiltersSchema,
  type FinvizScreenerResult,
  type FinvizScreenFilters,
} from "../schemas/index.js";

const FINVIZ_BASE = "https://finviz.com";

// Parse value with suffix (K, M, B, %)
function parseValue(str: string | undefined): number {
  if (!str || str === "-") return 0;
  str = str.replace(/,/g, "").replace(/%/g, "");

  const multipliers = new Map([
    ["K", 1e3],
    ["M", 1e6],
    ["B", 1e9],
    ["T", 1e12],
  ]);

  const match = str.match(/^(-?[\d.]+)([KMBT])?$/i);

  if (match?.[1]) {
    const num = parseFloat(match[1]);
    const suffix = match[2];
    const mult = suffix ? (multipliers.get(suffix.toUpperCase()) ?? 1) : 1;

    return num * mult;
  }

  return parseFloat(str) || 0;
}

export const finviz = {
  name: "finviz" as const,

  // Get stock quote/snapshot
  async getQuote(symbol: string): Promise<Quote | null> {
    try {
      const response = await fetch(`${FINVIZ_BASE}/quote.ashx?t=${symbol}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      const html = await response.text();

      // Extract price and change from snapshot table
      const priceMatch = html.match(/class="snapshot-td2-cp"[^>]*>([^<]+)/);
      const changeMatch = html.match(/class="snapshot-td2[^"]*"[^>]*>([+-]?\d+\.?\d*%?)/);

      const price = parseValue(priceMatch?.[1]);
      const change = parseValue(changeMatch?.[1]);

      return {
        symbol: symbol.toUpperCase(),
        price,
        open: 0,
        high: 0,
        low: 0,
        close: price,
        volume: 0,
        change,
        changePercent: change,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  // Screen stocks with Finviz screener
  async screen(filters: FinvizScreenFilters): Promise<FinvizScreenerResult[]> {
    try {
      // Validate filters with Zod
      const validatedFilters = FinvizScreenFiltersSchema.parse(filters);

      const params = new URLSearchParams();
      params.set("v", "111"); // Overview view

      // Use 's' param for signals (sorted results), 'f' for filters
      if (validatedFilters.signal) {
        params.set("s", validatedFilters.signal);
      }

      const filterStr = this.buildFilterString(validatedFilters);

      if (filterStr) {
        params.set("f", filterStr);
      }

      const response = await fetch(`${FINVIZ_BASE}/screener.ashx?${params}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      const html = await response.text();

      // Extract screener results from table rows
      const results: FinvizScreenerResult[] = [];

      const rowMatches = [
        ...html.matchAll(/<tr[^>]*class="[^"]*-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi),
      ];

      for (const rowMatch of rowMatches) {
        const row = rowMatch[1];

        if (!row) continue;

        // Extract ticker from href or tab-link
        const tickerMatch =
          row.match(/href="quote\.ashx\?t=([A-Za-z0-9.-]+)/i) ??
          row.match(/class="tab-link">([A-Za-z0-9.-]+)</i);

        const ticker = tickerMatch?.[1];

        if (!ticker) continue;

        const symbol = ticker.toUpperCase();

        // Extract company name (third td)
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        const companyCell = cells[2]?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";

        // Extract change percentage
        const changeMatch = row.match(/([+-]?\d+\.?\d*)%/);
        const changePercent = changeMatch?.[1] ? parseFloat(changeMatch[1]) : 0;

        // Extract price (look for number in span with is-positive/is-negative class)
        const priceMatch = row.match(/is-(?:positive|negative)">([0-9.]+)</);
        const price = priceMatch?.[1] ? parseFloat(priceMatch[1]) : 0;

        // Extract volume (usually last numeric td)
        const volumeMatch = row.match(/([0-9,]+)<\/a><\/td>\s*$/);
        const volume = volumeMatch?.[1] ? parseInt(volumeMatch[1].replace(/,/g, "")) : 0;

        // Extract market cap
        const mcMatch = row.match(/>([0-9.]+[BMK])</);
        const marketCap = mcMatch?.[1] ?? "";

        // Validate with Zod schema
        const parsed = FinvizScreenerResultSchema.safeParse({
          symbol,
          company: companyCell,
          price,
          changePercent,
          volume,
          marketCap,
        });

        if (parsed.success) {
          results.push(parsed.data);
        }
      }

      return results.slice(0, 50);
    } catch (e) {
      console.error("Finviz screen error:", e);

      return [];
    }
  },

  // Build filter string for screener
  buildFilterString(filters: FinvizScreenFilters): string {
    const parts: string[] = [];

    if (filters.marketCap) {
      const caps = {
        small: "cap_smallover",
        mid: "cap_midover",
        large: "cap_largeover",
        mega: "cap_mega",
      };

      const capFilter = caps[filters.marketCap];

      if (capFilter) parts.push(capFilter);
    }

    // Don't include signal in filter string anymore (use 's' param instead)

    if (filters.change === "up") parts.push("ta_change_u");

    if (filters.change === "down") parts.push("ta_change_d");

    return parts.join(",");
  },

  // Get top gainers
  async getGainers(limit = 20): Promise<FinvizScreenerResult[]> {
    const results = await this.screen({ signal: "ta_topgainers" });

    return results.slice(0, limit);
  },

  // Get top losers
  async getLosers(limit = 20): Promise<FinvizScreenerResult[]> {
    const results = await this.screen({ signal: "ta_toplosers" });

    return results.slice(0, limit);
  },

  // Get oversold stocks (RSI < 30)
  async getOversold(): Promise<FinvizScreenerResult[]> {
    return this.screen({ signal: "ta_oversold" });
  },

  // Get overbought stocks (RSI > 70)
  async getOverbought(): Promise<FinvizScreenerResult[]> {
    return this.screen({ signal: "ta_overbought" });
  },

  // Get new highs
  async getNewHighs(): Promise<FinvizScreenerResult[]> {
    return this.screen({ signal: "ta_newhigh" });
  },

  // Get new lows
  async getNewLows(): Promise<FinvizScreenerResult[]> {
    return this.screen({ signal: "ta_newlow" });
  },

  // Get unusual volume
  async getUnusualVolume(): Promise<FinvizScreenerResult[]> {
    return this.screen({ signal: "ta_unusualvolume" });
  },

  // Get most volatile
  async getMostVolatile(): Promise<FinvizScreenerResult[]> {
    return this.screen({ signal: "ta_mostvolatile" });
  },

  // Get signals for a stock
  async getSignals(symbol: string): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      const response = await fetch(`${FINVIZ_BASE}/quote.ashx?t=${symbol}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      const html = await response.text();

      // Check for pattern signals in the page
      if (html.includes("Oversold")) {
        signals.push({
          symbol,
          type: "OVERSOLD",
          direction: "bullish",
          strength: 0.7,
          timestamp: new Date().toISOString(),
          description: "RSI indicates oversold conditions",
        });
      }

      if (html.includes("Overbought")) {
        signals.push({
          symbol,
          type: "OVERBOUGHT",
          direction: "bearish",
          strength: 0.7,
          timestamp: new Date().toISOString(),
          description: "RSI indicates overbought conditions",
        });
      }
    } catch {
      // Silently fail
    }

    return signals;
  },
};
