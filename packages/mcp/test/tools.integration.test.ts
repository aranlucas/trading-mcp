import { z } from "zod";
import { BarSchema } from "@trading/core";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { connectTestTools, ToolTextSchema } from "@test/mcp-test-client.js";
import type { ToolDependencies } from "@/tools/index.js";
import { registerAllTools } from "@/tools/index.js";

const dependencies = {
  alpaca: {
    getQuote: vi.fn<ToolDependencies["alpaca"]["getQuote"]>().mockResolvedValue({
      symbol: "AAPL",
      price: 175.5,
      open: 174.0,
      high: 176.2,
      low: 173.8,
      close: 175.5,
      volume: 50000000,
      change: 1.5,
      changePercent: 0.86,
      timestamp: "2024-01-15T16:00:00Z",
    }),
    getBars: vi.fn<ToolDependencies["alpaca"]["getBars"]>().mockResolvedValue([
      {
        t: "2024-01-15",
        o: 174.0,
        h: 176.2,
        l: 173.8,
        c: 175.5,
        v: 50000000,
      },
    ]),
    getMarketClock: vi.fn<ToolDependencies["alpaca"]["getMarketClock"]>().mockResolvedValue({
      isOpen: true,
      nextOpen: "2024-01-16T09:30:00-05:00",
      nextClose: "2024-01-15T16:00:00-05:00",
    }),
    getAccount: vi.fn<ToolDependencies["alpaca"]["getAccount"]>().mockResolvedValue({
      id: "account-123",
      status: "ACTIVE",
      equity: "100000.00",
      cash: "50000.00",
      buying_power: "100000.00",
    }),
    getPositions: vi.fn<ToolDependencies["alpaca"]["getPositions"]>().mockResolvedValue([
      {
        symbol: "AAPL",
        quantity: 100,
        avgCost: 150.0,
        currentPrice: 175.5,
        marketValue: 17550,
        unrealizedPL: 2550,
        unrealizedPLPercent: 17.0,
      },
    ]),
    getPortfolio: vi.fn<ToolDependencies["alpaca"]["getPortfolio"]>().mockResolvedValue({
      equity: 100000,
      cash: 50000,
      buyingPower: 100000,
      dayChange: 500,
      dayChangePercent: 0.5,
      positions: [],
    }),
    placeOrder: vi.fn<ToolDependencies["alpaca"]["placeOrder"]>().mockResolvedValue({
      id: "order-123",
      symbol: "AAPL",
      side: "buy",
      type: "limit",
      quantity: 10,
      filledQuantity: 0,
      limitPrice: 175.0,
      status: "open",
      timeInForce: "day",
      createdAt: "2024-01-15T10:00:00Z",
    }),
    getOrder: vi.fn<ToolDependencies["alpaca"]["getOrder"]>().mockResolvedValue({
      id: "order-123",
      symbol: "AAPL",
      side: "buy",
      type: "limit",
      quantity: 10,
      filledQuantity: 0,
      limitPrice: 175.0,
      status: "open",
      timeInForce: "day",
      createdAt: "2024-01-15T10:00:00Z",
    }),
    getOrders: vi.fn<ToolDependencies["alpaca"]["getOrders"]>().mockResolvedValue([]),
    cancelOrder: vi.fn<ToolDependencies["alpaca"]["cancelOrder"]>().mockResolvedValue(),
  },
  polygon: {
    isConfigured: vi.fn<ToolDependencies["polygon"]["isConfigured"]>().mockReturnValue(false),
    getGainersLosers: vi
      .fn<ToolDependencies["polygon"]["getGainersLosers"]>()
      .mockResolvedValue([]),
  },
  finviz: {
    getOversold: vi.fn<ToolDependencies["finviz"]["getOversold"]>().mockResolvedValue([]),
    getOverbought: vi.fn<ToolDependencies["finviz"]["getOverbought"]>().mockResolvedValue([]),
    getUnusualVolume: vi.fn<ToolDependencies["finviz"]["getUnusualVolume"]>().mockResolvedValue([]),
    getNewHighs: vi.fn<ToolDependencies["finviz"]["getNewHighs"]>().mockResolvedValue([]),
    getNewLows: vi.fn<ToolDependencies["finviz"]["getNewLows"]>().mockResolvedValue([]),
    getMostVolatile: vi.fn<ToolDependencies["finviz"]["getMostVolatile"]>().mockResolvedValue([]),
    getGainers: vi.fn<ToolDependencies["finviz"]["getGainers"]>().mockResolvedValue([]),
    getLosers: vi.fn<ToolDependencies["finviz"]["getLosers"]>().mockResolvedValue([]),
  },
  yahoo: {
    getTrending: vi.fn<ToolDependencies["yahoo"]["getTrending"]>().mockResolvedValue([]),
    search: vi.fn<ToolDependencies["yahoo"]["search"]>().mockResolvedValue({
      quotes: [],
      news: [],
      nav: [],
      lists: [],
      researchReports: [],
      screenerFieldResults: [],
      totalTime: 0,
      timeTakenForQuotes: 0,
      timeTakenForNews: 0,
      timeTakenForAlgowatchlist: 0,
      timeTakenForPredefinedScreener: 0,
      timeTakenForCrunchbase: 0,
      timeTakenForNav: 0,
      timeTakenForResearchReports: 0,
      timeTakenForScreenerField: 0,
      count: 0,
      explains: [],
      timeTakenForCulturalAssets: 0,
      timeTakenForSearchLists: 0,
    }),
    getOptions: vi
      .fn<ToolDependencies["yahoo"]["getOptions"]>()
      .mockResolvedValue({ expirationDates: [], calls: [], puts: [] }),
    getOptionsForExpiration: vi
      .fn<ToolDependencies["yahoo"]["getOptionsForExpiration"]>()
      .mockRejectedValue(new Error("No expiration fixture configured")),
  },
} satisfies ToolDependencies;

describe("MCP Tools Integration", () => {
  let harness: Awaited<ReturnType<typeof connectTestTools>>;
  let registeredTools: Awaited<ReturnType<typeof connectTestTools>>["tools"];

  beforeEach(async () => {
    vi.clearAllMocks();
    harness = await connectTestTools((server) => registerAllTools(server, dependencies));
    registeredTools = harness.tools;
  });

  afterEach(async () => {
    await harness.close();
  });

  describe("Tool Registration", () => {
    it("should register all expected tools", () => {
      const expectedTools = [
        "get_quote",
        "get_bars",
        "get_market_status",
        "get_account",
        "get_portfolio",
        "get_positions",
        "place_order",
        "get_order",
        "list_orders",
        "cancel_order",
      ];

      for (const tool of expectedTools) {
        expect(registeredTools.has(tool)).toBe(true);
      }
    });
  });

  describe("Market Tools", () => {
    it("get_quote should return quote data", async () => {
      const tool = registeredTools.get("get_quote");
      const result = await tool!.handler({ symbol: "AAPL" });

      expect(result).toHaveProperty("content");
      const content = ToolTextSchema.parse(result);
      const quote = z.object({ symbol: z.string(), price: z.number() }).parse(JSON.parse(content));
      expect(quote.symbol).toBe("AAPL");
      expect(quote.price).toBe(175.5);
    });

    it("get_bars should return historical data", async () => {
      const tool = registeredTools.get("get_bars");

      const result = await tool!.handler({
        symbol: "AAPL",
        timeframe: "1Day",
        limit: 10,
      });

      expect(result).toHaveProperty("content");
      const content = ToolTextSchema.parse(result);
      const bars = z.array(BarSchema).parse(JSON.parse(content));
      expect(bars).toHaveLength(1);
      expect(bars[0]?.c).toBe(175.5);
    });

    it("get_market_status should return market clock", async () => {
      const tool = registeredTools.get("get_market_status");
      const result = await tool!.handler({});

      expect(result).toHaveProperty("content");
      const content = ToolTextSchema.parse(result);
      const status = z.object({ isOpen: z.boolean() }).parse(JSON.parse(content));
      expect(status.isOpen).toBe(true);
    });
  });

  describe("Portfolio Tools", () => {
    it("get_account should return account info", async () => {
      const tool = registeredTools.get("get_account");
      const result = await tool!.handler({});

      expect(result).toHaveProperty("content");
      const content = ToolTextSchema.parse(result);
      const account = z.object({ equity: z.string(), cash: z.string() }).parse(JSON.parse(content));
      expect(account.equity).toBe("100000.00");
      expect(account.cash).toBe("50000.00");
    });

    it("get_positions should return positions", async () => {
      const tool = registeredTools.get("get_positions");
      const result = await tool!.handler({});

      expect(result).toHaveProperty("content");
      const content = ToolTextSchema.parse(result);

      const positions = z
        .array(z.object({ symbol: z.string(), quantity: z.number() }))
        .parse(JSON.parse(content));

      expect(positions).toEqual([{ symbol: "AAPL", quantity: 100 }]);
    });
  });

  describe("Order Tools", () => {
    it("place_order should validate limit price for limit orders", async () => {
      const tool = registeredTools.get("place_order");

      const result = await tool!.handler({
        symbol: "AAPL",
        side: "buy",
        quantity: 10,
        type: "limit",
        timeInForce: "day",
        // Missing limitPrice
      });

      expect(result).toHaveProperty("isError", true);
      const content = ToolTextSchema.parse(result);
      expect(content).toContain("limit_price required");
    });

    it("place_order should validate stop price for stop orders", async () => {
      const tool = registeredTools.get("place_order");

      const result = await tool!.handler({
        symbol: "AAPL",
        side: "buy",
        quantity: 10,
        type: "stop",
        timeInForce: "day",
        // Missing stopPrice
      });

      expect(result).toHaveProperty("isError", true);
      const content = ToolTextSchema.parse(result);
      expect(content).toContain("stop_price required");
    });

    it("place_order should place valid market order", async () => {
      const tool = registeredTools.get("place_order");

      const result = await tool!.handler({
        symbol: "AAPL",
        side: "buy",
        quantity: 10,
        type: "market",
        timeInForce: "day",
      });

      expect(result).not.toHaveProperty("isError");
      const content = ToolTextSchema.parse(result);
      const order = z.object({ id: z.string(), symbol: z.string() }).parse(JSON.parse(content));
      expect(order.symbol).toBe("AAPL");
    });

    it("place_order should place valid limit order with price", async () => {
      const tool = registeredTools.get("place_order");

      const result = await tool!.handler({
        symbol: "AAPL",
        side: "buy",
        quantity: 10,
        type: "limit",
        limitPrice: 175.0,
        timeInForce: "day",
      });

      expect(result).not.toHaveProperty("isError");
    });

    it("get_order should return order details", async () => {
      const tool = registeredTools.get("get_order");
      const result = await tool!.handler({ orderId: "order-123" });

      expect(result).toHaveProperty("content");
      const content = ToolTextSchema.parse(result);
      const order = z.object({ id: z.string(), symbol: z.string() }).parse(JSON.parse(content));
      expect(order.id).toBe("order-123");
    });

    it("cancel_order acknowledges the request without inventing a terminal broker status", async () => {
      const tool = registeredTools.get("cancel_order");
      const result = await tool!.handler({ orderId: "order-123" });

      expect(result).toHaveProperty("content");
      const content = ToolTextSchema.parse(result);
      expect(JSON.parse(content)).toMatchObject({
        orderId: "order-123",
        status: "cancel_requested",
      });
      expect(dependencies.alpaca.cancelOrder).toHaveBeenCalledExactlyOnceWith("order-123");
      expect(dependencies.alpaca.getOrder).not.toHaveBeenCalled();
      expect(dependencies.alpaca.placeOrder).not.toHaveBeenCalled();
    });

    it.each(["filled", "canceled"])(
      "preserves pending_cancel and subsequent broker status %s after acknowledgement",
      async (status) => {
        const order = await dependencies.alpaca.getOrder("order-123");
        dependencies.alpaca.getOrder.mockClear();
        dependencies.alpaca.getOrder
          .mockResolvedValueOnce({ ...order, status: "pending_cancel" })
          .mockResolvedValueOnce({ ...order, status });
        const cancelled = await registeredTools.get("cancel_order")!.handler({ orderId: order.id });
        expect(JSON.parse(ToolTextSchema.parse(cancelled))).toMatchObject({
          orderId: order.id,
          status: "cancel_requested",
        });
        const pending = await registeredTools.get("get_order")!.handler({ orderId: order.id });
        expect(JSON.parse(ToolTextSchema.parse(pending))).toMatchObject({
          status: "pending_cancel",
        });
        const final = await registeredTools.get("get_order")!.handler({ orderId: order.id });
        expect(JSON.parse(ToolTextSchema.parse(final))).toMatchObject({ status });
        expect(dependencies.alpaca.placeOrder).not.toHaveBeenCalled();
      },
    );

    it.each(["rejected", "timed out"])(
      "reports an unconfirmed cancel request when %s",
      async (reason) => {
        dependencies.alpaca.cancelOrder.mockRejectedValueOnce(
          new Error(`private broker detail: ${reason}`),
        );
        const result = await registeredTools.get("cancel_order")!.handler({ orderId: "order-123" });
        expect(result.isError).toBe(true);
        const text = ToolTextSchema.parse(result);
        expect(JSON.parse(text)).toMatchObject({
          orderId: "order-123",
          status: "cancel_request_unconfirmed",
        });
        expect(text).not.toContain("private broker detail");
        expect(dependencies.alpaca.cancelOrder).toHaveBeenCalledExactlyOnceWith("order-123");
        expect(dependencies.alpaca.getOrder).not.toHaveBeenCalled();
        expect(dependencies.alpaca.placeOrder).not.toHaveBeenCalled();
      },
    );
  });
});
