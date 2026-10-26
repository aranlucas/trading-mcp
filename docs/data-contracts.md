# Quotes, screening, and cancellation

This describes the normalized quote contract and the order-cancellation response.
Raw provider APIs retain their upstream shapes; the table below identifies each
boundary. These contracts do not promise live market data or order execution.

## Normalized quotes

`Quote` is inferred from the exported `QuoteSchema` in `@trading/core`.
`symbol` is a nonempty uppercase string and `price` must be finite and positive.
A missing, zero, negative, or nonfinite required price makes the quote unavailable.

| Field                     | Meaning                                                                        | Unavailable value |
| ------------------------- | ------------------------------------------------------------------------------ | ----------------- |
| `open`, `high`, `low`     | Provider's session/bar prices, when supplied                                   | `null`            |
| `close`                   | Previous session close relative to this observation                            | `null`            |
| `volume`                  | Reported nonnegative volume; a reported zero remains zero                      | `null`            |
| `change`, `changePercent` | Reported change, or derived from a usable previous close                       | `null`            |
| `timestamp`               | Provider observation time or bar-start time, normalized to ISO UTC             | `null`            |
| `retrievedAt`             | ISO time at normalization; says when data was retrieved, not how current it is | Required          |
| `source`, `kind`          | Provider and observation category                                              | Required          |

Invalid optional normalized numbers become `null`. Provider payload validation
can reject the entire response before normalization. Missing timestamps never
become the current clock. A positive price alone does not establish freshness;
callers must decide which observation kinds and ages their use case accepts.

| Normalized API                                    | `source` / `kind`                  | Price and timestamp basis                                                                       |
| ------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `alpaca.getQuote`, MCP `get_quote`                | `alpaca` / `daily_bar`             | Latest available daily close and that bar's start time; prior bar supplies `close` when present |
| `yahoo.getQuoteNormalized`, `normalizeYahooQuote` | `yahoo` / `market_snapshot`        | `regularMarketPrice` and `regularMarketTime`                                                    |
| `finnhub.getQuote`                                | `finnhub` / `market_snapshot`      | `c` and `t`; volume is unavailable                                                              |
| `polygon.getPreviousClose`                        | `polygon` / `previous_session_bar` | Previous-session aggregate close and bar start; no preceding close or derived daily change      |
| `finviz.getQuote`                                 | `finviz` / `web_snapshot`          | Snapshot-table price; observation time and day high/low are unavailable                         |
| `unified.getQuote`                                | Winning provider's values          | First valid successful provider; may return any category above except Alpaca                    |

The unified boundary validates the requested symbol, positive price, and provider
identity before recording success. Finviz rejects non-success HTTP responses
without parsing their bodies, and rejects missing/invalid snapshot prices.
Cheerio parses the HTML once; Zod validates financial fields. This replaces a
quote-specific regex parser, while the other Finviz screening/signal parsers
remain separate work.

Finviz requires an identifiable ticker in its canonical quote link or ticker
heading. Recognized identities must agree with one another and the request;
missing or changed identity markup makes the snapshot unavailable. Polygon
preserves the response's top-level ticker and result `T`, requires at least one,
and rejects either if it conflicts with the requested symbol. The adapters do
not label an unidentified response with the requested ticker.

`normalizeYahooQuote(raw, expectedSymbol?)` validates a Yahoo snapshot and returns
`Quote`, throwing for invalid required data or a mismatched expected symbol.
Omit `expectedSymbol` only when validating a batch item by its own returned
symbol, then check that it belongs to the requested set. `quoteChange(price,
previousClose)` returns nullable change fields and never emits nonfinite results.

Unavailable direct-provider results differ by API: Alpaca and normalized Yahoo
reject; Finnhub, Polygon, and Finviz return `null`. `unified.getQuote` rejects with
`ProviderError` when every candidate fails. It records success/failure metrics per
candidate. Its timeout bounds waiting, but does not abort underlying reads or
losing candidates; retries can overlap timed-out work.

## Consumer migration

Normalized `Quote` previously required numeric fields and a timestamp even when
providers did not supply them. Update consumers to handle `null` explicitly and
to retain `source`, `kind`, and `retrievedAt` when storing snapshots. Do not replace
unavailable financial values with zero or use `retrievedAt` as the price's as-of
time. Test fixtures must include provenance.

```ts
import type { Quote } from "@trading/core";

function volumeLabel(quote: Quote): string {
  if (quote.volume === null) {
    return "Unavailable";
  }
  return quote.volume.toLocaleString();
}
```

`ScreenerService.scan` returns nullable `volume`, `change`, and `changePercent`.
A requested minimum volume excludes unknown volume, including when the minimum
is zero; an actual zero meets a zero minimum. Technical filters exclude symbols
with unavailable required history. Quote-only scans do not request that history.
`getMovers` requires a known change percentage, prefers calculation from a valid
previous close, and otherwise uses the reported percentage. Absolute change may
still be unavailable. REST documents these fields at `/api/openapi.json`.
The built-in reporting client shares those response schemas. Report formatting
prints `unavailable` for missing values, preserves real zeroes, and sorts unknown
scan changes after known percentages before applying the report limit.

The REST `/api/quotes` routes, `yahoo.getQuote/getQuotes/getHistory`, and explicit
Yahoo access through `unified.providers` still return raw Yahoo shapes.
`unified.getQuotes` and `getBars` still have different success/fallback shapes;
they are not covered by this normalized contract. Do not treat them as `Quote[]`
without a separate adapter. Other Finviz APIs and portfolio day-change defaults
also remain outside this fix.

## Cancellation acknowledgment

`alpaca.cancelOrder(orderId): Promise<void>` acknowledges the transport request.
MCP `cancel_order` returns `{ orderId, status: "cancel_requested", message }` when
Alpaca accepts it. It does not confirm terminal cancellation or zero exposure.
Query `get_order`: the broker can report `pending_cancel`, `filled`, or `canceled`.
Those broker statuses are preserved without rewriting them.

Failure or timeout returns `isError: true` and a JSON payload containing
`orderId`, `status: "cancel_request_unconfirmed"`, a sanitized `error`, and a
message to check order state before retrying or replacing the order. The tool
does not poll, retry cancellation, or place a replacement. This follows Alpaca's
[cancel endpoint](https://docs.alpaca.markets/us/reference/deleteorderbyorderid-1)
and [order lifecycle](https://docs.alpaca.markets/us/docs/orders-at-alpaca#order-lifecycle).
Submission idempotency and reconciliation after ambiguous placement remain
separate work.

## Offline verification

Use the repository's native commands:

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm secretlint
pnpm syncpack:lint
```

Vitest covers malformed prices, non-success HTML, fast invalid/slow valid provider
races, requested-symbol and provenance mismatches, true zeroes, unknown fields,
provider timestamps, screening behavior, generated OpenAPI, and cancellation
acknowledgment followed by both fill and cancellation. Transport tests use mocked
responses, including the installed Alpaca SDK's 204 response handling. Default
tests do not place orders or call live providers. Provider and deployment checks
require their separate opt-in commands documented in the README.

No custom runner or validator is needed. Quote validation uses the existing Zod
dependency; HTML parsing uses pinned Cheerio 1.2.0 instead of general-purpose
parsing code. The remaining custom functions express provider mappings and
screening rules and are covered through the existing Vitest runner.
Native Oxlint enforces classic complexity at most 9 for the quote contract,
Yahoo, and Finnhub modules. Other modules still contain recorded hotspots; this
scoped gate does not claim the whole repository is below 10.
