// Order management tools

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { alpaca } from "@trading/core";

export function registerOrderTools(server: McpServer) {
  // Place order
  server.registerTool(
    "place_order",
    {
      title: "Place Order",
      description: "Place a buy or sell order for a stock",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
        side: z.enum(["buy", "sell"]).describe("Order side"),
        quantity: z.number().positive().describe("Number of shares"),
        type: z
          .enum(["market", "limit", "stop", "stop_limit"])
          .default("market")
          .describe("Order type"),
        limitPrice: z
          .number()
          .positive()
          .optional()
          .describe("Limit price (required for limit/stop_limit)"),
        stopPrice: z
          .number()
          .positive()
          .optional()
          .describe("Stop price (required for stop/stop_limit)"),
        timeInForce: z.enum(["day", "gtc", "ioc", "fok"]).default("day").describe("Time in force"),
      },
    },
    async ({ symbol, side, quantity, type, limitPrice, stopPrice, timeInForce }) => {
      // Validate price requirements
      if ((type === "limit" || type === "stop_limit") && !limitPrice) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: limit_price required for limit orders",
            },
          ],
          isError: true,
        };
      }
      if ((type === "stop" || type === "stop_limit") && !stopPrice) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: stop_price required for stop orders",
            },
          ],
          isError: true,
        };
      }

      try {
        const order = await alpaca.placeOrder({
          symbol: symbol.toUpperCase(),
          qty: quantity,
          side,
          type,
          time_in_force: timeInForce,
          limit_price: limitPrice,
          stop_price: stopPrice,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(order, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Get order status
  server.registerTool(
    "get_order",
    {
      title: "Get Order",
      description: "Get the status of an order by ID",
      inputSchema: {
        orderId: z.string().describe("Order ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ orderId }) => {
      try {
        const order = await alpaca.getOrder(orderId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(order, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // List orders
  server.registerTool(
    "list_orders",
    {
      title: "List Orders",
      description: "List orders by status",
      inputSchema: {
        status: z.enum(["open", "closed", "all"]).default("open").describe("Order status filter"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ status }) => {
      try {
        const orders = await alpaca.getOrders(status);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(orders, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Cancel order
  server.registerTool(
    "cancel_order",
    {
      title: "Cancel Order",
      description: "Cancel an open order by ID",
      inputSchema: {
        orderId: z.string().describe("Order ID to cancel"),
      },
    },
    async ({ orderId }) => {
      try {
        await alpaca.cancelOrder(orderId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ orderId, status: "cancelled" }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
