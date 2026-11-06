import { expect, it } from "vitest";
import { Backtester } from "@/scripts/lib/backtest.js";

it("does not invent RSI momentum or MA entries in flat history", () => {
  const bars = Array.from({ length: 65 }, (_, i) => ({
    t: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    o: 100,
    h: 100,
    l: 100,
    c: 100,
    v: 1000,
  }));

  const engine = new Backtester("FLAT", bars);
  expect(engine.backtestRsiOverbought(70, 5).trades).toEqual([]);
  expect(engine.backtestRsiOversold(30, 5).trades).toEqual([]);
  expect(engine.backtestMaBullishAlignment(5).trades).toEqual([]);
});

it("preserves RSI entry, holding period, short direction and realized return", () => {
  const bars = Array.from({ length: 27 }, (_, i) => ({
    t: `day-${i}`,
    o: 100 + i,
    h: 100 + i,
    l: 100 + i,
    c: 100 + i,
    v: 1000,
  }));

  const result = new Backtester("UP", bars).backtestRsiOverbought(70, 5);
  expect(result.trades).toEqual([
    {
      symbol: "UP",
      signal: "RSI_OVERBOUGHT_70",
      entryDate: "day-20",
      entryPrice: 120,
      exitDate: "day-25",
      exitPrice: 125,
      holdingDays: 5,
      pnl: -5,
      pnlPercent: (-5 / 120) * 100,
    },
  ]);
});
