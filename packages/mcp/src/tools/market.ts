// Market data tools

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { alpaca } from "@trading/core";

export function registerMarketTools(server: McpServer) {
  // Get stock quote
  server.registerTool(
    "get_quote",
    {
      title: "Get Stock Quote",
      description: "Get current stock quote with price, volume, and change",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol (e.g., AAPL, GOOGL)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        const quote = await alpaca.getQuote(symbol.toUpperCase());
        return {
          content: [{ type: "text" as const, text: JSON.stringify(quote, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Get price history
  server.registerTool(
    "get_bars",
    {
      title: "Get Price Bars",
      description: "Get historical OHLCV price bars for a symbol",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
        timeframe: z
          .enum(["1Min", "5Min", "15Min", "1Hour", "1Day"])
          .default("1Day")
          .describe("Bar timeframe"),
        limit: z.number().min(1).max(1000).default(100).describe("Number of bars"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const bars = await alpaca.getBars(symbol.toUpperCase(), timeframe, limit);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(bars, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Get market status
  server.registerTool(
    "get_market_status",
    {
      title: "Get Market Status",
      description: "Check if the market is currently open and get session times",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const status = await alpaca.getMarketClock();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
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
