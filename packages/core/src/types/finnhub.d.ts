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

  type Callback<T = any> = (err: any | null, data?: T, response?: any) => void;

  export class DefaultApi {
    constructor(apiKey?: string);

    quote(symbol: string, callback: Callback): void;
    companyProfile2(opts: { symbol?: string }, callback: Callback): void;
    companyNews(
      symbol: string,
      from: string,
      to: string,
      callback: Callback,
    ): void;
    marketNews(category: string, opts: object, callback: Callback): void;
    newsSentiment(symbol: string, callback: Callback): void;
    recommendationTrends(symbol: string, callback: Callback): void;
    priceTarget(symbol: string, callback: Callback): void;
    earningsCalendar(
      opts: { from?: string; to?: string },
      callback: Callback,
    ): void;
    insiderTransactions(symbol: string, opts: object, callback: Callback): void;
    companyPeers(symbol: string, callback: Callback): void;
    companyBasicFinancials(
      symbol: string,
      metric: string,
      callback: Callback,
    ): void;
    patternRecognition(
      symbol: string,
      resolution: string,
      callback: Callback,
    ): void;
    supportResistance(
      symbol: string,
      resolution: string,
      callback: Callback,
    ): void;
    socialSentiment(symbol: string, opts: object, callback: Callback): void;

    // Allow other methods/properties without strict typing
    [key: string]: any;
  }
}
