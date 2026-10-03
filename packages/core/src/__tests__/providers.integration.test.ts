import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUnified, yahoo, polygon, finnhub, finviz } from "../providers/index.js";
import { mockBars } from "./fixtures.js";
import type { Quote } from "../types/index.js";

const quote: Quote = {
  symbol: "AAPL",
  price: 175.5,
  open: 174,
  high: 176.2,
  low: 173.8,
  close: 174,
  volume: 50000000,
  change: 1.5,
  changePercent: 0.86,
  timestamp: "2024-01-15T16:00:00Z",
};

describe("Unified provider with offline provider seams", () => {
  beforeEach(() => {
    vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(false);
    vi.spyOn(yahoo, "getQuoteNormalized").mockResolvedValue(quote);
    vi.spyOn(finviz, "getQuote").mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a real normalized provider result through the unified coordinator", async () => {
    expect(await createUnified({ quoteRetries: 0 }).getQuote("AAPL")).toEqual(quote);
    expect(yahoo.getQuoteNormalized).toHaveBeenCalledWith("AAPL");
  });

  it("passes through a successful batch and handles an empty batch", async () => {
    vi.spyOn(yahoo, "getQuotes").mockResolvedValue([]);
    expect(await createUnified().getQuotes([])).toEqual([]);
    expect(yahoo.getQuotes).toHaveBeenCalledWith([]);
  });

  it("falls back from a failed batch to individual normalized quotes", async () => {
    vi.spyOn(yahoo, "getQuotes").mockRejectedValue(new Error("batch unavailable"));
    expect(await createUnified({ quoteRetries: 0 }).getQuotes(["AAPL"])).toEqual([quote]);
  });

  it("skips symbols when all individual providers fail", async () => {
    vi.spyOn(yahoo, "getQuotes").mockRejectedValue(new Error("batch unavailable"));
    vi.mocked(yahoo.getQuoteNormalized).mockRejectedValue(new Error("quote unavailable"));
    expect(await createUnified({ quoteRetries: 0 }).getQuotes(["AAPL"])).toEqual([]);
  });

  it("falls back to Polygon bars when Yahoo history fails", async () => {
    vi.spyOn(yahoo, "getHistory").mockRejectedValue(new Error("history unavailable"));
    vi.spyOn(polygon, "getAggregates").mockResolvedValue(mockBars);
    const bars = await createUnified().getBars("AAPL", 30);
    expect(bars).toEqual(mockBars);
    expect(polygon.getAggregates).toHaveBeenCalledWith(
      "AAPL",
      1,
      "day",
      expect.any(String),
      expect.any(String),
    );
  });

  it("maps Finviz movers after an empty Polygon result", async () => {
    vi.spyOn(polygon, "getGainersLosers").mockResolvedValue([]);
    vi.spyOn(finviz, "getGainers").mockResolvedValue([{ symbol: "AAPL", changePercent: 3 }]);
    expect(await createUnified().getMovers("gainers")).toEqual([
      { ticker: "AAPL", todaysChangePerc: 3 },
    ]);
  });

  it("preserves nonempty Polygon movers without requesting the fallback", async () => {
    vi.spyOn(polygon, "getGainersLosers").mockResolvedValue([
      { ticker: "AAPL", todaysChange: 2, todaysChangePerc: 3 },
    ]);
    const fallback = vi.spyOn(finviz, "getGainers");
    expect(await createUnified().getMovers("gainers")).toEqual([
      { ticker: "AAPL", todaysChange: 2, todaysChangePerc: 3 },
    ]);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("reports actual configured-provider flags without making requests", () => {
    const status = createUnified().getProviderStatus();
    expect(status.yahoo.configured).toBe(true);
    expect(status.finnhub.configured).toBe(false);
    expect(status.polygon.configured).toBe(false);
  });
});
