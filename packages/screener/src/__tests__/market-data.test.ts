import { afterEach, describe, expect, it, vi } from "vitest";
import { getMarketDataClient } from "../services/market-data.js";
import type { YahooMarketDataSource } from "../services/market-data.js";

const yahoo = {
  getHistory: vi.fn<YahooMarketDataSource["getHistory"]>(),
  getQuotes: vi.fn<YahooMarketDataSource["getQuotes"]>(),
  getQuote: vi.fn<YahooMarketDataSource["getQuote"]>(),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Yahoo market data history", () => {
  it("requests calendar headroom and returns the latest requested observations in order", async () => {
    vi.stubEnv("SCREENER_PROVIDER", "yahoo");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    vi.mocked(yahoo.getHistory).mockResolvedValueOnce({
      quotes: Array.from({ length: 70 }, (_, i) => ({
        date: new Date(Date.UTC(2026, 0, 70 - i)),
        close: 70 - i,
      })),
    });
    const { client } = getMarketDataClient(yahoo);
    const bars = await client.getBars("AAPL", 50);
    expect(bars).toHaveLength(50);
    expect(bars[0]?.c).toBe(21);
    expect(bars.at(-1)?.c).toBe(70);
    const from = vi.mocked(yahoo.getHistory).mock.calls[0]?.[1];
    expect(from).toBeInstanceOf(Date);
    expect((Date.now() - new Date(from!).getTime()) / 86_400_000).toBeGreaterThanOrEqual(84);
  });

  it("does not turn a request for no observations into a provider call", async () => {
    vi.stubEnv("SCREENER_PROVIDER", "yahoo");
    vi.mocked(yahoo.getHistory).mockClear();
    expect(await getMarketDataClient(yahoo).client.getBars("AAPL", 0)).toEqual([]);
    expect(yahoo.getHistory).not.toHaveBeenCalled();
  });
});
