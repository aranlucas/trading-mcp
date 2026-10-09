# Anti-slop lint integration

The unchanged upstream plugin is vendored under `anti-slop/`; its commit, source,
MIT license, and bundled Stylistic provenance are recorded in `anti-slop/UPSTREAM.md`.
Oxlint and `@oxlint/plugins` are both pinned to 1.87.0.
All 18 generic rules plus Oxlint's accumulating-spread rule cover owned source,
tests, and scripts. Effect rules do not apply: this repository has no Effect dependency.

## Typed boundaries

- Alpaca responses use the official v4 SDK fields. Output order status, order type,
  and time-in-force are broker-owned strings, retaining states such as
  `partially_filled`, `pending_cancel`, `trailing_stop`, `opg`, and future statuses.
  Submission schemas remain unchanged. Timeframe strings are checked through the
  SDK constructor; order-list filters are parsed against the SDK's supported values.
- FRED, Finnhub, and Polygon raw endpoints now parse domain schemas. Additional
  JSON fields are retained at previously raw pass-through endpoints. Invalid
  payloads follow the provider's existing empty/null fallback behavior.
- Error/rejection callbacks and untyped Finnhub SDK declarations keep narrowly
  documented unknown-input exceptions: their purpose is to accept arbitrary thrown
  or incoming data, validate it, and expose only the established result contract.
  There are no blanket rule disables or chained assertions.
- MCP tests connect real SDK client/server pairs over `InMemoryTransport`. Provider
  dependencies and screener market-data clients are injected through typed contracts.
  They never submit live orders. The strict test typecheck covers these seams too.

## Checks

Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test`. Live
suites stay skipped unless `RUN_REAL_PROVIDER_TESTS=1` or `RUN_DEPLOYMENT_E2E=1`.
Passing offline checks is not live-provider or live-trading
verification. Existing opt-in provider/deployment scripts and CI security audit
remain in place.

## Provider contract references

The Finnhub fields follow its published [OpenAPI components](https://github.com/Finnhub-Stock-API/finnhub-go/blob/master/api/openapi.yaml),
including open `metric`/`series` objects and the `SocialSentiment.data` list.
Optional unavailable fields are retained as null, and additional JSON is preserved.
FRED models follow [series](https://fred.stlouisfed.org/docs/api/fred/series.html)
and [releases](https://fred.stlouisfed.org/docs/api/fred/releases.html).
Polygon's existing v3 endpoints follow the current documentation for
[ticker overview](https://massive.com/docs/rest/stocks/tickers/ticker-overview),
[related tickers](https://massive.com/docs/rest/stocks/tickers/related-tickers),
[reference splits](https://massive.com/docs/rest/stocks/corporate-actions/reference-splits),
and [reference dividends](https://massive.com/docs/rest/stocks/corporate-actions/reference-dividends).
The reference splits/dividends endpoints are deprecated by the provider; this lint
migration intentionally preserves their existing API routes rather than selecting
new financial-data semantics.

`alpaca.normalization.test.ts` also runs the installed SDK's in-memory fetch harness
on snake_case wire fixtures before mapping the SDK results. This verifies runtime
order and clock deserialization, including future order statuses, without contacting
a broker. Date string formatting and numeric/default behavior are preserved.
