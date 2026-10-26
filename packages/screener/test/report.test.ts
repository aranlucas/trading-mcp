import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenerService, type ScanResult } from "@/services/screener.js";
import { scan, getMovers } from "@/scripts/lib/screener-api.js";
import { formatMoversBlock, formatScanBlock } from "@/scripts/lib/report.js";

afterEach(() => vi.restoreAllMocks());

describe("built-in reporting client", () => {
  it("accepts nullable scan rows through the real in-memory REST route", async () => {
    const results = [
      { symbol: "AAPL", price: 100, volume: null, change: null, changePercent: null },
    ];

    vi.spyOn(ScreenerService.prototype, "scan").mockResolvedValue(results);
    await expect(scan({ symbols: ["AAPL"] })).resolves.toEqual(results);
  });

  it("accepts movers with a known percentage and unavailable volume/absolute change", async () => {
    const results = [{ symbol: "AAPL", price: 100, volume: null, change: null, changePercent: 2 }];
    vi.spyOn(ScreenerService.prototype, "getMovers").mockResolvedValue(results);
    await expect(getMovers({ direction: "gainers", limit: 10 })).resolves.toEqual(results);
    expect(formatMoversBlock("Gainers", results)).toBe(
      "Gainers\nAAPL $100.00 (+2.00%) vol unavailable",
    );
  });

  it("renders unknowns explicitly, preserves zeroes, and sorts known changes before unknowns", () => {
    const results: ScanResult[] = [
      { symbol: "UNKNOWN", price: 100, volume: null, change: null, changePercent: null },
      { symbol: "ZERO", price: 100, volume: 0, change: 0, changePercent: 0 },
      { symbol: "DOWN", price: 100, volume: 1_000_000, change: -4, changePercent: -4 },
    ];

    expect(formatScanBlock(results, 3)).toBe(
      "Scan\nDOWN $100.00 (-4.00%) vol 1.0M\nZERO $100.00 (0.00%) vol 0\nUNKNOWN $100.00 (unavailable) vol unavailable",
    );
    expect(formatScanBlock(results, 2)).not.toContain("UNKNOWN");
    expect(results.map((row) => row.symbol)).toEqual(["UNKNOWN", "ZERO", "DOWN"]);
  });
});
