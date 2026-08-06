# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                        # Install dependencies
pnpm build                          # Build all packages (Turbo)
pnpm typecheck                      # Type-check without emit
pnpm test                           # Run all tests (Vitest via Turbo)
pnpm --filter @trading/core test    # Run tests for a single package
pnpm exec vitest run packages/core/src/__tests__/unified.fallback.test.ts  # Run a single test file
pnpm lint                           # ESLint on all packages
pnpm lint:fix                       # ESLint with auto-fix
pnpm format                         # Prettier format
pnpm dev                            # Dev mode: MCP server (tsx watch)
pnpm dev:screener                   # Dev mode: REST API (tsx watch)
```

Build, typecheck, and test tasks depend on `^build` — dependencies must build first.

## Project Overview

A trading tools monorepo with three packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@trading/core` | `packages/core/` | Shared types, Zod schemas, data providers, and infrastructure (cache, rate limiter, errors, retry, timeout) |
| `@trading/mcp` | `packages/mcp/` | MCP server (stdio transport) for AI-assisted trading |
| `@trading/screener` | `packages/screener/` | REST API (Hono + OpenAPI) for stock screening, deployed to Vercel via `api/` directory |

## Architecture

### Provider System (`packages/core/src/providers/index.ts`)

The `unified` facade is the primary entry point for market data:
- `Promise.any()` queries all configured providers in parallel (yahoo, finnhub, polygon, finviz)
- First successful response wins; 2s per-provider timeout with 1 retry (exponential backoff + jitter)
- Rolling-window metrics track error rates per provider; warns at >50% failure
- Direct access available via `unified.providers.yahoo.*` etc.
- `unified.healthCheck()` returns "healthy" (2+ providers), "degraded" (1), or "unhealthy" (0)

### Caching & Rate Limiting

- **LRU caches** (`lib/cache.ts`): Quotes 5s | Bars 1min | Market status 30s | News 5min
- **Rate limits** (`lib/rate-limiter.ts`, Bottleneck): Polygon 5/min | Finnhub 60/min | Alpaca 200/min | Yahoo 100/min | FRED 120/min | Finviz 10/min

### Error Hierarchy (`packages/core/src/lib/errors.ts`)

`AppError` base with `expose` flag → `ValidationError` (400), `ProviderError` (502), `NotFoundError` (404), `TimeoutError` (504). REST routes use `toPublicError()` to sanitize responses.

### MCP Tools (`packages/mcp/src/tools/`)

Each tool module registers tools with: Zod `inputSchema`, JSON response wrapping with `isError` flag on failures, `readOnlyHint: true` annotation for data-fetching tools. MCP server communicates over stdio; logs go to stderr.

### Screener REST API (`packages/screener/src/`)

Hono routes use `@hono/zod-openapi` for automatic request validation and OpenAPI spec generation. Service layer (`services/`) uses a market data client abstraction that switches between Alpaca and Yahoo based on `SCREENER_PROVIDER` env var.

## TypeScript Rules

- **Never use `any`** — ESLint enforces `@typescript-eslint/no-explicit-any: "error"`
- **Never disable ESLint rules** — fix the underlying issue
- **Strict mode** with `noUncheckedIndexedAccess` — all indexed access may be `undefined`
- **`verbatimModuleSyntax`** — use `import type` for type-only imports
- **Unused variables** — prefix with `_` (e.g., `_unusedParam`)
- Target: ES2024, module: NodeNext, ESM throughout

## Code Style

Enforced by Prettier (pre-commit via Husky + lint-staged):
- Double quotes, semicolons, trailing commas, 2-space indent, 100-char width
- Naming: PascalCase types/interfaces, camelCase functions/variables, SCREAMING_SNAKE_CASE constants

## Testing

- Framework: **Vitest** with v8 coverage
- Tests in `__tests__/` directories; E2E tests in `e2e/` (30s timeout)
- Use `vi.useFakeTimers()` for deterministic time-dependent tests

## Key Conventions

- Internal packages use `workspace:*` (Syncpack enforces exact versions for external deps)
- Zod schemas validate all external API responses at runtime
- Pino for structured logging (`packages/core/src/lib/logger.ts`)
- No import-time side effects — configuration loaded via explicit `loadConfig()` call
- Barrel exports (`index.ts`) define public API surfaces per package

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `ALPACA_API_KEY` | For trading | Alpaca API key |
| `ALPACA_API_SECRET` | For trading | Alpaca API secret |
| `ALPACA_PAPER` | No (default: true) | Use paper trading |
| `POLYGON_API_KEY` | No | Polygon market data |
| `FINNHUB_API_KEY` | No | Finnhub news/sentiment |
| `FRED_API_KEY` | No | Federal Reserve economic data |
| `SCREENER_PROVIDER` | No (default: yahoo) | `yahoo` (free) or `alpaca` |
| `PORT` | No (default: 3000) | REST API port |
