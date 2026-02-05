import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../tools/index.js";

vi.mock("@trading/core", () => ({
  alpaca: {
    getQuote: vi.fn().mockResolvedValue({
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
    getBars: vi.fn().mockResolvedValue([
      {
        t: "2024-01-15",
        o: 174.0,
        h: 176.2,
        l: 173.8,
        c: 175.5,
        v: 50000000,
      },
    ]),
    getMarketClock: vi.fn().mockResolvedValue({
      isOpen: true,
      nextOpen: "2024-01-16T09:30:00-05:00",
      nextClose: "2024-01-15T16:00:00-05:00",
    }),
    getAccount: vi.fn().mockResolvedValue({
      id: "account-123",
      status: "ACTIVE",
      equity: "100000.00",
      cash: "50000.00",
      buying_power: "100000.00",
    }),
    getPositions: vi.fn().mockResolvedValue([
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
    getPortfolio: vi.fn().mockResolvedValue({
      equity: 100000,
      cash: 50000,
      buyingPower: 100000,
      dayChange: 500,
      dayChangePercent: 0.5,
      positions: [],
    }),
    placeOrder: vi.fn().mockResolvedValue({
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
    getOrder: vi.fn().mockResolvedValue({
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
    getOrders: vi.fn().mockResolvedValue([]),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    getSnapshots: vi.fn().mockResolvedValue(new Map()),
  },
  unified: {
    getQuote: vi.fn().mockResolvedValue({
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
    getBars: vi.fn().mockResolvedValue([]),
    getMovers: vi.fn().mockResolvedValue([]),
  },
  finviz: {
    getOversold: vi.fn().mockResolvedValue([]),
    getOverbought: vi.fn().mockResolvedValue([]),
    getUnusualVolume: vi.fn().mockResolvedValue([]),
    getNewHighs: vi.fn().mockResolvedValue([]),
    getNewLows: vi.fn().mockResolvedValue([]),
    getMostVolatile: vi.fn().mockResolvedValue([]),
    screen: vi.fn().mockResolvedValue([]),
  },
  yahoo: {
    search: vi.fn().mockResolvedValue([]),
    getOptions: vi.fn().mockResolvedValue({ expirationDates: [], calls: [], puts: [] }),
    getOptionsForExpiration: vi.fn().mockResolvedValue({ expiration: "", calls: [], puts: [] }),
  },
}));

describe("MCP Tools Integration", () => {
  let server: McpServer;
  let registeredTools: Map<
    string,
    { handler: (args: Record<string, unknown>) => Promise<unknown> }
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools = new Map();

    // Create a mock server that captures tool registrations
    server = {
      registerTool: vi.fn(
        (
          name: string,
          _config: unknown,
          handler: (args: Record<string, unknown>) => Promise<unknown>,
        ) => {
          registeredTools.set(name, { handler });
        },
      ),
    } as unknown as McpServer;

    registerAllTools(server);
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
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
      const quote = JSON.parse(content);
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
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
      const bars = JSON.parse(content);
      expect(Array.isArray(bars)).toBe(true);
    });

    it("get_market_status should return market clock", async () => {
      const tool = registeredTools.get("get_market_status");
      const result = await tool!.handler({});

      expect(result).toHaveProperty("content");
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
      const status = JSON.parse(content);
      expect(status).toHaveProperty("isOpen");
    });
  });

  describe("Portfolio Tools", () => {
    it("get_account should return account info", async () => {
      const tool = registeredTools.get("get_account");
      const result = await tool!.handler({});

      expect(result).toHaveProperty("content");
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
      const account = JSON.parse(content);
      expect(account).toHaveProperty("equity");
      expect(account).toHaveProperty("cash");
    });

    it("get_positions should return positions", async () => {
      const tool = registeredTools.get("get_positions");
      const result = await tool!.handler({});

      expect(result).toHaveProperty("content");
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
      const positions = JSON.parse(content);
      expect(Array.isArray(positions)).toBe(true);
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
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
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
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
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
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
      const order = JSON.parse(content);
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
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
      const order = JSON.parse(content);
      expect(order.id).toBe("order-123");
    });

    it("cancel_order should cancel order", async () => {
      const tool = registeredTools.get("cancel_order");
      const result = await tool!.handler({ orderId: "order-123" });

      expect(result).toHaveProperty("content");
      const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
      const response = JSON.parse(content);
      expect(response.status).toBe("cancelled");
    });
  });
});
