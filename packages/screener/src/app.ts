import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { toPublicError, unified } from "@trading/core";
import { screenerRoutes } from "./routes/screener.js";
import { quotesRoutes } from "./routes/quotes.js";

export const app = new OpenAPIHono().basePath("/api");

// Middleware
app.use("*", secureHeaders());

app.use("*", cors());

app.onError((err, c) => {
  const pub = toPublicError(err);

  return c.json({ error: pub.message, code: pub.code }, pub.status);
});

const statusRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Service status",
      content: {
        "application/json": {
          schema: z.object({
            name: z.string(),
            version: z.string(),
            status: z.literal("ok"),
          }),
        },
      },
    },
  },
});

// Basic health check (no external calls)
app.openapi(statusRoute, (c) => {
  return c.json(
    {
      name: "trading-screener",
      version: "0.1.0",
      status: "ok",
    },
    200,
  );
});

const providerHealthSchema = z.object({
  healthy: z.boolean(),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
});

const providerHealthStatusSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  providers: z.record(z.string(), providerHealthSchema),
  timestamp: z.string(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      description: "Healthy/Degraded",
      content: {
        "application/json": {
          schema: providerHealthStatusSchema,
        },
      },
    },
    503: {
      description: "Unhealthy",
      content: {
        "application/json": {
          schema: providerHealthStatusSchema,
        },
      },
    },
  },
});

// Deep health check (tests all providers)
app.openapi(healthRoute, async (c) => {
  const health = await unified.healthCheck();
  const statusCode = health.status === "unhealthy" ? 503 : 200;

  return c.json(health, statusCode);
});

// Routes
app.route("/screener", screenerRoutes);

app.route("/quotes", quotesRoutes);

app.doc("/openapi.json", {
  openapi: "3.0.3",
  info: {
    title: "Trading Screener API",
    version: "0.1.0",
  },
});
