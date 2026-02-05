import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { unified } from "@trading/core";
import { screenerRoutes } from "./routes/screener.js";
import { quotesRoutes } from "./routes/quotes.js";
import { openapi } from "./openapi.js";

export const app = new Hono().basePath("/api");

// Middleware
app.use("*", secureHeaders());
app.use("*", cors());

// Basic health check (no external calls)
app.get("/", (c) => {
  return c.json({
    name: "trading-screener",
    version: "0.1.0",
    status: "ok",
  });
});

// Deep health check (tests all providers)
app.get("/health", async (c) => {
  const health = await unified.healthCheck();
  const statusCode = health.status === "unhealthy" ? 503 : 200;
  return c.json(health, statusCode);
});

// OpenAPI spec
app.get("/openapi.json", (c) => c.json(openapi));

// Routes
app.route("/screener", screenerRoutes);
app.route("/quotes", quotesRoutes);
