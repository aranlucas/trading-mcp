import { describe, it, expect, vi, beforeEach } from "vitest";

// Generate bars with a deterministic RSI tendency.
function generateBarsForRsi(
  targetRsi: number,
  periods = 30,
): { t: string; o: number; h: number; l: number; c: number; v: number }[] {
  const bars = [];
  let price = 100;

  // The implementation calculates RSI from the last 14 changes. Use a fixed
  // number of unit gains in that window so the signal boundary is predictable.
  const rsiPeriod = 14;
  const upDaysInRsiWindow = Math.round((targetRsi / 100) * rsiPeriod);
  const changes = Array.from({ length: periods - 1 }, (_, index) => {
    const rsiWindowStart = periods - 1 - rsiPeriod;
    if (index < rsiWindowStart) return 0;

    const dayInRsiWindow = index - rsiWindowStart;
    return dayInRsiWindow < upDaysInRsiWindow ? 1 : -1;
  });

  for (let i = 0; i < periods; i++) {
    const date = new Date(Date.UTC(2024, 0, i + 1));
    const change = i === 0 ? 0 : changes[i - 1]!;
    price = Math.max(10, price + change);

    bars.push({
      t: date.toISOString().slice(0, 10),
      o: price - change / 2,
      h: price + Math.abs(change) / 2,
      l: price - Math.abs(change) / 2 - 0.5,
      c: price,
      v: 50000000,
    });
  }

  return bars;
}

// Generate bars with a deterministic SMA alignment.
function generateBarsForSmaAlignment(
  aboveSma20: boolean,
  aboveSma50: boolean,
  periods = 60,
): { t: string; o: number; h: number; l: number; c: number; v: number }[] {
  const bars = [];

  // Start at 100, adjust trend based on desired alignment
  let price = 100;
  let trend: number;

  if (aboveSma20 && aboveSma50) {
    // Uptrend - price consistently above both SMAs
    trend = 0.5;
  } else if (!aboveSma20 && !aboveSma50) {
    // Downtrend - price below both SMAs
    trend = -0.5;
  } else {
    // Mixed - no trend
    trend = 0;
  }

  for (let i = 0; i < periods; i++) {
    const date = new Date(Date.UTC(2024, 0, i + 1));
    // Oscillate mixed-alignment fixtures so the RSI stays neutral instead of
    // being treated as overbought when every close is identical.
    const change = i === 0 ? 0 : trend || (i % 2 === 0 ? 1 : -1);
    price = Math.max(10, price + change);

    bars.push({
      t: date.toISOString().slice(0, 10),
      o: price - 0.5,
      h: price + 1,
      l: price - 1,
      c: price,
      v: 50000000,
    });
  }

  return bars;
}

// Mock data for different scenarios
const mockSnapshots = new Map([
  [
    "AAPL",
    {
      symbol: "AAPL",
      price: 175.5,
      open: 160.0,
      high: 176.2,
      low: 173.8,
      close: 174.0,
      volume: 50000000,
      change: 1.5,
      changePercent: 0.86,
      timestamp: "2024-01-15T16:00:00Z",
    },
  ],
  [
    "MSFT",
    {
      symbol: "MSFT",
      price: 380.25,
      open: 378.0,
      high: 382.0,
      low: 377.5,
      close: 378.0,
      volume: 25000000,
      change: 2.25,
      changePercent: 0.6,
      timestamp: "2024-01-15T16:00:00Z",
    },
  ],
  [
    "GOOGL",
    {
      symbol: "GOOGL",
      price: 142.8,
      open: 141.5,
      high: 143.5,
      low: 141.0,
      close: 141.5,
      volume: 18000000,
      change: 1.3,
      changePercent: 0.92,
      timestamp: "2024-01-15T16:00:00Z",
    },
  ],
  [
    "NVDA",
    {
      symbol: "NVDA",
      price: 550.0,
      open: 540.0,
      high: 555.0,
      low: 538.0,
      close: 540.0,
      volume: 35000000,
      change: 10.0,
      changePercent: 1.85,
      timestamp: "2024-01-15T16:00:00Z",
    },
  ],
  [
    "INTC",
    {
      symbol: "INTC",
      price: 45.5,
      open: 46.0,
      high: 46.5,
      low: 45.0,
      close: 46.0,
      volume: 28000000,
      change: -0.5,
      changePercent: -1.09,
      timestamp: "2024-01-15T16:00:00Z",
    },
  ],
]);

// Mock bars for each symbol
const mockBarsNeutral = generateBarsForSmaAlignment(false, true, 60);
const mockBarsOversold = generateBarsForRsi(20, 30);
const mockBarsOverbought = generateBarsForRsi(85, 30);

// Mock the @trading/core module
vi.mock("@trading/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@trading/core")>()),
  alpaca: {
    getSnapshots: vi.fn().mockImplementation(async (symbols: string[]) => {
      const result = new Map();
      for (const symbol of symbols) {
        if (mockSnapshots.has(symbol)) {
          result.set(symbol, mockSnapshots.get(symbol));
        }
      }
      return result;
    }),
    getBars: vi.fn().mockImplementation(async (symbol: string) => {
      // Return different bars based on symbol to test different signals
      if (symbol === "INTC") return mockBarsOversold;
      if (symbol === "NVDA") return mockBarsOverbought;
      return mockBarsNeutral;
    }),
  },
  yahoo: {
    getQuotes: vi.fn().mockResolvedValue([]),
    getHistory: vi.fn().mockResolvedValue({ quotes: [] }),
  },
}));

import { ScreenerService, type ScanCriteria } from "../services/screener.js";
import { alpaca } from "@trading/core";

describe("ScreenerService", () => {
  let screener: ScreenerService;

  it.each([0, 10, 14, 15, 19, 20, 49, 50])(
    "requires enough observations for every requested predicate (%i bars)",
    async (length) => {
      vi.mocked(alpaca.getBars).mockResolvedValue(generateBarsForSmaAlignment(true, true, length));
      for (const [criteria, required] of [
        [{ minRsi: 0 }, 15],
        [{ maxRsi: 100 }, 15],
        [{ aboveSma20: true }, 20],
        [{ aboveSma50: true }, 50],
        [{ minRsi: 0, aboveSma50: true }, 50],
      ] as const) {
        const results = await screener.scan({ symbols: ["AAPL"], ...criteria });
        expect(results, JSON.stringify(criteria)).toHaveLength(length >= required ? 1 : 0);
      }
    },
  );

  it("honors zero maximum RSI and price thresholds", async () => {
    vi.mocked(alpaca.getBars).mockResolvedValue(generateBarsForSmaAlignment(true, true));
    expect(await screener.scan({ symbols: ["AAPL"], maxRsi: 0 })).toEqual([]);
    expect(await screener.scan({ symbols: ["AAPL"], maxPrice: 0 })).toEqual([]);
    vi.mocked(alpaca.getBars).mockResolvedValue(generateBarsForSmaAlignment(false, false));
    expect(await screener.scan({ symbols: ["AAPL"], maxRsi: 0 })).toHaveLength(1);
  });

  it("still permits quote-only scans without price history", async () => {
    vi.mocked(alpaca.getBars).mockResolvedValue([]);
    expect(await screener.scan({ symbols: ["AAPL"] })).toHaveLength(1);
    expect(alpaca.getBars).not.toHaveBeenCalled();
  });

  it("treats a measured zero SMA as available", async () => {
    vi.mocked(alpaca.getBars).mockResolvedValue(
      generateBarsForSmaAlignment(true, true).map((bar) => ({ ...bar, c: 0 })),
    );
    expect(await screener.scan({ symbols: ["AAPL"], aboveSma50: true })).toHaveLength(1);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(alpaca.getBars).mockImplementation(async (symbol: string) => {
      if (symbol === "INTC") return mockBarsOversold;
      if (symbol === "NVDA") return mockBarsOverbought;
      return mockBarsNeutral;
    });
    process.env.SCREENER_PROVIDER = "alpaca";
    screener = new ScreenerService();
  });

  describe("scan", () => {
    it("should scan default universe when no symbols provided", async () => {
      const results = await screener.scan({});

      expect(results.length).toBeGreaterThan(0);
      expect(alpaca.getSnapshots).toHaveBeenCalledTimes(1);
    });

    it("should scan specific symbols when provided", async () => {
      const criteria: ScanCriteria = {
        symbols: ["AAPL", "MSFT"],
      };

      const results = await screener.scan(criteria);

      expect(results).toHaveLength(2);
      expect(alpaca.getSnapshots).toHaveBeenCalledWith(["AAPL", "MSFT"]);
    });

    it("should filter by minimum price", async () => {
      const criteria: ScanCriteria = {
        symbols: ["AAPL", "MSFT", "GOOGL", "NVDA", "INTC"],
        minPrice: 200,
      };

      const results = await screener.scan(criteria);

      // Should filter out GOOGL (142.8), AAPL (175.5), INTC (45.5)
      expect(results.every((r) => r.price >= 200)).toBe(true);
      expect(results.map((r) => r.symbol)).toContain("MSFT");
      expect(results.map((r) => r.symbol)).toContain("NVDA");
    });

    it("should filter by maximum price", async () => {
      const criteria: ScanCriteria = {
        symbols: ["AAPL", "MSFT", "GOOGL", "NVDA", "INTC"],
        maxPrice: 200,
      };

      const results = await screener.scan(criteria);

      // Should filter out MSFT (380.25), NVDA (550)
      expect(results.every((r) => r.price <= 200)).toBe(true);
      expect(results.map((r) => r.symbol)).toContain("AAPL");
      expect(results.map((r) => r.symbol)).toContain("GOOGL");
      expect(results.map((r) => r.symbol)).toContain("INTC");
    });

    it("should filter by minimum volume", async () => {
      const criteria: ScanCriteria = {
        symbols: ["AAPL", "MSFT", "GOOGL"],
        minVolume: 30000000,
      };

      const results = await screener.scan(criteria);

      // Should filter out MSFT (25M), GOOGL (18M)
      expect(results.every((r) => r.volume >= 30000000)).toBe(true);
      expect(results.map((r) => r.symbol)).toContain("AAPL");
    });

    it("should return scan results with all required fields", async () => {
      const results = await screener.scan({ symbols: ["AAPL"] });

      expect(results).toHaveLength(1);
      const result = results[0]!;
      expect(result).toHaveProperty("symbol");
      expect(result).toHaveProperty("price");
      expect(result).toHaveProperty("volume");
      expect(result).toHaveProperty("change");
      expect(result).toHaveProperty("changePercent");
    });

    it("should include technical indicators when RSI criteria specified", async () => {
      const criteria: ScanCriteria = {
        symbols: ["AAPL"],
        minRsi: 30,
        maxRsi: 70,
      };

      await screener.scan(criteria);

      // Should have called getBars to calculate RSI
      expect(alpaca.getBars).toHaveBeenCalledWith("AAPL", "1Day", 60);
    });

    it("should filter by SMA20 alignment", async () => {
      const criteria: ScanCriteria = {
        symbols: ["AAPL", "MSFT"],
        aboveSma20: true,
      };

      await screener.scan(criteria);

      // Should have calculated technicals
      expect(alpaca.getBars).toHaveBeenCalled();
    });
  });

  describe("getMovers", () => {
    it("should return top gainers sorted by change percent", async () => {
      const movers = await screener.getMovers("gainers", 5);

      expect(movers.length).toBeLessThanOrEqual(5);
      expect(movers.every((m) => m.changePercent > 0)).toBe(true);
      // Should be sorted descending by changePercent
      for (let i = 1; i < movers.length; i++) {
        expect(movers[i - 1]!.changePercent).toBeGreaterThanOrEqual(movers[i]!.changePercent);
      }
    });

    it("should return top losers sorted by change percent", async () => {
      const movers = await screener.getMovers("losers", 5);

      expect(movers.length).toBeLessThanOrEqual(5);
      expect(movers.every((m) => m.changePercent < 0)).toBe(true);
      // Should be sorted ascending by changePercent (most negative first)
      for (let i = 1; i < movers.length; i++) {
        expect(movers[i - 1]!.changePercent).toBeLessThanOrEqual(movers[i]!.changePercent);
      }
    });

    it("should respect the limit parameter", async () => {
      const movers = await screener.getMovers("gainers", 2);

      expect(movers.length).toBeLessThanOrEqual(2);
    });

    it("should compute change percent vs previous close (not open)", async () => {
      const movers = await screener.getMovers("gainers", 10);
      const aapl = movers.find((m) => m.symbol === "AAPL");
      expect(aapl).toBeDefined();

      // If computed vs open: (175.5 - 160.0)/160.0 = 9.6875% (incorrect).
      // We want: (175.5 - 174.0)/174.0 = 0.862...% (previous close base).
      expect(aapl!.changePercent).toBeCloseTo(((175.5 - 174.0) / 174.0) * 100, 6);
    });
  });

  describe("getSignals", () => {
    it("should generate RSI_OVERSOLD signal when RSI < 30", async () => {
      // INTC returns oversold bars
      const signals = await screener.getSignals(["INTC"]);

      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        symbol: "INTC",
        type: "RSI_OVERSOLD",
        direction: "bullish",
        strength: expect.closeTo(0.2857, 3),
        description: "RSI at 21.4 - oversold",
      });
      expect(signals[0]?.timestamp).toEqual(expect.any(String));
      expect(alpaca.getBars).toHaveBeenCalledWith("INTC", "1Day", 60);
    });

    it("should generate RSI_OVERBOUGHT signal when RSI > 70", async () => {
      // NVDA returns overbought bars
      const signals = await screener.getSignals(["NVDA"]);

      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        symbol: "NVDA",
        type: "RSI_OVERBOUGHT",
        direction: "bearish",
        strength: expect.closeTo(0.5238, 3),
        description: "RSI at 85.7 - overbought",
      });
      expect(signals[0]?.timestamp).toEqual(expect.any(String));
      expect(alpaca.getBars).toHaveBeenCalledWith("NVDA", "1Day", 60);
    });

    it("should include timestamp and description in signals", async () => {
      const signals = await screener.getSignals(["AAPL", "MSFT"]);

      for (const signal of signals) {
        expect(signal).toHaveProperty("timestamp");
        expect(signal).toHaveProperty("description");
        expect(signal).toHaveProperty("direction");
        expect(signal).toHaveProperty("strength");
        expect(signal).toHaveProperty("type");
      }
    });

    it("should return empty array for symbols without signals", async () => {
      // Reset mock to return neutral bars for all
      vi.mocked(alpaca.getBars).mockResolvedValue(mockBarsNeutral);

      const signals = await screener.getSignals(["AAPL"]);

      expect(signals).toEqual([]);
    });

    it("should process multiple symbols", async () => {
      const symbols = ["AAPL", "MSFT", "GOOGL"];
      await screener.getSignals(symbols);

      expect(alpaca.getBars).toHaveBeenCalledTimes(symbols.length);
    });
  });
});
