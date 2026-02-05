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

  type Callback<T> = (err: Error | null, data?: T, response?: unknown) => void;

  export class DefaultApi {
    constructor(apiKey?: string);

    quote<T = unknown>(symbol: string, callback: Callback<T>): void;
    companyProfile2<T = unknown>(opts: { symbol?: string }, callback: Callback<T>): void;
    companyNews<T = unknown>(symbol: string, from: string, to: string, callback: Callback<T>): void;
    marketNews<T = unknown>(category: string, opts: object, callback: Callback<T>): void;
    newsSentiment<T = unknown>(symbol: string, callback: Callback<T>): void;
    recommendationTrends<T = unknown>(symbol: string, callback: Callback<T>): void;
    priceTarget<T = unknown>(symbol: string, callback: Callback<T>): void;
    earningsCalendar<T = unknown>(
      opts: { from?: string; to?: string },
      callback: Callback<T>,
    ): void;
    insiderTransactions<T = unknown>(symbol: string, opts: object, callback: Callback<T>): void;
    companyPeers<T = unknown>(symbol: string, callback: Callback<T>): void;
    companyBasicFinancials<T = unknown>(
      symbol: string,
      metric: string,
      callback: Callback<T>,
    ): void;
    patternRecognition<T = unknown>(
      symbol: string,
      resolution: string,
      callback: Callback<T>,
    ): void;
    supportResistance<T = unknown>(symbol: string, resolution: string, callback: Callback<T>): void;
    socialSentiment<T = unknown>(symbol: string, opts: object, callback: Callback<T>): void;

    // Allow other methods/properties without strict typing
    [key: string]: unknown;
  }
}
