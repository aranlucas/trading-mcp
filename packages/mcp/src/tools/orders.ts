import { toolError } from "./result.js";
// Order management tools

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { alpaca as alpacaProvider, toPublicError } from "@trading/core";

export type OrderDependencies = {
  alpaca: Pick<
    typeof alpacaProvider,
    "cancelOrder" | "getOrder" | "getOrderByClientOrderId" | "getOrders" | "placeOrder"
  >;
};

const defaultDependencies: OrderDependencies = { alpaca: alpacaProvider };

export function registerOrderTools(
  server: McpServer,
  dependencies: OrderDependencies = defaultDependencies,
) {
  const { alpaca } = dependencies;

  server.registerTool(
    "place_order",
    {
      title: "Place Order",
      description:
        "Place a buy or sell order for a stock. Every order carries a clientOrderId (generated when omitted). If the result is submit_unconfirmed, the order may exist: check get_order_by_client_id before retrying, and retry only with the same clientOrderId.",
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
        clientOrderId: alpacaProvider.ClientOrderIdSchema.optional().describe(
          "Unique ID for this order (letters, digits, . _ : -; max 128). Reuse it when retrying: the broker rejects a duplicate ID, so a retry cannot create a second order. Generated when omitted.",
        ),
      },
    },
    async ({
      symbol,
      side,
      quantity,
      type,
      limitPrice,
      stopPrice,
      timeInForce,
      clientOrderId: requestedClientOrderId,
    }) => {
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

      // Resolve the ID before submitting so it can be reported even when the outcome is unknown.
      const clientOrderId = requestedClientOrderId ?? crypto.randomUUID();

      try {
        const order = await alpaca.placeOrder({
          client_order_id: clientOrderId,
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
        const failure = alpacaProvider.describeOrderSubmissionFailure(error);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                clientOrderId,
                ...failure,
                message:
                  failure.status === "submit_rejected"
                    ? "The order was not accepted. Correct the request before submitting again."
                    : "Submission outcome is unconfirmed; the order may exist. Call get_order_by_client_id with this clientOrderId before anything else. Only if it reports no order, retry with the same clientOrderId.",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_order_by_client_id",
    {
      title: "Get Order by Client Order ID",
      description:
        "Look up an order by the clientOrderId it was submitted with, e.g. to reconcile a submit_unconfirmed result before retrying",
      inputSchema: {
        clientOrderId: alpacaProvider.ClientOrderIdSchema.describe("Client order ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ clientOrderId }) => {
      try {
        const order = await alpaca.getOrderByClientOrderId(clientOrderId);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(order, null, 2) }],
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

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
        return toolError(error);
      }
    },
  );

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
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "cancel_order",
    {
      title: "Cancel Order",
      description:
        "Request cancellation of an open order. Acceptance does not confirm cancellation; use get_order to check broker status. The order may still fill.",
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
              text: JSON.stringify({
                orderId,
                status: "cancel_requested",
                message:
                  "Request accepted. Use get_order to check broker status; the order may still fill.",
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                orderId,
                status: "cancel_request_unconfirmed",
                error: toPublicError(error),
                message:
                  "Request outcome is unconfirmed. Use get_order before retrying or placing a replacement.",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
