import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FINNHUB_API_KEY", "synthetic-only");
  vi.stubEnv("POLYGON_API_KEY", "synthetic-only");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Finnhub callback-to-quote normalization", () => {
  it.each([{}, { c: 0 }, { c: -1 }, { c: Number.NaN }])(
    "rejects unusable price in %j",
    async (payload) => {
      const sdk = await import("finnhub");

      const callback = vi
        .spyOn(sdk.DefaultApi.prototype, "quote")
        .mockImplementation((_symbol, cb) => {
          cb(null, payload);
        });

      const { finnhubProvider } = await import("@/providers/finnhub.js");
      expect(await finnhubProvider.getQuote("TEST")).toBeNull();
      expect(callback).toHaveBeenCalledOnce();
    },
  );

  it("keeps the observed epoch time and genuine zero changes without inventing volume", async () => {
    const sdk = await import("finnhub");
    vi.spyOn(sdk.DefaultApi.prototype, "quote").mockImplementation((_symbol, cb) => {
      cb(null, { c: 123, d: 0, dp: 0, t: 1792785600 });
    });
    const { finnhubProvider } = await import("@/providers/finnhub.js");
    expect(await finnhubProvider.getQuote("TEST")).toMatchObject({
      symbol: "TEST",
      price: 123,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      change: 0,
      changePercent: 0,
      source: "finnhub",
      kind: "market_snapshot",
      timestamp: new Date(1792785600 * 1000).toISOString(),
    });
  });
});

describe("Polygon previous-session snapshots", () => {
  it.each([{}, { c: 0 }, { c: -1 }])("rejects a bar without a usable close: %j", async (bar) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: [bar] })));
    const { polygon } = await import("@/providers/polygon.js");
    expect(await polygon.getPreviousClose("TEST")).toBeNull();
  });

  it("labels previous-session data and preserves its bar timestamp without inventing a daily change", async () => {
    const time = Date.parse("2026-10-23T04:00:00Z");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ results: [{ T: "TEST", c: 123, v: 0, t: time }] })),
    );
    const { polygon } = await import("@/providers/polygon.js");
    expect(await polygon.getPreviousClose("TEST")).toMatchObject({
      price: 123,
      close: null,
      open: null,
      high: null,
      low: null,
      volume: 0,
      change: null,
      changePercent: null,
      timestamp: new Date(time).toISOString(),
      source: "polygon",
      kind: "previous_session_bar",
    });
  });
});
