// Alpaca API client using official SDK

import { createRequire } from "module";
import { z } from "zod";
import { config } from "../config.js";
import type { Quote, Position, Portfolio, Order, MarketStatus } from "../types/index.js";
import { AlpacaPositionSchema, AlpacaOrderSchema, AlpacaBarSchema } from "../schemas/index.js";
import { ValidationError } from "./errors.js";

// CJS import for Alpaca SDK (it doesn't have proper ESM exports)
const require = createRequire(import.meta.url);
const Alpaca = require("@alpacahq/alpaca-trade-api");

// Initialize official Alpaca client
const alpaca = new Alpaca({
  keyId: config.alpaca.apiKey,
  secretKey: config.alpaca.apiSecret,
  paper: config.alpaca.paper,
});

// Schema for account response
const AlpacaAccountSchema = z.object({
  id: z.string(),
  status: z.string(),
  equity: z.string(),
  cash: z.string(),
  buying_power: z.string(),
});

// Schema for clock response
const AlpacaClockSchema = z.object({
  is_open: z.boolean(),
  next_open: z.string(),
  next_close: z.string(),
});

// Account & Portfolio
export async function getAccount(): Promise<{
  id: string;
  status: string;
  equity: string;
  cash: string;
  buying_power: string;
}> {
  const raw = await alpaca.getAccount();
  const account = AlpacaAccountSchema.parse(raw);
  return {
    id: account.id,
    status: account.status,
    equity: account.equity,
    cash: account.cash,
    buying_power: account.buying_power,
  };
}

export async function getPositions(): Promise<Position[]> {
  const raw = await alpaca.getPositions();
  const positions = z.array(AlpacaPositionSchema).parse(raw);
  return positions.map((p) => ({
    symbol: p.symbol,
    quantity: parseFloat(p.qty),
    avgCost: parseFloat(p.avg_entry_price),
    currentPrice: parseFloat(p.current_price),
    marketValue: parseFloat(p.market_value),
    unrealizedPL: parseFloat(p.unrealized_pl),
    unrealizedPLPercent: parseFloat(p.unrealized_plpc) * 100,
  }));
}

export async function getPortfolio(): Promise<Portfolio> {
  const [account, positions] = await Promise.all([getAccount(), getPositions()]);

  return {
    equity: parseFloat(account.equity),
    cash: parseFloat(account.cash),
    buyingPower: parseFloat(account.buying_power),
    dayChange: 0,
    dayChangePercent: 0,
    positions,
  };
}

// Market Data
export async function getQuote(symbol: string): Promise<Quote> {
  const bars = alpaca.getBarsV2(symbol, {
    timeframe: "1Day",
    limit: 1,
  });

  let lastBar: z.infer<typeof AlpacaBarSchema> | null = null;
  for await (const bar of bars) {
    const parsed = AlpacaBarSchema.safeParse(bar);
    if (parsed.success) {
      lastBar = parsed.data;
    }
  }

  return {
    symbol,
    price: lastBar?.ClosePrice ?? 0,
    open: lastBar?.OpenPrice ?? 0,
    high: lastBar?.HighPrice ?? 0,
    low: lastBar?.LowPrice ?? 0,
    close: lastBar?.ClosePrice ?? 0,
    volume: lastBar?.Volume ?? 0,
    change: 0,
    changePercent: 0,
    timestamp: lastBar?.Timestamp ?? new Date().toISOString(),
  };
}

export async function getBars(
  symbol: string,
  timeframe = "1Day",
  limit = 100,
): Promise<{ t: string; o: number; h: number; l: number; c: number; v: number }[]> {
  const bars = alpaca.getBarsV2(symbol, {
    timeframe,
    limit,
  });

  const result: {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  }[] = [];
  for await (const bar of bars) {
    const parsed = AlpacaBarSchema.safeParse(bar);
    if (parsed.success) {
      result.push({
        t: parsed.data.Timestamp,
        o: parsed.data.OpenPrice,
        h: parsed.data.HighPrice,
        l: parsed.data.LowPrice,
        c: parsed.data.ClosePrice,
        v: parsed.data.Volume,
      });
    }
  }
  return result;
}

// Orders
export const AlpacaOrderRequestSchema = z
  .object({
    symbol: z
      .string()
      .min(1)
      .max(10)
      .regex(/^[A-Z0-9.]+$/i, "Invalid symbol format"),
    qty: z.number().finite().positive(),
    side: z.enum(["buy", "sell"]),
    type: z.enum(["market", "limit", "stop", "stop_limit"]),
    time_in_force: z.enum(["day", "gtc", "ioc", "fok"]),
    limit_price: z.number().finite().positive().optional(),
    stop_price: z.number().finite().positive().optional(),
  })
  .superRefine((val, ctx) => {
    if ((val.type === "limit" || val.type === "stop_limit") && val.limit_price === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["limit_price"],
        message: "limit_price is required for limit and stop_limit orders",
      });
    }
    if ((val.type === "stop" || val.type === "stop_limit") && val.stop_price === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stop_price"],
        message: "stop_price is required for stop and stop_limit orders",
      });
    }
  });

export async function placeOrder(params: {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  time_in_force: "day" | "gtc" | "ioc" | "fok";
  limit_price?: number;
  stop_price?: number;
}): Promise<Order> {
  const parsed = AlpacaOrderRequestSchema.safeParse(params);
  if (!parsed.success) {
    throw new ValidationError("Invalid order parameters", parsed.error.issues);
  }

  const raw = await alpaca.createOrder({
    symbol: parsed.data.symbol,
    qty: parsed.data.qty,
    side: parsed.data.side,
    type: parsed.data.type,
    time_in_force: parsed.data.time_in_force,
    limit_price: parsed.data.limit_price,
    stop_price: parsed.data.stop_price,
  });

  const order = AlpacaOrderSchema.parse(raw);
  return {
    id: order.id,
    symbol: order.symbol,
    side: order.side as "buy" | "sell",
    type: order.type as "market" | "limit" | "stop" | "stop_limit",
    quantity: parseFloat(order.qty),
    filledQuantity: parseFloat(order.filled_qty ?? "0"),
    limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
    stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
    status: order.status as Order["status"],
    timeInForce: order.time_in_force as Order["timeInForce"],
    createdAt: order.created_at,
    filledAt: order.filled_at,
  };
}

export async function getOrder(orderId: string): Promise<Order> {
  const raw = await alpaca.getOrder(orderId);
  const order = AlpacaOrderSchema.parse(raw);
  return {
    id: order.id,
    symbol: order.symbol,
    side: order.side as "buy" | "sell",
    type: order.type as "market" | "limit" | "stop" | "stop_limit",
    quantity: parseFloat(order.qty),
    filledQuantity: parseFloat(order.filled_qty ?? "0"),
    limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
    stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
    status: order.status as Order["status"],
    timeInForce: order.time_in_force as Order["timeInForce"],
    createdAt: order.created_at,
    filledAt: order.filled_at,
  };
}

export async function cancelOrder(orderId: string): Promise<void> {
  await alpaca.cancelOrder(orderId);
}

export async function getOrders(status = "open"): Promise<Order[]> {
  const raw = await alpaca.getOrders({ status });
  const orders = z.array(AlpacaOrderSchema).parse(raw);
  return orders.map((order) => ({
    id: order.id,
    symbol: order.symbol,
    side: order.side as "buy" | "sell",
    type: order.type as "market" | "limit" | "stop" | "stop_limit",
    quantity: parseFloat(order.qty),
    filledQuantity: parseFloat(order.filled_qty ?? "0"),
    limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
    stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
    status: order.status as Order["status"],
    timeInForce: order.time_in_force as Order["timeInForce"],
    createdAt: order.created_at,
    filledAt: order.filled_at,
  }));
}

// Market Status
export async function getMarketClock(): Promise<MarketStatus> {
  const raw = await alpaca.getClock();
  const clock = AlpacaClockSchema.parse(raw);
  return {
    isOpen: clock.is_open,
    nextOpen: clock.next_open,
    nextClose: clock.next_close,
  };
}

// Screener: Get snapshots for multiple symbols
export async function getSnapshots(symbols: string[]): Promise<Map<string, Quote>> {
  const results = new Map<string, Quote>();

  // Get bars for each symbol
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await getQuote(symbol);
        results.set(symbol, quote);
      } catch {
        // Skip symbols that fail
      }
    }),
  );

  return results;
}

// Export the raw client for advanced usage
export { alpaca as client };
