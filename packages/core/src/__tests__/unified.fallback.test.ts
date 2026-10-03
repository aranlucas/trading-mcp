import { afterEach, describe, expect, it, vi } from "vitest";
import { createUnified } from "../providers/index.js";
import { ProviderError } from "../lib/errors.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("unified.getQuote fallback", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the first successful provider result (parallel)", async () => {
    vi.useFakeTimers();

    const finnhub = (await import("../providers/finnhub.js")).finnhubProvider;
    const polygon = (await import("../providers/polygon.js")).polygon;
    vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(false);

    const unified = createUnified({ quoteTimeoutMs: 2000, quoteRetries: 0 });

    // Monkey-patch the provider implementations by mocking the module boundary via dynamic import.
    // This test validates first-success behavior via timing, not provider internals.
    const yahoo = (await import("../providers/yahoo.js")).yahoo;
    const finviz = (await import("../providers/finviz.js")).finviz;

    const yahooSpy = vi
      .spyOn(yahoo, "getQuoteNormalized")
      .mockImplementation(async (symbol: string) => {
        await sleep(500);

        return {
          symbol,
          price: 111,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          volume: 0,
          change: 0,
          changePercent: 0,
          timestamp: new Date().toISOString(),
        };
      });

    const finvizSpy = vi.spyOn(finviz, "getQuote").mockImplementation(async (symbol: string) => {
      await sleep(10);

      return {
        symbol,
        price: 222,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 0,
        change: 0,
        changePercent: 0,
        timestamp: new Date().toISOString(),
      };
    });

    const pending = unified.getQuote("AAPL");

    await vi.advanceTimersByTimeAsync(20);
    await expect(pending).resolves.toMatchObject({ symbol: "AAPL", price: 222 });

    expect(finvizSpy).toHaveBeenCalledTimes(1);
    expect(yahooSpy).toHaveBeenCalledTimes(1);

    const metrics = unified.getProviderMetrics();
    expect(metrics.providers.finviz?.getQuote?.totals.success).toBe(1);
  });

  it("retries retryable failures", async () => {
    vi.useFakeTimers();

    const finnhub = (await import("../providers/finnhub.js")).finnhubProvider;
    const polygon = (await import("../providers/polygon.js")).polygon;
    vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(false);

    const unified = createUnified({
      quoteTimeoutMs: 2000,
      quoteRetries: 1,
      quoteRetryMinDelayMs: 10,
    });

    const yahoo = (await import("../providers/yahoo.js")).yahoo;
    const finviz = (await import("../providers/finviz.js")).finviz;

    const yahooSpy = vi
      .spyOn(yahoo, "getQuoteNormalized")
      .mockImplementationOnce(async () => {
        throw Object.assign(new Error("fetch failed"), { code: "ECONNRESET" });
      })
      .mockImplementationOnce(async (symbol: string) => {
        await sleep(1);

        return {
          symbol,
          price: 333,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          volume: 0,
          change: 0,
          changePercent: 0,
          timestamp: new Date().toISOString(),
        };
      });

    vi.spyOn(finviz, "getQuote").mockResolvedValue(null);

    const pending = unified.getQuote("MSFT");
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({ symbol: "MSFT", price: 333 });
    expect(yahooSpy).toHaveBeenCalledTimes(2);
  });

  it("wraps all-provider failure into a unified ProviderError (AggregateError cause)", async () => {
    const finnhub = (await import("../providers/finnhub.js")).finnhubProvider;
    const polygon = (await import("../providers/polygon.js")).polygon;
    vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(false);

    const unified = createUnified({ quoteRetries: 0 });

    const yahoo = (await import("../providers/yahoo.js")).yahoo;
    const finviz = (await import("../providers/finviz.js")).finviz;

    vi.spyOn(yahoo, "getQuoteNormalized").mockRejectedValueOnce(new Error("yahoo down"));
    vi.spyOn(finviz, "getQuote").mockRejectedValueOnce(new Error("finviz down"));

    try {
      await unified.getQuote("AAPL");
      throw new Error("expected unified.getQuote to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);

      if (!(err instanceof ProviderError)) throw err;
      const pe = err;
      expect(pe.provider).toBe("unified");
      expect(pe.operation).toBe("getQuote");
      expect(pe.cause).toBeInstanceOf(AggregateError);
    }
  });

  it("treats provider timeouts as failures and records metrics", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-05T00:00:00.000Z"));

    const finnhub = (await import("../providers/finnhub.js")).finnhubProvider;
    const polygon = (await import("../providers/polygon.js")).polygon;
    vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(false);

    const unified = createUnified({ quoteTimeoutMs: 10, quoteRetries: 0 });

    const yahoo = (await import("../providers/yahoo.js")).yahoo;
    const finviz = (await import("../providers/finviz.js")).finviz;

    vi.spyOn(yahoo, "getQuoteNormalized").mockImplementation(async () => {
      await new Promise<void>(() => {});
      throw new Error("unreachable");
    });
    vi.spyOn(finviz, "getQuote").mockImplementation(async () => {
      await new Promise<void>(() => {});

      return null;
    });

    const pending = unified.getQuote("TSLA");
    const assertion = expect(pending).rejects.toBeInstanceOf(ProviderError);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;

    const snap = unified.getProviderMetrics();
    expect(snap.providers.yahoo?.getQuote?.totals.failure).toBe(1);
    expect(snap.providers.finviz?.getQuote?.totals.failure).toBe(1);
  });
});
