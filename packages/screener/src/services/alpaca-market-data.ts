import { alpaca, type Quote } from "@trading/core";
import type { MarketDataClient } from "./market-data.js";

type PriceBar = Awaited<ReturnType<typeof alpaca.getBars>>[number];

export class AlpacaMarketDataClient implements MarketDataClient {
  async getSnapshots(symbols: string[]): Promise<Map<string, Quote>> {
    const snapshots = await alpaca.getSnapshots(symbols);

    return snapshots;
  }

  async getBars(symbol: string, limit: number): Promise<PriceBar[]> {
    const bars = await alpaca.getBars(symbol, "1Day", limit);

    return bars;
  }
}
