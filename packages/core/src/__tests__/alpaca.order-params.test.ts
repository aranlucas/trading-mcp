import { describe, expect, it } from "vitest";
import { AlpacaOrderRequestSchema } from "../lib/alpaca.js";

describe("AlpacaOrderRequestSchema", () => {
  it("rejects limit order without limit_price", () => {
    const parsed = AlpacaOrderRequestSchema.safeParse({
      symbol: "AAPL",
      qty: 1,
      side: "buy",
      type: "limit",
      time_in_force: "day",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects stop order without stop_price", () => {
    const parsed = AlpacaOrderRequestSchema.safeParse({
      symbol: "AAPL",
      qty: 1,
      side: "buy",
      type: "stop",
      time_in_force: "day",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts stop_limit order with both prices", () => {
    const parsed = AlpacaOrderRequestSchema.safeParse({
      symbol: "AAPL",
      qty: 2,
      side: "sell",
      type: "stop_limit",
      time_in_force: "gtc",
      limit_price: 100,
      stop_price: 101,
    });
    expect(parsed.success).toBe(true);
  });
});
