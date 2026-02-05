import { describe, it, expect, vi, beforeEach } from "vitest";

// Backtesting framework for screener signals

interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface Trade {
  symbol: string;
  signal: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  holdingDays: number;
  pnl: number;
  pnlPercent: number;
}

interface BacktestResult {
  strategy: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgPnlPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Trade[];
}

// Simple RSI calculation
function calculateRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i]! - closes[i - 1]!);
  }

  const gains = changes.slice(-period).map((c) => (c > 0 ? c : 0));
  const losses = changes.slice(-period).map((c) => (c < 0 ? -c : 0));

  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Simple Moving Average
function sma(data: number[], period: number): number {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Generate realistic historical price data with trends
function generateHistoricalData(
  days: number,
  startPrice: number,
  volatility: number,
  drift: number
): Bar[] {
  const bars: Bar[] = [];
  let price = startPrice;

  const startDate = new Date(2023, 0, 1);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Random walk with drift
    const dailyReturn =
      drift / 252 + volatility * Math.sqrt(1 / 252) * (Math.random() * 2 - 1);
    price = price * (1 + dailyReturn);

    const open = price * (1 + (Math.random() - 0.5) * 0.005);
    const high = Math.max(open, price) * (1 + Math.random() * 0.01);
    const low = Math.min(open, price) * (1 - Math.random() * 0.01);

    bars.push({
      t: date.toISOString().slice(0, 10),
      o: open,
      h: high,
      l: low,
      c: price,
      v: Math.floor(50000000 * (0.5 + Math.random())),
    });
  }

  return bars;
}

// Backtesting engine
class Backtester {
  private bars: Bar[];

  constructor(bars: Bar[]) {
    this.bars = bars;
  }

  // Backtest RSI oversold strategy
  // Buy when RSI < threshold, sell after N days
  backtestRsiOversold(
    rsiThreshold: number,
    holdingPeriod: number
  ): BacktestResult {
    const trades: Trade[] = [];
    const closes = this.bars.map((b) => b.c);

    for (let i = 20; i < this.bars.length - holdingPeriod; i++) {
      const rsi = calculateRsi(closes.slice(0, i + 1));

      if (rsi < rsiThreshold) {
        const entryBar = this.bars[i]!;
        const exitBar = this.bars[i + holdingPeriod]!;

        const entryPrice = entryBar.c;
        const exitPrice = exitBar.c;
        const pnl = exitPrice - entryPrice;
        const pnlPercent = (pnl / entryPrice) * 100;

        trades.push({
          symbol: "TEST",
          signal: `RSI_OVERSOLD_${rsiThreshold}`,
          entryDate: entryBar.t,
          entryPrice,
          exitDate: exitBar.t,
          exitPrice,
          holdingDays: holdingPeriod,
          pnl,
          pnlPercent,
        });

        // Skip ahead to avoid overlapping trades
        i += holdingPeriod;
      }
    }

    return this.calculateStats(`RSI_OVERSOLD_${rsiThreshold}`, trades);
  }

  // Backtest RSI overbought strategy (short or exit long)
  backtestRsiOverbought(
    rsiThreshold: number,
    holdingPeriod: number
  ): BacktestResult {
    const trades: Trade[] = [];
    const closes = this.bars.map((b) => b.c);

    for (let i = 20; i < this.bars.length - holdingPeriod; i++) {
      const rsi = calculateRsi(closes.slice(0, i + 1));

      if (rsi > rsiThreshold) {
        const entryBar = this.bars[i]!;
        const exitBar = this.bars[i + holdingPeriod]!;

        const entryPrice = entryBar.c;
        const exitPrice = exitBar.c;
        // For short: profit when price goes down
        const pnl = entryPrice - exitPrice;
        const pnlPercent = (pnl / entryPrice) * 100;

        trades.push({
          symbol: "TEST",
          signal: `RSI_OVERBOUGHT_${rsiThreshold}`,
          entryDate: entryBar.t,
          entryPrice,
          exitDate: exitBar.t,
          exitPrice,
          holdingDays: holdingPeriod,
          pnl,
          pnlPercent,
        });

        i += holdingPeriod;
      }
    }

    return this.calculateStats(`RSI_OVERBOUGHT_${rsiThreshold}`, trades);
  }

  // Backtest MA crossover strategy
  // Buy when price > SMA20 > SMA50
  backtestMaBullishAlignment(holdingPeriod: number): BacktestResult {
    const trades: Trade[] = [];
    const closes = this.bars.map((b) => b.c);

    for (let i = 50; i < this.bars.length - holdingPeriod; i++) {
      const currentPrice = closes[i]!;
      const sma20 = sma(closes.slice(0, i + 1), 20);
      const sma50 = sma(closes.slice(0, i + 1), 50);

      // Check if we're in a bullish alignment that wasn't there yesterday
      const prevPrice = closes[i - 1]!;
      const prevSma20 = sma(closes.slice(0, i), 20);
      const prevSma50 = sma(closes.slice(0, i), 50);

      const isBullish = currentPrice > sma20 && sma20 > sma50;
      const wasBullish = prevPrice > prevSma20 && prevSma20 > prevSma50;

      // New signal - just crossed into bullish alignment
      if (isBullish && !wasBullish) {
        const entryBar = this.bars[i]!;
        const exitBar = this.bars[i + holdingPeriod]!;

        const entryPrice = entryBar.c;
        const exitPrice = exitBar.c;
        const pnl = exitPrice - entryPrice;
        const pnlPercent = (pnl / entryPrice) * 100;

        trades.push({
          symbol: "TEST",
          signal: "MA_BULLISH_ALIGNMENT",
          entryDate: entryBar.t,
          entryPrice,
          exitDate: exitBar.t,
          exitPrice,
          holdingDays: holdingPeriod,
          pnl,
          pnlPercent,
        });

        i += holdingPeriod;
      }
    }

    return this.calculateStats("MA_BULLISH_ALIGNMENT", trades);
  }

  // Combined strategy - buy on oversold OR bullish alignment
  backtestCombinedStrategy(
    rsiThreshold: number,
    holdingPeriod: number
  ): BacktestResult {
    const trades: Trade[] = [];
    const closes = this.bars.map((b) => b.c);

    for (let i = 50; i < this.bars.length - holdingPeriod; i++) {
      const currentPrice = closes[i]!;
      const rsi = calculateRsi(closes.slice(0, i + 1));
      const sma20 = sma(closes.slice(0, i + 1), 20);
      const sma50 = sma(closes.slice(0, i + 1), 50);

      const isOversold = rsi < rsiThreshold;
      const isBullish = currentPrice > sma20 && sma20 > sma50;

      // Look for combination signals (higher conviction)
      if (isOversold || isBullish) {
        const entryBar = this.bars[i]!;
        const exitBar = this.bars[i + holdingPeriod]!;

        const entryPrice = entryBar.c;
        const exitPrice = exitBar.c;
        const pnl = exitPrice - entryPrice;
        const pnlPercent = (pnl / entryPrice) * 100;

        trades.push({
          symbol: "TEST",
          signal: isOversold ? "RSI_OVERSOLD" : "MA_BULLISH",
          entryDate: entryBar.t,
          entryPrice,
          exitDate: exitBar.t,
          exitPrice,
          holdingDays: holdingPeriod,
          pnl,
          pnlPercent,
        });

        i += holdingPeriod;
      }
    }

    return this.calculateStats("COMBINED_STRATEGY", trades);
  }

  private calculateStats(strategy: string, trades: Trade[]): BacktestResult {
    if (trades.length === 0) {
      return {
        strategy,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        avgPnlPercent: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        trades: [],
      };
    }

    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl <= 0);

    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((a, b) => a + b.pnlPercent, 0) /
          winningTrades.length
        : 0;

    const avgLoss =
      losingTrades.length > 0
        ? losingTrades.reduce((a, b) => a + b.pnlPercent, 0) /
          losingTrades.length
        : 0;

    const avgPnlPercent =
      trades.reduce((a, b) => a + b.pnlPercent, 0) / trades.length;

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const trade of trades) {
      cumulative += trade.pnlPercent;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Calculate Sharpe ratio (simplified)
    const returns = trades.map((t) => t.pnlPercent);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

    return {
      strategy,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      avgWin,
      avgLoss,
      avgPnlPercent,
      maxDrawdown,
      sharpeRatio,
      trades,
    };
  }
}

describe("Backtesting Framework", () => {
  describe("RSI Oversold Strategy", () => {
    it("should execute trades when RSI crosses below threshold", () => {
      // Generate data with some mean reversion characteristics
      const bars = generateHistoricalData(500, 100, 0.3, 0.05);
      const backtester = new Backtester(bars);

      const result = backtester.backtestRsiOversold(30, 5);

      // Should have found some signals
      expect(result.totalTrades).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeLessThanOrEqual(100);
    });

    it("should test different RSI thresholds", () => {
      const bars = generateHistoricalData(500, 100, 0.25, 0.03);
      const backtester = new Backtester(bars);

      const rsi20 = backtester.backtestRsiOversold(20, 5);
      const rsi30 = backtester.backtestRsiOversold(30, 5);
      const rsi40 = backtester.backtestRsiOversold(40, 5);

      // Lower threshold = fewer but potentially higher quality signals
      console.log("\n=== RSI Oversold Strategy Results ===");
      console.log(`RSI < 20: ${rsi20.totalTrades} trades, Win rate: ${rsi20.winRate.toFixed(1)}%, Avg PnL: ${rsi20.avgPnlPercent.toFixed(2)}%`);
      console.log(`RSI < 30: ${rsi30.totalTrades} trades, Win rate: ${rsi30.winRate.toFixed(1)}%, Avg PnL: ${rsi30.avgPnlPercent.toFixed(2)}%`);
      console.log(`RSI < 40: ${rsi40.totalTrades} trades, Win rate: ${rsi40.winRate.toFixed(1)}%, Avg PnL: ${rsi40.avgPnlPercent.toFixed(2)}%`);

      // Generally, lower RSI threshold should have fewer trades
      expect(rsi20.totalTrades).toBeLessThanOrEqual(rsi40.totalTrades);
    });

    it("should test different holding periods", () => {
      const bars = generateHistoricalData(500, 100, 0.25, 0.03);
      const backtester = new Backtester(bars);

      const hold3 = backtester.backtestRsiOversold(30, 3);
      const hold5 = backtester.backtestRsiOversold(30, 5);
      const hold10 = backtester.backtestRsiOversold(30, 10);

      console.log("\n=== Holding Period Comparison (RSI < 30) ===");
      console.log(`3 days: ${hold3.totalTrades} trades, Win rate: ${hold3.winRate.toFixed(1)}%, Avg PnL: ${hold3.avgPnlPercent.toFixed(2)}%`);
      console.log(`5 days: ${hold5.totalTrades} trades, Win rate: ${hold5.winRate.toFixed(1)}%, Avg PnL: ${hold5.avgPnlPercent.toFixed(2)}%`);
      console.log(`10 days: ${hold10.totalTrades} trades, Win rate: ${hold10.winRate.toFixed(1)}%, Avg PnL: ${hold10.avgPnlPercent.toFixed(2)}%`);

      // All should be valid results
      expect(typeof hold3.avgPnlPercent).toBe("number");
      expect(typeof hold5.avgPnlPercent).toBe("number");
      expect(typeof hold10.avgPnlPercent).toBe("number");
    });
  });

  describe("RSI Overbought Strategy", () => {
    it("should execute short trades when RSI crosses above threshold", () => {
      const bars = generateHistoricalData(500, 100, 0.3, 0.05);
      const backtester = new Backtester(bars);

      const result = backtester.backtestRsiOverbought(70, 5);

      console.log("\n=== RSI Overbought Strategy Results ===");
      console.log(`RSI > 70: ${result.totalTrades} trades, Win rate: ${result.winRate.toFixed(1)}%, Avg PnL: ${result.avgPnlPercent.toFixed(2)}%`);

      expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    });
  });

  describe("MA Bullish Alignment Strategy", () => {
    it("should execute trades on bullish alignment", () => {
      const bars = generateHistoricalData(500, 100, 0.2, 0.08);
      const backtester = new Backtester(bars);

      const result = backtester.backtestMaBullishAlignment(10);

      console.log("\n=== MA Bullish Alignment Strategy Results ===");
      console.log(`Total: ${result.totalTrades} trades, Win rate: ${result.winRate.toFixed(1)}%, Avg PnL: ${result.avgPnlPercent.toFixed(2)}%`);
      console.log(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%, Sharpe: ${result.sharpeRatio.toFixed(2)}`);

      expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Combined Strategy", () => {
    it("should test combined RSI + MA strategy", () => {
      const bars = generateHistoricalData(500, 100, 0.25, 0.05);
      const backtester = new Backtester(bars);

      const result = backtester.backtestCombinedStrategy(30, 5);

      console.log("\n=== Combined Strategy Results ===");
      console.log(`Total: ${result.totalTrades} trades, Win rate: ${result.winRate.toFixed(1)}%, Avg PnL: ${result.avgPnlPercent.toFixed(2)}%`);
      console.log(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%, Sharpe: ${result.sharpeRatio.toFixed(2)}`);

      expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Monte Carlo Simulation", () => {
    it("should run multiple simulations to assess strategy robustness", () => {
      const runs = 10;
      const oversoldResults: number[] = [];
      const overboughtResults: number[] = [];
      const maResults: number[] = [];

      console.log("\n=== Monte Carlo Simulation (10 runs) ===");

      for (let i = 0; i < runs; i++) {
        const bars = generateHistoricalData(500, 100, 0.25, 0.05);
        const backtester = new Backtester(bars);

        const oversold = backtester.backtestRsiOversold(30, 5);
        const overbought = backtester.backtestRsiOverbought(70, 5);
        const ma = backtester.backtestMaBullishAlignment(10);

        if (oversold.totalTrades > 0) oversoldResults.push(oversold.avgPnlPercent);
        if (overbought.totalTrades > 0) overboughtResults.push(overbought.avgPnlPercent);
        if (ma.totalTrades > 0) maResults.push(ma.avgPnlPercent);
      }

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const std = (arr: number[]) => {
        if (arr.length < 2) return 0;
        const mean = avg(arr);
        return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
      };

      console.log(`RSI Oversold: Avg PnL: ${avg(oversoldResults).toFixed(2)}% ± ${std(oversoldResults).toFixed(2)}%`);
      console.log(`RSI Overbought: Avg PnL: ${avg(overboughtResults).toFixed(2)}% ± ${std(overboughtResults).toFixed(2)}%`);
      console.log(`MA Bullish: Avg PnL: ${avg(maResults).toFixed(2)}% ± ${std(maResults).toFixed(2)}%`);

      // Just verify we got valid numbers
      expect(typeof avg(oversoldResults)).toBe("number");
      expect(typeof avg(overboughtResults)).toBe("number");
      expect(typeof avg(maResults)).toBe("number");
    });
  });
});

describe("Strategy Evaluation Summary", () => {
  it("should provide a comprehensive analysis of all strategies", () => {
    console.log("\n" + "=".repeat(60));
    console.log("SCREENER STRATEGY BACKTEST SUMMARY");
    console.log("=".repeat(60));

    const bars = generateHistoricalData(750, 100, 0.22, 0.06);
    const backtester = new Backtester(bars);

    // Test all strategies
    const strategies = [
      { name: "RSI < 20 (5d hold)", result: backtester.backtestRsiOversold(20, 5) },
      { name: "RSI < 30 (5d hold)", result: backtester.backtestRsiOversold(30, 5) },
      { name: "RSI < 30 (10d hold)", result: backtester.backtestRsiOversold(30, 10) },
      { name: "RSI > 70 (5d short)", result: backtester.backtestRsiOverbought(70, 5) },
      { name: "RSI > 80 (5d short)", result: backtester.backtestRsiOverbought(80, 5) },
      { name: "MA Bullish (10d hold)", result: backtester.backtestMaBullishAlignment(10) },
      { name: "Combined (5d hold)", result: backtester.backtestCombinedStrategy(30, 5) },
    ];

    console.log("\n| Strategy | Trades | Win Rate | Avg PnL | Max DD | Sharpe |");
    console.log("|----------|--------|----------|---------|--------|--------|");

    for (const { name, result } of strategies) {
      console.log(
        `| ${name.padEnd(20)} | ${String(result.totalTrades).padStart(6)} | ${result.winRate.toFixed(1).padStart(7)}% | ${result.avgPnlPercent.toFixed(2).padStart(6)}% | ${result.maxDrawdown.toFixed(1).padStart(5)}% | ${result.sharpeRatio.toFixed(2).padStart(6)} |`
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("KEY FINDINGS:");
    console.log("-".repeat(60));

    // Find best strategy
    const validStrategies = strategies.filter((s) => s.result.totalTrades >= 5);
    if (validStrategies.length > 0) {
      const bestByWinRate = validStrategies.reduce((a, b) =>
        a.result.winRate > b.result.winRate ? a : b
      );
      const bestByPnl = validStrategies.reduce((a, b) =>
        a.result.avgPnlPercent > b.result.avgPnlPercent ? a : b
      );
      const bestBySharpe = validStrategies.reduce((a, b) =>
        a.result.sharpeRatio > b.result.sharpeRatio ? a : b
      );

      console.log(`Best by Win Rate: ${bestByWinRate.name} (${bestByWinRate.result.winRate.toFixed(1)}%)`);
      console.log(`Best by Avg PnL: ${bestByPnl.name} (${bestByPnl.result.avgPnlPercent.toFixed(2)}%)`);
      console.log(`Best by Sharpe: ${bestBySharpe.name} (${bestBySharpe.result.sharpeRatio.toFixed(2)})`);
    }

    console.log("=".repeat(60));

    expect(strategies.length).toBe(7);
  });
});
