import type { Signal } from "@trading/core";
import { app } from "@trading/screener/app";
import {
  MoverResultSchema,
  ScanResultSchema,
  ScanCriteriaSchema,
  SignalSchema,
  type ScanCriteria,
} from "@trading/screener/contracts";

import { z } from "zod";

type MoversOptions = {
  direction: "gainers" | "losers";
  limit: number;
};

export { ScanCriteriaSchema, ScanResultSchema, MoverResultSchema };

export type { ScanCriteria };

export type ScreenerScanResult = z.infer<typeof ScanResultSchema>;

async function appJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await app.request(path, init);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Screener API error: ${res.status} ${body}`.trim());
  }

  return schema.parse(await res.json());
}

export async function getMovers(opts: MoversOptions): Promise<ScreenerScanResult[]> {
  const data = await appJson(
    `/api/screener/movers/${opts.direction}?limit=${opts.limit}`,
    z.object({ movers: z.array(MoverResultSchema) }),
  );

  return data.movers;
}

export async function scan(criteria: ScanCriteria): Promise<ScreenerScanResult[]> {
  const data = await appJson(
    "/api/screener/scan",
    z.object({ results: z.array(ScanResultSchema) }),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(criteria),
    },
  );

  return data.results;
}

export async function getSignals(symbols: string[]): Promise<Signal[]> {
  const data = await appJson(
    "/api/screener/signals",
    z.object({ signals: z.array(SignalSchema) }),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols }),
    },
  );

  return data.signals;
}
