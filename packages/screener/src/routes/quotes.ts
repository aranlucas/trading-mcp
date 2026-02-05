import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { yahoo, toPublicError } from "@trading/core";

export const quotesRoutes = new Hono();

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
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 100))
    .pipe(z.number().min(1).max(365)),
});

// Get single quote
quotesRoutes.get("/:symbol", zValidator("param", symbolParamSchema), async (c) => {
  const { symbol } = c.req.valid("param");

  try {
    const yahooQuote = await yahoo.getQuote(symbol.toUpperCase());
    return c.json(yahooQuote);
  } catch (error) {
    const pub = toPublicError(error);
    return c.json({ error: pub.message, code: pub.code }, pub.status);
  }
});

// Get multiple quotes
quotesRoutes.post("/batch", zValidator("json", batchQuotesSchema), async (c) => {
  const { symbols } = c.req.valid("json");

  try {
    const yahooQuotes = await yahoo.getQuotes(symbols.map((s) => s.toUpperCase()));
    return c.json(yahooQuotes);
  } catch (error) {
    const pub = toPublicError(error);
    return c.json({ error: pub.message, code: pub.code }, pub.status);
  }
});

// Get price bars
quotesRoutes.get(
  "/:symbol/bars",
  zValidator("param", symbolParamSchema),
  zValidator("query", barsQuerySchema),
  async (c) => {
    const { symbol } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    const days = limit;
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    try {
      const chart = await yahoo.getHistory(symbol.toUpperCase(), period1);
      return c.json(chart);
    } catch (error) {
      const pub = toPublicError(error);
      return c.json({ error: pub.message, code: pub.code }, pub.status);
    }
  },
);
