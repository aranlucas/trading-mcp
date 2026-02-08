# Claude Code Guidelines

## Project Overview

Trading-MCP is a TypeScript monorepo providing AI-assisted trading tools via two surfaces:
- **`@trading/mcp`** - Model Context Protocol (stdio) server for LLM/agent tool use
- **`@trading/screener`** - REST API (Hono) for programmatic stock screening
- **`@trading/core`** - Shared library: types, schemas, provider integrations, trading adapter, infra utilities

## Tech Stack

- **Language:** TypeScript 5.9 (strict mode, ES2024 target, NodeNext modules)
- **Runtime:** Node.js >= 22.0.0
- **Package manager:** pnpm 9.15.4 (workspace monorepo)
- **Build orchestrator:** Turbo
- **Test framework:** Vitest (v8 coverage, 80%+ target)
- **HTTP framework:** Hono (with `@hono/zod-openapi`)
- **Validation:** Zod (runtime schemas for all external data)
- **Logging:** Pino (structured, domain-scoped children)

## Repository Layout

```
packages/
  core/src/
    types/         # TypeScript type definitions
    schemas/       # Zod validation schemas (Yahoo, Polygon, Finnhub, FRED, Alpaca)
    config.ts      # Environment-based configuration
    lib/
      alpaca.ts    # Alpaca SDK adapter (orders, portfolio, bars)
      errors.ts    # Error hierarchy (AppError, ValidationError, ProviderError, NotFoundError)
      logger.ts    # Pino logger with domain children
      cache.ts     # LRU caches for quotes/news
      rate-limiter.ts  # Bottleneck-based per-provider rate limiting
      timeout.ts   # Generic request timeout wrapper
      retry.ts     # Exponential backoff retry helper
      provider-metrics.ts  # Rolling-window error-rate tracking
    providers/
      index.ts     # Unified facade (multi-provider fallback)
      yahoo.ts     # Yahoo Finance provider
      polygon.ts   # Polygon.io provider
      finnhub.ts   # Finnhub provider
      finviz.ts    # Finviz HTML scraper (brittle, replacement planned)
      fred.ts      # FRED economic data

  mcp/src/
    index.ts       # Stdio MCP transport entry
    server.ts      # McpServer setup + tool registration
    tools/
      market.ts    # get_quote, get_bars, get_market_status
      portfolio.ts # get_account, get_portfolio, get_positions
      orders.ts    # place_order, get_order, list_orders, cancel_order
      technicals.ts # get_technicals, get_signals
      screener.ts  # get_gainers, get_losers, get_oversold, etc.
      options.ts   # get_options_chain, get_options_expiration, etc.

  screener/src/
    index.ts       # Hono HTTP server entry (PORT default 3000)
    app.ts         # Middleware (CORS, secure headers, error handler)
    routes/
      quotes.ts    # GET /api/quotes/:symbol, POST /api/quotes/batch, GET .../bars
      screener.ts  # POST /api/screener/scan, GET .../movers, POST .../signals
    services/
      screener.ts  # Scan logic, signal computation (RSI, SMA, MACD)
      market-data.ts # Unified data fetching

e2e/               # End-to-end tests (30s timeout)
api/               # Vercel serverless entry points
```

## Common Commands

```bash
pnpm build            # Build all packages (Turbo-orchestrated)
pnpm dev              # Run MCP server in watch mode
pnpm dev:screener     # Run screener API in watch mode
pnpm typecheck        # TypeScript validation (all packages)
pnpm test             # Run all tests via Vitest
pnpm lint             # ESLint check
pnpm lint:fix         # ESLint autofix
pnpm format           # Prettier format
pnpm format:check     # Prettier validation
pnpm secretlint       # Scan for committed secrets
pnpm syncpack:lint    # Check dependency version consistency
```

## TypeScript Rules

- **Never use `any` type** - Always use proper types, `unknown`, or generics instead. This is enforced as an ESLint error (`@typescript-eslint/no-explicit-any`).
- **Never disable ESLint rules** - Fix the underlying issue instead of using `eslint-disable` comments.
- **Prefer real type fixes** over type-escape hatches (`any`, `unknown` casts, `// @ts-ignore`). If a CJS/ESM interop edge case forces a cast, isolate it to the smallest possible surface area.
- **Unused variables** must be prefixed with `_` (enforced by `@typescript-eslint/no-unused-vars`).
- `pnpm typecheck` must pass without suppressions.

## Code Style

- **Formatter:** Prettier - semicolons, double quotes, 2-space indent, trailing commas, 100 char line width
- **Pre-commit hook** (Husky + lint-staged): ESLint fix + Prettier on staged `.ts` files
- **Module system:** ES Modules throughout (`"type": "module"`, `verbatimModuleSyntax: true`)

## Testing Conventions

- Test files live alongside source: `packages/*/src/__tests__/*.test.ts`
- Shared fixtures in `packages/core/src/__tests__/fixtures.ts` (mock quotes, bars, positions, orders)
- E2E tests in `e2e/` with 30s timeout
- Coverage target: 80%+ on core orchestration logic
- Coverage provider: v8, reporters: text + HTML

## Architecture Patterns

### Error Handling
Custom error hierarchy in `core/src/lib/errors.ts`:
- `AppError` (base) -> `ValidationError` (400), `ProviderError` (502), `NotFoundError` (404), `TimeoutError` (504)
- REST: errors converted to `{ error, code, status }` envelope (never leak internals)
- MCP: tools return `{ content: [...], isError: true }` instead of throwing

### Provider System
`unified` facade in `core/src/providers/index.ts`:
- `getQuote(symbol)`: parallel fallback (Yahoo -> Finnhub -> Polygon -> Finviz)
- `getNews(symbol?)`: aggregates + dedupes across Yahoo + Finnhub + Polygon
- `healthCheck()`: parallel smoke test across all providers
- All calls wrapped with rate limiting, timeouts, caching, and retry

### Zod Validation
All external API responses are validated through Zod schemas before use. Types are inferred from schemas. ZodError maps to ValidationError (400).

### MCP Tool Pattern
Each tool: Zod input schema, `readOnlyHint` annotation for read-only operations, structured return with `{ content: [...], isError?: boolean }`.

## Environment Variables

See `.env.example` for the full list. Key ones:
- `ALPACA_API_KEY` / `ALPACA_API_SECRET` - Required for trading features
- `ALPACA_PAPER=true` - Paper trading (default)
- `POLYGON_API_KEY`, `FINNHUB_API_KEY`, `FRED_API_KEY` - Optional additional data providers
- `SCREENER_PROVIDER` - `"yahoo"` (free, default) or `"alpaca"`
- `PORT` - Screener API port (default 3000)

## CI/CD

GitHub Actions workflows:
- **ci.yml**: Typecheck, lint, test, security audit on push/PR to main (Node 25.x)
- **screener.yml**: Manual/scheduled backtest, health-check, Vercel deploy-preview
- **prettier.yml**: Formatting validation
- **telegram-screener.yml**: Scheduled Telegram alerts

## Deployment

- **Docker**: Multi-stage Alpine build, runs `packages/screener/dist/index.js`
- **Vercel**: Screener REST API deployed as serverless functions at `/api/*`
