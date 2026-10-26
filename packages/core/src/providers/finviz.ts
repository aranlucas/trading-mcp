// Finviz scraper - FREE, no API key (rate limited)

import type { Quote, Signal } from "../types/index.js";
import { z } from "zod";
import { load, type CheerioAPI } from "cheerio";
import { parseQuote, quoteChange } from "../lib/quote.js";
import {
  FinvizScreenerResultSchema,
  FinvizScreenFiltersSchema,
  type FinvizScreenerResult,
  type FinvizScreenFilters,
} from "../schemas/index.js";

const FINVIZ_BASE = "https://finviz.com";

const FinvizNumberSchema = z
  .string()
  .trim()
  .regex(/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/)
  .transform((value) => Number(value.replaceAll(",", "")))
  .pipe(z.number());

const FinvizPriceSchema = FinvizNumberSchema.pipe(z.number().positive());

const optionalPrice = FinvizPriceSchema.nullable().catch(null);

const optionalPercent = z
  .string()
  .trim()
  .regex(/%$/)
  .transform((value) => value.slice(0, -1))
  .pipe(FinvizNumberSchema)
  .nullable()
  .catch(null);

const volumeMultipliers = new Map([
  ["K", 1e3],
  ["M", 1e6],
  ["B", 1e9],
  ["T", 1e12],
]);

function parseVolume(value = ""): number | null {
  const multiplier = volumeMultipliers.get(value.slice(-1).toUpperCase());

  const parsed = FinvizNumberSchema.safeParse(
    multiplier === undefined ? value : value.slice(0, -1),
  );

  if (!parsed.success) {
    return null;
  }

  const result = z
    .number()
    .nonnegative()
    .safeParse(parsed.data * (multiplier ?? 1));

  return result.success ? result.data : null;
}

function snapshotFields($: CheerioAPI) {
  const fields = new Map<string, string>();
  $("table.snapshot-table2 tr").each((_index, row) => {
    const cells = $(row).children("td");

    for (let index = 0; index + 1 < cells.length; index += 2) {
      fields.set(
        cells.eq(index).text().trim(),
        cells
          .eq(index + 1)
          .text()
          .trim(),
      );
    }
  });

  return fields;
}

function canonicalTicker(href: string): string {
  const url = new URL(href, FINVIZ_BASE);

  if (
    url.origin !== FINVIZ_BASE ||
    url.pathname !== "/quote.ashx" ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid Finviz canonical quote URL");
  }

  return z.tuple([z.string().trim().min(1)]).parse(url.searchParams.getAll("t"))[0];
}

function snapshotSymbol($: CheerioAPI): string {
  const tickers = $(".quote-header_ticker-wrapper_ticker, .fullview-ticker")
    .map((_index, element) => $(element).text())
    .get();

  $("link[rel~='canonical']").each((_index, element) => {
    tickers.push(canonicalTicker($(element).attr("href") ?? ""));
  });
  const normalized = tickers.map((ticker) => ticker.trim().toUpperCase());
  const [symbol] = normalized;

  if (!symbol || normalized.some((ticker) => ticker !== symbol)) {
    throw new Error("Missing or conflicting Finviz quote identity");
  }

  return symbol;
}

function parseSnapshot(html: string, symbol: string): Quote {
  const $ = load(html);
  const fields = snapshotFields($);
  const price = FinvizPriceSchema.parse(fields.get("Price"));
  const close = optionalPrice.parse(fields.get("Prev Close"));
  const changes = quoteChange(price, close);

  return parseQuote(
    {
      symbol: snapshotSymbol($),
      price,
      open: optionalPrice.parse(fields.get("Open")),
      close,
      volume: parseVolume(fields.get("Volume")),
      change: changes.change,
      changePercent: optionalPercent.parse(fields.get("Change")) ?? changes.changePercent,
      source: "finviz",
      kind: "web_snapshot",
      // The snapshot table has no trustworthy observation timestamp or day high/low fields.
      retrievedAt: new Date().toISOString(),
    },
    symbol,
  );
}

export const finviz = {
  name: "finviz" as const,

  // Get stock quote/snapshot
  async getQuote(symbol: string): Promise<Quote | null> {
    try {
      const url = new URL("/quote.ashx", FINVIZ_BASE);
      url.searchParams.set("t", symbol);

      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!response.ok) {
        return null;
      }

      return parseSnapshot(await response.text(), symbol);
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

      const response = await fetch(`${FINVIZ_BASE}/screener.ashx?${params.toString()}`, {
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

        if (!row) {
          continue;
        }

        // Extract ticker from href or tab-link
        const tickerMatch =
          row.match(/href="quote\.ashx\?t=([A-Za-z0-9.-]+)/i) ??
          row.match(/class="tab-link">([A-Za-z0-9.-]+)</i);

        const ticker = tickerMatch?.[1];

        if (!ticker) {
          continue;
        }

        const symbol = ticker.toUpperCase();

        // Extract company name (third td)
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        const companyCell = cells[2]?.[1]?.replaceAll(/<[^>]+>/g, "").trim() ?? "";

        // Extract change percentage
        const changeMatch = row.match(/([+-]?\d+\.?\d*)%/);
        const changePercent = changeMatch?.[1] ? parseFloat(changeMatch[1]) : 0;

        // Extract price (look for number in span with is-positive/is-negative class)
        const priceMatch = row.match(/is-(?:positive|negative)">([0-9.]+)</);
        const price = priceMatch?.[1] ? parseFloat(priceMatch[1]) : 0;

        // Extract volume (usually last numeric td)
        const volumeMatch = row.match(/([0-9,]+)<\/a><\/td>\s*$/);
        const volume = volumeMatch?.[1] ? parseInt(volumeMatch[1].replaceAll(",", ""), 10) : 0;

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

      if (capFilter) {
        parts.push(capFilter);
      }
    }

    // Don't include signal in filter string anymore (use 's' param instead)

    if (filters.change === "up") {
      parts.push("ta_change_u");
    }

    if (filters.change === "down") {
      parts.push("ta_change_d");
    }

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
    const results = await this.screen({ signal: "ta_oversold" });

    return results;
  },

  // Get overbought stocks (RSI > 70)
  async getOverbought(): Promise<FinvizScreenerResult[]> {
    const results = await this.screen({ signal: "ta_overbought" });

    return results;
  },

  // Get new highs
  async getNewHighs(): Promise<FinvizScreenerResult[]> {
    const results = await this.screen({ signal: "ta_newhigh" });

    return results;
  },

  // Get new lows
  async getNewLows(): Promise<FinvizScreenerResult[]> {
    const results = await this.screen({ signal: "ta_newlow" });

    return results;
  },

  // Get unusual volume
  async getUnusualVolume(): Promise<FinvizScreenerResult[]> {
    const results = await this.screen({ signal: "ta_unusualvolume" });

    return results;
  },

  // Get most volatile
  async getMostVolatile(): Promise<FinvizScreenerResult[]> {
    const results = await this.screen({ signal: "ta_mostvolatile" });

    return results;
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
