// Options tools - get options chain data

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { yahoo, type YahooOptionContract } from "@trading/core";

// Helper to safely get numeric value
function num(value: number | undefined): number {
  return value ?? 0;
}

export type OptionsDependencies = {
  yahoo: Pick<typeof yahoo, "getOptions" | "getOptionsForExpiration">;
};

export function registerOptionsTools(
  server: McpServer,
  dependencies: OptionsDependencies = { yahoo },
) {
  const { yahoo } = dependencies;

  // Get options chain
  server.registerTool(
    "get_options_chain",
    {
      title: "Get Options Chain",
      description:
        "Get the full options chain for a symbol including all expiration dates, calls and puts with greeks",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol (e.g., AAPL, NVDA)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        const options = await yahoo.getOptions(symbol.toUpperCase());

        // Format the response
        const result = {
          symbol: symbol.toUpperCase(),
          expirationDates: options.expirationDates,
          nearestExpiration: options.expirationDates?.[0] ?? null,
          callsCount: options.calls?.length ?? 0,
          putsCount: options.puts?.length ?? 0,
          calls: options.calls?.slice(0, 20).map((c: YahooOptionContract) => ({
            strike: c.strike,
            expiration: c.expiration,
            bid: c.bid,
            ask: c.ask,
            last: c.lastPrice,
            volume: c.volume,
            openInterest: c.openInterest,
            impliedVolatility: c.impliedVolatility,
            inTheMoney: c.inTheMoney,
          })),
          puts: options.puts?.slice(0, 20).map((p: YahooOptionContract) => ({
            strike: p.strike,
            expiration: p.expiration,
            bid: p.bid,
            ask: p.ask,
            last: p.lastPrice,
            volume: p.volume,
            openInterest: p.openInterest,
            impliedVolatility: p.impliedVolatility,
            inTheMoney: p.inTheMoney,
          })),
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Get specific expiration options
  server.registerTool(
    "get_options_expiration",
    {
      title: "Get Options for Expiration",
      description: "Get options chain for a specific expiration date",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
        expiration: z.string().describe("Expiration date (YYYY-MM-DD format)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol, expiration }) => {
      try {
        const options = await yahoo.getOptionsForExpiration(symbol.toUpperCase(), expiration);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(options, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Find high IV options
  server.registerTool(
    "get_high_iv_options",
    {
      title: "Get High IV Options",
      description: "Find options with high implied volatility (good for selling premium)",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
        minIV: z.number().min(0).max(5).default(0.5).describe("Minimum IV threshold (0.5 = 50%)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol, minIV }) => {
      try {
        const options = await yahoo.getOptions(symbol.toUpperCase());

        const highIVCalls = (options.calls ?? [])
          .filter((c: YahooOptionContract) => num(c.impliedVolatility) >= minIV)
          .sort(
            (a: YahooOptionContract, b: YahooOptionContract) =>
              num(b.impliedVolatility) - num(a.impliedVolatility),
          )
          .slice(0, 15)
          .map((c: YahooOptionContract) => ({
            type: "call",
            strike: c.strike,
            expiration: c.expiration,
            bid: c.bid,
            ask: c.ask,
            iv: c.impliedVolatility,
            volume: c.volume,
            openInterest: c.openInterest,
            inTheMoney: c.inTheMoney,
          }));

        const highIVPuts = (options.puts ?? [])
          .filter((p: YahooOptionContract) => num(p.impliedVolatility) >= minIV)
          .sort(
            (a: YahooOptionContract, b: YahooOptionContract) =>
              num(b.impliedVolatility) - num(a.impliedVolatility),
          )
          .slice(0, 15)
          .map((p: YahooOptionContract) => ({
            type: "put",
            strike: p.strike,
            expiration: p.expiration,
            bid: p.bid,
            ask: p.ask,
            iv: p.impliedVolatility,
            volume: p.volume,
            openInterest: p.openInterest,
            inTheMoney: p.inTheMoney,
          }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  symbol: symbol.toUpperCase(),
                  minIVThreshold: minIV,
                  highIVCalls,
                  highIVPuts,
                },
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

  // Get unusual options activity
  server.registerTool(
    "get_options_activity",
    {
      title: "Get Unusual Options Activity",
      description: "Find options with unusually high volume relative to open interest",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        const options = await yahoo.getOptions(symbol.toUpperCase());

        // Find options where volume > open interest (unusual activity)
        const unusualCalls = (options.calls ?? [])
          .filter((c: YahooOptionContract) => num(c.volume) > 0 && num(c.openInterest) > 0)
          .map((c: YahooOptionContract) => ({
            ...c,
            volOIRatio: num(c.volume) / num(c.openInterest),
          }))
          .filter((c) => c.volOIRatio > 1)
          .sort((a, b) => b.volOIRatio - a.volOIRatio)
          .slice(0, 10)
          .map((c) => ({
            type: "call",
            strike: c.strike,
            expiration: c.expiration,
            bid: c.bid,
            ask: c.ask,
            last: c.lastPrice,
            volume: c.volume,
            openInterest: c.openInterest,
            volOIRatio: Math.round(c.volOIRatio * 100) / 100,
            iv: c.impliedVolatility,
            inTheMoney: c.inTheMoney,
          }));

        const unusualPuts = (options.puts ?? [])
          .filter((p: YahooOptionContract) => num(p.volume) > 0 && num(p.openInterest) > 0)
          .map((p: YahooOptionContract) => ({
            ...p,
            volOIRatio: num(p.volume) / num(p.openInterest),
          }))
          .filter((p) => p.volOIRatio > 1)
          .sort((a, b) => b.volOIRatio - a.volOIRatio)
          .slice(0, 10)
          .map((p) => ({
            type: "put",
            strike: p.strike,
            expiration: p.expiration,
            bid: p.bid,
            ask: p.ask,
            last: p.lastPrice,
            volume: p.volume,
            openInterest: p.openInterest,
            volOIRatio: Math.round(p.volOIRatio * 100) / 100,
            iv: p.impliedVolatility,
            inTheMoney: p.inTheMoney,
          }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  symbol: symbol.toUpperCase(),
                  description: "Options where today's volume exceeds open interest",
                  unusualCalls,
                  unusualPuts,
                },
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

  // Calculate options summary stats
  server.registerTool(
    "get_options_summary",
    {
      title: "Get Options Summary",
      description: "Get put/call ratio and options activity summary for a symbol",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        const options = await yahoo.getOptions(symbol.toUpperCase());

        const calls = options.calls ?? [];
        const puts = options.puts ?? [];

        const totalCallVolume = calls.reduce(
          (sum: number, c: YahooOptionContract) => sum + num(c.volume),
          0,
        );

        const totalPutVolume = puts.reduce(
          (sum: number, p: YahooOptionContract) => sum + num(p.volume),
          0,
        );

        const totalCallOI = calls.reduce(
          (sum: number, c: YahooOptionContract) => sum + num(c.openInterest),
          0,
        );

        const totalPutOI = puts.reduce(
          (sum: number, p: YahooOptionContract) => sum + num(p.openInterest),
          0,
        );

        const avgCallIV =
          calls.length > 0
            ? calls.reduce(
                (sum: number, c: YahooOptionContract) => sum + num(c.impliedVolatility),
                0,
              ) / calls.length
            : 0;

        const avgPutIV =
          puts.length > 0
            ? puts.reduce(
                (sum: number, p: YahooOptionContract) => sum + num(p.impliedVolatility),
                0,
              ) / puts.length
            : 0;

        // Find most active strikes
        const mostActiveCalls = [...calls]
          .sort((a: YahooOptionContract, b: YahooOptionContract) => num(b.volume) - num(a.volume))
          .slice(0, 5)
          .map((c: YahooOptionContract) => ({
            strike: c.strike,
            volume: c.volume,
            oi: c.openInterest,
          }));

        const mostActivePuts = [...puts]
          .sort((a: YahooOptionContract, b: YahooOptionContract) => num(b.volume) - num(a.volume))
          .slice(0, 5)
          .map((p: YahooOptionContract) => ({
            strike: p.strike,
            volume: p.volume,
            oi: p.openInterest,
          }));

        const summary = {
          symbol: symbol.toUpperCase(),
          expirations: options.expirationDates?.length ?? 0,
          nearestExpiration: options.expirationDates?.[0] ?? null,
          putCallRatio: {
            byVolume:
              totalCallVolume > 0 ? Math.round((totalPutVolume / totalCallVolume) * 100) / 100 : 0,
            byOpenInterest:
              totalCallOI > 0 ? Math.round((totalPutOI / totalCallOI) * 100) / 100 : 0,
          },
          volume: {
            calls: totalCallVolume,
            puts: totalPutVolume,
            total: totalCallVolume + totalPutVolume,
          },
          openInterest: {
            calls: totalCallOI,
            puts: totalPutOI,
            total: totalCallOI + totalPutOI,
          },
          avgImpliedVolatility: {
            calls: Math.round(avgCallIV * 10000) / 100, // Convert to percentage
            puts: Math.round(avgPutIV * 10000) / 100,
          },
          mostActiveStrikes: {
            calls: mostActiveCalls,
            puts: mostActivePuts,
          },
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
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
