// Zod schemas for runtime validation of external API responses

import { z } from "zod";

// ============================================
// Yahoo Finance Schemas
// ============================================

export const YahooQuoteSchema = z.object({
  symbol: z.string(),
  regularMarketPrice: z.number().optional(),
  regularMarketOpen: z.number().optional(),
  regularMarketDayHigh: z.number().optional(),
  regularMarketDayLow: z.number().optional(),
  regularMarketPreviousClose: z.number().optional(),
  regularMarketVolume: z.number().optional(),
  regularMarketChange: z.number().optional(),
  regularMarketChangePercent: z.number().optional(),
});

export const YahooQuoteArraySchema = z.array(YahooQuoteSchema);

export const YahooChartQuoteSchema = z.object({
  date: z.date().optional(),
  open: z.number().optional(),
  high: z.number().optional(),
  low: z.number().optional(),
  close: z.number().optional(),
  volume: z.number().optional(),
});

export const YahooChartResultSchema = z.object({
  quotes: z.array(YahooChartQuoteSchema).optional(),
});

export const YahooSearchResultSchema = z.object({
  symbol: z.string().optional(),
  shortname: z.string().optional(),
  longname: z.string().optional(),
  typeDisp: z.string().optional(),
  quoteType: z.string().optional(),
  exchange: z.string().optional(),
});

export const YahooSearchResponseSchema = z.object({
  quotes: z.array(YahooSearchResultSchema).optional(),
  news: z
    .array(
      z.object({
        uuid: z.string().optional(),
        title: z.string().optional(),
        publisher: z.string().optional(),
        link: z.string().optional(),
        providerPublishTime: z.date().optional(),
      }),
    )
    .optional(),
});

export const YahooOptionContractSchema = z.object({
  strike: z.number(),
  expiration: z.date().optional(),
  bid: z.number().optional(),
  ask: z.number().optional(),
  lastPrice: z.number().optional(),
  volume: z.number().optional(),
  openInterest: z.number().optional(),
  impliedVolatility: z.number().optional(),
  inTheMoney: z.boolean().optional(),
});

export const YahooOptionsResponseSchema = z.object({
  expirationDates: z.array(z.date()).optional(),
  options: z
    .array(
      z.object({
        calls: z.array(YahooOptionContractSchema).optional(),
        puts: z.array(YahooOptionContractSchema).optional(),
      }),
    )
    .optional(),
});

export const YahooTrendingResponseSchema = z.object({
  quotes: z.array(z.object({ symbol: z.string() })).optional(),
});

export const YahooScreenerResponseSchema = z.object({
  quotes: z.array(z.unknown()).optional(),
});

export const YahooGainersResponseSchema = z.object({
  quotes: z.array(z.unknown()).optional(),
});

// ============================================
// Polygon Schemas
// ============================================

export const PolygonBarSchema = z.object({
  T: z.string().optional(),
  t: z.number().optional(),
  o: z.number().optional(),
  h: z.number().optional(),
  l: z.number().optional(),
  c: z.number().optional(),
  v: z.number().optional(),
});

export const PolygonAggregatesResponseSchema = z.object({
  results: z.array(PolygonBarSchema).optional(),
});

export const PolygonNewsArticleSchema = z.object({
  id: z.string().optional(),
  tickers: z.array(z.string()).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  publisher: z.object({ name: z.string().optional() }).optional(),
  article_url: z.string().optional(),
  published_utc: z.string().optional(),
  insights: z.array(z.object({ sentiment: z.string().optional() })).optional(),
});

export const PolygonNewsResponseSchema = z.object({
  results: z.array(PolygonNewsArticleSchema).optional(),
});

export const PolygonTickerSnapshotSchema = z.object({
  ticker: z.string(),
  day: z.object({ c: z.number().optional(), v: z.number().optional() }).optional(),
  prevDay: z.object({ c: z.number().optional() }).optional(),
  todaysChange: z.number().optional(),
  todaysChangePerc: z.number().optional(),
});

export const PolygonSnapshotResponseSchema = z.object({
  tickers: z.array(PolygonTickerSnapshotSchema).optional(),
  ticker: PolygonTickerSnapshotSchema.optional(),
});

// Provider extensions are JSON, retained for forward compatibility rather than stripped.
export const PolygonTickerDetailsSchema = z
  .object({
    ticker: z.string().nullish(),
    name: z.string().nullish(),
    market: z.string().nullish(),
    locale: z.string().nullish(),
    active: z.boolean().nullish(),
    market_cap: z.number().nullish(),
  })
  .catchall(z.json());

export const PolygonSplitSchema = z
  .object({
    ticker: z.string().nullish(),
    execution_date: z.string().nullish(),
    split_from: z.number().nullish(),
    split_to: z.number().nullish(),
  })
  .catchall(z.json());

export const PolygonDividendSchema = z
  .object({
    ticker: z.string().nullish(),
    ex_dividend_date: z.string().nullish(),
    cash_amount: z.number().nullish(),
    currency: z.string().nullish(),
  })
  .catchall(z.json());

export const PolygonRelatedCompanySchema = z
  .object({
    ticker: z.string().nullish(),
  })
  .catchall(z.json());

export const PolygonTickerDetailsResponseSchema = z.object({
  results: PolygonTickerDetailsSchema.optional(),
});

export const PolygonMarketStatusResponseSchema = z.object({
  market: z.string().optional(),
  serverTime: z.string().optional(),
});

export const PolygonSplitsResponseSchema = z.object({
  results: z.array(PolygonSplitSchema).optional(),
});

export const PolygonDividendsResponseSchema = z.object({
  results: z.array(PolygonDividendSchema).optional(),
});

export const PolygonRelatedResponseSchema = z.object({
  results: z.array(PolygonRelatedCompanySchema).optional(),
});

// ============================================
// Finnhub Schemas
// ============================================

export const FinnhubQuoteSchema = z.object({
  c: z.number().optional(),
  o: z.number().optional(),
  h: z.number().optional(),
  l: z.number().optional(),
  pc: z.number().optional(),
  d: z.number().optional(),
  dp: z.number().optional(),
});

export const FinnhubNewsArticleSchema = z.object({
  id: z.number(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  source: z.string().optional(),
  url: z.string().optional(),
  datetime: z.number().optional(),
});

export const FinnhubPatternSchema = z.object({
  patternname: z.string().optional(),
  patterntype: z.string().optional(),
});

export const FinnhubPatternResponseSchema = z.object({
  points: z.array(FinnhubPatternSchema).optional(),
});

// Contract: https://github.com/Finnhub-Stock-API/finnhub-go/blob/master/api/openapi.yaml
// Known optional fields permit null for unavailable observations; extension JSON is retained.
export const FinnhubCompanyProfileSchema = z
  .object({
    ticker: z.string().nullish(),
    name: z.string().nullish(),
    country: z.string().nullish(),
    currency: z.string().nullish(),
    exchange: z.string().nullish(),
    ipo: z.string().nullish(),
    marketCapitalization: z.number().nullish(),
    shareOutstanding: z.number().nullish(),
  })
  .catchall(z.json());

export const FinnhubNewsSentimentSchema = z
  .object({
    symbol: z.string().nullish(),
    companyNewsScore: z.number().nullish(),
    sectorAverageBullishPercent: z.number().nullish(),
    sectorAverageNewsScore: z.number().nullish(),
    sentiment: z
      .object({ bearishPercent: z.number().nullish(), bullishPercent: z.number().nullish() })
      .catchall(z.json())
      .nullish(),
    buzz: z
      .object({
        articlesInLastWeek: z.number().nullish(),
        buzz: z.number().nullish(),
        weeklyAverage: z.number().nullish(),
      })
      .catchall(z.json())
      .nullish(),
  })
  .catchall(z.json());

export const FinnhubRecommendationSchema = z
  .object({
    symbol: z.string().nullish(),
    period: z.string().nullish(),
    buy: z.number().nullish(),
    hold: z.number().nullish(),
    sell: z.number().nullish(),
    strongBuy: z.number().nullish(),
    strongSell: z.number().nullish(),
  })
  .catchall(z.json());

export const FinnhubPriceTargetSchema = z
  .object({
    symbol: z.string().nullish(),
    lastUpdated: z.string().nullish(),
    targetHigh: z.number().nullish(),
    targetLow: z.number().nullish(),
    targetMean: z.number().nullish(),
    targetMedian: z.number().nullish(),
  })
  .catchall(z.json());

export const FinnhubEarningSchema = z
  .object({
    symbol: z.string().nullish(),
    date: z.string().nullish(),
    epsActual: z.number().nullish(),
    epsEstimate: z.number().nullish(),
    revenueActual: z.number().nullish(),
    revenueEstimate: z.number().nullish(),
    hour: z.string().nullish(),
    quarter: z.number().nullish(),
    year: z.number().nullish(),
  })
  .catchall(z.json());

export const FinnhubInsiderTransactionSchema = z
  .object({
    name: z.string().nullish(),
    symbol: z.string().nullish(),
    share: z.number().nullish(),
    change: z.number().nullish(),
    transactionPrice: z.number().nullish(),
    transactionDate: z.string().nullish(),
    filingDate: z.string().nullish(),
    transactionCode: z.string().nullish(),
  })
  .catchall(z.json());

export const FinnhubBasicFinancialsSchema = z
  .object({
    symbol: z.string().nullish(),
    metricType: z.string().nullish(),
    // Finnhub's OpenAPI defines these metric dictionaries as open objects.
    metric: z.record(z.string(), z.json()).nullish(),
    series: z.record(z.string(), z.json()).nullish(),
  })
  .catchall(z.json());

export const FinnhubSupportResistanceSchema = z
  .object({
    levels: z.array(z.number()).nullish(),
  })
  .catchall(z.json());

const FinnhubSocialPointSchema = z
  .object({
    atTime: z.string().nullish(),
    mention: z.number().nullish(),
    positiveMention: z.number().nullish(),
    negativeMention: z.number().nullish(),
    score: z.number().nullish(),
    positiveScore: z.number().nullish(),
    negativeScore: z.number().nullish(),
  })
  .catchall(z.json());

export const FinnhubSocialSentimentSchema = z
  .object({
    symbol: z.string().nullish(),
    data: z.array(FinnhubSocialPointSchema).nullish(),
    reddit: z.array(FinnhubSocialPointSchema).nullish(),
    twitter: z.array(FinnhubSocialPointSchema).nullish(),
  })
  .catchall(z.json());

export const FinnhubEarningsResponseSchema = z.object({
  earningsCalendar: z.array(FinnhubEarningSchema).optional(),
});

export const FinnhubInsiderResponseSchema = z.object({
  data: z.array(FinnhubInsiderTransactionSchema).optional(),
});

// ============================================
// FRED Schemas
// ============================================

export const FredObservationSchema = z.object({
  date: z.string(),
  value: z.string(),
});

export const FredObservationsResponseSchema = z.object({
  observations: z.array(FredObservationSchema).optional(),
});

// https://fred.stlouisfed.org/docs/api/fred/series.html
export const FredSeriesSchema = z
  .object({
    id: z.string(),
    title: z.string().nullish(),
    units: z.string().nullish(),
    frequency: z.string().nullish(),
    observation_start: z.string().nullish(),
    observation_end: z.string().nullish(),
  })
  .catchall(z.json());

// https://fred.stlouisfed.org/docs/api/fred/releases.html
export const FredReleaseSchema = z
  .object({
    id: z.number(),
    name: z.string().nullish(),
    press_release: z.boolean().nullish(),
    link: z.string().nullish(),
    notes: z.string().nullish(),
  })
  .catchall(z.json());

export const FredSeriesResponseSchema = z.object({
  seriess: z.array(FredSeriesSchema).optional(),
});

export const FredReleasesResponseSchema = z.object({
  releases: z.array(FredReleaseSchema).optional(),
});

// ============================================
// Finviz Schemas
// ============================================

export const FinvizScreenerResultSchema = z.object({
  symbol: z.string(),
  company: z.string().optional(),
  price: z.number().optional(),
  changePercent: z.number().optional(),
  volume: z.number().optional(),
  marketCap: z.string().optional(),
});

export const FinvizScreenFiltersSchema = z.object({
  marketCap: z.enum(["small", "mid", "large", "mega"]).optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  price: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  change: z.enum(["up", "down"]).optional(),
  volume: z.object({ min: z.number().optional() }).optional(),
  signal: z.string().optional(),
});

// ============================================
// Alpaca Schemas
// ============================================

export const AlpacaPositionSchema = z.object({
  symbol: z.string(),
  qty: z.string(),
  avg_entry_price: z.string(),
  current_price: z.string(),
  market_value: z.string(),
  unrealized_pl: z.string(),
  unrealized_plpc: z.string(),
});

export const AlpacaOrderSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.string(),
  type: z.string(),
  qty: z.string(),
  filled_qty: z.string().optional(),
  limit_price: z.string().optional(),
  stop_price: z.string().optional(),
  status: z.string(),
  time_in_force: z.string(),
  created_at: z.string(),
  filled_at: z.string().optional(),
});

export const AlpacaBarSchema = z.object({
  Timestamp: z.string(),
  OpenPrice: z.number(),
  HighPrice: z.number(),
  LowPrice: z.number(),
  ClosePrice: z.number(),
  Volume: z.number(),
});

// ============================================
// Common/Output Schemas
// ============================================

export const BarSchema = z.object({
  t: z.string(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
});

// ============================================
// Type exports (inferred from schemas)
// ============================================

export type YahooQuote = z.infer<typeof YahooQuoteSchema>;

export type YahooChartQuote = z.infer<typeof YahooChartQuoteSchema>;

export type YahooSearchResult = z.infer<typeof YahooSearchResultSchema>;

export type YahooOptionContract = z.infer<typeof YahooOptionContractSchema>;

export type PolygonBar = z.infer<typeof PolygonBarSchema>;

export type PolygonNewsArticle = z.infer<typeof PolygonNewsArticleSchema>;

export type PolygonTickerSnapshot = z.infer<typeof PolygonTickerSnapshotSchema>;

export type FinnhubQuote = z.infer<typeof FinnhubQuoteSchema>;

export type FinnhubNewsArticle = z.infer<typeof FinnhubNewsArticleSchema>;

export type FinnhubPattern = z.infer<typeof FinnhubPatternSchema>;

export type FredObservation = z.infer<typeof FredObservationSchema>;

export type FinvizScreenerResult = z.infer<typeof FinvizScreenerResultSchema>;

export type FinvizScreenFilters = z.infer<typeof FinvizScreenFiltersSchema>;

export type AlpacaPosition = z.infer<typeof AlpacaPositionSchema>;

export type AlpacaOrder = z.infer<typeof AlpacaOrderSchema>;

export type AlpacaBar = z.infer<typeof AlpacaBarSchema>;

export type Bar = z.infer<typeof BarSchema>;

export type PolygonTickerDetails = z.infer<typeof PolygonTickerDetailsSchema>;

export type PolygonSplit = z.infer<typeof PolygonSplitSchema>;

export type PolygonDividend = z.infer<typeof PolygonDividendSchema>;

export type PolygonRelatedCompany = z.infer<typeof PolygonRelatedCompanySchema>;

export type FinnhubCompanyProfile = z.infer<typeof FinnhubCompanyProfileSchema>;

export type FinnhubNewsSentiment = z.infer<typeof FinnhubNewsSentimentSchema>;

export type FinnhubRecommendation = z.infer<typeof FinnhubRecommendationSchema>;

export type FinnhubPriceTarget = z.infer<typeof FinnhubPriceTargetSchema>;

export type FinnhubEarning = z.infer<typeof FinnhubEarningSchema>;

export type FinnhubInsiderTransaction = z.infer<typeof FinnhubInsiderTransactionSchema>;

export type FinnhubBasicFinancials = z.infer<typeof FinnhubBasicFinancialsSchema>;

export type FinnhubSupportResistance = z.infer<typeof FinnhubSupportResistanceSchema>;

export type FinnhubSocialSentiment = z.infer<typeof FinnhubSocialSentimentSchema>;

export type FredSeries = z.infer<typeof FredSeriesSchema>;

export type FredRelease = z.infer<typeof FredReleaseSchema>;
