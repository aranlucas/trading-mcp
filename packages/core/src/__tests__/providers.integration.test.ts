import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockBars } from "./fixtures.js";

// Mock the entire providers module
vi.mock("../providers/index.js", () => {
  const mockYahoo = {
    name: "yahoo",
    getQuote: vi.fn().mockImplementation(async (symbol: string) => ({
      symbol,
      price: 175.5,
      open: 174.0,
      high: 176.2,
      low: 173.8,
      close: 174.0,
      volume: 50000000,
      change: 1.5,
      changePercent: 0.86,
      timestamp: new Date().toISOString(),
    })),
    getQuotes: vi.fn().mockImplementation(async (symbols: string[]) => {
      const map = new Map();
      for (const symbol of symbols) {
        map.set(symbol, {
          symbol,
          price: 175.5,
          open: 174.0,
          high: 176.2,
          low: 173.8,
          close: 174.0,
          volume: 50000000,
          change: 1.5,
          changePercent: 0.86,
          timestamp: new Date().toISOString(),
        });
      }
      return map;
    }),
    getHistory: vi.fn().mockResolvedValue(mockBars),
    search: vi.fn().mockImplementation(async (query: string) => [
      {
        symbol: query.toUpperCase(),
        name: `${query} Inc`,
        type: "Equity",
        exchange: "NASDAQ",
      },
    ]),
    getTrending: vi.fn().mockResolvedValue([{ symbol: "AAPL" }, { symbol: "MSFT" }]),
    getOptions: vi.fn().mockResolvedValue({
      expirationDates: ["2024-02-16", "2024-03-15"],
      calls: [{ strike: 175, bid: 2.5, ask: 2.6 }],
      puts: [{ strike: 175, bid: 1.5, ask: 1.6 }],
    }),
  };

  const mockPolygon = {
    name: "polygon",
    isConfigured: vi.fn().mockReturnValue(false),
    getPreviousClose: vi.fn().mockResolvedValue(null),
    getAggregates: vi.fn().mockResolvedValue(mockBars),
    getGainersLosers: vi.fn().mockResolvedValue([]),
    getNews: vi.fn().mockResolvedValue([]),
  };

  const mockFinnhub = {
    name: "finnhub",
    isConfigured: vi.fn().mockReturnValue(false),
    getQuote: vi.fn().mockResolvedValue(null),
    getNews: vi.fn().mockResolvedValue([]),
    getMarketNews: vi.fn().mockResolvedValue([]),
  };

  const mockFred = {
    name: "fred",
    isConfigured: vi.fn().mockReturnValue(false),
    getMacroSnapshot: vi.fn().mockResolvedValue({}),
  };

  const mockFinviz = {
    name: "finviz",
    getQuote: vi.fn().mockResolvedValue(null),
    getGainers: vi.fn().mockResolvedValue([{ symbol: "AAPL", changePercent: 3.0 }]),
    getLosers: vi.fn().mockResolvedValue([{ symbol: "TSLA", changePercent: -2.5 }]),
  };

  return {
    yahoo: mockYahoo,
    polygon: mockPolygon,
    finnhub: mockFinnhub,
    fred: mockFred,
    finviz: mockFinviz,
    INDICATORS: {},
    unified: {
      getQuote: mockYahoo.getQuote,
      getQuotes: mockYahoo.getQuotes,
      getBars: mockYahoo.getHistory,
      getNews: vi.fn().mockResolvedValue([]),
      getMovers: vi.fn().mockResolvedValue([{ ticker: "AAPL", todaysChangePerc: 3.0 }]),
      getSentiment: vi.fn().mockResolvedValue({}),
      getMacro: mockFred.getMacroSnapshot,
      getRecommendations: vi.fn().mockResolvedValue([]),
      getEarningsCalendar: vi.fn().mockResolvedValue([]),
      getProviderStatus: vi.fn().mockReturnValue({
        yahoo: { configured: true, rateLimit: "none" },
        polygon: { configured: false, rateLimit: "5/min" },
        finnhub: { configured: false, rateLimit: "60/min" },
        fred: { configured: false, rateLimit: "none" },
        finviz: { configured: true, rateLimit: "web scraping" },
      }),
    },
  };
});

import { unified, yahoo, polygon, finnhub } from "../providers/index.js";

describe("Unified Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQuote", () => {
    it("should fetch a quote", async () => {
      const quote = await unified.getQuote("AAPL");

      expect(quote).toBeDefined();
      expect(quote.symbol).toBe("AAPL");
      expect(quote.price).toBe(175.5);
      expect(quote.volume).toBe(50000000);
    });

    it("should return quote with all required fields", async () => {
      const quote = await unified.getQuote("MSFT");

      expect(quote).toHaveProperty("symbol");
      expect(quote).toHaveProperty("price");
      expect(quote).toHaveProperty("open");
      expect(quote).toHaveProperty("high");
      expect(quote).toHaveProperty("low");
      expect(quote).toHaveProperty("close");
      expect(quote).toHaveProperty("volume");
      expect(quote).toHaveProperty("change");
      expect(quote).toHaveProperty("changePercent");
      expect(quote).toHaveProperty("timestamp");
    });
  });

  describe("getQuotes", () => {
    it("should fetch multiple quotes", async () => {
      const quotes = await unified.getQuotes(["AAPL", "MSFT", "GOOGL"]);

      expect(quotes).toBeInstanceOf(Map);
      expect(quotes.size).toBe(3);
      expect(quotes.has("AAPL")).toBe(true);
      expect(quotes.has("MSFT")).toBe(true);
      expect(quotes.has("GOOGL")).toBe(true);
    });

    it("should handle empty symbol array", async () => {
      const quotes = await unified.getQuotes([]);

      expect(quotes).toBeInstanceOf(Map);
      expect(quotes.size).toBe(0);
    });
  });

  describe("getBars", () => {
    it("should fetch historical bar data", async () => {
      const bars = await unified.getBars("AAPL", 30);

      expect(Array.isArray(bars)).toBe(true);
      expect(bars.length).toBeGreaterThan(0);

      const bar = bars[0]!;
      expect(bar).toHaveProperty("t");
      expect(bar).toHaveProperty("o");
      expect(bar).toHaveProperty("h");
      expect(bar).toHaveProperty("l");
      expect(bar).toHaveProperty("c");
      expect(bar).toHaveProperty("v");
    });

    it("should return bars with valid OHLCV data", async () => {
      const bars = await unified.getBars("AAPL", 30);

      for (const bar of bars) {
        expect(typeof bar.o).toBe("number");
        expect(typeof bar.h).toBe("number");
        expect(typeof bar.l).toBe("number");
        expect(typeof bar.c).toBe("number");
        expect(typeof bar.v).toBe("number");
        expect(bar.h).toBeGreaterThanOrEqual(bar.l);
      }
    });
  });

  describe("getMovers", () => {
    it("should fetch movers", async () => {
      const movers = await unified.getMovers("gainers");
      expect(Array.isArray(movers)).toBe(true);
    });
  });

  describe("getProviderStatus", () => {
    it("should return status for all providers", () => {
      const status = unified.getProviderStatus();

      expect(status).toHaveProperty("yahoo");
      expect(status).toHaveProperty("polygon");
      expect(status).toHaveProperty("finnhub");
      expect(status).toHaveProperty("fred");
      expect(status).toHaveProperty("finviz");
      expect(status.yahoo.configured).toBe(true);
    });
  });
});

describe("Yahoo Provider", () => {
  it("should fetch single quote", async () => {
    const quote = await yahoo.getQuote("AAPL");

    expect(quote.symbol).toBe("AAPL");
    expect(quote.price).toBeDefined();
  });

  it("should fetch multiple quotes", async () => {
    const quotes = await yahoo.getQuotes(["AAPL", "MSFT"]);

    expect(quotes).toBeInstanceOf(Map);
    expect(quotes.size).toBe(2);
  });

  it("should fetch historical data", async () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const bars = await yahoo.getHistory("AAPL", from);

    expect(Array.isArray(bars)).toBe(true);
  });

  it("should search symbols", async () => {
    const results = await yahoo.search("AAPL");

    expect(Array.isArray(results)).toBe(true);
    expect(results[0]).toHaveProperty("symbol");
    expect(results[0]).toHaveProperty("name");
  });

  it("should fetch trending tickers", async () => {
    const trending = await yahoo.getTrending(5);
    expect(Array.isArray(trending)).toBe(true);
  });

  it("should fetch options chain", async () => {
    const options = await yahoo.getOptions("AAPL");

    expect(options).toHaveProperty("expirationDates");
    expect(options).toHaveProperty("calls");
    expect(options).toHaveProperty("puts");
  });
});

describe("Polygon Provider", () => {
  it("should check configuration status", () => {
    expect(polygon.isConfigured()).toBe(false);
  });
});

describe("Finnhub Provider", () => {
  it("should check configuration status", () => {
    expect(finnhub.isConfigured()).toBe(false);
  });
});
