import { beforeEach, describe, expect, it, vi } from "vitest";

const yahooMock = vi.hoisted(() => ({
  getQuote: vi.fn(),
  getQuotes: vi.fn(),
  getHistory: vi.fn(),
}));

vi.mock("@trading/core", () => ({
  yahoo: yahooMock,
}));

import { quotesRoutes } from "../routes/quotes.js";

describe("quotesRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("GET /:symbol uppercases and returns quote", async () => {
    yahooMock.getQuote.mockResolvedValueOnce({ symbol: "AAPL", price: 123.45 });

    const res = await quotesRoutes.request("http://test/aapl");

    expect(res.status).toBe(200);
    expect(yahooMock.getQuote).toHaveBeenCalledWith("AAPL");
    await expect(res.json()).resolves.toEqual({ symbol: "AAPL", price: 123.45 });
  });

  it("GET /:symbol rejects invalid symbols", async () => {
    const res = await quotesRoutes.request("http://test/aa!pl");
    expect(res.status).toBe(400);
  });

  it("POST /batch uppercases symbols and returns quotes", async () => {
    yahooMock.getQuotes.mockResolvedValueOnce([{ symbol: "AAPL" }, { symbol: "MSFT" }]);

    const res = await quotesRoutes.request("http://test/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: ["aapl", "msft"] }),
    });

    expect(res.status).toBe(200);
    expect(yahooMock.getQuotes).toHaveBeenCalledWith(["AAPL", "MSFT"]);
    await expect(res.json()).resolves.toEqual([{ symbol: "AAPL" }, { symbol: "MSFT" }]);
  });

  it("GET /:symbol/bars uses limit to compute history start date", async () => {
    yahooMock.getHistory.mockResolvedValueOnce({ bars: [] });

    vi.useFakeTimers();
    const frozen = new Date("2024-02-01T12:00:00.000Z");
    vi.setSystemTime(frozen);

    const res = await quotesRoutes.request("http://test/aapl/bars?limit=10");

    expect(res.status).toBe(200);
    expect(yahooMock.getHistory).toHaveBeenCalledTimes(1);
    expect(yahooMock.getHistory.mock.calls[0]?.[0]).toBe("AAPL");

    const start = yahooMock.getHistory.mock.calls[0]?.[1] as Date;
    const expected = new Date(frozen);
    expected.setDate(expected.getDate() - 10);
    expect(start.getTime()).toBe(expected.getTime());
  });
});
