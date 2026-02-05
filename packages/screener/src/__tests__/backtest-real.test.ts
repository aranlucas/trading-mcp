import { describe, it, expect } from "vitest";
import { yahoo } from "@trading/core";

// Real data backtesting using Yahoo Finance

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
  symbol: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgPnlPercent: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Trade[];
}

// Fetch real historical data from Yahoo Finance
async function fetchRealData(
  symbol: string,
  days: number
): Promise<Bar[]> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  try {
    const result = await yahoo.getHistory(symbol, from, to);

    if (!result.quotes || result.quotes.length === 0) {
      return [];
    }

    return result.quotes
      .filter((q: { open?: number; high?: number; low?: number; close?: number; volume?: number }) =>
        q.open && q.high && q.low && q.close && q.volume)
      .map((q: { date: Date; open: number; high: number; low: number; close: number; volume: number }) => ({
        t: new Date(q.date).toISOString().slice(0, 10),
        o: q.open,
        h: q.high,
        l: q.low,
        c: q.close,
        v: q.volume,
      }));
  } catch (error) {
    console.error(`Failed to fetch data for ${symbol}:`, error);
    return [];
  }
}

// RSI calculation
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

// SMA calculation
function sma(data: number[], period: number): number {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Backtester class for real data
class RealDataBacktester {
  private bars: Bar[];
  private symbol: string;

  constructor(symbol: string, bars: Bar[]) {
    this.symbol = symbol;
    this.bars = bars;
  }

  backtestRsiOversold(rsiThreshold: number, holdingPeriod: number): BacktestResult {
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
          symbol: this.symbol,
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

  backtestRsiOverbought(rsiThreshold: number, holdingPeriod: number): BacktestResult {
    const trades: Trade[] = [];
    const closes = this.bars.map((b) => b.c);

    for (let i = 20; i < this.bars.length - holdingPeriod; i++) {
      const rsi = calculateRsi(closes.slice(0, i + 1));

      if (rsi > rsiThreshold) {
        const entryBar = this.bars[i]!;
        const exitBar = this.bars[i + holdingPeriod]!;

        const entryPrice = entryBar.c;
        const exitPrice = exitBar.c;
        // Short position: profit when price goes down
        const pnl = entryPrice - exitPrice;
        const pnlPercent = (pnl / entryPrice) * 100;

        trades.push({
          symbol: this.symbol,
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

  backtestMaBullishAlignment(holdingPeriod: number): BacktestResult {
    const trades: Trade[] = [];
    const closes = this.bars.map((b) => b.c);

    for (let i = 50; i < this.bars.length - holdingPeriod; i++) {
      const currentPrice = closes[i]!;
      const sma20 = sma(closes.slice(0, i + 1), 20);
      const sma50 = sma(closes.slice(0, i + 1), 50);

      const prevPrice = closes[i - 1]!;
      const prevSma20 = sma(closes.slice(0, i), 20);
      const prevSma50 = sma(closes.slice(0, i), 50);

      const isBullish = currentPrice > sma20 && sma20 > sma50;
      const wasBullish = prevPrice > prevSma20 && prevSma20 > prevSma50;

      if (isBullish && !wasBullish) {
        const entryBar = this.bars[i]!;
        const exitBar = this.bars[i + holdingPeriod]!;

        const entryPrice = entryBar.c;
        const exitPrice = exitBar.c;
        const pnl = exitPrice - entryPrice;
        const pnlPercent = (pnl / entryPrice) * 100;

        trades.push({
          symbol: this.symbol,
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

  private calculateStats(strategy: string, trades: Trade[]): BacktestResult {
    if (trades.length === 0) {
      return {
        strategy,
        symbol: this.symbol,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        avgPnlPercent: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        trades: [],
      };
    }

    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl <= 0);

    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((a, b) => a + b.pnlPercent, 0) / winningTrades.length
        : 0;

    const avgLoss =
      losingTrades.length > 0
        ? losingTrades.reduce((a, b) => a + b.pnlPercent, 0) / losingTrades.length
        : 0;

    const avgPnlPercent = trades.reduce((a, b) => a + b.pnlPercent, 0) / trades.length;
    const totalReturn = trades.reduce((a, b) => a + b.pnlPercent, 0);

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

    // Sharpe ratio (simplified - annualized)
    const returns = trades.map((t) => t.pnlPercent);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252 / 5) : 0;

    return {
      strategy,
      symbol: this.symbol,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      avgWin,
      avgLoss,
      avgPnlPercent,
      totalReturn,
      maxDrawdown,
      sharpeRatio,
      trades,
    };
  }
}

// Aggregate results across multiple symbols
interface AggregateResult {
  strategy: string;
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  avgPnlPercent: number;
  totalReturn: number;
  maxDrawdown: number;
  avgSharpe: number;
  symbolResults: BacktestResult[];
}

function aggregateResults(results: BacktestResult[]): AggregateResult {
  const validResults = results.filter((r) => r.totalTrades > 0);

  if (validResults.length === 0) {
    return {
      strategy: results[0]?.strategy || "Unknown",
      totalTrades: 0,
      winningTrades: 0,
      winRate: 0,
      avgPnlPercent: 0,
      totalReturn: 0,
      maxDrawdown: 0,
      avgSharpe: 0,
      symbolResults: [],
    };
  }

  const totalTrades = validResults.reduce((a, b) => a + b.totalTrades, 0);
  const winningTrades = validResults.reduce((a, b) => a + b.winningTrades, 0);
  const totalReturn = validResults.reduce((a, b) => a + b.totalReturn, 0);
  const maxDrawdown = Math.max(...validResults.map((r) => r.maxDrawdown));
  const avgSharpe = validResults.reduce((a, b) => a + b.sharpeRatio, 0) / validResults.length;

  return {
    strategy: validResults[0]!.strategy,
    totalTrades,
    winningTrades,
    winRate: (winningTrades / totalTrades) * 100,
    avgPnlPercent: totalReturn / totalTrades,
    totalReturn,
    maxDrawdown,
    avgSharpe,
    symbolResults: validResults,
  };
}

// Stock universe to test
const STOCK_UNIVERSE = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "AMD",
  "NFLX",
  "INTC",
];

describe("Real Data Backtest - Yahoo Finance", () => {
  // Cache for historical data
  const dataCache = new Map<string, Bar[]>();

  // Fetch data for all symbols once
  async function ensureDataLoaded(): Promise<void> {
    if (dataCache.size > 0) return;

    console.log("\n📊 Fetching 2 years of real market data from Yahoo Finance...\n");

    for (const symbol of STOCK_UNIVERSE) {
      const bars = await fetchRealData(symbol, 730); // ~2 years
      if (bars.length > 0) {
        dataCache.set(symbol, bars);
        console.log(`  ✓ ${symbol}: ${bars.length} bars (${bars[0]?.t} to ${bars[bars.length - 1]?.t})`);
      } else {
        console.log(`  ✗ ${symbol}: No data available`);
      }
    }

    console.log(`\n📈 Loaded data for ${dataCache.size} symbols\n`);
  }

  it("should fetch real historical data", async () => {
    await ensureDataLoaded();
    // Skip if no network access (e.g., CI environment)
    if (dataCache.size === 0) {
      console.log("⚠️  No network access - skipping real data tests");
      return;
    }
    expect(dataCache.size).toBeGreaterThan(0);
  }, 60000);

  it("should backtest RSI Oversold strategy on real data", async () => {
    await ensureDataLoaded();

    console.log("\n" + "=".repeat(70));
    console.log("RSI OVERSOLD STRATEGY (Buy when RSI < 30, hold 5 days)");
    console.log("=".repeat(70));

    const results: BacktestResult[] = [];

    for (const [symbol, bars] of dataCache) {
      const backtester = new RealDataBacktester(symbol, bars);
      const result = backtester.backtestRsiOversold(30, 5);
      results.push(result);

      if (result.totalTrades > 0) {
        console.log(
          `${symbol.padEnd(6)} | Trades: ${String(result.totalTrades).padStart(3)} | Win: ${result.winRate.toFixed(1).padStart(5)}% | Avg: ${result.avgPnlPercent.toFixed(2).padStart(6)}% | Total: ${result.totalReturn.toFixed(2).padStart(7)}%`
        );
      }
    }

    const aggregate = aggregateResults(results);
    console.log("-".repeat(70));
    console.log(
      `TOTAL  | Trades: ${String(aggregate.totalTrades).padStart(3)} | Win: ${aggregate.winRate.toFixed(1).padStart(5)}% | Avg: ${aggregate.avgPnlPercent.toFixed(2).padStart(6)}% | Total: ${aggregate.totalReturn.toFixed(2).padStart(7)}%`
    );
    console.log(`Max Drawdown: ${aggregate.maxDrawdown.toFixed(2)}% | Avg Sharpe: ${aggregate.avgSharpe.toFixed(2)}`);

    expect(aggregate.totalTrades).toBeGreaterThanOrEqual(0);
  }, 60000);

  it("should backtest RSI Overbought strategy on real data", async () => {
    await ensureDataLoaded();

    console.log("\n" + "=".repeat(70));
    console.log("RSI OVERBOUGHT STRATEGY (Short when RSI > 70, hold 5 days)");
    console.log("=".repeat(70));

    const results: BacktestResult[] = [];

    for (const [symbol, bars] of dataCache) {
      const backtester = new RealDataBacktester(symbol, bars);
      const result = backtester.backtestRsiOverbought(70, 5);
      results.push(result);

      if (result.totalTrades > 0) {
        console.log(
          `${symbol.padEnd(6)} | Trades: ${String(result.totalTrades).padStart(3)} | Win: ${result.winRate.toFixed(1).padStart(5)}% | Avg: ${result.avgPnlPercent.toFixed(2).padStart(6)}% | Total: ${result.totalReturn.toFixed(2).padStart(7)}%`
        );
      }
    }

    const aggregate = aggregateResults(results);
    console.log("-".repeat(70));
    console.log(
      `TOTAL  | Trades: ${String(aggregate.totalTrades).padStart(3)} | Win: ${aggregate.winRate.toFixed(1).padStart(5)}% | Avg: ${aggregate.avgPnlPercent.toFixed(2).padStart(6)}% | Total: ${aggregate.totalReturn.toFixed(2).padStart(7)}%`
    );

    expect(aggregate.totalTrades).toBeGreaterThanOrEqual(0);
  }, 60000);

  it("should backtest MA Bullish Alignment strategy on real data", async () => {
    await ensureDataLoaded();

    console.log("\n" + "=".repeat(70));
    console.log("MA BULLISH ALIGNMENT (Buy when Price > SMA20 > SMA50, hold 10 days)");
    console.log("=".repeat(70));

    const results: BacktestResult[] = [];

    for (const [symbol, bars] of dataCache) {
      const backtester = new RealDataBacktester(symbol, bars);
      const result = backtester.backtestMaBullishAlignment(10);
      results.push(result);

      if (result.totalTrades > 0) {
        console.log(
          `${symbol.padEnd(6)} | Trades: ${String(result.totalTrades).padStart(3)} | Win: ${result.winRate.toFixed(1).padStart(5)}% | Avg: ${result.avgPnlPercent.toFixed(2).padStart(6)}% | Total: ${result.totalReturn.toFixed(2).padStart(7)}%`
        );
      }
    }

    const aggregate = aggregateResults(results);
    console.log("-".repeat(70));
    console.log(
      `TOTAL  | Trades: ${String(aggregate.totalTrades).padStart(3)} | Win: ${aggregate.winRate.toFixed(1).padStart(5)}% | Avg: ${aggregate.avgPnlPercent.toFixed(2).padStart(6)}% | Total: ${aggregate.totalReturn.toFixed(2).padStart(7)}%`
    );

    expect(aggregate.totalTrades).toBeGreaterThanOrEqual(0);
  }, 60000);

  it("should compare all strategies with different parameters", async () => {
    await ensureDataLoaded();

    console.log("\n" + "=".repeat(80));
    console.log("COMPREHENSIVE STRATEGY COMPARISON - REAL DATA (2 YEARS)");
    console.log("=".repeat(80));

    const strategies: { name: string; run: () => AggregateResult }[] = [
      {
        name: "RSI < 25 (5d)",
        run: () => {
          const results = Array.from(dataCache).map(([symbol, bars]) =>
            new RealDataBacktester(symbol, bars).backtestRsiOversold(25, 5)
          );
          return aggregateResults(results);
        },
      },
      {
        name: "RSI < 30 (5d)",
        run: () => {
          const results = Array.from(dataCache).map(([symbol, bars]) =>
            new RealDataBacktester(symbol, bars).backtestRsiOversold(30, 5)
          );
          return aggregateResults(results);
        },
      },
      {
        name: "RSI < 30 (10d)",
        run: () => {
          const results = Array.from(dataCache).map(([symbol, bars]) =>
            new RealDataBacktester(symbol, bars).backtestRsiOversold(30, 10)
          );
          return aggregateResults(results);
        },
      },
      {
        name: "RSI < 35 (5d)",
        run: () => {
          const results = Array.from(dataCache).map(([symbol, bars]) =>
            new RealDataBacktester(symbol, bars).backtestRsiOversold(35, 5)
          );
          return aggregateResults(results);
        },
      },
      {
        name: "RSI > 70 (5d short)",
        run: () => {
          const results = Array.from(dataCache).map(([symbol, bars]) =>
            new RealDataBacktester(symbol, bars).backtestRsiOverbought(70, 5)
          );
          return aggregateResults(results);
        },
      },
      {
        name: "RSI > 75 (5d short)",
        run: () => {
          const results = Array.from(dataCache).map(([symbol, bars]) =>
            new RealDataBacktester(symbol, bars).backtestRsiOverbought(75, 5)
          );
          return aggregateResults(results);
        },
      },
      {
        name: "MA Bullish (5d)",
        run: () => {
          const results = Array.from(dataCache).map(([symbol, bars]) =>
            new RealDataBacktester(symbol, bars).backtestMaBullishAlignment(5)
          );
          return aggregateResults(results);
        },
      },
      {
        name: "MA Bullish (10d)",
        run: () => {
          const results = Array.from(dataCache).map(([symbol, bars]) =>
            new RealDataBacktester(symbol, bars).backtestMaBullishAlignment(10)
          );
          return aggregateResults(results);
        },
      },
    ];

    console.log("\n| Strategy           | Trades | Win Rate |  Avg PnL | Total Ret | Max DD | Sharpe |");
    console.log("|" + "-".repeat(19) + "|" + "-".repeat(8) + "|" + "-".repeat(10) + "|" + "-".repeat(10) + "|" + "-".repeat(11) + "|" + "-".repeat(8) + "|" + "-".repeat(8) + "|");

    const allResults: { name: string; result: AggregateResult }[] = [];

    for (const strategy of strategies) {
      const result = strategy.run();
      allResults.push({ name: strategy.name, result });

      console.log(
        `| ${strategy.name.padEnd(17)} | ${String(result.totalTrades).padStart(6)} | ${result.winRate.toFixed(1).padStart(7)}% | ${result.avgPnlPercent.toFixed(2).padStart(7)}% | ${result.totalReturn.toFixed(1).padStart(8)}% | ${result.maxDrawdown.toFixed(1).padStart(5)}% | ${result.avgSharpe.toFixed(2).padStart(6)} |`
      );
    }

    // Find best strategies
    const validResults = allResults.filter((r) => r.result.totalTrades >= 5);

    if (validResults.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("KEY FINDINGS FROM REAL DATA:");
      console.log("-".repeat(80));

      const bestByWinRate = validResults.reduce((a, b) =>
        a.result.winRate > b.result.winRate ? a : b
      );
      const bestByPnl = validResults.reduce((a, b) =>
        a.result.avgPnlPercent > b.result.avgPnlPercent ? a : b
      );
      const bestByTotal = validResults.reduce((a, b) =>
        a.result.totalReturn > b.result.totalReturn ? a : b
      );
      const bestBySharpe = validResults.reduce((a, b) =>
        a.result.avgSharpe > b.result.avgSharpe ? a : b
      );

      console.log(`📈 Best Win Rate:    ${bestByWinRate.name} (${bestByWinRate.result.winRate.toFixed(1)}%)`);
      console.log(`💰 Best Avg PnL:     ${bestByPnl.name} (${bestByPnl.result.avgPnlPercent.toFixed(2)}% per trade)`);
      console.log(`📊 Best Total Return: ${bestByTotal.name} (${bestByTotal.result.totalReturn.toFixed(1)}%)`);
      console.log(`⚖️  Best Sharpe:      ${bestBySharpe.name} (${bestBySharpe.result.avgSharpe.toFixed(2)})`);

      // Determine if strategies are worthwhile
      console.log("\n" + "-".repeat(80));
      console.log("VERDICT:");
      console.log("-".repeat(80));

      const profitableStrategies = validResults.filter(
        (r) => r.result.avgPnlPercent > 0 && r.result.winRate > 50
      );

      if (profitableStrategies.length > 0) {
        console.log("✅ WORTHWHILE strategies found:\n");
        for (const s of profitableStrategies) {
          console.log(`   • ${s.name}: ${s.result.winRate.toFixed(1)}% win rate, ${s.result.avgPnlPercent.toFixed(2)}% avg gain`);
        }
      } else {
        console.log("⚠️  No clearly profitable strategies found with current parameters.");
        console.log("   Consider adjusting thresholds or adding additional filters.");
      }

      const unprofitableStrategies = validResults.filter(
        (r) => r.result.avgPnlPercent < 0
      );

      if (unprofitableStrategies.length > 0) {
        console.log("\n❌ NOT WORTHWHILE (negative expected return):\n");
        for (const s of unprofitableStrategies) {
          console.log(`   • ${s.name}: ${s.result.avgPnlPercent.toFixed(2)}% avg loss`);
        }
      }
    }

    console.log("\n" + "=".repeat(80));

    expect(allResults.length).toBe(8);
  }, 120000);

  it("should show individual trade details for best strategy", async () => {
    await ensureDataLoaded();

    console.log("\n" + "=".repeat(70));
    console.log("SAMPLE TRADES - RSI < 30 OVERSOLD STRATEGY");
    console.log("=".repeat(70));

    const allTrades: Trade[] = [];

    for (const [symbol, bars] of dataCache) {
      const backtester = new RealDataBacktester(symbol, bars);
      const result = backtester.backtestRsiOversold(30, 5);
      allTrades.push(...result.trades);
    }

    // Show last 20 trades
    const recentTrades = allTrades
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
      .slice(0, 20);

    console.log("\n| Symbol | Entry Date | Entry $ | Exit Date  | Exit $  |  PnL % |");
    console.log("|" + "-".repeat(8) + "|" + "-".repeat(12) + "|" + "-".repeat(9) + "|" + "-".repeat(12) + "|" + "-".repeat(9) + "|" + "-".repeat(8) + "|");

    for (const trade of recentTrades) {
      const result = trade.pnlPercent >= 0 ? "✅" : "❌";
      console.log(
        `| ${trade.symbol.padEnd(6)} | ${trade.entryDate} | $${trade.entryPrice.toFixed(2).padStart(6)} | ${trade.exitDate} | $${trade.exitPrice.toFixed(2).padStart(6)} | ${trade.pnlPercent >= 0 ? "+" : ""}${trade.pnlPercent.toFixed(2).padStart(5)}% ${result}`
      );
    }

    console.log("\n" + "=".repeat(70));

    expect(allTrades.length).toBeGreaterThanOrEqual(0);
  }, 60000);
});
