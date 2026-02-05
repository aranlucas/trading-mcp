// Test fixtures and mock data for integration tests

import type { Quote, Position, Order, Signal } from "../types/index.js";

// Mock quotes
export const mockQuote: Quote = {
  symbol: "AAPL",
  price: 175.5,
  open: 174.0,
  high: 176.2,
  low: 173.8,
  close: 175.5,
  volume: 50000000,
  change: 1.5,
  changePercent: 0.86,
  timestamp: "2024-01-15T16:00:00Z",
};

export const mockQuotes: Map<string, Quote> = new Map([
  ["AAPL", mockQuote],
  [
    "MSFT",
    {
      symbol: "MSFT",
      price: 380.25,
      open: 378.0,
      high: 382.0,
      low: 377.5,
      close: 380.25,
      volume: 25000000,
      change: 2.25,
      changePercent: 0.6,
      timestamp: "2024-01-15T16:00:00Z",
    },
  ],
  [
    "GOOGL",
    {
      symbol: "GOOGL",
      price: 142.8,
      open: 141.5,
      high: 143.5,
      low: 141.0,
      close: 142.8,
      volume: 18000000,
      change: 1.3,
      changePercent: 0.92,
      timestamp: "2024-01-15T16:00:00Z",
    },
  ],
]);

// Mock bars data for technical analysis
export const mockBars = [
  { t: "2024-01-01", o: 170.0, h: 172.0, l: 169.0, c: 171.5, v: 40000000 },
  { t: "2024-01-02", o: 171.5, h: 173.0, l: 170.5, c: 172.0, v: 42000000 },
  { t: "2024-01-03", o: 172.0, h: 174.0, l: 171.0, c: 173.5, v: 38000000 },
  { t: "2024-01-04", o: 173.5, h: 175.0, l: 172.5, c: 174.0, v: 45000000 },
  { t: "2024-01-05", o: 174.0, h: 176.0, l: 173.0, c: 175.5, v: 50000000 },
  { t: "2024-01-08", o: 175.5, h: 177.0, l: 174.5, c: 176.0, v: 48000000 },
  { t: "2024-01-09", o: 176.0, h: 178.0, l: 175.0, c: 177.5, v: 52000000 },
  { t: "2024-01-10", o: 177.5, h: 179.0, l: 176.5, c: 178.0, v: 46000000 },
  { t: "2024-01-11", o: 178.0, h: 180.0, l: 177.0, c: 179.5, v: 55000000 },
  { t: "2024-01-12", o: 179.5, h: 181.0, l: 178.5, c: 180.0, v: 60000000 },
  { t: "2024-01-15", o: 180.0, h: 182.0, l: 179.0, c: 181.5, v: 58000000 },
  { t: "2024-01-16", o: 181.5, h: 183.0, l: 180.5, c: 182.0, v: 54000000 },
  { t: "2024-01-17", o: 182.0, h: 184.0, l: 181.0, c: 183.5, v: 56000000 },
  { t: "2024-01-18", o: 183.5, h: 185.0, l: 182.5, c: 184.0, v: 62000000 },
  { t: "2024-01-19", o: 184.0, h: 186.0, l: 183.0, c: 185.5, v: 65000000 },
  { t: "2024-01-22", o: 185.5, h: 187.0, l: 184.5, c: 186.0, v: 58000000 },
  { t: "2024-01-23", o: 186.0, h: 188.0, l: 185.0, c: 187.5, v: 54000000 },
  { t: "2024-01-24", o: 187.5, h: 189.0, l: 186.5, c: 188.0, v: 52000000 },
  { t: "2024-01-25", o: 188.0, h: 190.0, l: 187.0, c: 189.5, v: 60000000 },
  { t: "2024-01-26", o: 189.5, h: 191.0, l: 188.5, c: 190.0, v: 58000000 },
  { t: "2024-01-29", o: 190.0, h: 191.5, l: 189.0, c: 190.5, v: 48000000 },
  { t: "2024-01-30", o: 190.5, h: 192.0, l: 189.5, c: 191.0, v: 50000000 },
];

// Mock positions
export const mockPositions: Position[] = [
  {
    symbol: "AAPL",
    quantity: 100,
    avgCost: 150.0,
    currentPrice: 175.5,
    marketValue: 17550,
    unrealizedPL: 2550,
    unrealizedPLPercent: 17.0,
  },
  {
    symbol: "MSFT",
    quantity: 50,
    avgCost: 350.0,
    currentPrice: 380.25,
    marketValue: 19012.5,
    unrealizedPL: 1512.5,
    unrealizedPLPercent: 8.64,
  },
];

// Mock orders
export const mockOrder: Order = {
  id: "order-123",
  symbol: "AAPL",
  side: "buy",
  type: "limit",
  quantity: 10,
  filledQuantity: 0,
  limitPrice: 175.0,
  status: "open",
  timeInForce: "day",
  createdAt: "2024-01-15T10:00:00Z",
};

export const mockFilledOrder: Order = {
  id: "order-456",
  symbol: "MSFT",
  side: "sell",
  type: "market",
  quantity: 5,
  filledQuantity: 5,
  status: "filled",
  timeInForce: "day",
  createdAt: "2024-01-15T09:30:00Z",
  filledAt: "2024-01-15T09:30:01Z",
};

// Mock signals
export const mockSignals: Signal[] = [
  {
    symbol: "AAPL",
    type: "RSI_OVERSOLD",
    direction: "bullish",
    strength: 0.8,
    timestamp: "2024-01-15T16:00:00Z",
    description: "RSI at 25.5 - oversold",
  },
  {
    symbol: "MSFT",
    type: "MA_BULLISH_ALIGNMENT",
    direction: "bullish",
    strength: 0.7,
    timestamp: "2024-01-15T16:00:00Z",
    description: "Price > SMA20 > SMA50",
  },
];

// Mock Alpaca API responses
export const mockAlpacaAccount = {
  id: "account-123",
  status: "ACTIVE",
  equity: "100000.00",
  cash: "50000.00",
  buying_power: "100000.00",
};

export const mockAlpacaClock = {
  is_open: true,
  next_open: "2024-01-16T09:30:00-05:00",
  next_close: "2024-01-15T16:00:00-05:00",
};

export const mockAlpacaPosition = {
  symbol: "AAPL",
  qty: "100",
  avg_entry_price: "150.00",
  current_price: "175.50",
  market_value: "17550.00",
  unrealized_pl: "2550.00",
  unrealized_plpc: "0.17",
};

export const mockAlpacaOrder = {
  id: "order-123",
  symbol: "AAPL",
  side: "buy",
  type: "limit",
  qty: "10",
  filled_qty: "0",
  limit_price: "175.00",
  status: "open",
  time_in_force: "day",
  created_at: "2024-01-15T10:00:00Z",
};

export const mockAlpacaBar = {
  Timestamp: "2024-01-15T16:00:00Z",
  OpenPrice: 174.0,
  HighPrice: 176.2,
  LowPrice: 173.8,
  ClosePrice: 175.5,
  Volume: 50000000,
};

// Mock Yahoo Finance responses
export const mockYahooQuote = {
  symbol: "AAPL",
  regularMarketPrice: 175.5,
  regularMarketOpen: 174.0,
  regularMarketDayHigh: 176.2,
  regularMarketDayLow: 173.8,
  regularMarketPreviousClose: 174.0,
  regularMarketVolume: 50000000,
  regularMarketChange: 1.5,
  regularMarketChangePercent: 0.86,
};

// Helper to generate bar data for technical indicators
export function generateBarsForRsi(
  targetRsi: number,
  periods = 30,
): { t: string; o: number; h: number; l: number; c: number; v: number }[] {
  const bars = [];
  let price = 100;

  // Determine trend based on target RSI
  const trend = targetRsi > 50 ? 1 : -1;
  const magnitude = Math.abs(targetRsi - 50) / 50;

  for (let i = 0; i < periods; i++) {
    const date = new Date(2024, 0, i + 1);
    const change = trend * magnitude * (Math.random() * 2);
    price += change;

    bars.push({
      t: date.toISOString().slice(0, 10),
      o: price - 0.5,
      h: price + 1,
      l: price - 1,
      c: price,
      v: 50000000,
    });
  }

  return bars;
}
