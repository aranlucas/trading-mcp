// Portfolio and account tools

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { alpaca } from "@trading/core";

export function registerPortfolioTools(server: McpServer) {
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
          content: [
            { type: "text" as const, text: JSON.stringify(account, null, 2) },
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
          content: [
            { type: "text" as const, text: JSON.stringify(portfolio, null, 2) },
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
          positions = positions.filter(
            (p) => p.symbol.toUpperCase() === symbol.toUpperCase(),
          );
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(positions, null, 2) },
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
}
