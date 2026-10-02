import { afterEach, describe, expect, it, vi } from "vitest";
import { getMarketDataClient } from "../services/market-data.js";
import { yahoo } from "@trading/core";

vi.mock("@trading/core", () => ({
  alpaca: {},
  yahoo: { getHistory: vi.fn() },
}));

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
    } as unknown as Awaited<ReturnType<typeof yahoo.getHistory>>);
    const { client } = getMarketDataClient();
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
    expect(await getMarketDataClient().client.getBars("AAPL", 0)).toEqual([]);
    expect(yahoo.getHistory).not.toHaveBeenCalled();
  });
});
