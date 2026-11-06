# Architecture and engineering constraints

`@trading/core` owns shared types, provider adapters and Alpaca access.
`@trading/mcp` exposes stdio tools; `@trading/screener` exposes the REST app.
They share code but do not yet share one market-data selection policy.

## Runtime boundaries

| Caller                                        | Data path                                                             | Consequence                                                             |
| --------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| MCP market, technicals, portfolio and orders  | Alpaca                                                                | Credentials required; quote prices are daily-bar snapshots.             |
| MCP gainers/losers                            | Polygon when configured, otherwise Finviz                             | Results differ from REST screening.                                     |
| Other MCP screeners; trending/search; options | Finviz; Yahoo; Yahoo                                                  | These paths also bypass unified quote fallback.                         |
| REST quote routes                             | Yahoo directly                                                        | Raw Yahoo responses, without unified fallback.                          |
| REST screening                                | Injected `MarketDataClient`, Yahoo by default or Alpaca               | Normalized quotes; history fetched only for technical predicates.       |
| `unified.getQuote`                            | First valid success from Yahoo, configured Finnhub/Polygon, or Finviz | Observation kind depends on the winner; fastest does not mean freshest. |

See [data contracts](docs/data-contracts.md) for availability, provenance and
raw-response exclusions and fallback cancellation limits. Existing cache and
rate-limiter helpers are not applied consistently, so
their presence does not establish a request budget across every provider path.

[Configuration](packages/core/src/config.ts) reads environment variables and
warns at import time. `validateEnv()` exists in
[`lib/env.ts`](packages/core/src/lib/env.ts) but entrypoints do not invoke it.
Changing environment variables after imports may not reconfigure clients.

MCP stdout carries only protocol messages. Startup diagnostics and the shared
Pino logger write to stderr. REST and generic MCP tool failures use
`toPublicError`; cancellation retains its specialized unconfirmed-state payload.
Provider health checks require available data, not merely a resolved request.

## Engineering prerequisites

These are proposed improvements, not implemented guarantees. The
[product roadmap](ROADMAP.md) controls user-facing release order.

- **One market-data boundary:** unify provider selection, normalized batch/history
  contracts, caching, timeouts and rate limiting before switching callers.
  Propagate cancellation to reads, prevent retries accumulating abandoned work,
  and evaluate provider scoring/circuit breaking against measured failures.
- **Trading policy:** before journal automation or live execution, introduce
  deterministic order previews (market hours, notional/quantity limits, symbol
  policy, extended-hours limits), short-lived preview IDs with exact parameter
  matching, idempotency and a durable audit/reconciliation trail. Cancellation
  acknowledgment alone cannot prove exposure is gone.
- **Startup and errors:** validate configuration once at each composition root;
  construct clients explicitly, sanitize errors consistently and propagate
  correlation IDs through requests, provider calls and logs. Expose latency,
  error rates and cache behavior before setting service-level targets.
- **Remaining provider/API work:** evaluate replacing Finviz scraping or hardening
  its remaining regex-based screen/signal parsers (quotes already use Cheerio).
  Replace raw REST response schemas with explicit contracts and document actual
  rate-limit behavior as enforcement is integrated.

Provider-backed WebSocket streaming is an optional future capability; it is not
part of the first persisted research-snapshot milestone. Watchlist storage and
notifications belong to that product roadmap rather than a second feature list.
