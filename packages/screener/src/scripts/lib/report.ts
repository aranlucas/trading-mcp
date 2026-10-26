import type { Signal } from "@trading/core";
import type { ScreenerScanResult } from "./screener-api.js";

function formatCompactNumber(n: number | null): string {
  if (n === null) {
    return "unavailable";
  }

  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}B`;
  }

  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }

  return `${n}`;
}

function fmtPct(n: number | null): string {
  if (n === null) {
    return "unavailable";
  }

  const sign = n > 0 ? "+" : "";

  return `${sign}${n.toFixed(2)}%`;
}

function fmtUsd(n: number): string {
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

export function formatMoversBlock(title: string, movers: ScreenerScanResult[]): string {
  const lines = movers.map((m) => {
    const price = fmtUsd(m.price);
    const ch = fmtPct(m.changePercent);
    const vol = formatCompactNumber(m.volume);

    return `${m.symbol} $${price} (${ch}) vol ${vol}`;
  });

  return [title, ...lines].join("\n");
}

export function formatSignalsBlock(signals: Signal[]): string {
  const bySymbol = new Map<string, Signal[]>();

  for (const s of signals) {
    const list = bySymbol.get(s.symbol) ?? [];
    list.push(s);
    bySymbol.set(s.symbol, list);
  }

  const symbols = [...bySymbol.keys()].toSorted();
  const lines: string[] = [];

  for (const sym of symbols) {
    const list = bySymbol.get(sym) ?? [];

    const top = list
      .toSorted((a, b) => b.strength - a.strength)
      .slice(0, 3)
      .map((s) => `${s.type} (${s.direction}) ${Math.round(s.strength * 100)}%`)
      .join(", ");

    lines.push(`${sym}: ${top}`);
  }

  return ["Signals", ...lines].join("\n");
}

function compareChanges(a: ScreenerScanResult, b: ScreenerScanResult): number {
  if (a.changePercent === null) {
    return Number(b.changePercent !== null);
  }

  if (b.changePercent === null) {
    return -1;
  }

  return Math.abs(b.changePercent) - Math.abs(a.changePercent);
}

export function formatScanBlock(results: ScreenerScanResult[], limit: number): string {
  const sorted = results.toSorted(compareChanges).slice(0, limit);

  const lines = sorted.map((r) => {
    const flags = [
      r.rsi === undefined ? undefined : `RSI ${r.rsi.toFixed(1)}`,
      r.aboveSma20 === undefined ? undefined : r.aboveSma20 ? "above SMA20" : "below SMA20",
      r.aboveSma50 === undefined ? undefined : r.aboveSma50 ? "above SMA50" : "below SMA50",
    ].filter(Boolean);

    const meta = flags.length ? ` — ${flags.join(", ")}` : "";

    return `${r.symbol} $${fmtUsd(r.price)} (${fmtPct(r.changePercent)}) vol ${formatCompactNumber(r.volume)}${meta}`;
  });

  return ["Scan", ...lines].join("\n");
}
