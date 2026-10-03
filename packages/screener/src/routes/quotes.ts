import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { yahoo } from "@trading/core";
import { publicErrorResponses } from "../openapi/error-responses.js";

import type { YahooMarketDataSource } from "../services/market-data.js";

export function createQuotesRoutes(source: YahooMarketDataSource = yahoo) {
  const quotesRoutes = new OpenAPIHono();

  // Validation schemas
  const symbolSchema = z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9.]+$/i, "Invalid symbol format");

  const symbolParamSchema = z.object({
    symbol: symbolSchema,
  });

  const batchQuotesSchema = z.object({
    symbols: z.array(symbolSchema).min(1).max(100),
  });

  const barsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(365).optional().default(100),
  });

  const getSingleQuoteRoute = createRoute({
    method: "get",
    path: "/{symbol}",
    request: {
      params: symbolParamSchema,
    },
    responses: {
      200: {
        description: "Quote (raw Yahoo Finance response)",
        content: {
          "application/json": {
            schema: z.unknown(),
          },
        },
      },
      ...publicErrorResponses,
    },
  });

  // Get single quote
  quotesRoutes.openapi(getSingleQuoteRoute, async (c) => {
    const { symbol } = c.req.valid("param");

    const yahooQuote = await source.getQuote(symbol.toUpperCase());

    return c.json(yahooQuote, 200);
  });

  const getBatchQuotesRoute = createRoute({
    method: "post",
    path: "/batch",
    request: {
      body: {
        content: {
          "application/json": {
            schema: batchQuotesSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Quotes (raw Yahoo Finance response)",
        content: {
          "application/json": {
            schema: z.unknown(),
          },
        },
      },
      ...publicErrorResponses,
    },
  });

  // Get multiple quotes
  quotesRoutes.openapi(getBatchQuotesRoute, async (c) => {
    const { symbols } = c.req.valid("json");

    const yahooQuotes = await source.getQuotes(symbols.map((s) => s.toUpperCase()));

    return c.json(yahooQuotes, 200);
  });

  const getPriceBarsRoute = createRoute({
    method: "get",
    path: "/{symbol}/bars",
    request: {
      params: symbolParamSchema,
      query: barsQuerySchema,
    },
    responses: {
      200: {
        description: "Price bars (raw Yahoo Finance response)",
        content: {
          "application/json": {
            schema: z.unknown(),
          },
        },
      },
      ...publicErrorResponses,
    },
  });

  // Get price bars
  quotesRoutes.openapi(getPriceBarsRoute, async (c) => {
    const { symbol } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    const days = limit;
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    const chart = await source.getHistory(symbol.toUpperCase(), period1);

    return c.json(chart, 200);
  });

  return quotesRoutes;
}

export const quotesRoutes = createQuotesRoutes();
