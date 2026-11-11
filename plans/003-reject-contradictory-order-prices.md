# Plan 003: Reject order requests whose price fields contradict their type

> **Executor instructions**: Follow this plan step by step; run every
> verification. On a STOP condition, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 27c0e52..HEAD -- packages/core/src/lib/alpaca.ts packages/mcp/src/tools/orders.ts packages/core/test/alpaca.order-params.test.ts packages/mcp/test/tools.integration.test.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-reconcilable-order-submission.md (same files; land after it)
- **Category**: bug
- **Planned at**: commit `27c0e52`, 2026-11-11

## Why this matters

`place_order` defaults `type` to `"market"`. A caller that sends `limitPrice:
150` but forgets `type` passes validation as a **market** order carrying a limit
price: the ceiling the caller intended is not enforced by our validation, and
whether the broker ignores or rejects the stray field is unverified. `type:
"limit"` with `stopPrice` passes too. Order safety rules should reject
contradictions instead of forwarding them.

## Current state

- `packages/core/src/lib/alpaca.ts` `AlpacaOrderRequestSchema.superRefine` only
  _requires_ `limit_price` for `limit`/`stop_limit` and `stop_price` for
  `stop`/`stop_limit`; it never forbids extras. `placeOrder` forwards both prices
  whatever the type.
- `packages/mcp/src/tools/orders.ts` `place_order` duplicates the "required"
  checks with truthiness (`!limitPrice`) and messages naming snake_case fields
  (`limit_price`) that are not the tool's camelCase inputs.
- Tests: `packages/core/test/alpaca.order-params.test.ts` (schema),
  `packages/mcp/test/tools.integration.test.ts` "Order Tools" (tool messages
  `limit_price required`, `stop_price required`).

## Commands you will need

| Purpose | Command                                                                        | Expected |
| ------- | ------------------------------------------------------------------------------ | -------- |
| Tests   | `pnpm --filter @trading/core exec vitest run test/alpaca.order-params.test.ts` | pass     |
| Tests   | `pnpm --filter @trading/mcp exec vitest run test/tools.integration.test.ts`    | pass     |
| All     | `pnpm typecheck && pnpm test && pnpm lint`                                     | exit 0   |

## Scope

**In scope**: the four files above. **Out of scope**: making `type` required (a
breaking input change; record as a follow-up), notional orders, extended hours.

## Steps

### Step 1: Forbid stray prices in the core schema

Add `superRefine` issues: `limit_price` present on `market`/`stop` →
"limit_price is only allowed for limit and stop_limit orders"; `stop_price`
present on `market`/`limit` → the stop equivalent.
**Verify**: core focused test → pass after Step 3's tests are added.

### Step 2: Make the MCP tool report core validation instead of duplicating it

Remove the two MCP pre-checks so the core `ValidationError` surfaces (after
plan 001 it arrives as `submit_rejected`). Include the Zod issue messages in the
public message, mapping `limit_price`/`stop_price` to `limitPrice`/`stopPrice`.
Update the two existing MCP tests to assert the new message text, keeping
`isError: true` and `placeOrder` not reaching the transport.
**Verify**: MCP focused test → pass.

### Step 3: Tests

Core: market + limit_price rejected; limit + stop_price rejected; stop + limit_price rejected; stop_limit with both accepted (existing).
MCP: `{ quantity: 10, limitPrice: 150 }` with no type → `isError`, nothing submitted.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check` exit 0
- [ ] New rejection tests exist and pass

## STOP conditions

- Plan 001 has not landed and the catch block in `place_order` still uses `toolError`: either land 001 first or keep the MCP pre-checks and only change core.

## Maintenance notes

When trailing-stop or bracket orders are added, extend the same type/field matrix.
