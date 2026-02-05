import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ScreenerService } from "../services/screener.js";

export const screenerRoutes = new Hono();
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
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().min(1).max(100)),
});

// Screen stocks by criteria
screenerRoutes.post("/scan", zValidator("json", scanSchema), async (c) => {
  const criteria = c.req.valid("json");

  try {
    const results = await screener.scan(criteria);
    return c.json({ results });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Get top movers
screenerRoutes.get(
  "/movers/:direction",
  zValidator("param", directionSchema),
  zValidator("query", limitQuerySchema),
  async (c) => {
    const { direction } = c.req.valid("param");
    const { limit } = c.req.valid("query");

    try {
      const movers = await screener.getMovers(direction, limit);
      return c.json({ movers });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  },
);

// Get signals for watchlist
screenerRoutes.post("/signals", zValidator("json", signalsSchema), async (c) => {
  const { symbols } = c.req.valid("json");

  try {
    const signals = await screener.getSignals(symbols);
    return c.json({ signals });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});
