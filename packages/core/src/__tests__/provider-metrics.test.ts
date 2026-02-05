import { describe, expect, it, vi } from "vitest";
import { createProviderMetrics } from "../lib/provider-metrics.js";

describe("provider metrics (rolling window)", () => {
  it("computes rolling error rate within window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-05T00:00:00.000Z"));

    const metrics = createProviderMetrics({ windowMs: 1000 });
    const now = Date.now();

    metrics.recordSuccess({ provider: "yahoo", operation: "getQuote", latencyMs: 10, at: now });
    metrics.recordFailure({
      provider: "yahoo",
      operation: "getQuote",
      latencyMs: 20,
      err: new Error("boom"),
      at: now + 100,
    });

    const snap = metrics.snapshot(now + 100);
    const yahoo = snap.providers.yahoo?.getQuote;
    expect(yahoo).toBeDefined();
    expect(yahoo?.rolling).toEqual({ total: 2, success: 1, failure: 1, errorRate: 0.5 });

    vi.useRealTimers();
  });

  it("prunes events outside the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-05T00:00:00.000Z"));

    const metrics = createProviderMetrics({ windowMs: 1000 });
    const base = Date.now();

    metrics.recordFailure({
      provider: "finviz",
      operation: "getQuote",
      latencyMs: 50,
      err: new Error("fail"),
      at: base,
    });

    metrics.recordSuccess({
      provider: "finviz",
      operation: "getQuote",
      latencyMs: 10,
      at: base + 2000,
    });

    const snap = metrics.snapshot(base + 2000);
    const finviz = snap.providers.finviz?.getQuote;
    expect(finviz?.rolling).toEqual({ total: 1, success: 1, failure: 0, errorRate: 0 });

    vi.useRealTimers();
  });

  it("redacts secret-looking query params in error messages", () => {
    const metrics = createProviderMetrics({ windowMs: 1000 });
    metrics.recordFailure({
      provider: "polygon",
      operation: "getQuote",
      latencyMs: 1,
      err: new Error("fetch failed: https://x.y/?apiKey=SECRET123&token=ABC"),
    });

    const snap = metrics.snapshot();
    const msg = snap.providers.polygon?.getQuote?.lastError?.message ?? "";
    expect(msg).toContain("apiKey=[REDACTED]");
    expect(msg).toContain("token=[REDACTED]");
  });
});
