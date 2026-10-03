// Tool registration index

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMarketTools } from "./market.js";
import { registerPortfolioTools } from "./portfolio.js";
import { registerOrderTools } from "./orders.js";
import { registerTechnicalTools } from "./technicals.js";
import { registerScreenerTools } from "./screener.js";
import { registerOptionsTools } from "./options.js";

import type { PortfolioDependencies } from "./portfolio.js";
import type { TechnicalDependencies } from "./technicals.js";
import type { MarketDependencies } from "./market.js";
import type { ScreenerDependencies } from "./screener.js";
import type { OrderDependencies } from "./orders.js";
import type { OptionsDependencies } from "./options.js";
import { alpaca, yahoo, polygon, finviz } from "@trading/core";

export type ToolDependencies = PortfolioDependencies &
  TechnicalDependencies &
  MarketDependencies &
  ScreenerDependencies &
  OrderDependencies &
  OptionsDependencies;

export function registerAllTools(
  server: McpServer,
  dependencies: ToolDependencies = { alpaca, yahoo, polygon, finviz },
) {
  registerMarketTools(server, dependencies);
  registerPortfolioTools(server, dependencies);
  registerOrderTools(server, dependencies);
  registerTechnicalTools(server, dependencies);
  registerScreenerTools(server, dependencies);
  registerOptionsTools(server, dependencies);
}
