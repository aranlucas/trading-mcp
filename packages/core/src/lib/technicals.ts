import type { TechnicalIndicators } from "../types/index.js";

export type HistoryIndicators = Omit<TechnicalIndicators, "symbol" | "timestamp">;

function sma(closes: readonly number[], period: number): number | null {
  if (closes.length < period) return null;

  return closes.slice(-period).reduce((sum, close) => sum + close, 0) / period;
}

function emaSeries(closes: readonly number[], period: number): number[] {
  const seed = sma(closes.slice(0, period), period);

  if (seed === null) return [];
  const values = [seed];
  let value = seed;
  const weight = 2 / (period + 1);

  for (const close of closes.slice(period)) {
    value = close * weight + value * (1 - weight);
    values.push(value);
  }

  return values;
}

// Retain the existing simple, trailing-14-change RSI definition on both surfaces.
function rsi(closes: readonly number[]): number | null {
  if (closes.length < 15) return null;
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - 14; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!;
    gains += Math.max(0, change);
    losses += Math.max(0, -change);
  }

  if (gains === 0 && losses === 0) return 50;

  if (losses === 0) return 100;

  return 100 - 100 / (1 + gains / losses);
}

/**
 * Analyze finite closes ordered oldest first. Null means insufficient history:
 * RSI14 needs 15 observations; SMA/EMA/Bollinger need their period; MACD(12,26,9)
 * needs 34 observations to seed its signal EMA. Never substitute a price of zero.
 */
export function analyzeHistory(closes: readonly number[]): HistoryIndicators {
  if (!closes.every(Number.isFinite)) {
    throw new RangeError("Technical analysis requires finite closing prices");
  }

  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdValues = ema26.map((value, i) => ema12[i + 14]! - value);
  const macdValue = macdValues.at(-1);
  const signal = emaSeries(macdValues, 9).at(-1);
  const middle = sma(closes, 20);

  const deviation =
    middle === null
      ? null
      : Math.sqrt(closes.slice(-20).reduce((sum, close) => sum + (close - middle) ** 2, 0) / 20);

  return {
    rsi14: rsi(closes),
    sma20: middle,
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    ema12: ema12.at(-1) ?? null,
    ema26: ema26.at(-1) ?? null,
    macd:
      macdValue === undefined || signal === undefined
        ? null
        : {
            value: macdValue,
            signal,
            histogram: macdValue - signal,
          },
    bollingerBands:
      middle === null || deviation === null
        ? null
        : {
            upper: middle + 2 * deviation,
            middle,
            lower: middle - 2 * deviation,
          },
  };
}
