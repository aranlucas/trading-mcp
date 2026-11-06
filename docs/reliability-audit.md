# Correctness and reliability audit — 2026-11-06

## Baseline and inventory (before implementation)

Remote default `origin/main`, b85cb574a151ffcf127df2dae2ed79296e4fa71c;
clean isolated worktree. This is a behavior audit after #53, not a structural pass.
All tests and builds run in CI only.

- `packages/core`: Alpaca brokerage reads/submission/cancellation, Yahoo,
  Finnhub, Polygon, FRED and scraped Finviz; normalized quote validation,
  technical indicators, bounded caches, retry/timeout helpers and metrics.
- `packages/mcp`: stdio initialization, tool discovery and calls for market,
  portfolio, orders, technicals, options and screening. Broker account identity
  comes from process credentials; no multi-tenant storage or transactions exist.
- `packages/screener`: public read-only Hono REST API, validation/OpenAPI,
  quote and screening adapters, provider health, Telegram reporting and backtests.
- Root/serverless entrypoints, Docker, workspace exports and CI are delivery
  boundaries. Provider data, HTTP inputs and broker numeric strings are untrusted.
  stdout must remain an MCP transport; errors must not expose credentials.

## Initial evidence and hypotheses

1. **History date validation (high confidence):** in
   `packages/screener/src/services/market-data.ts`, numeric chart dates are
   transformed to `Date` without validating its range. A finite epoch such as
   `1e20` produces an invalid Date, then `toISOString()` throws. One malformed
   observation discards otherwise usable history (scan technicals silently
   exclude the symbol). Expected: skip the unusable observation as for malformed
   string dates. Regression should retain adjacent valid observations.
2. **First-success helper (high confidence):** exported `raceToSuccess` in
   `packages/core/src/lib/timeout.ts` awaits _all_ providers and selects in input
   order. A hung provider prevents a resolved valid candidate returning forever.
   Expected: first non-null fulfillment; all failures still aggregate. Production
   unified quotes already use Promise.any; assess exported helper separately.

Review also covers success/error semantics, order transport ambiguity, provider
identity, indicator availability, serialization, reporting, cancellation and
resource lifetimes. Additional findings and rejected hypotheses will be recorded
as inspection completes.

## e2e framework investigation

Inspected the real published `e2e` 0.23.0 npm tarball (repository tester-army/e2e),
including shipped quickstart, CI/GitHub Actions, API testing, fixtures and engine
hooks. Published Node requirement: ^22.22.3 or >=24.8.0; repository pins 24.22.1.
API testing explicitly supports fetch/value matchers and engine-less targets;
there is no need to manufacture a UI or configure a model. Plan: real HTTP REST
and MCP protocol journeys using deterministic fixtures and engine-less runner.
No browser/mobile product exists in this repository.

3. **Malformed JSON becomes a server failure (high confidence):** Hono's body
   validator throws HTTPException(400) for syntactically invalid JSON, but
   `packages/screener/src/app.ts` treats it as an unknown 500. Trigger: POST
   scan or batch body `{` with JSON content type. Preserve client-error status
   with a sanitized validation response. Independently identified in review;
   REST e2e covers rejection followed by a successful screening request.

## Disposition and audit limits

The three confirmed findings above are fixed without changing public signatures
or successful response shapes. CI first restores the three original source files
from the baseline commit and requires the named regressions to fail; it restores
fixed sources before the ordinary build/typecheck/lint/test/container gates.
The baseline check is pinned deliberately: unrelated future behavior must not
be mistaken for evidence of these defects. Reports and pre-fix logs are uploaded.

Independent review confirmed the two initial findings and identified the malformed
JSON defect. Implementation review found a shallow-checkout hazard in the
reproduction job and an intentionally invalid SDK fixture needing an explicit
cast; both were corrected. Neither reviewer ran local tests/builds.

Reviewed/rejected hypotheses and remaining explicit limitations:

- Unified quote selection already uses Promise.any and validates quote identity;
  the first-success defect affects the exported helper, not that coordinator.
- Cancellation transport success deliberately means request accepted, never
  confirmed canceled. Existing SDK/MCP tests retain fills and ambiguous failures;
  the new stdio journey submits once, reads, cancels and observes a subsequent fill.
- No server-side multi-tenant persistence exists. REST exposes public market
  research, not brokerage mutations. Stdio inherits one account's environment.
  Introducing authentication, storage transactions or an order policy here would
  invent requirements. Submission idempotency and daily P&L placeholders remain
  documented constraints; no automatic retry is added to brokerage writes.
- Read timeouts bound waiting but cannot abort SDK reads; quote retries can
  overlap timed-out work. Existing documentation already states this limitation.
  Broad provider/cancellation API redesign is outside these contract-preserving fixes.
- Raw provider screening adapters have partial semantics: Yahoo `screen` returns
  day gainers regardless of query, Finviz ignores price/volume/sector/industry/
  country filters. These are not the REST `ScreenerService.scan` path. Do not use
  these legacy adapters for exact filtering; selecting a replacement provider
  query contract is follow-up work. Backtest Sharpe uses five-day scaling and
  should not be used as an annualized statistic for other holding periods.
- Cache bounds use lru-cache; rate-limit helpers use Bottleneck but are not wired
  across all providers. Their existence is not evidence of enforced global limits.
- Optional-provider empty results and incomplete history are retained documented
  availability conventions; missing quote fields stay nullable, zero stays zero.
  Existing provider, indicator, order, reporting and serverless tests are retained.

## Framework and verification evidence

Pinned real `e2e` 0.23.0 (Apache-2.0, maintained tester-army package, published
Node requirements compatible with repository Node 24.22.1). It provides the
supported engine-less API runner and fixture teardown, avoiding custom runner
code. No `@e2e-dev/web` or mobile engine applies to this API/stdio-only product.
No model steps, model credentials, production services or local tests are used.
REST tests bind a loopback HTTP server with deterministic Yahoo fixtures. MCP
launches the built production stdio entrypoint with synthetic credentials and
an in-process fake fetch transport that cannot contact a broker. Vitest also
checks the fake transport's network and duplicate-submission guardrails.

Dependency installation used `--ignore-scripts`; inspected lifecycle scripts
include root Husky prepare and optional native dependency builds. No local
install hook, test, benchmark or build ran. Static lint/format inspection is
allowed; TypeScript workspace imports require CI-built dist artifacts.
CI run URLs, head SHA and final outcome are tracked in the portfolio status and
PR. Pending CI is not a claim that verification passed.
