import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { ScreenerService } from "../services/screener.js";
import { publicErrorResponses } from "../openapi/error-responses.js";

export const screenerRoutes = new OpenAPIHono();
const screener = new ScreenerService();

// Validation schemas
const symbolSchema = z
  .string()
  .min(1)
  .max(10)
  .regex(/^[A-Z0-9.]+$/i, "Invalid symbol format");

const scanSchema = z.object({
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  minVolume: z.number().min(0).optional(),
  minRsi: z.number().min(0).max(100).optional(),
  maxRsi: z.number().min(0).max(100).optional(),
  aboveSma20: z.boolean().optional(),
  aboveSma50: z.boolean().optional(),
  symbols: z.array(symbolSchema).max(100).optional(),
});

const signalsSchema = z.object({
  symbols: z.array(symbolSchema).min(1).max(100),
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
          schema: scanSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Scan results",
      content: {
        "application/json": {
          schema: z.object({ results: z.unknown() }),
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
          schema: z.object({ movers: z.unknown() }),
        },
      },
    },
    ...publicErrorResponses,
  },
});

// Get top movers
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
          schema: z.object({ signals: z.unknown() }),
        },
      },
    },
    ...publicErrorResponses,
  },
});

// Get signals for watchlist
screenerRoutes.openapi(signalsRoute, async (c) => {
  const { symbols } = c.req.valid("json");

  const signals = await screener.getSignals(symbols);
  return c.json({ signals }, 200);
});
