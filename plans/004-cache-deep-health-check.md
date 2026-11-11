# Plan 004: Stop the public deep health check from spending provider quota per request

> **Executor instructions**: Follow this plan step by step; run every
> verification. On a STOP condition, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 27c0e52..HEAD -- packages/screener/src/app.ts packages/core/src/providers/index.ts packages/core/test/provider-health.test.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (resource exhaustion) / perf
- **Planned at**: commit `27c0e52`, 2026-11-11

## Why this matters

`GET /api/health` is unauthenticated and calls `unified.healthCheck()` on every
request. That makes live calls to Yahoo, Polygon (free tier: 5 requests/min),
Finnhub and FRED, and scrapes Finviz. One uptime monitor polling every minute
uses 20% of the Polygon budget, and anyone can drain the shared quotas (and
risk a Finviz IP block) by looping on a public URL.

## Current state

- `packages/screener/src/app.ts` ≈line 92:
  ```ts
  app.openapi(healthRoute, async (c) => {
    const health = await unified.healthCheck();
    const statusCode = health.status === "unhealthy" ? 503 : 200;
    return c.json(health, statusCode);
  });
  ```
- `packages/core/src/providers/index.ts` ≈line 428 `healthCheck` probes every configured provider.
- AGENTS.md: use `lru-cache` for bounded caching (already a core dependency; see `packages/core/src/lib/cache.ts` for its usage pattern with `ttl`).
- README documents `/api/health` as a network probe, not an offline liveness check (keep that; it can still be a probe, just a cached one).

## Commands you will need

| Purpose | Command                                                                    | Expected |
| ------- | -------------------------------------------------------------------------- | -------- |
| Tests   | `pnpm --filter @trading/core exec vitest run test/provider-health.test.ts` | pass     |
| All     | `pnpm typecheck && pnpm test && pnpm lint`                                 | exit 0   |

## Scope

**In scope**: `packages/core/src/providers/index.ts` (health memoization), its health test, and README's one-line description of `/api/health`.
**Out of scope**: authentication for `/api/health`; wiring rate limiters into providers.

## Steps

### Step 1: Memoize the health result

Wrap `healthCheck` so a result is reused for 30 seconds and concurrent callers
share one in-flight probe. Prefer `lru-cache` with `ttl` and `fetchMethod`
(it de-duplicates in-flight fetches natively). Keep the returned shape identical.
**Verify**: `pnpm --filter @trading/core build` → exit 0.

### Step 2: Tests

With fake timers and mocked provider probes: two concurrent calls → probes run
once; a call within 30 s reuses the result; a call after 30 s probes again.
**Verify**: focused test → pass.

### Step 3: Document the freshness bound

Add "results are cached for up to 30 seconds" to README's `/api/health` line.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check` exit 0
- [ ] New memoization tests pass

## STOP conditions

- Health tests depend on uncached behaviour in a way that cannot be reset between tests without exporting test-only hooks — report the trade-off instead of adding globals.

## Maintenance notes

Serverless instances each hold their own cache; the bound is per instance, which is still a large reduction.
