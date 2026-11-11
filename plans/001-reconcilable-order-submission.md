# Plan 001: Make `place_order` submissions reconcilable and safe to retry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 27c0e52..HEAD -- packages/core/src/lib/alpaca.ts packages/core/src/types/index.ts packages/mcp/src/tools/orders.ts packages/mcp/e2e packages/core/test/alpaca.transport.test.ts packages/mcp/test/tools.integration.test.ts docs/data-contracts.md README.md ARCHITECTURE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the order-submission path; no live endpoints are ever called by tests)
- **Depends on**: none
- **Category**: bug (correctness/safety) + direction (ROADMAP "paper decision journal" prerequisite)
- **Planned at**: commit `27c0e52`, 2026-11-11

## Why this matters

`place_order` is the only tool that can create brokerage exposure, and an LLM
agent is its caller. Today two failure classes look identical to that agent:
a definite broker rejection (insufficient buying power, sub-penny price,
fractional GTC — HTTP 4xx) and an ambiguous transport failure (connection
reset, timeout, 5xx) where the order **may already exist**. Both come back as
`Error: Internal server error`. No client order ID is sent, so after an
ambiguous failure there is no way to look the order up, and the natural agent
reaction — retry — can create a duplicate order. `ROADMAP.md` requires that
"an ambiguous response is never replayed as another order", and the Alpaca SDK
documents the fix: "Supply a stable, unique `clientOrderId` so an ambiguous
transport failure can be reconciled before deciding whether to submit another
order." Alpaca rejects a reused `client_order_id`, so a retry carrying the same
ID cannot create a second order.

## Current state

- `packages/core/src/lib/alpaca.ts` — Alpaca SDK wrapper.
  - `AlpacaOrderRequestSchema` (≈line 185) has no client order ID:
    ```ts
    export const AlpacaOrderRequestSchema = z.object({
      symbol: z
        .string()
        .min(1)
        .max(10)
        .regex(/^[A-Z0-9.]+$/i, "Invalid symbol format"),
      qty: z.number().finite().positive(),
      side: z.enum(["buy", "sell"]),
      type: z.enum(["market", "limit", "stop", "stop_limit"]),
      time_in_force: z.enum(["day", "gtc", "ioc", "fok"]),
      limit_price: z.number().finite().positive().optional(),
      stop_price: z.number().finite().positive().optional(),
    });
    ```
  - `placeOrder` (≈line 217) calls `getAlpaca().trading.orders.submit({...})`
    without `clientOrderId`.
  - `mapOrder(raw, fallback?)` (≈line 258) maps SDK orders to the domain `Order`;
    `BrokerOrderFields` is a `Pick<BrokerOrder, ...>` list of the fields read.
  - `getOrder(orderId)` uses `trading.orders.getOrderByOrderID({ orderId })`.
- `packages/core/src/types/index.ts:38-52` — `interface Order` (no `clientOrderId`).
- `packages/mcp/src/tools/orders.ts` — MCP order tools. `place_order` catch block
  is `return toolError(error);` which renders `Error: ${toPublicError(error).message}`.
  `cancel_order` already has the pattern to copy: on failure it returns
  `isError: true` with JSON `{ orderId, status: "cancel_request_unconfirmed", error: toPublicError(error), message }`.
- `packages/core/src/lib/errors.ts:52-82` — `toPublicError` exposes `AppError`s
  with `expose: true`; anything else (including SDK `errors.ApiError`) becomes
  `{ status: 500, code: "INTERNAL_ERROR", message: "Internal server error" }`.
- Installed SDK `@alpacahq/alpaca-trade-api@5.0.0`:
  - `OrderInput` accepts `clientOrderId?: string` (≤128 chars), serialized as `client_order_id`.
  - `trading.orders.getOrderByClientOrderId({ clientOrderId })` →
    `GET /v2/orders:by_client_order_id?client_order_id=...`.
  - `errors.ApiError` has numeric `status`, `code`, broker `message`; `errors.FetchError` is a transport failure.
  - The SDK's own `submitAndWait` uses `input.clientOrderId ?? globalThis.crypto.randomUUID()`. Match it.
  - The SDK does not auto-retry POSTs (existing test "propagates an ambiguous transport failure without resubmitting").
- Tests to follow as patterns:
  - `packages/core/test/alpaca.transport.test.ts` — real SDK serialization with an in-memory `fetchApi` (`mockFetch` from `@alpacahq/alpaca-trade-api/testing`).
  - `packages/mcp/test/tools.integration.test.ts` — MCP tools via `connectTestTools` with mocked `ToolDependencies`.
  - `packages/mcp/e2e/broker-transport.ts` — stdio e2e fixture that asserts the exact POST body and refuses duplicate submission.

Conventions: Zod for MCP inputs and request validation (AGENTS.md "Libraries
first"); errors cross public boundaries only via `toPublicError` / exposed
`AppError`s; tests protect contracts, use synthetic credentials, never reach a
network.

## Commands you will need

| Purpose   | Command                                                                     | Expected on success |
| --------- | --------------------------------------------------------------------------- | ------------------- |
| Install   | `pnpm install --frozen-lockfile`                                            | exit 0              |
| Typecheck | `pnpm typecheck`                                                            | exit 0              |
| Tests     | `pnpm test`                                                                 | all pass            |
| Focused   | `pnpm --filter @trading/core exec vitest run test/alpaca.transport.test.ts` | all pass            |
| Focused   | `pnpm --filter @trading/mcp exec vitest run test/tools.integration.test.ts` | all pass            |
| E2E       | `pnpm build && pnpm exec e2e run`                                           | all journeys pass   |
| Lint      | `pnpm lint && pnpm format:check && pnpm secretlint && pnpm syncpack:lint`   | exit 0              |

## Scope

**In scope**:

- `packages/core/src/lib/alpaca.ts`
- `packages/core/src/types/index.ts` (add optional `clientOrderId` to `Order`)
- `packages/core/test/alpaca.transport.test.ts`
- `packages/mcp/src/tools/orders.ts`
- `packages/mcp/test/tools.integration.test.ts`
- `packages/mcp/e2e/broker-transport.ts`, `packages/mcp/e2e/orders.e2e.ts`
- `docs/data-contracts.md`, `README.md`, `ARCHITECTURE.md` (contract text only)

**Out of scope**:

- `toPublicError` in `packages/core/src/lib/errors.ts` — changing it alters every REST and MCP error; the broader "expose broker 4xx reasons everywhere" is a follow-up.
- Order previews, notional/quantity limits, market-hours policy — the separately reviewed trading policy in ARCHITECTURE.md.
- Any automatic retry of submission. The tool must still submit exactly once per call.
- The MCP limit/stop pre-checks in `place_order` (plan 003 covers order-field validation).
- `cancel_order` behavior.

## Git workflow

- Branch: `improve/<slug>`; one commit is fine. Message style matches `git log`
  (sentence-case imperative, e.g. "Fix malformed requests, history dates and first-success reliability").

## Steps

### Step 1: Accept and always send a client order ID in core

In `alpaca.ts`:

- Export `ClientOrderIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/, "Invalid client order ID")`.
- Add `client_order_id: ClientOrderIdSchema.optional()` to `AlpacaOrderRequestSchema`.
- In `placeOrder`, resolve `const clientOrderId = parsed.data.client_order_id ?? crypto.randomUUID();`, pass `clientOrderId` to `submit`, and pass `{ ...parsed.data, client_order_id: clientOrderId }` as the `mapOrder` fallback.
- Add `"clientOrderId"` to `BrokerOrderFields` and map `clientOrderId: raw.clientOrderId ?? fallback?.client_order_id` in `mapOrder`.
- Add `clientOrderId?: string` to `Order` in `types/index.ts`.

**Verify**: `pnpm --filter @trading/core build` → exit 0.

### Step 2: Look up an order by client order ID

Add `getOrderByClientOrderId(clientOrderId: string): Promise<Order>`: validate
with `ClientOrderIdSchema` (throw `ValidationError` without a request on
failure), call `trading.orders.getOrderByClientOrderId({ clientOrderId })`, and
map with `mapOrder`. Convert an SDK `errors.ApiError` with `status === 404` into
core `NotFoundError("No order found for this client order ID")` so callers can
distinguish "not found" from a failed lookup. Rethrow everything else.

**Verify**: `pnpm --filter @trading/core build` → exit 0.

### Step 3: Classify submission failures in core

Export `describeOrderSubmissionFailure(error)` returning a discriminated result:

- `{ status: "submit_rejected", error: PublicError }` when the error is a core
  `ValidationError` (never sent) or an SDK `errors.ApiError` with a 4xx
  status (the broker refused it). For the SDK case, expose the broker's
  `message` (truncate to 300 chars) with code `ORDER_REJECTED` by passing an
  exposed `AppError` through `toPublicError`.
- `{ status: "submit_unconfirmed", error: toPublicError(error) }` for everything
  else (FetchError, TimeoutError, 5xx, unknown) — the order may exist.

**Verify**: `pnpm --filter @trading/core build` → exit 0.

### Step 4: Wire the MCP tools

In `orders.ts`:

- Add optional `clientOrderId` input to `place_order` using `alpaca.ClientOrderIdSchema`, describing that reusing it on retry makes the retry safe. Resolve `clientOrderId ?? crypto.randomUUID()` _in the tool_ (so it is known even when submission throws) and pass it as `client_order_id`.
- Replace the `toolError` catch with `isError: true` JSON `{ clientOrderId, status, error, message }` from `describeOrderSubmissionFailure`. Rejected message: correct the request before submitting again. Unconfirmed message: call `get_order_by_client_id` with this ID before doing anything else; only if it reports not found, retry with the same `clientOrderId`.
- Register `get_order_by_client_id` (readOnlyHint) returning the order JSON or `toolError`.
- Add `"getOrderByClientOrderId"` to `OrderDependencies`.

**Verify**: `pnpm --filter @trading/mcp build` → exit 0.

### Step 5: Tests, e2e fixture, docs

See Test plan. Update the e2e broker fixture to accept (and require) a
`client_order_id` in the POST body. Update docs: README safety paragraph,
data-contracts "Order submission" section, ARCHITECTURE trading-policy bullet
(idempotency is now provided by client order IDs; previews/policy remain).

**Verify**: `pnpm typecheck && pnpm test && pnpm lint && pnpm format:check` → all exit 0.

## Test plan

Core (`alpaca.transport.test.ts`, real SDK + in-memory transport):

- The submitted body includes the caller's `client_order_id`, and the result carries `clientOrderId`.
- Omitted ID → a generated UUID is sent (match a UUID regex) and returned.
- Invalid client ID (e.g. 129 chars or containing a space) → `ValidationError`, transport never called.
- `getOrderByClientOrderId` hits `/v2/orders:by_client_order_id` with the query param; 404 → core `NotFoundError`.
- `describeOrderSubmissionFailure`: broker 422 → `submit_rejected` exposing the broker message; `FetchError` (transport reject) → `submit_unconfirmed` with no private detail; 503 → `submit_unconfirmed`.

MCP (`tools.integration.test.ts`):

- `place_order` passes a provided `clientOrderId` through, generates one otherwise.
- Ambiguous failure → `isError`, JSON status `submit_unconfirmed`, same `clientOrderId` as was sent, private detail absent, `placeOrder` called exactly once.
- Core `ValidationError` → `submit_rejected`.
- `get_order_by_client_id` is registered and returns the order.

E2E (`orders.e2e.ts`): pass an explicit `clientOrderId`, assert it is echoed.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0, new tests above exist and pass
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm secretlint`, `pnpm syncpack:lint` exit 0
- [ ] `pnpm exec e2e run` passes (after `pnpm build`)
- [ ] `grep -n "clientOrderId" packages/core/src/lib/alpaca.ts packages/mcp/src/tools/orders.ts` shows the new wiring
- [ ] No file outside the in-scope list is modified

## STOP conditions

- The SDK at the installed version does not serialize `clientOrderId` as `client_order_id`, or `getOrderByClientOrderId` is missing.
- Any test would need a real network call or real credentials.
- Implementing classification appears to require changing `toPublicError`.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Future preview/execute policy (ARCHITECTURE.md) should derive the client order ID from the preview ID so a confirmed preview maps to exactly one broker order.
- A reviewer should check that no code path submits twice and that only 4xx broker messages are exposed.
- Deferred: exposing broker 4xx reasons for read tools (`get_order`, `list_orders`, portfolio) via `toPublicError`.
