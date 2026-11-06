import { afterEach, describe, expect, it, vi } from "vitest";
import { createUnified } from "@/providers/index.js";
import { yahoo, normalizeYahooQuote } from "@/providers/yahoo.js";
import { finviz } from "@/providers/finviz.js";
import { finnhubProvider } from "@/providers/finnhub.js";
import { polygon } from "@/providers/polygon.js";
import { fred } from "@/providers/fred.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("provider availability health", () => {
  it("reports unavailable nullable quotes and empty observations as unhealthy", async () => {
    vi.spyOn(yahoo, "getQuoteNormalized").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(finviz, "getQuote").mockResolvedValue(null);
    vi.spyOn(finnhubProvider, "isConfigured").mockReturnValue(true);
    vi.spyOn(finnhubProvider, "getQuote").mockResolvedValue(null);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(true);
    vi.spyOn(polygon, "getPreviousClose").mockResolvedValue(null);
    vi.spyOn(fred, "isConfigured").mockReturnValue(true);
    vi.spyOn(fred, "getSeries").mockResolvedValue([]);
    const health = await createUnified().healthCheck();
    expect(health.status).toBe("unhealthy");
    expect(Object.values(health.providers).map((provider) => provider.healthy)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("distinguishes a single available provider from two and skips unconfigured reads", async () => {
    vi.spyOn(yahoo, "getQuoteNormalized").mockResolvedValue(
      normalizeYahooQuote({ symbol: "AAPL", regularMarketPrice: 100 }),
    );
    const quote = vi.spyOn(finviz, "getQuote").mockResolvedValue(null);
    vi.spyOn(finnhubProvider, "isConfigured").mockReturnValue(false);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(false);
    vi.spyOn(fred, "isConfigured").mockReturnValue(false);
    const fredRead = vi.spyOn(fred, "getSeries");
    expect((await createUnified().healthCheck()).status).toBe("degraded");
    quote.mockResolvedValue({
      ...normalizeYahooQuote({ symbol: "AAPL", regularMarketPrice: 100 }),
      source: "finviz",
      kind: "web_snapshot",
    });
    expect((await createUnified().healthCheck()).status).toBe("healthy");
    expect(fredRead).not.toHaveBeenCalled();
  });
});
