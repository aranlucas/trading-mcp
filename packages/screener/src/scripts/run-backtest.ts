#!/usr/bin/env -S pnpm exec tsx
type BacktestStrategy = { name: string; run: () => ReturnType<typeof aggregateResults> };

type StrategyResult = { name: string; result: ReturnType<typeof aggregateResults> };

/**
 * Real Data Backtest Script
 *
 * Run this script directly to backtest screener strategies on real Yahoo Finance data:
 *   pnpm exec tsx packages/screener/src/scripts/run-backtest.ts
 *
 * Or from the screener package:
 *   cd packages/screener && pnpm exec tsx src/scripts/run-backtest.ts
 */

import { forEachSequential, yahoo } from "@trading/core";
import { Backtester, type Bar, type BacktestResult } from "./lib/backtest.js";

// Fetch real historical data from Yahoo Finance
async function fetchRealData(symbol: string, days: number): Promise<Bar[]> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  try {
    const result = await yahoo.getHistory(symbol, from, to);

    if (!result.quotes || result.quotes.length === 0) {
      return [];
    }

    const bars: Bar[] = [];

    for (const q of result.quotes) {
      if (
        q.open === null ||
        q.open === undefined ||
        q.high === null ||
        q.high === undefined ||
        q.low === null ||
        q.low === undefined ||
        q.close === null ||
        q.close === undefined ||
        q.volume === null ||
        q.volume === undefined
      ) {
        continue;
      }

      bars.push({
        t: new Date(q.date).toISOString().slice(0, 10),
        o: q.open,
        h: q.high,
        l: q.low,
        c: q.close,
        v: q.volume,
      });
    }

    return bars;
  } catch (error) {
    console.error(`Failed to fetch data for ${symbol}:`, error);

    return [];
  }
}

function aggregateResults(results: BacktestResult[]) {
  const validResults = results.filter((r) => r.totalTrades > 0);

  if (validResults.length === 0) {
    return {
      strategy: results[0]?.strategy === "" ? "Unknown" : (results[0]?.strategy ?? "Unknown"),
      totalTrades: 0,
      winningTrades: 0,
      winRate: 0,
      avgPnlPercent: 0,
      totalReturn: 0,
      maxDrawdown: 0,
      avgSharpe: 0,
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
  };
}

// Stock universe
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

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("SCREENER BACKTEST - REAL YAHOO FINANCE DATA");
  console.log("=".repeat(80));

  console.log("\n📊 Fetching 2 years of real market data from Yahoo Finance...\n");

  const dataCache = new Map<string, Bar[]>();

  await forEachSequential(STOCK_UNIVERSE, async (symbol) => {
    process.stdout.write(`  Fetching ${symbol}...`);
    const bars = await fetchRealData(symbol, 730);

    if (bars.length > 0) {
      dataCache.set(symbol, bars);
      console.log(
        ` ✓ ${bars.length} bars (${bars[0]?.t ?? "unknown"} to ${bars.at(-1)?.t ?? "unknown"})`,
      );
    } else {
      console.log(" ✗ No data");
    }
  });

  if (dataCache.size === 0) {
    console.log("\n❌ No data available. Check your network connection.\n");
    process.exit(1);
  }

  console.log(`\n📈 Loaded data for ${dataCache.size} symbols\n`);

  // Define strategies to test
  const strategies: BacktestStrategy[] = [
    {
      name: "RSI < 25 (5d)",
      run: () => {
        const results = Array.from(dataCache).map(([symbol, bars]) =>
          new Backtester(symbol, bars).backtestRsiOversold(25, 5),
        );

        return aggregateResults(results);
      },
    },
    {
      name: "RSI < 30 (5d)",
      run: () => {
        const results = Array.from(dataCache).map(([symbol, bars]) =>
          new Backtester(symbol, bars).backtestRsiOversold(30, 5),
        );

        return aggregateResults(results);
      },
    },
    {
      name: "RSI < 30 (10d)",
      run: () => {
        const results = Array.from(dataCache).map(([symbol, bars]) =>
          new Backtester(symbol, bars).backtestRsiOversold(30, 10),
        );

        return aggregateResults(results);
      },
    },
    {
      name: "RSI < 35 (5d)",
      run: () => {
        const results = Array.from(dataCache).map(([symbol, bars]) =>
          new Backtester(symbol, bars).backtestRsiOversold(35, 5),
        );

        return aggregateResults(results);
      },
    },
    {
      name: "RSI > 70 (5d short)",
      run: () => {
        const results = Array.from(dataCache).map(([symbol, bars]) =>
          new Backtester(symbol, bars).backtestRsiOverbought(70, 5),
        );

        return aggregateResults(results);
      },
    },
    {
      name: "RSI > 75 (5d short)",
      run: () => {
        const results = Array.from(dataCache).map(([symbol, bars]) =>
          new Backtester(symbol, bars).backtestRsiOverbought(75, 5),
        );

        return aggregateResults(results);
      },
    },
    {
      name: "MA Bullish (5d)",
      run: () => {
        const results = Array.from(dataCache).map(([symbol, bars]) =>
          new Backtester(symbol, bars).backtestMaBullishAlignment(5),
        );

        return aggregateResults(results);
      },
    },
    {
      name: "MA Bullish (10d)",
      run: () => {
        const results = Array.from(dataCache).map(([symbol, bars]) =>
          new Backtester(symbol, bars).backtestMaBullishAlignment(10),
        );

        return aggregateResults(results);
      },
    },
  ];

  console.log("=".repeat(80));
  console.log("STRATEGY COMPARISON");
  console.log("=".repeat(80));

  console.log(
    "\n| Strategy           | Trades | Win Rate |  Avg PnL | Total Ret | Max DD | Sharpe |",
  );
  console.log(
    "|" +
      "-".repeat(19) +
      "|" +
      "-".repeat(8) +
      "|" +
      "-".repeat(10) +
      "|" +
      "-".repeat(10) +
      "|" +
      "-".repeat(11) +
      "|" +
      "-".repeat(8) +
      "|" +
      "-".repeat(8) +
      "|",
  );

  const allResults: StrategyResult[] = [];

  for (const strategy of strategies) {
    const result = strategy.run();
    allResults.push({ name: strategy.name, result });

    console.log(
      `| ${strategy.name.padEnd(17)} | ${String(result.totalTrades).padStart(6)} | ${result.winRate.toFixed(1).padStart(7)}% | ${result.avgPnlPercent.toFixed(2).padStart(7)}% | ${result.totalReturn.toFixed(1).padStart(8)}% | ${result.maxDrawdown.toFixed(1).padStart(5)}% | ${result.avgSharpe.toFixed(2).padStart(6)} |`,
    );
  }

  // Analysis
  const validResults = allResults.filter((r) => r.result.totalTrades >= 5);

  if (validResults.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("KEY FINDINGS:");
    console.log("-".repeat(80));

    const bestByWinRate = validResults.reduce((a, b) =>
      a.result.winRate > b.result.winRate ? a : b,
    );

    const bestByPnl = validResults.reduce((a, b) =>
      a.result.avgPnlPercent > b.result.avgPnlPercent ? a : b,
    );

    const bestByTotal = validResults.reduce((a, b) =>
      a.result.totalReturn > b.result.totalReturn ? a : b,
    );

    const bestBySharpe = validResults.reduce((a, b) =>
      a.result.avgSharpe > b.result.avgSharpe ? a : b,
    );

    console.log(
      `📈 Best Win Rate:     ${bestByWinRate.name} (${bestByWinRate.result.winRate.toFixed(1)}%)`,
    );
    console.log(
      `💰 Best Avg PnL:      ${bestByPnl.name} (${bestByPnl.result.avgPnlPercent.toFixed(2)}% per trade)`,
    );
    console.log(
      `📊 Best Total Return: ${bestByTotal.name} (${bestByTotal.result.totalReturn.toFixed(1)}%)`,
    );
    console.log(
      `⚖️  Best Sharpe:       ${bestBySharpe.name} (${bestBySharpe.result.avgSharpe.toFixed(2)})`,
    );

    console.log("\n" + "-".repeat(80));
    console.log("VERDICT:");
    console.log("-".repeat(80));

    const profitableStrategies = validResults.filter(
      (r) => r.result.avgPnlPercent > 0 && r.result.winRate > 50,
    );

    if (profitableStrategies.length > 0) {
      console.log("✅ WORTHWHILE strategies:\n");

      for (const s of profitableStrategies) {
        console.log(
          `   • ${s.name}: ${s.result.winRate.toFixed(1)}% win rate, ${s.result.avgPnlPercent.toFixed(2)}% avg gain`,
        );
      }
    } else {
      console.log("⚠️  No clearly profitable strategies found.");
    }

    const unprofitableStrategies = validResults.filter((r) => r.result.avgPnlPercent < 0);

    if (unprofitableStrategies.length > 0) {
      console.log("\n❌ NOT WORTHWHILE (negative expected return):\n");

      for (const s of unprofitableStrategies) {
        console.log(`   • ${s.name}: ${s.result.avgPnlPercent.toFixed(2)}% avg loss`);
      }
    }
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

main().catch(console.error);
