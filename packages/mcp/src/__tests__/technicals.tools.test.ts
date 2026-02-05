import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function barsFromCloses(closes: number[]) {
  return closes.map((c, i) => ({
    t: `2024-01-${String(i + 1).padStart(2, "0")}`,
    o: c,
    h: c,
    l: c,
    c,
    v: 1,
  }));
}

const alpacaMock = vi.hoisted(() => ({
  getBars: vi.fn(),
}));

vi.mock("@trading/core", () => ({
  alpaca: alpacaMock,
}));

import { registerTechnicalTools } from "../tools/technicals.js";

describe("Technical MCP tools", () => {
  let registeredTools: Map<
    string,
    { handler: (args: Record<string, unknown>) => Promise<unknown> }
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools = new Map();

    const server = {
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

    registerTechnicalTools(server);
  });

  it("get_technicals returns indicator payload for valid history", async () => {
    alpacaMock.getBars.mockResolvedValueOnce(
      barsFromCloses(Array.from({ length: 30 }, (_, i) => 100 + i)),
    );

    const tool = registeredTools.get("get_technicals");
    const result = await tool!.handler({ symbol: "aapl" });

    const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
    const indicators = JSON.parse(content) as { symbol: string; sma200: number; rsi14: number };

    expect(indicators.symbol).toBe("AAPL");
    expect(indicators.sma200).toBe(0);
    expect(typeof indicators.rsi14).toBe("number");
  });

  it("get_signals emits RSI oversold + MA bearish for downtrend", async () => {
    alpacaMock.getBars.mockResolvedValueOnce(
      barsFromCloses(Array.from({ length: 60 }, (_, i) => 160 - i)),
    );

    const tool = registeredTools.get("get_signals");
    const result = await tool!.handler({ symbol: "aapl" });

    const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
    const signals = JSON.parse(content) as Array<{ type: string; symbol: string }>;

    expect(signals.some((s) => s.symbol === "AAPL")).toBe(true);
    expect(signals.some((s) => s.type === "RSI_OVERSOLD")).toBe(true);
    expect(signals.some((s) => s.type === "MA_BEARISH")).toBe(true);
  });

  it("get_signals emits RSI overbought + MA bullish for uptrend", async () => {
    alpacaMock.getBars.mockResolvedValueOnce(
      barsFromCloses(Array.from({ length: 60 }, (_, i) => 100 + i)),
    );

    const tool = registeredTools.get("get_signals");
    const result = await tool!.handler({ symbol: "aapl" });

    const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
    const signals = JSON.parse(content) as Array<{ type: string }>;

    expect(signals.some((s) => s.type === "RSI_OVERBOUGHT")).toBe(true);
    expect(signals.some((s) => s.type === "MA_BULLISH")).toBe(true);
  });

  it("get_signals returns an error when history is too short", async () => {
    alpacaMock.getBars.mockResolvedValueOnce(
      barsFromCloses([100, 99, 98, 97, 96, 95, 94, 93, 92, 91]),
    );

    const tool = registeredTools.get("get_signals");
    const result = await tool!.handler({ symbol: "aapl" });

    expect(result).toHaveProperty("isError", true);
    const content = (result as { content: Array<{ text: string }> }).content[0]!.text;
    expect(content).toContain("Not enough data for signals");
  });
});
