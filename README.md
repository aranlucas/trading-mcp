# Trading Monorepo

[![CI](https://github.com/aranlucas/trading-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/aranlucas/trading-mcp/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A monorepo for trading tools, including an MCP server and a screener API.

See `ARCHITECTURE.md` for system design and improvement roadmap.

## Packages

| Package             | Description                                 |
| ------------------- | ------------------------------------------- |
| `@trading/core`     | Shared types, config, and Alpaca API client |
| `@trading/mcp`      | MCP server for AI-assisted trading          |
| `@trading/screener` | REST API for stock screening                |

## Setup

```bash
npm install
npm run build
```

## Configuration

Set your Alpaca API credentials:

```bash
export ALPACA_API_KEY="your-api-key"
export ALPACA_API_SECRET="your-api-secret"
export ALPACA_PAPER="true"  # Use paper trading (default)
```

Get free API keys at [alpaca.markets](https://alpaca.markets)

## Telegram Alerts (GitHub Actions)

This repo includes a scheduled workflow that uses the screener API code to send a Telegram message (top movers, scan results, and/or signals).

**Required GitHub secrets:**

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (optionally `TELEGRAM_MESSAGE_THREAD_ID`)

**Optional (only if you run the workflow with `provider=alpaca`):**

- `ALPACA_API_KEY`, `ALPACA_API_SECRET` (and optionally `ALPACA_PAPER`)

Workflow file: `.github/workflows/telegram-screener.yml`

## Packages

### @trading/core

Shared utilities used by other packages:

- Type definitions (`Quote`, `Position`, `Order`, etc.)
- Alpaca API client
- Configuration management

### @trading/mcp

MCP server for Claude/AI integration:

```bash
npm run dev --workspace=@trading/mcp
```

**Tools:**

- Market data: `get_quote`, `get_bars`, `get_market_status`
- Portfolio: `get_account`, `get_portfolio`, `get_positions`
- Orders: `place_order`, `get_order`, `list_orders`, `cancel_order`
- Technicals: `get_technicals`, `get_signals`
- Screener: `get_gainers`, `get_losers`, `get_oversold`, `get_overbought`, `get_unusual_volume`, `get_new_highs`, `get_new_lows`, `get_volatile`, `get_trending`, `search_symbols`
- Options: `get_options_chain`, `get_options_expiration`, `get_high_iv_options`, `get_options_activity`, `get_options_summary`

### @trading/screener

REST API for stock screening:

```bash
npm run dev --workspace=@trading/screener
```

**Endpoints:**

- `GET /` - Health check
- `GET /health` - Provider health check
- `GET /openapi.json` - OpenAPI 3.0 spec
- `GET /api/quotes/:symbol` - Get single quote
- `POST /api/quotes/batch` - Get multiple quotes
- `GET /api/quotes/:symbol/bars` - Get price history
- `POST /api/screener/scan` - Screen stocks by criteria
- `GET /api/screener/movers/:direction` - Get top gainers/losers
- `POST /api/screener/signals` - Get signals for symbols

## Project Structure

```
packages/
├── core/               # Shared utilities
│   └── src/
│       ├── types/      # TypeScript types
│       ├── lib/        # Alpaca API client
│       └── config.ts   # Configuration
├── mcp/                # MCP server
│   └── src/
│       ├── tools/      # Tool implementations
│       └── server.ts   # Server setup
└── screener/           # REST API
    └── src/
        ├── routes/     # API routes
        └── services/   # Business logic
```

## Development

```bash
# Build all packages
npm run build

# Dev mode for MCP
npm run dev --workspace=@trading/mcp

# Dev mode for screener
npm run dev --workspace=@trading/screener
```

## License

MIT
