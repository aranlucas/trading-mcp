import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { connectTestTools, ToolTextSchema } from "./mcp-test-client.js";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("ALPACA_API_KEY", "synthetic-only");
  vi.stubEnv("ALPACA_API_SECRET", "synthetic-only");
  vi.stubEnv("ALPACA_PAPER", "true");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function callTool(
  register: (server: McpServer) => void,
  name: string,
  args: Record<string, string | number> = {},
) {
  const mcp = await connectTestTools(register);

  try {
    const tool = mcp.tools.get(name);

    if (!tool) {
      throw new Error(`Missing ${name} tool`);
    }

    return await tool.handler(args);
  } finally {
    await mcp.close();
  }
}

async function getAccountResult() {
  const { registerPortfolioTools } = await import("@/tools/portfolio.js");

  return callTool(registerPortfolioTools, "get_account");
}

it.each(["ALPACA_API_KEY", "ALPACA_API_SECRET"])(
  "explains missing %s without contacting Alpaca",
  async (variable) => {
    vi.stubEnv(variable, "");
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("Unexpected fetch"));
    vi.stubGlobal("fetch", fetch);

    const result = await getAccountResult();
    expect(result.isError).toBe(true);
    expect(ToolTextSchema.parse(result)).toBe(
      "Error: Set ALPACA_API_KEY and ALPACA_API_SECRET, then restart the server.",
    );
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each([
  [
    401,
    "Alpaca rejected the configured credentials. Check ALPACA_API_KEY, ALPACA_API_SECRET, and ALPACA_PAPER, then restart the server after changing them.",
  ],
  [
    403,
    "Alpaca denied access. Check the configured API keys and the account's permissions for this operation.",
  ],
])("returns actionable guidance for Alpaca HTTP %s", async (status, message) => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(
      Response.json({ message: "synthetic-private-broker-detail" }, { status }),
    );

  vi.stubGlobal("fetch", fetch);

  const result = await getAccountResult();
  expect(result.isError).toBe(true);
  expect(ToolTextSchema.parse(result)).toBe(`Error: ${message}`);
  expect(result._meta?.["mcp/www_authenticate"]).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("reports a local credential failure as a definite order rejection", async () => {
  vi.stubEnv("ALPACA_API_SECRET", "");
  const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("Unexpected fetch"));
  vi.stubGlobal("fetch", fetch);

  const { registerOrderTools } = await import("@/tools/orders.js");

  const result = await callTool(registerOrderTools, "place_order", {
    symbol: "TEST",
    side: "buy",
    quantity: 1,
  });

  expect(result.isError).toBe(true);
  expect(JSON.parse(ToolTextSchema.parse(result))).toMatchObject({
    status: "submit_rejected",
    error: { message: "Set ALPACA_API_KEY and ALPACA_API_SECRET, then restart the server." },
  });
  expect(fetch).not.toHaveBeenCalled();
});
