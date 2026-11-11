# Plan 005: Make `aboveSma20: false` / `aboveSma50: false` filter instead of being ignored

> **Executor instructions**: Follow this plan step by step; run every
> verification. On a STOP condition, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 27c0e52..HEAD -- packages/screener/src/services/screener.ts packages/screener/src/contracts.ts packages/screener/test/screener.service.test.ts docs/data-contracts.md`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `27c0e52`, 2026-11-11

## Why this matters

The REST scan schema accepts `aboveSma20`/`aboveSma50` as booleans, but the
service only acts on `true`. `POST /api/screener/scan {"aboveSma20": false}`
returns the whole universe without computing SMA at all, so a "below the
20-day" screen (including Telegram reports via `SCREENER_SCAN_JSON`) silently
returns wrong results.

## Current state

- `packages/screener/src/contracts.ts`: `aboveSma20: z.boolean().optional()`, `aboveSma50: z.boolean().optional()`.
- `packages/screener/src/services/screener.ts`:
  ```ts
  function needsTechnicals(criteria: ScanCriteria): boolean {
    return (criteria.minRsi !== undefined || criteria.maxRsi !== undefined ||
      criteria.aboveSma20 === true || criteria.aboveSma50 === true);
  }
  function matchesTechnicals(values: ScanTechnicals, criteria: ScanCriteria): boolean {
    ...
    if (criteria.aboveSma20 && values.aboveSma20 !== true) return false;
    if (criteria.aboveSma50 && values.aboveSma50 !== true) return false;
    return true;
  }
  ```
- docs/data-contracts.md: technical filters exclude symbols with unavailable required history (keep that for `false` too: unknown SMA must not count as "below").

## Commands you will need

| Purpose | Command                                                                         | Expected |
| ------- | ------------------------------------------------------------------------------- | -------- |
| Tests   | `pnpm --filter @trading/screener exec vitest run test/screener.service.test.ts` | pass     |
| All     | `pnpm typecheck && pnpm test && pnpm lint`                                      | exit 0   |

## Scope

**In scope**: `services/screener.ts`, `test/screener.service.test.ts`, one sentence in `docs/data-contracts.md`.
**Out of scope**: renaming the fields; the OpenAPI shape (still boolean).

## Steps

### Step 1: Treat `false` as "must be at or below"

`needsTechnicals`: `criteria.aboveSma20 !== undefined || criteria.aboveSma50 !== undefined`.
`matchesTechnicals`: when the criterion is defined, require `values.aboveSmaN === criteria.aboveSmaN` (so `null`/unknown is excluded either way).
**Verify**: screener build → exit 0.

### Step 2: Tests

`aboveSma20: false` keeps a symbol below SMA20, excludes one above, excludes one with insufficient history; `true` behaviour unchanged.

### Step 3: Docs

Add to data-contracts' screening paragraph: "`aboveSma20`/`aboveSma50: false` selects symbols at or below the average; unknown averages are excluded."

## Done criteria

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check` exit 0
- [ ] New tests pass

## STOP conditions

- An existing test or the Telegram report config relies on `false` meaning "don't care" — report instead of changing semantics.

## Maintenance notes

If more boolean technical predicates are added, follow the same tri-state rule (undefined = ignore, true/false = filter).
