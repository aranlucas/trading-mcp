import { createMockAlpaca } from "@alpacahq/alpaca-trade-api/testing";
import { describe, expect, it } from "vitest";
import { mapOrder, parseTimeframe, mapMarketClock } from "../lib/alpaca.js";

describe("Alpaca SDK order normalization (synthetic only)", () => {
  it.each([
    "new",
    "partially_filled",
    "pending_cancel",
    "canceled",
    "replaced",
    "done_for_day",
    "future_broker_state",
  ])("preserves broker status %s without inventing a local state", (status) => {
    const order = mapOrder({
      id: "synthetic-order",
      symbol: "TEST",
      type: "market",
      timeInForce: "day",
      status,
      side: "sell",
      qty: "2.5",
      filledQty: "1.25",
    });

    expect(order).toMatchObject({ status, side: "sell", quantity: 2.5, filledQuantity: 1.25 });
  });

  it("preserves SDK order types and time-in-force values beyond the submission form", () => {
    expect(
      mapOrder({ type: "trailing_stop", timeInForce: "opg", status: "accepted" }),
    ).toMatchObject({ type: "trailing_stop", timeInForce: "opg", status: "accepted" });
  });

  it("maps optional SDK camel-case prices and timestamps without raw-object assertions", () => {
    const createdAt = new Date("2026-01-01T12:00:00Z");
    expect(
      mapOrder({
        type: "stop_limit",
        timeInForce: "gtc",
        limitPrice: "123.45",
        stopPrice: "125",
        createdAt,
        filledAt: null,
      }),
    ).toMatchObject({
      limitPrice: 123.45,
      stopPrice: 125,
      createdAt: String(createdAt),
      filledAt: undefined,
    });
  });

  it("retains existing submission fallbacks when optional SDK values are absent", () => {
    expect(
      mapOrder(
        { type: "market", timeInForce: "day" },
        {
          symbol: "TEST",
          qty: 3,
          type: "market",
          side: "sell",
          time_in_force: "day",
        },
      ),
    ).toMatchObject({
      symbol: "TEST",
      quantity: 3,
      side: "sell",
      status: "new",
      filledQuantity: 0,
    });
  });
});

describe("Alpaca timeframe boundary", () => {
  it.each(["1Day", "5Min", "23Hour", "1Week", "1Month"])("builds SDK timeframe %s", (value) => {
    expect(parseTimeframe(value)).toBe(value);
  });

  it.each(["garbage", "0Min", "60Min", "1Second", "-1Day"])(
    "rejects invalid timeframe %s locally",
    (value) => {
      expect(() => parseTimeframe(value)).toThrow();
    },
  );
});

// Exercise the installed SDK transport and generated deserializers on actual wire keys.
// createMockAlpaca supplies canned in-memory fetch responses and cannot reach a broker.
describe("Alpaca wire-to-domain compatibility", () => {
  const wire = {
    id: "synthetic-wire-order",
    symbol: "TEST",
    side: "sell",
    type: "stop_limit",
    qty: "2.5",
    notional: null,
    filled_qty: "1.25",
    limit_price: "123.45",
    stop_price: "125.50",
    time_in_force: "gtc",
    created_at: "2026-01-01T12:00:00Z",
    filled_at: "2026-01-01T12:01:00Z",
  };

  it.each(["partially_filled", "future_broker_state"])(
    "deserializes snake_case orders and preserves %s",
    async (status) => {
      const client = createMockAlpaca([
        { method: "GET", path: "/v2/orders/synthetic-wire-order", body: { ...wire, status } },
      ]);

      const sdkOrder = await client.trading.orders.getOrderByOrderID({ orderId: wire.id });
      expect(sdkOrder.filledQty).toBe("1.25");
      expect(sdkOrder.createdAt).toBeInstanceOf(Date);
      expect(mapOrder(sdkOrder)).toEqual({
        id: wire.id,
        symbol: "TEST",
        side: "sell",
        type: "stop_limit",
        quantity: 2.5,
        filledQuantity: 1.25,
        limitPrice: 123.45,
        stopPrice: 125.5,
        status,
        timeInForce: "gtc",
        createdAt: String(new Date(wire.created_at)),
        filledAt: String(new Date(wire.filled_at)),
      });
    },
  );

  it("uses the same deserializer for the synthetic submit response", async () => {
    const client = createMockAlpaca([
      {
        method: "POST",
        path: "/v2/orders",
        body: { ...wire, status: "new", filled_qty: "0", filled_at: null },
      },
    ]);

    const sdkOrder = await client.trading.orders.submit({
      symbol: "TEST",
      qty: "2.5",
      side: "sell",
      type: "stop_limit",
      timeInForce: "gtc",
      limitPrice: "123.45",
      stopPrice: "125.50",
    });

    expect(mapOrder(sdkOrder)).toMatchObject({
      filledQuantity: 0,
      filledAt: undefined,
      status: "new",
      limitPrice: 123.45,
      stopPrice: 125.5,
    });
  });

  it.each([true, false])(
    "deserializes the legacy clock's snake_case fields (open=%s)",
    async (isOpen) => {
      const nextOpen = "2026-01-02T14:30:00Z";
      const nextClose = "2026-01-02T21:00:00Z";

      const client = createMockAlpaca([
        {
          method: "GET",
          path: "/v2/clock",
          body: {
            is_open: isOpen,
            next_open: nextOpen,
            next_close: nextClose,
            timestamp: "2026-01-01T12:00:00Z",
          },
        },
      ]);

      const sdkClock = await client.trading.clock.legacyClock();
      expect(sdkClock.nextOpen).toBeInstanceOf(Date);
      expect(mapMarketClock(sdkClock)).toEqual({
        isOpen,
        nextOpen: String(new Date(nextOpen)),
        nextClose: String(new Date(nextClose)),
      });
    },
  );
});
