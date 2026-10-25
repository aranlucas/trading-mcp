import { Alpaca } from "@alpacahq/alpaca-trade-api";
import { mockFetch } from "@alpacahq/alpaca-trade-api/testing";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelOrder,
  client,
  getBars,
  getOrder,
  getOrders,
  getPortfolio,
  getPositions,
  getQuote,
  getSnapshots,
  parseTimeframe,
  placeOrder,
} from "@/lib/alpaca.js";
import { NotFoundError, ProviderError, ValidationError, toPublicError } from "@/lib/errors.js";

const transport = vi.fn<ReturnType<typeof mockFetch>>();

const wireOrder = {
  id: "synthetic-order",
  symbol: "TEST",
  side: "sell",
  type: "stop_limit",
  qty: "2.5",
  filled_qty: "1.25",
  limit_price: "101.25",
  stop_price: "100.50",
  time_in_force: "day",
  status: "partially_filled",
};

const orderRequest = {
  symbol: "TEST",
  side: "sell" as const,
  type: "stop_limit" as const,
  qty: 2.5,
  limit_price: 101.25,
  stop_price: 100.5,
  time_in_force: "day" as const,
};

const wirePosition = {
  symbol: "TEST",
  qty: "-2.5",
  avg_entry_price: "101.25",
  current_price: "100.50",
  market_value: "-251.25",
  unrealized_pl: "1.875",
  unrealized_plpc: "0.0074074",
};

function bar(day: string, close: number) {
  return { t: `${day}T14:30:00Z`, o: close - 1, h: close + 2, l: close - 2, c: close, v: 100 };
}

beforeEach(() => {
  transport.mockReset();
  transport.mockRejectedValue(new Error("Unexpected synthetic request"));

  // Keep the installed SDK's serialization, pagination and errors with an in-memory transport.
  const syntheticClient = new Alpaca({
    keyId: "synthetic-key",
    secret: "synthetic-secret",
    paper: true,
    rateLimit: false,
    fetchApi: transport,
  });

  vi.spyOn(client, "trading", "get").mockReturnValue(syntheticClient.trading);
  vi.spyOn(client, "marketData", "get").mockReturnValue(syntheticClient.marketData);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Alpaca history through the installed SDK", () => {
  it("collects the requested latest bars across short pages, then stops and returns chronological data", async () => {
    transport.mockImplementation(
      mockFetch([
        {
          path: "/v2/stocks/bars",
          respond: ({ url }) => {
            const token = url.searchParams.get("page_token");

            if (!token) {
              return { bars: { TEST: [bar("2026-01-05", 105)] }, next_page_token: "page-2" };
            }

            if (token === "page-2") {
              return { bars: { TEST: [bar("2026-01-02", 100)] }, next_page_token: "page-3" };
            }

            return { bars: { TEST: [bar("2026-01-01", 99)] }, next_page_token: null };
          },
        },
      ]),
    );
    const bars = await getBars("TEST", "1Day", 2);

    expect(bars.map(({ t, c }) => ({ t, c }))).toEqual([
      { t: "2026-01-02T14:30:00.000Z", c: 100 },
      { t: "2026-01-05T14:30:00.000Z", c: 105 },
    ]);
    expect(transport).toHaveBeenCalledTimes(2);
    const url = new URL(transport.mock.calls[0]?.[0] ?? "");
    expect(url.searchParams.get("start")).toBe("1970-01-01T00:00:00.000Z");
    expect(url.searchParams.get("sort")).toBe("desc");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("uses only the latest two daily bars for price and previous close without requesting older pages", async () => {
    transport.mockImplementation(
      mockFetch([
        {
          path: "/v2/stocks/bars",
          body: {
            bars: { TEST: [bar("2026-01-05", 105), bar("2026-01-02", 100)] },
            next_page_token: "unneeded-page",
          },
        },
      ]),
    );

    expect(await getQuote("TEST")).toMatchObject({
      price: 105,
      close: 100,
      change: 5,
      changePercent: 5,
      timestamp: "2026-01-05T14:30:00.000Z",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 10001])(
    "rejects invalid bar count %s before requesting data",
    async (limit) => {
      await expect(getBars("TEST", "1Day", limit)).rejects.toBeInstanceOf(ValidationError);
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("classifies SDK-rejected timeframe amounts as local validation errors", () => {
    expect(() => parseTimeframe("60Min")).toThrow(ValidationError);
  });

  it("does not fabricate zero-price snapshots for symbols with no bars", async () => {
    transport.mockImplementation(
      mockFetch([
        {
          path: "/v2/stocks/bars",
          respond: ({ url }) => ({
            bars:
              url.searchParams.get("symbols") === "TEST" ? { TEST: [bar("2026-01-05", 105)] } : {},
            next_page_token: null,
          }),
        },
      ]),
    );

    await expect(getQuote("EMPTY")).rejects.toBeInstanceOf(NotFoundError);
    const snapshots = await getSnapshots(["TEST", "EMPTY"]);
    expect([...snapshots.keys()]).toEqual(["TEST"]);
    expect(snapshots.get("TEST")).toMatchObject({ price: 105, close: 105, change: 0 });
  });

  it("propagates a later-page failure instead of returning incomplete history", async () => {
    transport.mockImplementation(
      mockFetch([
        {
          path: "/v2/stocks/bars",
          respond: ({ url }) =>
            url.searchParams.has("page_token")
              ? Response.json({ code: 50310000, message: "Synthetic outage" }, { status: 503 })
              : { bars: { TEST: [bar("2026-01-05", 105)] }, next_page_token: "page-2" },
        },
      ]),
    );

    await expect(getBars("TEST", "1Day", 2)).rejects.toMatchObject({ status: 503 });
    // The SDK retries the failed GET twice; the successful first page is not replayed.
    expect(transport).toHaveBeenCalledTimes(4);
  });
});

describe("Alpaca financial response boundaries", () => {
  it("preserves signed fractional positions and zero balances in the portfolio", async () => {
    transport.mockImplementation(
      mockFetch([
        { path: "/v2/account", body: { equity: "1000.25", cash: "0", buying_power: "2000.50" } },
        { path: "/v2/positions", body: [wirePosition] },
      ]),
    );

    expect(await getPortfolio()).toMatchObject({
      equity: 1000.25,
      cash: 0,
      buyingPower: 2000.5,
      positions: [
        {
          symbol: "TEST",
          quantity: -2.5,
          avgCost: 101.25,
          currentPrice: 100.5,
          marketValue: -251.25,
          unrealizedPL: 1.875,
          unrealizedPLPercent: 0.74074,
        },
      ],
    });
  });

  it("rejects partially numeric account values as upstream failures", async () => {
    transport.mockImplementation(
      mockFetch([
        { path: "/v2/account", body: { equity: "1000oops", cash: "0", buying_power: "0" } },
        { path: "/v2/positions", body: [] },
      ]),
    );

    await expect(getPortfolio().catch(toPublicError)).resolves.toEqual({
      status: 502,
      code: "PROVIDER_ERROR",
      message: "Invalid numeric value in Alpaca response",
    });
  });

  it.each(["12oops", "Infinity", "", " "])(
    "rejects malformed position amounts (%j) instead of publishing plausible or nonfinite numbers",
    async (qty) => {
      transport.mockImplementation(
        mockFetch([{ path: "/v2/positions", body: [{ ...wirePosition, qty }] }]),
      );

      await expect(getPositions()).rejects.toBeInstanceOf(ProviderError);
    },
  );

  it("rejects malformed order prices through both retrieval and listing", async () => {
    transport.mockImplementation(
      mockFetch([
        { path: "/v2/orders/synthetic-order", body: { ...wireOrder, limit_price: "101.25oops" } },
        { path: "/v2/orders", body: [{ ...wireOrder, limit_price: "101.25oops" }] },
      ]),
    );

    await expect(getOrder("synthetic-order")).rejects.toBeInstanceOf(ProviderError);
    await expect(getOrders()).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("Alpaca order request and failure contracts", () => {
  it("serializes fractional amounts and returns the broker's actual order state", async () => {
    transport.mockImplementation(
      mockFetch([{ method: "POST", path: "/v2/orders", body: wireOrder }]),
    );

    expect(await placeOrder(orderRequest)).toMatchObject({
      id: "synthetic-order",
      quantity: 2.5,
      filledQuantity: 1.25,
      limitPrice: 101.25,
      stopPrice: 100.5,
      status: "partially_filled",
    });
    expect(transport).toHaveBeenCalledTimes(1);
    const body = transport.mock.calls[0]?.[1]?.body;
    expect(JSON.parse(z.string().parse(body))).toEqual({
      symbol: "TEST",
      qty: "2.5",
      side: "sell",
      type: "stop_limit",
      time_in_force: "day",
      limit_price: "101.25",
      stop_price: "100.5",
    });
  });

  it.each([
    { qty: 0 },
    { qty: -1 },
    { qty: Number.NaN },
    { qty: Number.POSITIVE_INFINITY },
    { limit_price: 0 },
    { stop_price: Number.POSITIVE_INFINITY },
    { limit_price: undefined },
    { stop_price: undefined },
  ])("rejects invalid amounts or missing prices without submitting: %j", async (invalid) => {
    await expect(placeOrder({ ...orderRequest, ...invalid })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("retains broker rejection details without resubmitting an order", async () => {
    transport.mockImplementation(
      mockFetch([
        {
          method: "POST",
          path: "/v2/orders",
          status: 422,
          headers: { "X-Request-ID": "synthetic-request" },
          body: { code: 42210000, message: "Synthetic rejection" },
        },
      ]),
    );

    await expect(placeOrder(orderRequest)).rejects.toMatchObject({
      status: 422,
      code: 42210000,
      message: "Synthetic rejection",
      requestId: "synthetic-request",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("propagates an ambiguous transport failure without resubmitting", async () => {
    transport.mockRejectedValue(new TypeError("Synthetic connection reset"));

    await expect(placeOrder(orderRequest)).rejects.toMatchObject({ name: "FetchError" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("does not turn a failed cancellation into success", async () => {
    transport.mockImplementation(
      mockFetch([
        {
          method: "DELETE",
          path: "/v2/orders/synthetic-order",
          status: 422,
          body: { code: 42210000, message: "Order cannot be canceled" },
        },
      ]),
    );

    await expect(cancelOrder("synthetic-order")).rejects.toMatchObject({ status: 422 });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
