// Tool registration index

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMarketTools } from "./market.js";
import { registerPortfolioTools } from "./portfolio.js";
import { registerOrderTools } from "./orders.js";
import { registerTechnicalTools } from "./technicals.js";
import { registerScreenerTools } from "./screener.js";
import { registerOptionsTools } from "./options.js";

export function registerAllTools(server: McpServer) {
  registerMarketTools(server);
  registerPortfolioTools(server);
  registerOrderTools(server);
  registerTechnicalTools(server);
  registerScreenerTools(server);
  registerOptionsTools(server);
}
