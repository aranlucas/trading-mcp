// Technical analysis tools

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeHistory, alpaca, type TechnicalIndicators, type Signal } from "@trading/core";

export type TechnicalDependencies = {
  alpaca: Pick<typeof alpaca, "getBars">;
};

export function registerTechnicalTools(
  server: McpServer,
  dependencies: TechnicalDependencies = { alpaca },
) {
  const { alpaca } = dependencies;

  // Get technical indicators
  server.registerTool(
    "get_technicals",
    {
      title: "Get Technical Indicators",
      description:
        "Calculate technical indicators (RSI, MACD, SMA, EMA, Bollinger Bands) for a symbol",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        const bars = await alpaca.getBars(symbol.toUpperCase(), "1Day", 200);
        const closes = bars.map((b) => b.c);

        if (closes.length < 26) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Not enough data for indicators",
              },
            ],
            isError: true,
          };
        }

        const indicators: TechnicalIndicators = {
          symbol: symbol.toUpperCase(),
          timestamp: new Date().toISOString(),
          ...analyzeHistory(closes),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(indicators, null, 2),
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

  // Get signals
  server.registerTool(
    "get_signals",
    {
      title: "Get Trading Signals",
      description: "Generate trading signals based on technical analysis",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        const bars = await alpaca.getBars(symbol.toUpperCase(), "1Day", 200);
        const closes = bars.map((b) => b.c);
        const signals: Signal[] = [];
        const currentPrice = closes[closes.length - 1] ?? 0;

        if (closes.length < 20) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Not enough data for signals",
              },
            ],
            isError: true,
          };
        }

        // RSI signals
        const analysis = analyzeHistory(closes);
        const rsiValue = analysis.rsi14;

        if (rsiValue !== null && rsiValue < 30) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "RSI_OVERSOLD",
            direction: "bullish",
            strength: (30 - rsiValue) / 30,
            timestamp: new Date().toISOString(),
            description: `RSI at ${rsiValue.toFixed(2)} indicates oversold conditions`,
          });
        } else if (rsiValue !== null && rsiValue > 70) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "RSI_OVERBOUGHT",
            direction: "bearish",
            strength: (rsiValue - 70) / 30,
            timestamp: new Date().toISOString(),
            description: `RSI at ${rsiValue.toFixed(2)} indicates overbought conditions`,
          });
        }

        // Moving average crossover
        const sma20Val = analysis.sma20;
        const sma50Val = analysis.sma50;

        if (
          sma20Val !== null &&
          sma50Val !== null &&
          currentPrice > sma20Val &&
          sma20Val > sma50Val
        ) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "MA_BULLISH",
            direction: "bullish",
            strength: 0.7,
            timestamp: new Date().toISOString(),
            description: "Price above SMA20, SMA20 above SMA50 (bullish alignment)",
          });
        } else if (
          sma20Val !== null &&
          sma50Val !== null &&
          currentPrice < sma20Val &&
          sma20Val < sma50Val
        ) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "MA_BEARISH",
            direction: "bearish",
            strength: 0.7,
            timestamp: new Date().toISOString(),
            description: "Price below SMA20, SMA20 below SMA50 (bearish alignment)",
          });
        }

        // Bollinger Band signals
        const bb = analysis.bollingerBands;

        if (bb !== null && currentPrice < bb.lower) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "BB_LOWER",
            direction: "bullish",
            strength: 0.6,
            timestamp: new Date().toISOString(),
            description: "Price below lower Bollinger Band (potential bounce)",
          });
        } else if (bb !== null && currentPrice > bb.upper) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "BB_UPPER",
            direction: "bearish",
            strength: 0.6,
            timestamp: new Date().toISOString(),
            description: "Price above upper Bollinger Band (potential pullback)",
          });
        }

        // MACD momentum signal
        const macdData = analysis.macd;

        const macdStrength =
          macdData === null
            ? 0
            : Math.min(1, Math.abs(macdData.histogram) / (Math.abs(macdData.value) || 1)) || 0.3;

        if (macdData !== null && macdData.histogram > 0 && macdData.value > 0) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "MACD_BULLISH",
            direction: "bullish",
            strength: macdStrength,
            timestamp: new Date().toISOString(),
            description: "MACD histogram above zero (bullish momentum)",
          });
        } else if (macdData !== null && macdData.histogram < 0 && macdData.value < 0) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "MACD_BEARISH",
            direction: "bearish",
            strength: macdStrength,
            timestamp: new Date().toISOString(),
            description: "MACD histogram below zero (bearish momentum)",
          });
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(signals, null, 2) }],
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
