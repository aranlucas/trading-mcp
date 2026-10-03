/**
 * Environment variable validation with Zod
 * Validates all environment variables at startup to fail fast on misconfiguration.
 */

import { z } from "zod";
import { logger } from "./logger.js";

// Schema for environment variables
const EnvSchema = z.object({
  // Alpaca trading (required for trading functionality)
  ALPACA_API_KEY: z.string().optional(),
  ALPACA_API_SECRET: z.string().optional(),
  ALPACA_PAPER: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v !== "false"),

  // Polygon.io (optional, for market data)
  POLYGON_API_KEY: z.string().optional(),

  // Finnhub (optional, for sentiment/news)
  FINNHUB_API_KEY: z.string().optional(),

  // FRED (optional, for economic data)
  FRED_API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .optional()
    .default("info"),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates environment variables and returns typed config.
 * Logs warnings for missing optional API keys.
 */
export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    logger.error({ errors: formatted }, "Environment validation failed");
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }

  const env = result.data;

  // Log warnings for missing optional keys
  const missingProviders: string[] = [];

  if (!env.ALPACA_API_KEY || !env.ALPACA_API_SECRET) {
    missingProviders.push("Alpaca (trading disabled)");
  }

  if (!env.POLYGON_API_KEY) {
    missingProviders.push("Polygon.io");
  }

  if (!env.FINNHUB_API_KEY) {
    missingProviders.push("Finnhub");
  }

  if (!env.FRED_API_KEY) {
    missingProviders.push("FRED");
  }

  if (missingProviders.length > 0) {
    logger.warn({ missingProviders }, "Some API keys are not configured. Features may be limited.");
  }

  return env;
}

/**
 * Get provider configuration status
 */
export function getProviderConfigStatus() {
  return {
    alpaca: Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET),
    polygon: Boolean(process.env.POLYGON_API_KEY),
    finnhub: Boolean(process.env.FINNHUB_API_KEY),
    fred: Boolean(process.env.FRED_API_KEY),
    yahoo: true, // Always available (no API key required)
    finviz: true, // Always available (web scraping)
  };
}
