declare module "finnhub" {
  export const ApiClient: {
    instance: {
      authentications: {
        [key: string]: {
          apiKey?: string;
        };
      };
    };
  };

  // This untyped third-party SDK hands raw payloads to our endpoint schema parser.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Boundary declaration only; provider callbacks parse data before use.
  type Callback = (err: Error | null, data?: unknown) => void;

  export class DefaultApi {
    constructor(apiKey?: string);

    quote(symbol: string, callback: Callback): void;
    companyProfile2(opts: { symbol?: string }, callback: Callback): void;
    companyNews(symbol: string, from: string, to: string, callback: Callback): void;
    marketNews(category: string, opts: { minId?: number }, callback: Callback): void;
    newsSentiment(symbol: string, callback: Callback): void;
    recommendationTrends(symbol: string, callback: Callback): void;
    priceTarget(symbol: string, callback: Callback): void;
    earningsCalendar(opts: { from?: string; to?: string }, callback: Callback): void;
    insiderTransactions(
      symbol: string,
      opts: { from?: string; to?: string },
      callback: Callback,
    ): void;
    companyPeers(symbol: string, callback: Callback): void;
    companyBasicFinancials(symbol: string, metric: string, callback: Callback): void;
    patternRecognition(symbol: string, resolution: string, callback: Callback): void;
    supportResistance(symbol: string, resolution: string, callback: Callback): void;
    socialSentiment(symbol: string, opts: { from?: string; to?: string }, callback: Callback): void;
  }
}
