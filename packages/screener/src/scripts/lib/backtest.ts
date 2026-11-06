import { analyzeHistory } from "@trading/core";

export interface Bar {
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

export interface BacktestResult {
  strategy: string;
  symbol: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgPnlPercent: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Trade[];
}

export class Backtester {
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
      const { rsi14: rsi } = analyzeHistory(closes.slice(Math.max(0, i - 14), i + 1));

      if (rsi !== null && rsi < rsiThreshold) {
        const entryBar = this.bars[i];
        const exitBar = this.bars[i + holdingPeriod];

        if (!entryBar || !exitBar) {
          throw new RangeError("Backtest trade requires entry and exit bars");
        }

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

        i += holdingPeriod;
      }
    }

    return this.calculateStats(`RSI_OVERSOLD_${rsiThreshold}`, trades);
  }

  backtestRsiOverbought(rsiThreshold: number, holdingPeriod: number): BacktestResult {
    const trades: Trade[] = [];
    const closes = this.bars.map((b) => b.c);

    for (let i = 20; i < this.bars.length - holdingPeriod; i++) {
      const { rsi14: rsi } = analyzeHistory(closes.slice(Math.max(0, i - 14), i + 1));

      if (rsi !== null && rsi > rsiThreshold) {
        const entryBar = this.bars[i];
        const exitBar = this.bars[i + holdingPeriod];

        if (!entryBar || !exitBar) {
          throw new RangeError("Backtest trade requires entry and exit bars");
        }

        const entryPrice = entryBar.c;
        const exitPrice = exitBar.c;
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
      const currentPrice = closes[i];
      const { sma20, sma50 } = analyzeHistory(closes.slice(i - 49, i + 1));
      const prevPrice = closes[i - 1];

      if (currentPrice === undefined || prevPrice === undefined) {
        throw new RangeError("Backtest alignment requires current and previous closes");
      }

      const { sma20: prevSma20, sma50: prevSma50 } = analyzeHistory(closes.slice(i - 50, i));
      const isBullish = sma20 !== null && sma50 !== null && currentPrice > sma20 && sma20 > sma50;

      const wasBullish =
        prevSma20 !== null && prevSma50 !== null && prevPrice > prevSma20 && prevSma20 > prevSma50;

      if (isBullish && !wasBullish) {
        const entryBar = this.bars[i];
        const exitBar = this.bars[i + holdingPeriod];

        if (!entryBar || !exitBar) {
          throw new RangeError("Backtest trade requires entry and exit bars");
        }

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
        avgPnlPercent: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        trades: [],
      };
    }

    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl <= 0);
    const avgPnlPercent = trades.reduce((a, b) => a + b.pnlPercent, 0) / trades.length;
    const totalReturn = trades.reduce((a, b) => a + b.pnlPercent, 0);

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const trade of trades) {
      cumulative += trade.pnlPercent;

      if (cumulative > peak) {
        peak = cumulative;
      }

      const drawdown = peak - cumulative;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const returns = trades.map((t) => t.pnlPercent);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252 / 5) : 0;

    return {
      strategy,
      symbol: this.symbol,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      avgPnlPercent,
      totalReturn,
      maxDrawdown,
      sharpeRatio,
      trades,
    };
  }
}
