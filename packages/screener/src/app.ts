import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { unified } from "@trading/core";
import { screenerRoutes } from "./routes/screener.js";
import { quotesRoutes } from "./routes/quotes.js";

export const app = new Hono();

// Middleware
app.use("*", secureHeaders());
app.use("*", cors());

// Basic health check (fast, no external calls)
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

// Routes
app.route("/api/screener", screenerRoutes);
app.route("/api/quotes", quotesRoutes);
