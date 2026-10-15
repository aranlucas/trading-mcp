declare module "finnhub" {
  interface ApiAuthentication {
    apiKey?: string;
  }

  interface ApiClientInstance {
    authentications: Record<string, ApiAuthentication>;
  }

  interface ApiClientSingleton {
    instance: ApiClientInstance;
  }

  export const ApiClient: ApiClientSingleton;

  interface CompanyProfileOptions {
    symbol?: string;
  }

  interface MarketNewsOptions {
    minId?: number;
  }

  interface DateRangeOptions {
    from?: string;
    to?: string;
  }

  // This untyped third-party SDK hands raw payloads to our endpoint schema parser.
  // The SDK callback is an untyped external boundary; endpoint schemas validate its payloads.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters
  type Callback = (err: Error | null, data?: unknown) => void;

  export class DefaultApi {
    constructor(apiKey?: string);

    quote(symbol: string, callback: Callback): void;
    companyProfile2(opts: CompanyProfileOptions, callback: Callback): void;
    companyNews(symbol: string, from: string, to: string, callback: Callback): void;
    marketNews(category: string, opts: MarketNewsOptions, callback: Callback): void;
    newsSentiment(symbol: string, callback: Callback): void;
    recommendationTrends(symbol: string, callback: Callback): void;
    priceTarget(symbol: string, callback: Callback): void;
    earningsCalendar(opts: DateRangeOptions, callback: Callback): void;
    insiderTransactions(symbol: string, opts: DateRangeOptions, callback: Callback): void;
    companyPeers(symbol: string, callback: Callback): void;
    companyBasicFinancials(symbol: string, metric: string, callback: Callback): void;
    patternRecognition(symbol: string, resolution: string, callback: Callback): void;
    supportResistance(symbol: string, resolution: string, callback: Callback): void;
    socialSentiment(symbol: string, opts: DateRangeOptions, callback: Callback): void;
  }
}
