import { describe, expect, it } from "vitest";
import {
  FredSeriesResponseSchema,
  FredReleasesResponseSchema,
  FinnhubCompanyProfileSchema,
  FinnhubNewsSentimentSchema,
  FinnhubRecommendationSchema,
  FinnhubEarningsResponseSchema,
  FinnhubInsiderResponseSchema,
  FinnhubBasicFinancialsSchema,
  FinnhubSocialSentimentSchema,
  FinnhubPriceTargetSchema,
  FinnhubSupportResistanceSchema,
  PolygonTickerDetailsResponseSchema,
  PolygonSplitsResponseSchema,
  PolygonDividendsResponseSchema,
  PolygonRelatedResponseSchema,
} from "../schemas/index.js";
import { isRetryableError } from "../lib/retry.js";
import { toPublicError, ProviderError } from "../lib/errors.js";

describe("Provider payload boundaries", () => {
  it("validates FRED metadata and preserves extensions", () => {
    const series = {
      id: "TEST",
      title: "Synthetic series",
      units: "Index",
      future: { revision: 2 },
    };

    expect(FredSeriesResponseSchema.parse({ seriess: [series] }).seriess).toEqual([series]);
    expect(FredSeriesResponseSchema.safeParse({ seriess: [42] }).success).toBe(false);
    expect(
      FredReleasesResponseSchema.parse({
        releases: [{ id: 1, name: "Synthetic", press_release: true, future: [] }],
      }).releases?.[0]?.future,
    ).toEqual([]);
  });

  it("preserves unavailable optional values and open metric dictionaries", () => {
    expect(
      FredSeriesResponseSchema.parse({ seriess: [{ id: "TEST", title: null, units: null }] })
        .seriess?.[0]?.title,
    ).toBeNull();
    expect(
      PolygonTickerDetailsResponseSchema.parse({ results: { ticker: "TEST", market_cap: null } })
        .results?.market_cap,
    ).toBeNull();
    expect(FinnhubPriceTargetSchema.parse({ targetMean: null }).targetMean).toBeNull();
    expect(
      FinnhubBasicFinancialsSchema.parse({
        metric: { future: { values: [null, true, 1] } },
        series: { future: [1, 2] },
      }).metric?.future,
    ).toEqual({ values: [null, true, 1] });
    expect(
      FinnhubSocialSentimentSchema.parse({ symbol: "TEST", data: [{ score: null, mention: 0 }] })
        .data?.[0]?.score,
    ).toBeNull();
  });

  it("validates Polygon endpoint objects while retaining provider extensions", () => {
    expect(
      PolygonTickerDetailsResponseSchema.parse({
        results: { ticker: "TEST", active: true, address: { city: "Test" } },
      }).results?.address,
    ).toEqual({ city: "Test" });
    expect(
      PolygonSplitsResponseSchema.parse({
        results: [{ ticker: "TEST", split_from: 1, split_to: 2, future: "kept" }],
      }).results?.[0]?.future,
    ).toBe("kept");
    expect(
      PolygonDividendsResponseSchema.parse({
        results: [{ ticker: "TEST", cash_amount: 0, currency: "USD" }],
      }).results?.[0]?.cash_amount,
    ).toBe(0);
    expect(
      PolygonRelatedResponseSchema.parse({ results: [{ ticker: "PEER", score: 1 }] }).results?.[0]
        ?.score,
    ).toBe(1);
    expect(PolygonSplitsResponseSchema.safeParse({ results: ["invalid"] }).success).toBe(false);
  });

  it("validates Finnhub object and list contracts, including null financial values", () => {
    expect(
      FinnhubCompanyProfileSchema.parse({
        ticker: "TEST",
        name: "Synthetic",
        future: { field: true },
      }).future,
    ).toEqual({ field: true });
    expect(
      FinnhubNewsSentimentSchema.parse({
        symbol: "TEST",
        sentiment: { bullishPercent: 0.5, bearishPercent: 0.5 },
        buzz: { weeklyAverage: 3 },
      }).sentiment?.bullishPercent,
    ).toBe(0.5);
    expect(
      FinnhubRecommendationSchema.parse({ symbol: "TEST", buy: 2, period: "2026-01-01", future: 1 })
        .future,
    ).toBe(1);
    expect(
      FinnhubEarningsResponseSchema.parse({
        earningsCalendar: [{ symbol: "TEST", epsActual: null }],
      }).earningsCalendar?.[0]?.epsActual,
    ).toBeNull();
    expect(
      FinnhubInsiderResponseSchema.parse({
        data: [{ symbol: "TEST", change: -1, transactionPrice: null }],
      }).data?.[0]?.change,
    ).toBe(-1);
    expect(
      FinnhubBasicFinancialsSchema.parse({
        symbol: "TEST",
        metric: { pe: null, date: "2026-01-01" },
        series: { annual: { eps: [{ period: "2025", v: 0 }] } },
      }).metric?.pe,
    ).toBeNull();
    expect(
      FinnhubSocialSentimentSchema.parse({
        reddit: [{ atTime: "2026-01-01", mention: 2, future: 3 }],
      }).reddit?.[0]?.future,
    ).toBe(3);
    expect(FinnhubPriceTargetSchema.parse({ targetMean: 10 }).targetMean).toBe(10);
    expect(FinnhubSupportResistanceSchema.parse({ levels: [1, 2] }).levels).toEqual([1, 2]);
    expect(
      FinnhubRecommendationSchema.safeParse({ symbol: "TEST", buy: "not a number" }).success,
    ).toBe(false);
    expect(FinnhubBasicFinancialsSchema.safeParse({ metric: { pe: () => 1 } }).success).toBe(false);
  });
});

describe("Arbitrary JavaScript rejection boundaries", () => {
  it("recognizes retryable Error and object fields without unsafe assertions", () => {
    expect(isRetryableError(Object.assign(new Error("failed"), { code: "ECONNRESET" }))).toBe(true);
    expect(isRetryableError({ name: "FetchError", code: 42 })).toBe(true);
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError("fetch failed")).toBe(false);
    expect(isRetryableError({ message: 42 })).toBe(false);
  });

  it("never exposes arbitrary thrown values as public error messages", () => {
    expect(toPublicError({ message: "private" })).toMatchObject({
      status: 500,
      message: "Internal server error",
    });
    expect(
      toPublicError(
        new ProviderError({ provider: "test", operation: "getQuote", cause: "private" }),
      ),
    ).toMatchObject({ status: 502, code: "PROVIDER_ERROR", message: "Upstream provider error" });
  });
});
