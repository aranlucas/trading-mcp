# Claude Code Guidelines

## Quick Reference

```bash
pnpm install            # Install dependencies
pnpm build              # Build all packages (Turbo)
pnpm typecheck          # Type-check without emit
pnpm test               # Run all tests (Vitest)
pnpm lint               # ESLint on all packages
pnpm lint:fix           # ESLint with auto-fix
pnpm format             # Prettier format
pnpm format:check       # Prettier check
pnpm dev                # Dev mode: MCP server (tsx watch)
pnpm dev:screener       # Dev mode: REST API
```

## Project Overview

A trading tools monorepo with three packages exposing shared market data and trading capabilities:

| Package | Path | Purpose |
|---------|------|---------|
| `@trading/core` | `packages/core/` | Shared types, schemas, providers, and infrastructure |
| `@trading/mcp` | `packages/mcp/` | MCP server (stdio) for AI-assisted trading |
| `@trading/screener` | `packages/screener/` | REST API (Hono) for stock screening |

## Repository Structure

```
packages/
├── core/                     # Shared platform package
│   └── src/
│       ├── lib/              # Infrastructure (logger, cache, rate limiter, errors, timeout, retry, alpaca)
│       ├── providers/        # Data providers (yahoo, polygon, finnhub, fred, finviz) + unified facade
│       ├── schemas/          # Zod validation schemas for all external APIs
│       ├── types/            # TypeScript domain types
│       ├── config.ts         # Configuration loader
│       └── __tests__/        # Unit tests
├── mcp/                      # MCP server
│   └── src/
│       ├── tools/            # Tool implementations (market, portfolio, orders, screener, technicals, options)
│       ├── server.ts         # MCP server setup + tool registration
│       ├── index.ts          # Stdio transport entry point
│       └── __tests__/        # Tool tests
└── screener/                 # REST API
    └── src/
        ├── routes/           # HTTP endpoints (quotes, screener)
        ├── services/         # Business logic (screener, market-data)
        ├── scripts/          # CLI utilities (telegram-screener, backtest)
        ├── openapi/          # OpenAPI schema definitions
        ├── app.ts            # Hono middleware and route setup
        ├── index.ts          # HTTP server entry point
        └── __tests__/        # Route and service tests
```

## TypeScript Rules

- **Never use `any` type** - Always use proper types, `unknown`, or generics instead. ESLint enforces `@typescript-eslint/no-explicit-any: "error"`.
- **Never disable ESLint rules** - Fix the underlying issue instead of using `eslint-disable` comments.
- **Prefer real type fixes over escape hatches** - Avoid `unknown` casts and `// @ts-ignore`. If an interop edge case forces a cast (e.g., CJS/ESM boundary), isolate it to the smallest surface area.
- **Unused variables** - Prefix with `_` (e.g., `_unusedParam`). The linter allows `argsIgnorePattern: "^_"`.
- **Strict mode** is enabled, including `noUncheckedIndexedAccess`.

## Code Style

Enforced by Prettier (runs on pre-commit via Husky + lint-staged):

- Double quotes, semicolons, trailing commas
- 2-space indentation, 100-character line width
- ESM modules (`"type": "module"` in package.json)
- Target: ES2024, module resolution: NodeNext

## Testing

Framework: **Vitest** with v8 coverage provider.

```bash
pnpm test                           # Run all tests
pnpm --filter @trading/core test    # Run tests for a specific package
```

- Tests live in `__tests__/` directories alongside source code
- E2E tests in `e2e/` directory (30s timeout)
- Use `vi.useFakeTimers()` for deterministic time-dependent tests
- Coverage target: 80%+
- Test and typecheck tasks depend on `^build` (dependencies must build first)

## Architecture Patterns

### Provider Fallback (Parallel, First-Success)

All market data flows through `packages/core/src/providers/index.ts` (the `unified` facade):
- Providers are queried in parallel with per-request timeouts
- First successful response wins
- Error rate tracking alerts if >50% failures in a rolling window

### Caching (LRU)

Defined in `packages/core/src/lib/cache.ts`:
- Quotes: 5s TTL | Bars: 1min | Market status: 30s | News: 5min

### Rate Limiting

Defined in `packages/core/src/lib/rate-limiter.ts` (Bottleneck):
- Polygon: 5/min | Finnhub: 60/min | Alpaca: 200/min | Yahoo: 100/min | FRED: 120/min | Finviz: 10/min

### Error Handling

Typed error hierarchy in `packages/core/src/lib/errors.ts`:
- `AppError` base class with `expose` flag for public/private distinction
- Subtypes: `ValidationError` (400), `ProviderError` (502), `NotFoundError` (404), `TimeoutError` (504)
- REST routes use `toPublicError()` to sanitize responses (never leak secrets)

### MCP Tool Pattern

Tools in `packages/mcp/src/tools/` follow a consistent pattern:
- Zod `inputSchema` for parameter validation
- JSON response wrapping with `isError` flag on failures
- Read-only hints for market data tools

### REST Route Pattern (Hono)

Routes in `packages/screener/src/routes/` use:
- `@hono/zod-openapi` for OpenAPI route definitions
- Automatic request validation via Zod schemas
- Standardized error responses with `code` + `error` fields

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` and PRs:
1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`

Security audit runs in parallel (non-blocking). Pre-commit hook runs `eslint --fix` + `prettier --write` on staged `.ts` files.

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

## Key Conventions

- **Monorepo managed by pnpm workspaces + Turbo** for build orchestration
- **Internal packages** use `workspace:*` version specifier (enforced by Syncpack)
- **Zod schemas** validate all external API responses at runtime
- **Pino** for structured logging (`packages/core/src/lib/logger.ts`)
- **No import-time side effects** where possible (configuration loaded via explicit function calls)
- Naming: PascalCase for types/interfaces, camelCase for functions/variables, `SCREAMING_SNAKE_CASE` for constants
- Barrel exports (`index.ts`) define public API surfaces for each package

## Related Documentation

- `ARCHITECTURE.md` - System design, provider strategy, and improvement roadmap
- `IMPROVEMENTS.md` - Tracked remaining work items
- `AGENTS.md` - Type safety guidelines for contributors
- `README.md` - Setup instructions, API endpoints, deployment
