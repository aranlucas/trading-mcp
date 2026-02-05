// FRED (Federal Reserve Economic Data) provider - FREE, no API key needed for basic

import {
  FredObservationsResponseSchema,
  FredSeriesResponseSchema,
  FredReleasesResponseSchema,
} from "../schemas/index.js";

const FRED_BASE = "https://api.stlouisfed.org/fred";
const apiKey = process.env.FRED_API_KEY || "";

export interface EconomicSeries {
  id: string;
  title: string;
  value: number;
  date: string;
  units: string;
}

// Common economic indicators
export const INDICATORS = {
  GDP: "GDP",
  UNRATE: "UNRATE", // Unemployment rate
  CPIAUCSL: "CPIAUCSL", // CPI
  FEDFUNDS: "FEDFUNDS", // Fed funds rate
  DGS10: "DGS10", // 10-year treasury
  DGS2: "DGS2", // 2-year treasury
  DTWEXBGS: "DTWEXBGS", // Trade weighted dollar
  VIXCLS: "VIXCLS", // VIX
  SP500: "SP500", // S&P 500
  BAMLH0A0HYM2: "BAMLH0A0HYM2", // High yield spread
  T10Y2Y: "T10Y2Y", // 10y-2y spread (yield curve)
  M2SL: "M2SL", // M2 money supply
  MORTGAGE30US: "MORTGAGE30US", // 30-year mortgage rate
  UMCSENT: "UMCSENT", // Consumer sentiment
};

export const fred = {
  name: "fred" as const,

  isConfigured(): boolean {
    return !!apiKey;
  },

  // Get series observations
  async getSeries(seriesId: string, limit = 10): Promise<{ date: string; value: number }[]> {
    if (!apiKey) return [];
    try {
      const url = `${FRED_BASE}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
      const response = await fetch(url);
      const raw = await response.json();

      const result = FredObservationsResponseSchema.safeParse(raw);
      if (!result.success) return [];

      return (result.data.observations ?? []).map((o) => ({
        date: o.date,
        value: parseFloat(o.value) || 0,
      }));
    } catch {
      return [];
    }
  },

  // Get series info
  async getSeriesInfo(seriesId: string): Promise<unknown> {
    if (!apiKey) return null;
    try {
      const url = `${FRED_BASE}/series?series_id=${seriesId}&api_key=${apiKey}&file_type=json`;
      const response = await fetch(url);
      const raw = await response.json();

      const result = FredSeriesResponseSchema.safeParse(raw);
      if (!result.success) return null;

      const series = result.data.seriess;
      return Array.isArray(series) && series.length > 0 ? series[0] : null;
    } catch {
      return null;
    }
  },

  // Get latest value for a series
  async getLatest(seriesId: string): Promise<EconomicSeries | null> {
    if (!apiKey) return null;
    try {
      const [obs, info] = await Promise.all([
        this.getSeries(seriesId, 1),
        this.getSeriesInfo(seriesId),
      ]);

      if (!obs[0] || !info) return null;

      // Info is unknown, need to safely access properties
      const infoObj = info as Record<string, unknown>;
      return {
        id: seriesId,
        title: typeof infoObj.title === "string" ? infoObj.title : seriesId,
        value: obs[0].value,
        date: obs[0].date,
        units: typeof infoObj.units === "string" ? infoObj.units : "",
      };
    } catch {
      return null;
    }
  },

  // Get macro snapshot (multiple indicators at once)
  async getMacroSnapshot(): Promise<Map<string, EconomicSeries>> {
    const results = new Map<string, EconomicSeries>();
    if (!apiKey) return results;

    const keys = Object.keys(INDICATORS) as (keyof typeof INDICATORS)[];
    const promises = keys.map(async (key) => {
      const data = await this.getLatest(INDICATORS[key]);
      if (data) results.set(key, data);
    });

    await Promise.allSettled(promises);
    return results;
  },

  // Search for series
  async search(query: string, limit = 20): Promise<unknown[]> {
    if (!apiKey) return [];
    try {
      const url = `${FRED_BASE}/series/search?search_text=${encodeURIComponent(query)}&api_key=${apiKey}&file_type=json&limit=${limit}`;
      const response = await fetch(url);
      const raw = await response.json();

      const result = FredSeriesResponseSchema.safeParse(raw);
      return result.success ? (result.data.seriess ?? []) : [];
    } catch {
      return [];
    }
  },

  // Get releases (economic calendar)
  async getReleases(limit = 20): Promise<unknown[]> {
    if (!apiKey) return [];
    try {
      const url = `${FRED_BASE}/releases?api_key=${apiKey}&file_type=json&limit=${limit}`;
      const response = await fetch(url);
      const raw = await response.json();

      const result = FredReleasesResponseSchema.safeParse(raw);
      return result.success ? (result.data.releases ?? []) : [];
    } catch {
      return [];
    }
  },
};
