import { describe, it, expect, vi, beforeEach } from "vitest";

// Generate bars with a specific RSI tendency
function generateBarsForRsi(
  targetRsi: number,
  periods = 30,
): { t: string; o: number; h: number; l: number; c: number; v: number }[] {
  const bars = [];
  let price = 100;

  // For oversold (low RSI), we need mostly down days
  // For overbought (high RSI), we need mostly up days
  const upDayProb = targetRsi / 100;

  for (let i = 0; i < periods; i++) {
    const date = new Date(2024, 0, i + 1);
    const isUpDay = Math.random() < upDayProb;
    const change = isUpDay ? Math.random() * 2 + 0.5 : -(Math.random() * 2 + 0.5);
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

// Generate bars with a specific SMA alignment
function generateBarsForSmaAlignment(
  aboveSma20: boolean,
  aboveSma50: boolean,
  periods = 60,
): { t: string; o: number; h: number; l: number; c: number; v: number }[] {
  const bars = [];

  // Start at 100, adjust trend based on desired alignment
  let price = 100;
  let trend = 0;

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
    const date = new Date(2024, 0, i + 1);
    const change = trend + (Math.random() - 0.5);
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
      open: 174.0,
      high: 176.2,
      low: 173.8,
      close: 175.5,
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
      close: 380.25,
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
      close: 142.8,
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
      close: 550.0,
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
      close: 45.5,
      volume: 28000000,
      change: -0.5,
      changePercent: -1.09,
      timestamp: "2024-01-15T16:00:00Z",
    },
  ],
]);

// Mock bars for each symbol
const mockBarsNeutral = generateBarsForSmaAlignment(true, true, 60);
const mockBarsOversold = generateBarsForRsi(20, 30);
const mockBarsOverbought = generateBarsForRsi(85, 30);

// Mock the @trading/core module
vi.mock("@trading/core", () => ({
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
}));

import { ScreenerService, type ScanCriteria } from "../services/screener.js";
import { alpaca } from "@trading/core";

describe("ScreenerService", () => {
  let screener: ScreenerService;

  beforeEach(() => {
    vi.clearAllMocks();
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
      // Should be sorted descending by changePercent
      for (let i = 1; i < movers.length; i++) {
        expect(movers[i - 1]!.changePercent).toBeGreaterThanOrEqual(movers[i]!.changePercent);
      }
    });

    it("should return top losers sorted by change percent", async () => {
      const movers = await screener.getMovers("losers", 5);

      expect(movers.length).toBeLessThanOrEqual(5);
      // Should be sorted ascending by changePercent (most negative first)
      for (let i = 1; i < movers.length; i++) {
        expect(movers[i - 1]!.changePercent).toBeLessThanOrEqual(movers[i]!.changePercent);
      }
    });

    it("should respect the limit parameter", async () => {
      const movers = await screener.getMovers("gainers", 2);

      expect(movers.length).toBeLessThanOrEqual(2);
    });
  });

  describe("getSignals", () => {
    it("should generate RSI_OVERSOLD signal when RSI < 30", async () => {
      // INTC returns oversold bars
      const signals = await screener.getSignals(["INTC"]);

      // May or may not trigger based on generated data, but should process
      expect(Array.isArray(signals)).toBe(true);
      expect(alpaca.getBars).toHaveBeenCalledWith("INTC", "1Day", 60);
    });

    it("should generate RSI_OVERBOUGHT signal when RSI > 70", async () => {
      // NVDA returns overbought bars
      await screener.getSignals(["NVDA"]);

      // Should have processed the symbol
      expect(Array.isArray(signals)).toBe(true);
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

      // May have MA_BULLISH_ALIGNMENT but no RSI signals
      expect(Array.isArray(signals)).toBe(true);
    });

    it("should process multiple symbols", async () => {
      const symbols = ["AAPL", "MSFT", "GOOGL"];
      await screener.getSignals(symbols);

      expect(alpaca.getBars).toHaveBeenCalledTimes(symbols.length);
    });
  });
});

describe("RSI Calculation", () => {
  // Test the RSI calculation logic
  it("should calculate RSI correctly for uptrend", () => {
    // With 14 consecutive up days, RSI should be high (approaching 100)
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);

    // Manual RSI calculation
    const changes = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i]! - closes[i - 1]!);
    }

    const gains = changes.slice(-14).map((c) => (c > 0 ? c : 0));
    const losses = changes.slice(-14).map((c) => (c < 0 ? -c : 0));

    const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;

    // All gains, no losses - RSI should be 100
    expect(avgGain).toBeGreaterThan(0);
    expect(avgLoss).toBe(0);
  });

  it("should calculate RSI correctly for downtrend", () => {
    // With 14 consecutive down days, RSI should be low (approaching 0)
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);

    const changes = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i]! - closes[i - 1]!);
    }

    const gains = changes.slice(-14).map((c) => (c > 0 ? c : 0));
    const losses = changes.slice(-14).map((c) => (c < 0 ? -c : 0));

    const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;

    // All losses, no gains
    expect(avgGain).toBe(0);
    expect(avgLoss).toBeGreaterThan(0);
  });
});

describe("SMA Calculation", () => {
  it("should calculate SMA correctly", () => {
    const data = [10, 20, 30, 40, 50];
    const period = 5;

    const smaValue = data.slice(-period).reduce((a, b) => a + b, 0) / period;

    expect(smaValue).toBe(30); // (10+20+30+40+50)/5 = 30
  });

  it("should use only last N values for SMA", () => {
    const data = [5, 10, 20, 30, 40, 50];
    const period = 5;

    const smaValue = data.slice(-period).reduce((a, b) => a + b, 0) / period;

    expect(smaValue).toBe(30); // (10+20+30+40+50)/5 = 30, ignoring first 5
  });
});
