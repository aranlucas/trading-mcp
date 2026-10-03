import { describe, expect, it } from "vitest";
import { normalizeYahooQuote } from "../providers/yahoo.js";

describe("Yahoo quote response parser", () => {
  it("rejects an invalid payload before field access", () => {
    expect(() => normalizeYahooQuote(123, "AAPL")).toThrow("Invalid Yahoo quote response");
  });

  it("normalizes a valid SDK quote and preserves the previous-close fallback", () => {
    expect(normalizeYahooQuote({ symbol: "aapl", regularMarketPrice: 123 }, "AAPL")).toMatchObject({
      symbol: "AAPL",
      price: 123,
      close: 123,
    });
  });
});
