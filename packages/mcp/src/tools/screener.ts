// Screener tools - find stocks by criteria

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  finviz,
  polygon,
  yahoo,
  type FinvizScreenerResult,
  type PolygonTickerSnapshot,
} from "@trading/core";

// Screener result with source
interface ScreenerResult {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  source: string;
}

export type ScreenerDependencies = {
  polygon: Pick<typeof polygon, "getGainersLosers" | "isConfigured">;
  yahoo: Pick<typeof yahoo, "getTrending" | "search">;
  finviz: Pick<
    typeof finviz,
    | "getGainers"
    | "getLosers"
    | "getMostVolatile"
    | "getNewHighs"
    | "getNewLows"
    | "getOverbought"
    | "getOversold"
    | "getUnusualVolume"
  >;
};

export function registerScreenerTools(
  server: McpServer,
  dependencies: ScreenerDependencies = { yahoo, finviz, polygon },
) {
  const { yahoo, finviz, polygon } = dependencies;

  // Get top gainers
  server.registerTool(
    "get_gainers",
    {
      title: "Get Top Gainers",
      description: "Get stocks with the biggest gains today",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results: ScreenerResult[] = [];

        // Try Polygon first (better data)
        if (polygon.isConfigured()) {
          const pgGainers = await polygon.getGainersLosers("gainers");

          if (pgGainers.length > 0) {
            results.push(
              ...pgGainers.slice(0, limit).map((t: PolygonTickerSnapshot) => ({
                symbol: t.ticker,
                price: t.day?.c ?? t.prevDay?.c ?? 0,
                change: t.todaysChange ?? 0,
                changePercent: t.todaysChangePerc ?? 0,
                volume: t.day?.v ?? 0,
                source: "polygon",
              })),
            );
          }
        }

        // Fallback to Finviz
        if (results.length === 0) {
          const fvGainers = await finviz.getGainers(limit);
          results.push(
            ...fvGainers.map((t: FinvizScreenerResult) => ({
              symbol: t.symbol,
              price: t.price,
              changePercent: t.changePercent,
              volume: t.volume,
              source: "finviz",
            })),
          );
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Get top losers
  server.registerTool(
    "get_losers",
    {
      title: "Get Top Losers",
      description: "Get stocks with the biggest losses today",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results: ScreenerResult[] = [];

        // Try Polygon first
        if (polygon.isConfigured()) {
          const pgLosers = await polygon.getGainersLosers("losers");

          if (pgLosers.length > 0) {
            results.push(
              ...pgLosers.slice(0, limit).map((t: PolygonTickerSnapshot) => ({
                symbol: t.ticker,
                price: t.day?.c ?? t.prevDay?.c ?? 0,
                change: t.todaysChange ?? 0,
                changePercent: t.todaysChangePerc ?? 0,
                volume: t.day?.v ?? 0,
                source: "polygon",
              })),
            );
          }
        }

        // Fallback to Finviz
        if (results.length === 0) {
          const fvLosers = await finviz.getLosers(limit);
          results.push(
            ...fvLosers.map((t: FinvizScreenerResult) => ({
              symbol: t.symbol,
              price: t.price,
              changePercent: t.changePercent,
              volume: t.volume,
              source: "finviz",
            })),
          );
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Get oversold stocks (RSI < 30)
  server.registerTool(
    "get_oversold",
    {
      title: "Get Oversold Stocks",
      description: "Get stocks with RSI below 30 (potentially undervalued)",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results = await finviz.getOversold();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                results.slice(0, limit).map((t: FinvizScreenerResult) => ({
                  ...t,
                  source: "finviz",
                })),
                null,
                2,
              ),
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

  // Get overbought stocks (RSI > 70)
  server.registerTool(
    "get_overbought",
    {
      title: "Get Overbought Stocks",
      description: "Get stocks with RSI above 70 (potentially overvalued)",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results = await finviz.getOverbought();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                results.slice(0, limit).map((t: FinvizScreenerResult) => ({
                  ...t,
                  source: "finviz",
                })),
                null,
                2,
              ),
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

  // Get unusual volume
  server.registerTool(
    "get_unusual_volume",
    {
      title: "Get Unusual Volume",
      description: "Get stocks with unusually high trading volume",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results = await finviz.getUnusualVolume();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                results.slice(0, limit).map((t: FinvizScreenerResult) => ({
                  ...t,
                  source: "finviz",
                })),
                null,
                2,
              ),
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

  // Get new highs
  server.registerTool(
    "get_new_highs",
    {
      title: "Get New 52-Week Highs",
      description: "Get stocks hitting new 52-week highs",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results = await finviz.getNewHighs();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                results.slice(0, limit).map((t: FinvizScreenerResult) => ({
                  ...t,
                  source: "finviz",
                })),
                null,
                2,
              ),
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

  // Get new lows
  server.registerTool(
    "get_new_lows",
    {
      title: "Get New 52-Week Lows",
      description: "Get stocks hitting new 52-week lows",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results = await finviz.getNewLows();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                results.slice(0, limit).map((t: FinvizScreenerResult) => ({
                  ...t,
                  source: "finviz",
                })),
                null,
                2,
              ),
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

  // Get most volatile
  server.registerTool(
    "get_volatile",
    {
      title: "Get Most Volatile",
      description: "Get stocks with highest volatility",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results = await finviz.getMostVolatile();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                results.slice(0, limit).map((t: FinvizScreenerResult) => ({
                  ...t,
                  source: "finviz",
                })),
                null,
                2,
              ),
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

  // Get trending tickers
  server.registerTool(
    "get_trending",
    {
      title: "Get Trending Tickers",
      description: "Get currently trending stock tickers",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("Number of results"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const results = await yahoo.getTrending(limit);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                results.map((t: { symbol: string }) => ({
                  symbol: t.symbol,
                  source: "yahoo",
                })),
                null,
                2,
              ),
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

  // Search symbols
  server.registerTool(
    "search_symbols",
    {
      title: "Search Symbols",
      description: "Search for stock symbols by name or ticker",
      inputSchema: {
        query: z.string().describe("Search query (company name or ticker)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      try {
        const results = await yahoo.search(query);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
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
