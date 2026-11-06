import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { ScreenerService } from "../services/screener.js";
import {
  ScanCriteriaSchema,
  ScanResultSchema,
  MoverResultSchema,
  SignalSchema,
  SymbolSchema,
} from "../contracts.js";
import { publicErrorResponses } from "../openapi/error-responses.js";

export const screenerRoutes = new OpenAPIHono();

const screener = new ScreenerService();

const signalsSchema = z.object({
  symbols: z.array(SymbolSchema).min(1).max(100),
});

const directionSchema = z.object({
  direction: z.enum(["gainers", "losers"]),
});

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

const scanRoute = createRoute({
  method: "post",
  path: "/scan",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ScanCriteriaSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Scan results",
      content: {
        "application/json": {
          schema: z.object({ results: z.array(ScanResultSchema) }),
        },
      },
    },
    ...publicErrorResponses,
  },
});

// Screen stocks by criteria
screenerRoutes.openapi(scanRoute, async (c) => {
  const criteria = c.req.valid("json");

  const results = await screener.scan(criteria);

  return c.json({ results }, 200);
});

const moversRoute = createRoute({
  method: "get",
  path: "/movers/{direction}",
  request: {
    params: directionSchema,
    query: limitQuerySchema,
  },
  responses: {
    200: {
      description: "Top movers",
      content: {
        "application/json": {
          schema: z.object({ movers: z.array(MoverResultSchema) }),
        },
      },
    },
    ...publicErrorResponses,
  },
});

screenerRoutes.openapi(moversRoute, async (c) => {
  const { direction } = c.req.valid("param");
  const { limit } = c.req.valid("query");

  const movers = await screener.getMovers(direction, limit);

  return c.json({ movers }, 200);
});

const signalsRoute = createRoute({
  method: "post",
  path: "/signals",
  request: {
    body: {
      content: {
        "application/json": {
          schema: signalsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Watchlist signals",
      content: {
        "application/json": {
          schema: z.object({ signals: z.array(SignalSchema) }),
        },
      },
    },
    ...publicErrorResponses,
  },
});

screenerRoutes.openapi(signalsRoute, async (c) => {
  const { symbols } = c.req.valid("json");

  const signals = await screener.getSignals(symbols);

  return c.json({ signals }, 200);
});
