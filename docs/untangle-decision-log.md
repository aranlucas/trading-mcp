# Untangle decision log — 2026-11-06

## Starting inventory (before implementation)

Baseline: clean working tree at a5a1988. Preserve prior test pruning (#50),
documentation consolidation (#51), Docker CI (#49), package imports (#48), and
all existing quote/cancellation contracts. Both optional additions selected.
Tests and builds run only in CI; no local test processes were started here.

Reviewed core provider/normalization/infrastructure boundaries, MCP registrations,
REST services/routes, reporting/backtest scripts, exports, deployment/config,
documentation and existing behavioral suites. An independent static review
covers the repository too. No new dependencies or custom automation scripts.

### Put screener wire contracts in a dependency-free contracts module

- Scan criteria live as a service interface, a stricter route schema, and a
  separate loose report schema. New fields and constraints require three edits.
- Signal response shape is copied into reporting while OpenAPI says unknown.
- Reporting imports service implementations just to obtain response schemas.

Keep existing service schema exports compatible; share route constraints with
report configuration validation. Invalid report configs should fail early.

### Own MCP error presentation once, with the shared public error policy

- Every tool family repeats the same catch response and stringifies arbitrary
  provider failures, unlike REST and the cancellation acknowledgment boundary.
- Preserve cancellation's specialized unconfirmed-state response and explicit
  order validation messages. Share generic failure presentation across families.

### Make diagnostic output safe for every transport

- Pino writes to stdout in development and production; importing shared provider
  logging into stdio MCP silently violates the protocol. Use Pino's native stderr
  destination for all environments, without a worker transport.

### Probe actual provider availability

- Unified health callbacks await nullable quote results and discard them,
  reporting healthy even when adapters intentionally return unavailable.
- Preserve health aggregation thresholds, timeout and unconfigured behavior;
  require a usable quote or nonempty FRED observation list.

### Remove implementation-restating comments; retain external constraints

- Provider/tool section labels and comments narrating obvious calls add reading
  cost. Keep protocol/data provenance, upstream API restrictions, rate budgets,
  units and lint-boundary explanations.

### Tests last

- Retain meaningful existing financial normalization, fallback, transport and
  indicator assertions. Prior cleanup already removed low-signal suites.
- Replace nominally different cancellation failure labels that both throw the
  same generic Error with actual Error/TimeoutError cases.
- Add behavioral coverage for sanitized tool failures, stderr diagnostics,
  shared validation and unavailable health probes. CI owns execution.

## Retained special cases and boundaries

Provider-specific optional data, unavailable-result conventions, API parsing,
fallbacks, indicator warm-up thresholds, fractional broker values and ambiguous
cancellation outcomes encode real requirements; preserve them. Sequential scans
protect upstream request pressure. Reporting uses the in-process REST app by
existing decision. Backtest simulation is a separate research workflow.

Do not force raw and normalized APIs into one shape or change provider selection:
those are documented migrations with consumer compatibility consequences. Keep
public infrastructure/config exports even if internally unused; deleting them
is an API break, and wiring unused rate-limit/cache settings into every provider
would change latency/freshness policy. Startup validation/client injection and
trading preview/audit policy remain explicit roadmap work, not speculative
refactor additions. Do not rewrite Finviz parsers without upstream fixtures.
CI already runs package behavioral suites plus root entrypoint checks, typecheck,
lint/format/secrets/dependency checks and container build.

## Inventory review round 1

Independent review confirmed the four boundary fixes. It also found duplicate
RSI/SMA implementations in the real-data backtest: flat history becomes RSI100
instead of the shared contract's RSI50. Before changing it, plan: extract the
simulation engine from the network-running CLI so behavioral tests can import it
without executing Yahoo requests; reuse `analyzeHistory` at existing warmups.
Keep holding periods, fills and summary calculations unchanged. Remove the
empty-only batch passthrough test; it only compares an empty stub to itself. Remove only
redundant content-presence assertions already established by parsing.

## Implementation and review round 2

Implemented shared screener schemas (retaining service re-exports), public MCP
error formatting, native Pino stderr output, availability-based health probes,
and offline-importable backtest engine using core indicators. Added CI regression
coverage and removed the empty-only passthrough test and redundant content checks.

Review found remaining duplicated symbol validation and Telegram provider
selection; these now share their owners. Health exception messages now use the
public classifier too. Added signals OpenAPI regression coverage, corrected the
cleanup hook return, and extended the comment cleanup. No other worthwhile
redesign was identified. Existing provider-specific selection and compatibility
boundaries remain deliberate.

Local formatter ran. Local lint without generated workspace declarations reports
unresolved-package type errors; no local build was run to produce declarations.
CI is authoritative for typecheck/lint and all behavioral validation. No local
tests, benchmarks, browser tests or test builds ran.

## Final static review

Final independent recheck confirmed all prior findings resolved and no further
worthwhile structural issues. Removed a dangling extraction comment and fixed
test spacing. PR #53 owns CI validation; no local tests or builds ran.
