// Alpaca API client using official SDK (v4)

import { z } from "zod";
import { config } from "../config.js";
import type { Quote, Position, Portfolio, Order, MarketStatus } from "../types/index.js";
import { ValidationError } from "./errors.js";
import { Alpaca, TimeFrame, TimeFrameUnit, timeFrame } from "@alpacahq/alpaca-trade-api";

type BrokerOrder = Awaited<ReturnType<Alpaca["trading"]["orders"]["submit"]>>;

type TimeFrameString = ReturnType<typeof timeFrame>;

// Initialize official Alpaca client lazily (v4 throws if creds missing at construction).
// In tests and local dev without keys we still need the module to import (e.g. order schema tests).
let _alpaca: Alpaca | null = null;

function getAlpaca(): Alpaca {
  if (_alpaca) return _alpaca;
  const keyId = config.alpaca.apiKey || "test-key-id";
  const secret = config.alpaca.apiSecret || "test-secret";
  _alpaca = new Alpaca({ keyId, secret, paper: config.alpaca.paper });

  return _alpaca;
}

// Account & Portfolio
export async function getAccount(): Promise<{
  id: string;
  status: string;
  equity: string;
  cash: string;
  buying_power: string;
}> {
  const raw = await getAlpaca().trading.account.getAccount();

  return {
    id: String(raw.id ?? ""),
    status: String(raw.status ?? ""),
    equity: String(raw.equity ?? "0"),
    cash: String(raw.cash ?? "0"),
    buying_power: String(raw.buyingPower ?? "0"),
  };
}

export async function getPositions(): Promise<Position[]> {
  const positions = await getAlpaca().trading.positions.getAllOpenPositions();

  return positions.map((p) => ({
    symbol: String(p.symbol),
    quantity: parseFloat(String(p.qty ?? "0")),
    avgCost: parseFloat(String(p.avgEntryPrice ?? "0")),
    currentPrice: parseFloat(String(p.currentPrice ?? "0")),
    marketValue: parseFloat(String(p.marketValue ?? "0")),
    unrealizedPL: parseFloat(String(p.unrealizedPl ?? "0")),
    unrealizedPLPercent: parseFloat(String(p.unrealizedPlpc ?? "0")) * 100,
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

// Market Data — uses v4 MarketDataClient facades
export async function getQuote(symbol: string): Promise<Quote> {
  const bars = await getAlpaca().marketData.getStockBarsFor(symbol, {
    timeframe: TimeFrame.Day,
    limit: 2,
  });

  const sorted = [...bars].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const prevBar = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const lastBar = sorted.length >= 1 ? sorted[sorted.length - 1] : null;

  const price = lastBar?.close ?? 0;
  const prevClose = prevBar?.close ?? price;
  const change = price - prevClose;
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol,
    price,
    open: lastBar?.open ?? 0,
    high: lastBar?.high ?? 0,
    low: lastBar?.low ?? 0,
    // Align with Yahoo snapshots: `close` is previous close.
    close: prevClose,
    volume: lastBar?.volume ?? 0,
    change,
    changePercent,
    timestamp: lastBar ? new Date(lastBar.timestamp).toISOString() : new Date().toISOString(),
  };
}

export async function getBars(
  symbol: string,
  timeframe = "1Day",
  limit = 100,
): Promise<{ t: string; o: number; h: number; l: number; c: number; v: number }[]> {
  const bars = await getAlpaca().marketData.getStockBarsFor(symbol, {
    timeframe: parseTimeframe(timeframe),
    limit,
  });

  return bars.map((b) => ({
    t: new Date(b.timestamp).toISOString(),
    o: b.open,
    h: b.high,
    l: b.low,
    c: b.close,
    v: b.volume,
  }));
}

// Validate the public string input through the SDK's own timeframe constructor.
export function parseTimeframe(value: string): TimeFrameString {
  const match = /^(\d+)(Min|Hour|Day|Week|Month)$/.exec(value);

  if (!match) throw new ValidationError("Invalid Alpaca timeframe");
  const amount = Number(match[1]);
  const unit = z.enum(TimeFrameUnit).parse(match[2]);

  return timeFrame(amount, unit);
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

  // Map to v4 submit shape; use generic submit for all order types
  const raw = await getAlpaca().trading.orders.submit({
    symbol: parsed.data.symbol,
    qty: String(parsed.data.qty),
    side: parsed.data.side,
    type: parsed.data.type,
    timeInForce: parsed.data.time_in_force,
    limitPrice: parsed.data.limit_price !== undefined ? String(parsed.data.limit_price) : undefined,
    stopPrice: parsed.data.stop_price !== undefined ? String(parsed.data.stop_price) : undefined,
  });

  return mapOrder(raw, parsed.data);
}

// The SDK owns deserialization. Preserve broker status strings, including future states.
// Pick removes the SDK's unrelated extension index signature from this pure mapper's input.
type BrokerOrderFields = Pick<
  BrokerOrder,
  | "id"
  | "symbol"
  | "side"
  | "type"
  | "orderType"
  | "qty"
  | "filledQty"
  | "limitPrice"
  | "stopPrice"
  | "timeInForce"
  | "createdAt"
  | "filledAt"
> & { status?: string };

type OrderFallback = z.infer<typeof AlpacaOrderRequestSchema>;

export function mapOrder(raw: BrokerOrderFields, fallback?: OrderFallback): Order {
  return {
    id: raw.id ?? "",
    symbol: raw.symbol ?? fallback?.symbol ?? "",
    side: raw.side ?? fallback?.side ?? "buy",
    type: raw.type ?? raw.orderType ?? fallback?.type ?? "market",
    quantity: parseFloat(raw.qty ?? String(fallback?.qty ?? 0)),
    filledQuantity: parseFloat(raw.filledQty ?? "0"),
    limitPrice: raw.limitPrice ? parseFloat(raw.limitPrice) : undefined,
    stopPrice: raw.stopPrice ? parseFloat(raw.stopPrice) : undefined,
    status: raw.status ?? "new",
    timeInForce: raw.timeInForce ?? fallback?.time_in_force ?? "day",
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
    filledAt: raw.filledAt ? String(raw.filledAt) : undefined,
  };
}

export async function getOrder(orderId: string): Promise<Order> {
  const raw = await getAlpaca().trading.orders.getOrderByOrderID({ orderId });

  return mapOrder(raw);
}

export async function cancelOrder(orderId: string): Promise<void> {
  await getAlpaca().trading.orders.deleteOrderByOrderID({ orderId });
}

export async function getOrders(status = "open"): Promise<Order[]> {
  const raw = await getAlpaca().trading.orders.getAllOrders({
    status: z.enum(["open", "closed", "all"]).parse(status),
  });

  return raw.map((order) => mapOrder(order));
}

// Market Status
export async function getMarketClock(): Promise<MarketStatus> {
  return mapMarketClock(await getAlpaca().trading.clock.legacyClock());
}

export function mapMarketClock(
  raw: Awaited<ReturnType<Alpaca["trading"]["clock"]["legacyClock"]>>,
): MarketStatus {
  return {
    isOpen: raw.isOpen,
    nextOpen: String(raw.nextOpen),
    nextClose: String(raw.nextClose),
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

// Export the raw client for advanced usage (breaking change: now a getter)
export const client = getAlpaca();
