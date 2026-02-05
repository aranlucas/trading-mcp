#!/usr/bin/env node

/**
 * Trading MCP Server
 *
 * A Model Context Protocol server for stock trading operations.
 * Integrates with Alpaca API for market data, orders, and portfolio management.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error("Trading MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
