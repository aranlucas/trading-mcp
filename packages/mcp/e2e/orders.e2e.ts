import { test, expect } from "e2e";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ResultSchema = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
  isError: z.boolean().optional(),
});

test("submit once, reconcile by client order ID, request cancellation, then observe a fill over stdio", async () => {
  const transport = new StdioClientTransport({
    command: "pnpm",
    args: ["exec", "tsx", "e2e/broker-fixture.ts"],
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: {
      PATH: process.env.PATH ?? "",
      ALPACA_API_KEY: "synthetic-only",
      ALPACA_API_SECRET: "synthetic-only",
      ALPACA_PAPER: "true",
    },
    stderr: "pipe",
  });

  const client = new Client({ name: "audit-e2e", version: "1" });

  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map(({ name }) => name)).toContain("place_order");

    const invalid = ResultSchema.parse(
      await client.callTool({
        name: "place_order",
        arguments: { symbol: "TEST", side: "buy", quantity: 2, type: "limit" },
      }),
    );

    expect(invalid.isError).toBe(true);

    const call = async (name: string, args: Record<string, string | number>) => {
      const result = ResultSchema.parse(await client.callTool({ name, arguments: args }));
      expect(result.isError).not.toBe(true);

      return z
        .json()
        .parse(JSON.parse(z.object({ text: z.string() }).parse(result.content[0]).text));
    };

    expect(
      await call("place_order", {
        symbol: "test",
        side: "buy",
        quantity: 2,
        type: "limit",
        limitPrice: 100,
        clientOrderId: "e2e-journey-1",
      }),
    ).toMatchObject({
      id: "fixture-order",
      clientOrderId: "e2e-journey-1",
      quantity: 2,
      status: "new",
    });
    expect(await call("get_order_by_client_id", { clientOrderId: "e2e-journey-1" })).toMatchObject({
      id: "fixture-order",
      status: "new",
    });
    expect(await call("get_order", { orderId: "fixture-order" })).toMatchObject({
      status: "new",
      filledQuantity: 0,
    });
    expect(await call("cancel_order", { orderId: "fixture-order" })).toMatchObject({
      status: "cancel_requested",
    });
    expect(await call("get_order", { orderId: "fixture-order" })).toMatchObject({
      status: "pending_cancel",
      filledQuantity: 0,
    });
    expect(await call("get_order", { orderId: "fixture-order" })).toMatchObject({
      status: "filled",
      filledQuantity: 2,
    });
  } finally {
    await client.close();
    await transport.close();
  }
});
