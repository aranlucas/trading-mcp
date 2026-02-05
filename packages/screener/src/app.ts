import { Hono } from "hono";
import { cors } from "hono/cors";
import { screenerRoutes } from "./routes/screener.js";
import { quotesRoutes } from "./routes/quotes.js";

export const app = new Hono();

// Middleware
app.use("*", cors());

// Health check
app.get("/", (c) => {
  return c.json({
    name: "trading-screener",
    version: "0.1.0",
    status: "ok",
  });
});

// Routes
app.route("/api/screener", screenerRoutes);
app.route("/api/quotes", quotesRoutes);
