import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { connectTestTools, ToolTextSchema } from "./mcp-test-client.js";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("ALPACA_API_KEY", "synthetic-only");
  vi.stubEnv("ALPACA_API_SECRET", "synthetic-only");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function connectOrders() {
  const { registerOrderTools } = await import("@/tools/orders.js");

  return connectTestTools(registerOrderTools);
}

function callOrder(mcp: Awaited<ReturnType<typeof connectOrders>>, name: string) {
  const tool = mcp.tools.get(name);

  if (!tool) {
    throw new Error(`Missing order tool: ${name}`);
  }

  return tool.handler({ orderId: "synthetic-order" });
}

it("preserves a fill after a 204 cancel acknowledgment through the installed SDK and MCP", async () => {
  let reads = 0;

  const transport = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    if (init?.method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    const pending = reads++ === 0;

    return Promise.resolve(
      Response.json({
        id: "synthetic-order",
        symbol: "TEST",
        status: pending ? "pending_cancel" : "filled",
        qty: "1",
        filled_qty: pending ? "0" : "1",
      }),
    );
  });

  vi.stubGlobal("fetch", transport);
  const mcp = await connectOrders();

  try {
    expect(JSON.parse(ToolTextSchema.parse(await callOrder(mcp, "cancel_order")))).toMatchObject({
      status: "cancel_requested",
    });
    expect(JSON.parse(ToolTextSchema.parse(await callOrder(mcp, "get_order")))).toMatchObject({
      status: "pending_cancel",
      filledQuantity: 0,
    });
    expect(JSON.parse(ToolTextSchema.parse(await callOrder(mcp, "get_order")))).toMatchObject({
      status: "filled",
      filledQuantity: 1,
    });
    expect(transport.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual([
      "DELETE",
      "GET",
      "GET",
    ]);
  } finally {
    await mcp.close();
  }
});

it("keeps a lost cancellation response unconfirmed and private before reading a subsequent fill", async () => {
  const transport = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    if (init?.method === "DELETE") {
      return Promise.reject(new Error("synthetic-private-broker-detail"));
    }

    return Promise.resolve(
      Response.json({
        id: "synthetic-order",
        symbol: "TEST",
        status: "filled",
        qty: "1",
        filled_qty: "1",
      }),
    );
  });

  vi.stubGlobal("fetch", transport);
  const mcp = await connectOrders();

  try {
    const result = await callOrder(mcp, "cancel_order");
    expect(result.isError).toBe(true);
    expect(JSON.parse(ToolTextSchema.parse(result))).toMatchObject({
      status: "cancel_request_unconfirmed",
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-private-broker-detail");
    expect(JSON.parse(ToolTextSchema.parse(await callOrder(mcp, "get_order")))).toMatchObject({
      status: "filled",
    });
    expect(transport.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual([
      "DELETE",
      "GET",
    ]);
  } finally {
    await mcp.close();
  }
});
