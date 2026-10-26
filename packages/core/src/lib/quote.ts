import { z } from "zod";
import { ProviderError } from "./provider-error.js";

const optionalPrice = z.number().positive().nullable().catch(null).default(null);

const optionalNumber = z.number().nullable().catch(null).default(null);

/** Provider observation time; absent/invalid values never become the retrieval clock. */
export const SourceTimestampSchema = z
  .union([
    z.date(),
    z
      .number()
      .nonnegative()
      .transform((value) => new Date(value > 10_000_000_000 ? value : value * 1000)),
    z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  ])
  .pipe(z.date())
  .transform((value) => value.toISOString())
  .nullable()
  .catch(null)
  .default(null);

/** Normalized stock snapshots require a usable price and explicit data provenance. */
export const QuoteSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  price: z.number().positive(),
  open: optionalPrice,
  high: optionalPrice,
  low: optionalPrice,
  close: optionalPrice.describe("Previous session close relative to this snapshot, when available"),
  volume: z.number().nonnegative().nullable().catch(null).default(null),
  change: optionalNumber,
  changePercent: optionalNumber,
  timestamp: SourceTimestampSchema.describe(
    "Provider observation time or bar-start time; null when unavailable",
  ),
  source: z.enum(["alpaca", "yahoo", "finnhub", "polygon", "finviz"]),
  kind: z.enum(["daily_bar", "market_snapshot", "previous_session_bar", "web_snapshot"]),
  retrievedAt: z.iso
    .datetime({ offset: true })
    .describe("Retrieval time; not evidence that the price is current"),
});

// Provider payloads and injected providers are untrusted; validate before accepting a quote.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function parseQuote(value: unknown, symbol: string): z.infer<typeof QuoteSchema> {
  const parsed = QuoteSchema.safeParse(value);

  if (!parsed.success) {
    throw new ProviderError({
      provider: "quote",
      operation: "normalize",
      message: "Invalid quote response",
      cause: parsed.error,
    });
  }

  if (parsed.data.symbol !== symbol.trim().toUpperCase()) {
    throw new ProviderError({
      provider: parsed.data.source,
      operation: "normalize",
      message: "Quote symbol does not match the request",
    });
  }

  return parsed.data;
}

const QuoteChangeSchema = QuoteSchema.pick({ change: true, changePercent: true });

type QuoteChange = z.infer<typeof QuoteChangeSchema>;

/** Derive changes only when a finite, positive previous close is available. */
export function quoteChange(price: number, previousClose: number | null | undefined): QuoteChange {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    previousClose === null ||
    previousClose === undefined ||
    !Number.isFinite(previousClose) ||
    previousClose <= 0
  ) {
    return { change: null, changePercent: null };
  }

  const change = price - previousClose;

  return QuoteChangeSchema.parse({ change, changePercent: (change / previousClose) * 100 });
}
