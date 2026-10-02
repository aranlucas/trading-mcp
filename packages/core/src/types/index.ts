// Common types for trading MCP

export interface Quote {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

export interface OptionPosition extends Position {
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  contracts: number;
}

export interface Portfolio {
  equity: number;
  cash: number;
  buyingPower: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Position[];
}

export interface Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  quantity: number;
  filledQuantity: number;
  limitPrice?: number;
  stopPrice?: number;
  status: "pending" | "open" | "filled" | "cancelled" | "rejected";
  timeInForce: "day" | "gtc" | "ioc" | "fok";
  createdAt: string;
  filledAt?: string;
}

export interface OptionChain {
  symbol: string;
  expiration: string;
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface OptionContract {
  symbol: string;
  strike: number;
  expiration: string;
  type: "call" | "put";
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface TechnicalIndicators {
  symbol: string;
  timestamp: string;
  rsi14: number | null;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  } | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  } | null;
}

export interface Signal {
  symbol: string;
  type: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: number;
  timestamp: string;
  description: string;
}

export interface NewsItem {
  id: string;
  symbol?: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment?: "positive" | "negative" | "neutral";
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: string;
  nextClose?: string;
  currentSession?: "pre" | "regular" | "post" | "closed";
}

export interface MacroSnapshot {
  sp500: { price: number; change: number };
  nasdaq: { price: number; change: number };
  dow: { price: number; change: number };
  vix: number;
  tenYearYield: number;
  dollarIndex: number;
  gold: number;
  oil: number;
  bitcoin: number;
}

// Sentiment types
export interface SentimentData {
  finnhub?: unknown;
  social?: unknown;
}

// Re-export schema-inferred types for provider-specific data
export type {
  YahooQuote,
  YahooChartQuote,
  YahooSearchResult,
  YahooOptionContract,
  PolygonBar,
  PolygonNewsArticle,
  PolygonTickerSnapshot,
  FinnhubQuote,
  FinnhubNewsArticle,
  FinnhubPattern,
  FredObservation,
  FinvizScreenerResult,
  FinvizScreenFilters,
  AlpacaPosition,
  AlpacaOrder,
  AlpacaBar,
  Bar,
} from "../schemas/index.js";
