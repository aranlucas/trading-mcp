# Trading Monorepo

Trading tools for Alpaca market data, an MCP server, and a stock screener API.

## Packages

- `@trading/core` — shared types, configuration, and Alpaca client.
- `@trading/mcp` — AI-assisted trading tools.
- `@trading/screener` — REST API for quotes, screening, and signals.

## Run locally

```bash
pnpm install
pnpm build
```

Set `ALPACA_API_KEY`, `ALPACA_API_SECRET`, and optionally `ALPACA_PAPER=true` before using provider-backed features. Never commit credentials.

```bash
pnpm dev
pnpm dev:screener
```

The screener API serves `/api/health`, `/api/openapi.json`, quote routes, and screening routes. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for deeper design notes.
## Deployment

Vercel uses Corepack to honor the pinned `pnpm@12.2.1` toolchain.
