// Technical analysis tools

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { alpaca, type TechnicalIndicators, type Signal } from "@trading/core";

// Simple moving average
function sma(data: number[], period: number): number {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Exponential moving average
function ema(data: number[], period: number): number {
  if (data.length < period) return 0;
  const k = 2 / (period + 1);
  let emaValue = sma(data.slice(0, period), period);
  for (let i = period; i < data.length; i++) {
    const value = data[i];
    if (value !== undefined) {
      emaValue = value * k + emaValue * (1 - k);
    }
  }
  return emaValue;
}

// RSI calculation
function rsi(data: number[], period = 14): number {
  if (data.length < period + 1) return 50;

  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const curr = data[i];
    const prev = data[i - 1];
    if (curr !== undefined && prev !== undefined) {
      changes.push(curr - prev);
    }
  }

  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? -c : 0));

  const avgGain = sma(gains.slice(-period), period);
  const avgLoss = sma(losses.slice(-period), period);

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// MACD calculation
function macd(data: number[]): {
  value: number;
  signal: number;
  histogram: number;
} {
  const ema12 = ema(data, 12);
  const ema26 = ema(data, 26);
  const macdValue = ema12 - ema26;
  const signal = macdValue * 0.9;
  return {
    value: macdValue,
    signal,
    histogram: macdValue - signal,
  };
}

// Bollinger Bands
function bollingerBands(
  data: number[],
  period = 20,
): { upper: number; middle: number; lower: number } {
  const middle = sma(data, period);
  const slice = data.slice(-period);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: middle + 2 * stdDev,
    middle,
    lower: middle - 2 * stdDev,
  };
}

export function registerTechnicalTools(server: McpServer) {
  // Get technical indicators
  server.registerTool(
    "get_technicals",
    {
      title: "Get Technical Indicators",
      description:
        "Calculate technical indicators (RSI, MACD, SMA, EMA, Bollinger Bands) for a symbol",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        const bars = await alpaca.getBars(symbol.toUpperCase(), "1Day", 200);
        const closes = bars.map((b) => b.c);

        if (closes.length < 26) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Not enough data for indicators",
              },
            ],
            isError: true,
          };
        }

        const indicators: TechnicalIndicators = {
          symbol: symbol.toUpperCase(),
          timestamp: new Date().toISOString(),
          rsi14: rsi(closes, 14),
          macd: macd(closes),
          sma20: sma(closes, 20),
          sma50: sma(closes, 50),
          sma200: closes.length >= 200 ? sma(closes, 200) : 0,
          ema12: ema(closes, 12),
          ema26: ema(closes, 26),
          bollingerBands: bollingerBands(closes, 20),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(indicators, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // Get signals
  server.registerTool(
    "get_signals",
    {
      title: "Get Trading Signals",
      description: "Generate trading signals based on technical analysis",
      inputSchema: {
        symbol: z.string().describe("Stock ticker symbol"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => {
      try {
        const bars = await alpaca.getBars(symbol.toUpperCase(), "1Day", 200);
        const closes = bars.map((b) => b.c);
        const signals: Signal[] = [];
        const currentPrice = closes[closes.length - 1] ?? 0;

        if (closes.length < 20) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Not enough data for signals",
              },
            ],
            isError: true,
          };
        }

        // RSI signals
        const rsiValue = rsi(closes, 14);
        if (rsiValue < 30) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "RSI_OVERSOLD",
            direction: "bullish",
            strength: (30 - rsiValue) / 30,
            timestamp: new Date().toISOString(),
            description: `RSI at ${rsiValue.toFixed(2)} indicates oversold conditions`,
          });
        } else if (rsiValue > 70) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "RSI_OVERBOUGHT",
            direction: "bearish",
            strength: (rsiValue - 70) / 30,
            timestamp: new Date().toISOString(),
            description: `RSI at ${rsiValue.toFixed(2)} indicates overbought conditions`,
          });
        }

        // Moving average crossover
        const sma20Val = sma(closes, 20);
        const sma50Val = sma(closes, 50);
        if (currentPrice > sma20Val && sma20Val > sma50Val) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "MA_BULLISH",
            direction: "bullish",
            strength: 0.7,
            timestamp: new Date().toISOString(),
            description: "Price above SMA20, SMA20 above SMA50 (bullish alignment)",
          });
        } else if (currentPrice < sma20Val && sma20Val < sma50Val) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "MA_BEARISH",
            direction: "bearish",
            strength: 0.7,
            timestamp: new Date().toISOString(),
            description: "Price below SMA20, SMA20 below SMA50 (bearish alignment)",
          });
        }

        // Bollinger Band signals
        const bb = bollingerBands(closes, 20);
        if (currentPrice < bb.lower) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "BB_LOWER",
            direction: "bullish",
            strength: 0.6,
            timestamp: new Date().toISOString(),
            description: "Price below lower Bollinger Band (potential bounce)",
          });
        } else if (currentPrice > bb.upper) {
          signals.push({
            symbol: symbol.toUpperCase(),
            type: "BB_UPPER",
            direction: "bearish",
            strength: 0.6,
            timestamp: new Date().toISOString(),
            description: "Price above upper Bollinger Band (potential pullback)",
          });
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(signals, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
