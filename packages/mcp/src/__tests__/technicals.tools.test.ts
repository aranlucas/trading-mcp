import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { alpaca } from "@trading/core";
import { connectTestTools, ToolTextSchema } from "./mcp-test-client.js";

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

const alpacaMock = { getBars: vi.fn<typeof alpaca.getBars>() };

import { registerTechnicalTools } from "../tools/technicals.js";

describe("Technical MCP tools", () => {
  let harness: Awaited<ReturnType<typeof connectTestTools>>;
  let registeredTools: Awaited<ReturnType<typeof connectTestTools>>["tools"];

  beforeEach(async () => {
    vi.clearAllMocks();
    harness = await connectTestTools((server) =>
      registerTechnicalTools(server, { alpaca: alpacaMock }),
    );
    registeredTools = harness.tools;
  });

  afterEach(async () => {
    await harness.close();
  });

  it("get_technicals returns indicator payload for valid history", async () => {
    alpacaMock.getBars.mockResolvedValueOnce(
      barsFromCloses(Array.from({ length: 30 }, (_, i) => 100 + i)),
    );

    const tool = registeredTools.get("get_technicals");
    const result = await tool!.handler({ symbol: "aapl" });

    const content = ToolTextSchema.parse(result);

    const indicators = z
      .object({ symbol: z.string(), sma200: z.number().nullable(), rsi14: z.number() })
      .parse(JSON.parse(content));

    expect(indicators.symbol).toBe("AAPL");
    expect(indicators.sma200).toBeNull();
    expect(indicators.rsi14).toEqual(expect.any(Number));
  });

  it("get_signals emits RSI oversold + MA bearish for downtrend", async () => {
    alpacaMock.getBars.mockResolvedValueOnce(
      barsFromCloses(Array.from({ length: 60 }, (_, i) => 160 - i)),
    );

    const tool = registeredTools.get("get_signals");
    const result = await tool!.handler({ symbol: "aapl" });

    const content = ToolTextSchema.parse(result);

    const signals = z
      .array(z.object({ type: z.string(), symbol: z.string() }))
      .parse(JSON.parse(content));

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

    const content = ToolTextSchema.parse(result);
    const signals = z.array(z.object({ type: z.string() })).parse(JSON.parse(content));

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
    const content = ToolTextSchema.parse(result);
    expect(content).toContain("Not enough data for signals");
  });

  it.each([20, 25, 26, 33, 34, 49])(
    "does not invent SMA50 alignment with %i bars",
    async (length) => {
      alpacaMock.getBars.mockResolvedValueOnce(
        barsFromCloses(Array.from({ length }, (_, i) => 100 + i)),
      );
      const result = await registeredTools.get("get_signals")!.handler({ symbol: "AAPL" });
      const content = ToolTextSchema.parse(result);
      const signals = z.array(z.object({ type: z.string() })).parse(JSON.parse(content));
      expect(signals.some((s) => s.type.startsWith("MA_"))).toBe(false);

      if (length < 34) expect(signals.some((s) => s.type.startsWith("MACD_"))).toBe(false);
    },
  );

  it("does not call flat history overbought", async () => {
    alpacaMock.getBars.mockResolvedValueOnce(barsFromCloses(Array(50).fill(100)));
    const result = await registeredTools.get("get_signals")!.handler({ symbol: "AAPL" });
    const content = ToolTextSchema.parse(result);
    expect(JSON.parse(content)).toEqual([]);
  });

  it("reports unavailable SMA50 and MACD as null, not measured values", async () => {
    alpacaMock.getBars.mockResolvedValueOnce(
      barsFromCloses(Array.from({ length: 26 }, (_, i) => 100 + i)),
    );
    const result = await registeredTools.get("get_technicals")!.handler({ symbol: "AAPL" });
    const content = ToolTextSchema.parse(result);
    expect(JSON.parse(content)).toMatchObject({ sma50: null, sma200: null, macd: null });
  });
});
