# Quotes, screening, and cancellation

This describes the normalized quote contract and the order submission and
cancellation responses.
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
and missing/invalid snapshot prices.

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
without a separate adapter. Other Finviz APIs remain outside this contract.

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

## Order submission

Every `alpaca.placeOrder` request sends a `client_order_id`: the caller's
(1–128 characters of letters, digits, `.`, `_`, `:` or `-`) or a generated
UUID. The returned `Order` carries it as `clientOrderId`. Alpaca rejects a
reused client order ID, so retrying with the same ID cannot create a second
order. MCP `place_order` resolves the ID before submitting and submits exactly
once per call; it never retries.

Failures return `isError: true` and a JSON payload containing `clientOrderId`,
a sanitized `error`, a `message`, and one of these statuses:

| `status`             | Cause                                                                     | Meaning                                                         |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `submit_rejected`    | Local validation, or a broker 4xx (including a duplicate client order ID) | No order was created by this call; the broker reason is exposed |
| `submit_unconfirmed` | Transport failure, timeout, 5xx, or anything unclassified                 | The order may exist; details are not exposed                    |

After `submit_unconfirmed`, call `get_order_by_client_id`
(`alpaca.getOrderByClientOrderId`) before anything else. It returns the order,
or a `NOT_FOUND` error when Alpaca has no order with that ID. Only then retry,
with the same `clientOrderId`. Library callers that need to reconcile must pass
their own `client_order_id`, because a generated one is not returned when
`placeOrder` throws; use `alpaca.describeOrderSubmissionFailure` to classify
the thrown value. This provides idempotent submission, not an order preview or
trading policy.

## History, indicators and broker amounts

Alpaca history returns at most `limit` recent bars, oldest first (`limit` is an
integer from 1 to 10,000). Pagination failures reject the whole request. Quotes
use the latest two available daily bars; no bars means unavailable data. These
are daily-bar snapshots, not real-time trades.

MCP technicals and REST screening share `analyzeHistory`. Unavailable indicators
are `null`: RSI14 needs 15 closes, SMA/EMA and Bollinger Bands need their period,
and MACD(12,26,9) needs 34 closes to seed its signal EMA. RSI uses the simple
trailing-14-change calculation; flat history returns 50. `get_technicals`
requires 26 closes, so a successful response can still have unavailable SMA50,
SMA200 and MACD. Signals skip unavailable indicators. Yahoo screening counts
observations rather than calendar days; newly listed or suspended symbols can
return fewer than requested.

Portfolio, position and order normalization rejects malformed money/quantity
strings as provider errors. Missing optional broker fields retain their
fallbacks; valid fractional and signed amounts are preserved. Domain numbers
use JavaScript floating point, not exact decimal accounting. Portfolio
`dayChange` and `dayChangePercent` are currently placeholder zeroes.

FRED omits missing/malformed observations while preserving real zeroes.
Non-success HTTP responses yield unavailable results. The latest value remains
unavailable when the most recent observation is missing; it is not replaced by
an older one.

See [verification commands](../README.md#verification) for offline tests and the
separate opt-in provider/deployment checks.
