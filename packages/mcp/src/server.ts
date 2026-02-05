// MCP Server setup

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "trading-mcp",
    version: "0.1.0",
  });

  registerAllTools(server);

  return server;
}
