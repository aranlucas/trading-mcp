// Configuration for trading packages

export interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paper: boolean;
}

export interface CacheConfig {
  newsMaxAge: number; // minutes
  quotesMaxAge: number; // seconds
}

export interface Config {
  alpaca: AlpacaConfig;
  cache: CacheConfig;
}

export function loadConfig(): Config {
  const alpacaKey = process.env.ALPACA_API_KEY || "";
  const alpacaSecret = process.env.ALPACA_API_SECRET || "";
  const alpacaPaper = process.env.ALPACA_PAPER !== "false";

  if (!alpacaKey || !alpacaSecret) {
    console.error("Warning: ALPACA_API_KEY and ALPACA_API_SECRET not set. API calls will fail.");
  }

  return {
    alpaca: {
      apiKey: alpacaKey,
      apiSecret: alpacaSecret,
      paper: alpacaPaper,
    },
    cache: {
      newsMaxAge: 15,
      quotesMaxAge: 5,
    },
  };
}

export const config = loadConfig();
