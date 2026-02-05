import type { Signal } from "@trading/core";
import { app } from "../../app.js";

export interface ScreenerScanResult {
  symbol: string;
  price: number;
  volume: number;
  change: number;
  changePercent: number;
  rsi?: number;
  aboveSma20?: boolean;
  aboveSma50?: boolean;
}

export type ScanCriteria = {
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  minRsi?: number;
  maxRsi?: number;
  aboveSma20?: boolean;
  aboveSma50?: boolean;
  symbols?: string[];
};

async function appJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await app.request(path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Screener API error: ${res.status} ${body}`.trim());
  }
  return (await res.json()) as T;
}

export async function getMovers(opts: {
  direction: "gainers" | "losers";
  limit: number;
}): Promise<ScreenerScanResult[]> {
  const data = await appJson<{ movers: ScreenerScanResult[] }>(
    `/api/screener/movers/${opts.direction}?limit=${opts.limit}`,
  );
  return data.movers;
}

export async function scan(criteria: ScanCriteria): Promise<ScreenerScanResult[]> {
  const data = await appJson<{ results: ScreenerScanResult[] }>("/api/screener/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(criteria),
  });
  return data.results;
}

export async function getSignals(symbols: string[]): Promise<Signal[]> {
  const data = await appJson<{ signals: Signal[] }>("/api/screener/signals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  return data.signals;
}
