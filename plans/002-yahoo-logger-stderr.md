# Plan 002: Keep yahoo-finance2 diagnostics off the MCP stdout channel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report. When done, update this plan's row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 27c0e52..HEAD -- packages/core/src/providers/yahoo.ts packages/core/test/yahoo.provider.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `27c0e52`, 2026-11-11

## Why this matters

ARCHITECTURE.md promises "MCP stdout carries only protocol messages". The Pino
logger was moved to stderr, but the shared `yahooFinance` client still uses
yahoo-finance2's default logger. When a Yahoo response fails the library's
schema validation (which the library says "may happen intermittently"), it
calls `logObj(errors)`. When stdout is not a TTY (always the case under MCP
stdio), `logObj` is `logger.info(JSON.stringify(...))`, and the default
`logger.info` is `console.log`, which writes to **stdout**. A version-check
`logger.info` line can follow. Multi-line non-JSON-RPC text on stdout can
break the MCP session. Options, search and trending MCP tools all use this client.

## Current state

- `packages/core/src/providers/yahoo.ts:16-18`:
  ```ts
  export const yahooFinance = new YahooFinance({
    suppressNotices: ["yahooSurvey"],
  });
  ```
- yahoo-finance2 4.0.5, `esm/src/createYahooFinance.js` ≈line 115: non-TTY `_logObj` → `this._opts.logger.info(JSON.stringify(obj, null, 2))`.
- `esm/src/lib/options/logger.js`: default `info: console.log`, `dir: console.dir` (both stdout). The option validator requires all five of `info, warn, error, debug, dir`.
- `esm/src/lib/options/defaults.js`: `versionCheck: true`, `validation.logErrors: true`.
- Shared logger: `packages/core/src/lib/logger.ts` (Pino, `pino.destination(2)` → stderr). Match it.

## Commands you will need

| Purpose   | Command                                                                   | Expected |
| --------- | ------------------------------------------------------------------------- | -------- |
| Typecheck | `pnpm typecheck`                                                          | exit 0   |
| Tests     | `pnpm --filter @trading/core exec vitest run test/yahoo.provider.test.ts` | pass     |
| Lint      | `pnpm lint && pnpm format:check`                                          | exit 0   |

## Scope

**In scope**: `packages/core/src/providers/yahoo.ts`, `packages/core/test/yahoo.provider.test.ts`.
**Out of scope**: changing validation strictness (`validation.logErrors` stays on, just routed to stderr); other providers.

## Steps

### Step 1: Pass a stderr logger and disable the version check

Construct `YahooFinance` with `logger: { info, warn, error, debug, dir }` where
each method writes through the shared Pino `logger` (e.g. `info: (...args) =>
logger.info({ provider: "yahoo" }, args.map(String).join(" "))`, `dir` likewise),
and `versionCheck: false` (a network call to npm from a trading server is unwanted).
**Verify**: `pnpm --filter @trading/core build` → exit 0.

### Step 2: Test that diagnostics never reach stdout

In `yahoo.provider.test.ts`, spy on `process.stdout.write` and `console.log`,
call `yahooFinance._logObj({ synthetic: true })` or trigger the configured
`logger.info` via `yahooFinance._opts.logger.info("x")`, and assert neither spy
was called. If those internals are not reachable through types, stub `fetch`
with a payload that fails validation for `quote` and assert the same.
**Verify**: focused test command → pass.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check` exit 0
- [ ] `grep -n "versionCheck: false" packages/core/src/providers/yahoo.ts` matches

## STOP conditions

- The installed yahoo-finance2 version does not accept a `logger` option.
- The only way to test requires a real network call.

## Maintenance notes

When upgrading yahoo-finance2, recheck that the logger option shape has not changed.
