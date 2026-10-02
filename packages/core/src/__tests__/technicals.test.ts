import { describe, expect, it } from "vitest";
import { analyzeHistory } from "../lib/technicals.js";

describe("analyzeHistory", () => {
  it.each([0, 10, 14, 15, 19, 20, 25, 26, 33, 34, 49, 50, 199, 200])(
    "reports availability independently with %i closes",
    (length) => {
      const analysis = analyzeHistory(Array.from({ length }, (_, i) => 100 + i));
      expect(analysis.rsi14 === null).toBe(length < 15);
      expect(analysis.sma20 === null).toBe(length < 20);
      expect(analysis.sma50 === null).toBe(length < 50);
      expect(analysis.sma200 === null).toBe(length < 200);
      expect(analysis.ema12 === null).toBe(length < 12);
      expect(analysis.ema26 === null).toBe(length < 26);
      expect(analysis.bollingerBands === null).toBe(length < 20);
      expect(analysis.macd === null).toBe(length < 34);
    },
  );

  it("uses only the last period for SMA and trailing RSI changes", () => {
    const history = [1_000, ...Array.from({ length: 50 }, (_, i) => 100 + i)];
    expect(analyzeHistory(history)).toMatchObject({ sma20: 139.5, sma50: 124.5, rsi14: 100 });
    expect(analyzeHistory(history.slice(1).reverse()).rsi14).toBe(0);
  });

  it("distinguishes flat history and valid zero averages from missing data", () => {
    expect(analyzeHistory(Array(50).fill(0))).toMatchObject({
      rsi14: 50,
      sma20: 0,
      sma50: 0,
      sma200: null,
      macd: { value: 0, signal: 0, histogram: 0 },
      bollingerBands: { upper: 0, middle: 0, lower: 0 },
    });
  });

  it("seeds the MACD signal with nine actual MACD observations", () => {
    const analysis = analyzeHistory([...Array(33).fill(100), 200]);
    const expected = 100 * (2 / 13 - 2 / 27);
    expect(analysis.macd?.value).toBeCloseTo(expected, 10);
    expect(analysis.macd?.signal).toBeCloseTo(expected / 9, 10);
    expect(analysis.macd?.histogram).toBeCloseTo((expected * 8) / 9, 10);
  });

  it("does not fabricate momentum from a constant linear trend", () => {
    const analysis = analyzeHistory(Array.from({ length: 50 }, (_, i) => 100 + i));
    expect(analysis.macd?.value).toBeCloseTo(7, 10);
    expect(analysis.macd?.signal).toBeCloseTo(7, 10);
    expect(analysis.macd?.histogram).toBeCloseTo(0, 10);
  });

  it.each([NaN, Infinity, -Infinity])("rejects non-finite observations (%s)", (invalid) => {
    expect(() => analyzeHistory([...Array(50).fill(100), invalid])).toThrow(/finite/);
  });
});
