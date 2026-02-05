import { Hono } from "hono";
import { yahoo } from "@trading/core";

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
    const yahooQuote = await yahoo.getQuote(symbol);
    return c.json(yahooQuote);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Get multiple quotes
quotesRoutes.post("/batch", zValidator("json", batchQuotesSchema), async (c) => {
  const { symbols } = c.req.valid("json");

  try {
    const yahooQuotes = await yahoo.getQuotes(symbols);
    return c.json(yahooQuotes);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Get price bars
quotesRoutes.get("/:symbol/bars", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const limit = parseInt(c.req.query("limit") || "100");
  const days = limit; // Approximate: limit bars roughly equals days back
  const period1 = new Date();
  period1.setDate(period1.getDate() - days);

  try {
    const chart = await yahoo.getHistory(symbol, period1);
    return c.json(chart);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});
