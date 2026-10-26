import { afterEach, describe, expect, it, vi } from "vitest";
import { finviz, createUnified, yahoo, finnhub, polygon } from "@/providers/index.js";
import { normalizeYahooQuote } from "@/providers/yahoo.js";
import { ProviderError } from "@/lib/errors.js";
import { quoteChange } from "@/lib/quote.js";

function snapshot(price: string, fields = "", symbol = "AAPL") {
  return `<link rel="canonical" href="https://finviz.com/quote.ashx?t=${symbol}"><h1 class="quote-header_ticker-wrapper_ticker">${symbol}</h1><table class="snapshot-table2"><tr><td>Price</td><td class="snapshot-td2-cp"><b>${price}</b></td>${fields}</tr></table>`;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Finviz quote quality", () => {
  it.each([
    snapshot("500", "", "MSFT"),
    '<table class="snapshot-table2"><tr><td>Price</td><td>500</td></tr></table>',
    snapshot("100").replace("t=AAPL", "t=MSFT"),
    snapshot("100").replace("t=AAPL", "t=AAPL&t=MSFT"),
    snapshot("100").replace("https://finviz.com/", "https://finviz.com.attacker.example/"),
  ])("rejects missing, conflicting or wrong response identity", async (html) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html)));
    expect(await finviz.getQuote("AAPL")).toBeNull();
  });

  it("a wrong-ticker page cannot win a race or earn provider success metrics", async () => {
    vi.useFakeTimers();
    vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(snapshot("500", "", "MSFT"))));
    vi.spyOn(yahoo, "getQuoteNormalized").mockImplementation(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      return normalizeYahooQuote({ symbol: "AAPL", regularMarketPrice: 100 });
    });
    const source = createUnified({ quoteRetries: 0 });
    const result = source.getQuote("AAPL");
    await vi.advanceTimersByTimeAsync(30);
    await expect(result).resolves.toMatchObject({ symbol: "AAPL", source: "yahoo", price: 100 });
    expect(source.getProviderMetrics().providers.finviz?.getQuote?.totals).toMatchObject({
      success: 0,
      failure: 1,
    });
  });

  it.each([403, 429, 500])(
    "rejects HTTP %s without treating its body as a quote",
    async (status) => {
      const response = new Response(snapshot("100"), { status });
      const read = vi.spyOn(response, "text");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      expect(await finviz.getQuote("AAPL")).toBeNull();
      expect(read).not.toHaveBeenCalled();
    },
  );

  it.each(["", "-", "0", "-1", "NaN", "Infinity", "12USD", "12%", "1,2"])(
    "rejects unavailable or malformed required price %j",
    async (price) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(snapshot(price))));
      expect(await finviz.getQuote("AAPL")).toBeNull();
    },
  );

  it("preserves a valid price and actual zero fields without fabricating missing values or an as-of time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            snapshot(
              "1,234.50",
              "<td>Volume</td><td><b>0</b></td><td>Change</td><td><span>0.00%</span></td>",
            ),
          ),
        ),
    );
    expect(await finviz.getQuote("aapl")).toMatchObject({
      symbol: "AAPL",
      price: 1234.5,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: 0,
      change: null,
      changePercent: 0,
      timestamp: null,
      source: "finviz",
      kind: "web_snapshot",
      retrievedAt: "2026-10-26T10:00:00.000Z",
    });
  });

  it.each([403, 429, 200])(
    "a fast unusable HTTP %s page cannot win over a valid provider",
    async (status) => {
      vi.useFakeTimers();
      vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
      vi.spyOn(polygon, "isConfigured").mockReturnValue(false);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("<html>Unavailable</html>", { status })),
      );
      vi.spyOn(yahoo, "getQuoteNormalized").mockImplementation(async (symbol) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });

        return {
          symbol,
          price: 100,
          open: 99,
          high: 101,
          low: 98,
          close: 99,
          volume: 0,
          change: 1,
          changePercent: 1.01,
          timestamp: "2026-10-26T09:59:00.000Z",
          source: "yahoo",
          kind: "market_snapshot",
          retrievedAt: "2026-10-26T10:00:00.000Z",
        };
      });
      const source = createUnified({ quoteRetries: 0 });
      const pending = source.getQuote("AAPL");
      await vi.advanceTimersByTimeAsync(30);
      await expect(pending).resolves.toMatchObject({ price: 100, source: "yahoo" });
      expect(source.getProviderMetrics().providers.finviz?.getQuote?.totals).toMatchObject({
        success: 0,
        failure: 1,
      });
    },
  );

  it("parses unit volumes and derives change only from a usable previous close", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            snapshot(
              "110",
              "<td>Prev Close</td><td>100</td><td>Volume</td><td>1.25M</td><td>Open</td><td>-</td><td>Change</td><td>unavailable</td>",
            ),
          ),
        ),
    );
    expect(await finviz.getQuote("AAPL")).toMatchObject({
      price: 110,
      close: 100,
      volume: 1_250_000,
      open: null,
      change: 10,
      changePercent: 10,
    });
  });
});

describe("Yahoo quote availability", () => {
  it("rejects a response for another requested symbol", () => {
    expect(() => normalizeYahooQuote({ symbol: "MSFT", regularMarketPrice: 100 }, "AAPL")).toThrow(
      "Quote symbol does not match the request",
    );
  });
  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects required price %s",
    (price) => {
      expect(() =>
        normalizeYahooQuote({ symbol: "AAPL", regularMarketPrice: price }, "AAPL"),
      ).toThrow("Invalid Yahoo quote response");
    },
  );

  it("keeps the source timestamp and distinguishes missing fields from real zeroes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
    expect(
      normalizeYahooQuote(
        {
          symbol: "AAPL",
          regularMarketPrice: 100,
          regularMarketVolume: 0,
          regularMarketChange: 0,
          regularMarketChangePercent: 0,
          regularMarketTime: new Date("2026-10-25T20:00:00Z"),
        },
        "AAPL",
      ),
    ).toMatchObject({
      price: 100,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: 0,
      change: 0,
      changePercent: 0,
      timestamp: "2026-10-25T20:00:00.000Z",
      source: "yahoo",
      kind: "market_snapshot",
      retrievedAt: "2026-10-26T10:00:00.000Z",
    });
  });
});

describe("Unified quote validation boundary", () => {
  it("rejects provider provenance mismatches before recording success", async () => {
    vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
    vi.spyOn(polygon, "isConfigured").mockReturnValue(false);
    const quote = normalizeYahooQuote({ symbol: "AAPL", regularMarketPrice: 100 });
    vi.spyOn(yahoo, "getQuoteNormalized").mockResolvedValue({ ...quote, source: "finviz" });
    vi.spyOn(finviz, "getQuote").mockResolvedValue(null);
    const source = createUnified({ quoteRetries: 0 });
    await expect(source.getQuote("AAPL")).rejects.toBeInstanceOf(ProviderError);
    expect(source.getProviderMetrics().providers.yahoo?.getQuote?.totals).toMatchObject({
      success: 0,
      failure: 1,
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not record invalid provider price %s as success",
    async (price) => {
      vi.spyOn(finnhub, "isConfigured").mockReturnValue(false);
      vi.spyOn(polygon, "isConfigured").mockReturnValue(false);
      const quote = normalizeYahooQuote({ symbol: "AAPL", regularMarketPrice: 100 }, "AAPL");
      vi.spyOn(yahoo, "getQuoteNormalized").mockResolvedValue({ ...quote, price });
      vi.spyOn(finviz, "getQuote").mockResolvedValue(null);
      const source = createUnified({ quoteRetries: 0 });
      await expect(source.getQuote("AAPL")).rejects.toBeInstanceOf(ProviderError);
      expect(source.getProviderMetrics().providers.yahoo?.getQuote?.totals).toMatchObject({
        success: 0,
        failure: 1,
      });
    },
  );
});

it("preserves unavailable change inputs and does not emit arithmetic overflow", () => {
  expect(quoteChange(Number.NaN, 100)).toEqual({ change: null, changePercent: null });
  expect(quoteChange(100, null)).toEqual({ change: null, changePercent: null });
  expect(quoteChange(100, 0)).toEqual({ change: null, changePercent: null });
  expect(quoteChange(100, 100)).toEqual({ change: 0, changePercent: 0 });
  expect(quoteChange(1e308, 1e-308)).toEqual({ change: 1e308, changePercent: null });
});
