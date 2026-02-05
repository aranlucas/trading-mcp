# CLAUDE.md - AI Assistant Guide

This document provides essential context for AI assistants working on the trading-mcp codebase.

## Project Overview

**Trading Monorepo** - A comprehensive trading tools platform consisting of:
- **@trading/core**: Shared types, config, multi-provider data access
- **@trading/mcp**: MCP (Model Context Protocol) server for AI-assisted trading
- **@trading/screener**: REST API for stock screening (Vercel-deployable)

**Tech Stack**: Node.js 20+, TypeScript 5.9, pnpm 9.15.4, Turborepo, Hono, Zod, Vitest

## Quick Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type checking
pnpm typecheck

# Linting and formatting
pnpm lint
pnpm lint:fix
pnpm format

# Development
pnpm dev              # MCP server
pnpm dev:screener     # Screener API

# Clean build artifacts
pnpm clean
```

## Repository Structure

```
trading-mcp/
├── packages/
│   ├── core/                    # Shared utilities
│   │   └── src/
│   │       ├── types/           # TypeScript types (Quote, Position, Order)
│   │       ├── providers/       # Data providers (Yahoo, Polygon, Finnhub, FRED, Finviz)
│   │       ├── lib/             # Alpaca client, rate-limiter, logger, cache
│   │       ├── schemas/         # Zod validation schemas
│   │       └── config.ts        # Environment configuration
│   ├── mcp/                     # MCP server
│   │   └── src/
│   │       ├── tools/           # Tool implementations (market, portfolio, orders, etc.)
│   │       ├── server.ts        # Server setup
│   │       └── index.ts         # Entry point (stdio transport)
│   └── screener/                # REST API
│       └── src/
│           ├── routes/          # Hono route handlers
│           ├── services/        # Business logic (screener service)
│           ├── scripts/         # CLI tools (backtest runner)
│           └── api/             # Vercel serverless wrapper
├── .github/workflows/           # CI/CD (ci.yml, screener.yml)
├── tsconfig.base.json           # Base TypeScript config
├── turbo.json                   # Turborepo configuration
├── vitest.config.ts             # Test configuration
├── eslint.config.js             # ESLint rules
├── .prettierrc                  # Code formatting
└── Dockerfile                   # Multi-stage Alpine build
```

## Architecture Patterns

### 1. Provider Pattern with Fallback Chain

Data fetching uses a resilient multi-provider approach (see `packages/core/src/providers/index.ts`):

```typescript
// Order: Yahoo (free) → Finnhub → Polygon → Finviz
async getQuote(symbol: string) {
  try {
    return await yahoo.getQuote(symbol);
  } catch {
    const fhQuote = await finnhub.getQuote(symbol);
    if (fhQuote) return fhQuote;
    // ... continue fallback chain
  }
}
```

### 2. MCP Tool Registration

Tools follow a consistent pattern (see `packages/mcp/src/tools/market.ts`):

```typescript
server.registerTool(
  "tool_name",
  {
    title: "Human Readable Title",
    description: "What the tool does",
    inputSchema: {
      param: z.string().describe("Parameter description"),
    },
    annotations: { readOnlyHint: true },  // true for read-only tools
  },
  async ({ param }) => {
    try {
      const result = await someOperation(param);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error}` }],
        isError: true,
      };
    }
  },
);
```

### 3. Hono Route Handlers with Zod Validation

REST endpoints use Hono with zValidator middleware (see `packages/screener/src/routes/screener.ts`):

```typescript
const schema = z.object({
  symbols: z.array(z.string()).min(1).max(100),
});

screenerRoutes.post("/endpoint", zValidator("json", schema), async (c) => {
  const data = c.req.valid("json");
  try {
    const result = await service.method(data);
    return c.json({ result });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});
```

### 4. Rate Limiting & Caching

- **Rate Limiting**: Bottleneck-based per-provider limits (`packages/core/src/lib/rate-limiter.ts`)
  - Polygon: 5/min, Yahoo: 100/min, Alpaca: 200/min
- **Caching**: LRU cache with TTLs (`packages/core/src/lib/cache.ts`)
  - Quotes: 5s, Bars: 60s, News: 5min

## Code Conventions

### TypeScript Configuration

- **Target**: ES2024
- **Module**: NodeNext
- **Strict Mode**: Enabled (`strict: true`)
- **Safe Indexing**: `noUncheckedIndexedAccess: true`
- **Explicit Exports**: `verbatimModuleSyntax: true`

### Code Style (Prettier)

- Double quotes (`"`)
- Semicolons always
- 2-space indentation
- 100 character line width
- Trailing commas in multi-line

### ESLint Rules

- No `any` types (use `unknown` and type guards)
- Prefix unused variables with `_`
- TypeScript ESLint recommended configs enabled

### Import Conventions

```typescript
// External imports first
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Internal imports with .js extension (required for NodeNext)
import { alpaca } from "@trading/core";
import { ScreenerService } from "../services/screener.js";
```

## Testing

**Framework**: Vitest with v8 coverage

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm test --filter=@trading/screener

# Watch mode
pnpm test:watch
```

**Test Locations**:
- `packages/core/src/__tests__/` - Provider integration tests
- `packages/mcp/src/__tests__/` - Tool integration tests
- `packages/screener/src/__tests__/` - Service and backtest tests

**Test Patterns**:
```typescript
import { describe, it, expect } from "vitest";

describe("FeatureName", () => {
  it("should do something", async () => {
    const result = await someFunction();
    expect(result).toBeDefined();
  });
});
```

## Environment Variables

```bash
# Required for trading functionality
ALPACA_API_KEY="your-key"
ALPACA_API_SECRET="your-secret"
ALPACA_PAPER="true"            # Paper trading (default)

# Optional data providers
POLYGON_API_KEY="pk_..."       # Polygon.io
FINNHUB_API_KEY="..."          # Finnhub
FRED_API_KEY="..."             # FRED economic data

# Server configuration
PORT=3000                       # Screener API port
```

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Core types | `packages/core/src/types/index.ts` |
| Unified data provider | `packages/core/src/providers/index.ts` |
| Alpaca client | `packages/core/src/lib/alpaca.ts` |
| Rate limiter | `packages/core/src/lib/rate-limiter.ts` |
| Cache system | `packages/core/src/lib/cache.ts` |
| MCP tool registry | `packages/mcp/src/tools/index.ts` |
| Screener service | `packages/screener/src/services/screener.ts` |
| API routes | `packages/screener/src/routes/` |

## Common Tasks

### Adding a New MCP Tool

1. Create or edit tool file in `packages/mcp/src/tools/`
2. Follow the registration pattern with Zod schema
3. Register in `packages/mcp/src/tools/index.ts`
4. Add tests in `packages/mcp/src/__tests__/`

### Adding a New API Endpoint

1. Add route in `packages/screener/src/routes/`
2. Define Zod validation schema
3. Use zValidator middleware
4. Add tests in `packages/screener/src/__tests__/`

### Adding a New Data Provider

1. Create provider file in `packages/core/src/providers/`
2. Implement standard interface (getQuote, getBars, etc.)
3. Add rate limiting in `packages/core/src/lib/rate-limiter.ts`
4. Add to fallback chain in `packages/core/src/providers/index.ts`
5. Export from providers index

### Running Backtests

```bash
# Via CLI script
cd packages/screener
pnpm tsx src/scripts/run-backtest.ts
```

## MCP Tools Available

**Market Data**: `get_quote`, `get_bars`, `get_market_status`

**Portfolio**: `get_account`, `get_portfolio`, `get_positions`

**Orders**: `place_order`, `get_order`, `list_orders`, `cancel_order`

**Technical Analysis**: `get_technicals`, `get_signals`

**Screener**: `get_gainers`, `get_losers`, `get_oversold`, `get_overbought`, `get_unusual_volume`, `get_new_highs`, `get_new_lows`, `get_volatile`, `get_trending`, `search_symbols`

**Options**: `get_options_chain`, `get_options_expiration`, `get_high_iv_options`, `get_options_activity`, `get_options_summary`

## API Endpoints

```
GET  /                           # Health check
GET  /api/quotes/:symbol         # Single quote
POST /api/quotes/batch           # Multiple quotes
GET  /api/quotes/:symbol/bars    # Price history
POST /api/screener/scan          # Screen by criteria
GET  /api/screener/movers/:dir   # Gainers/losers
POST /api/screener/signals       # Technical signals
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs:
1. Type checking (`tsc --noEmit`)
2. Linting (ESLint)
3. Tests (Vitest with coverage)
4. Security scanning

## Improvement Roadmap

See `IMPROVEMENTS.md` for detailed roadmap. Key priorities:
- Increase test coverage to 80%+
- Add OpenAPI documentation
- Replace Finviz HTML scraping with stable API
- Add pre-commit hooks (Husky)

## Troubleshooting

**Build errors**: Run `pnpm clean && pnpm install && pnpm build`

**Type errors after changes**: Ensure `.js` extensions in imports for NodeNext resolution

**Rate limit errors**: Check provider-specific limits; consider adding API keys for higher limits

**Test failures with real data**: Some tests use real Yahoo Finance data; network issues may cause intermittent failures
