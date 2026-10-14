// Portfolio and account tools

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { alpaca as alpacaProvider } from "@trading/core";

export type PortfolioDependencies = {
  alpaca: Pick<typeof alpacaProvider, "getAccount" | "getPortfolio" | "getPositions">;
};

const defaultDependencies: PortfolioDependencies = { alpaca: alpacaProvider };

export function registerPortfolioTools(
  server: McpServer,
  dependencies: PortfolioDependencies = defaultDependencies,
) {
  const { alpaca } = dependencies;

  // Get account info
  server.registerTool(
    "get_account",
    {
      title: "Get Account",
      description: "Get account information including buying power and equity",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const account = await alpaca.getAccount();

        return {
          content: [{ type: "text" as const, text: JSON.stringify(account, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // Get portfolio
  server.registerTool(
    "get_portfolio",
    {
      title: "Get Portfolio",
      description: "Get portfolio summary with positions and P&L",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const portfolio = await alpaca.getPortfolio();

        return {
          content: [{ type: "text" as const, text: JSON.stringify(portfolio, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // Get positions
  server.registerTool(
    "get_positions",
    {
      title: "Get Positions",
      description: "Get all open positions with current values",
      inputSchema: {
        symbol: z.string().optional().describe("Filter by symbol (optional)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        let positions = await alpaca.getPositions();

        if (symbol) {
          positions = positions.filter((p) => p.symbol.toUpperCase() === symbol.toUpperCase());
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(positions, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
