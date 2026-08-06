# Trading MCP - Remaining Improvements

This document tracks remaining work for the trading-mcp repository. Delete this file only when **all** items below are completed.

## Current State

**Status:** Production-ready infrastructure with comprehensive tooling

### Completed (removed from remaining list)

- **Parallel provider fallback** for `unified.getQuote()` (first-success, parallel requests with timeouts)
- **Retry logic** (exponential backoff helper)
- **Custom error types** + **sanitized public error responses** for the screener REST API
- **Order placement validation** at the core Alpaca client boundary (limit/stop price requirements)
- **OpenAPI**: `GET /openapi.json` added (basic spec)
- **Provider error-rate tracking** (rolling-window metrics snapshot)
- **Secret scanning**: Secretlint configured with recommended preset
- **API error responses** include stable `code` fields (in addition to `error`)
- **OpenAPI** schemas expanded (core request/response + error payloads)
- **Provider fallback tests** expanded (timeouts, all-fail AggregateError, invalid payloads)
- **Dependency hygiene**: `@hono/zod-validator` upgraded to support Zod v4

---

## Remaining Work

### 1. Increase Test Coverage

**Target:** 80%+ coverage

**Remaining:**
- Add coverage for trading/order flows beyond parameter validation

**Priority:** High

---

---

### 2. Replace Finviz HTML Scraping

**Problem:** `packages/core/src/providers/finviz.ts` parses HTML with regex (brittle, possible ToS issues).

**Alternatives:**
1. Finviz Elite API (paid)
2. Alpha Vantage (free tier)
3. Tradier (free market data)
4. IEX Cloud (pay-per-call)

**Priority:** Medium

---

### 3. API Documentation Improvements

**Current:** Basic OpenAPI spec exists at `GET /openapi.json`.

**Remaining:**
- Document rate limiting behavior

**Priority:** High

---

---

## Optional / Future

### WebSocket Support for Real-time Quotes

Add a WebSocket endpoint for real-time streaming via a provider that supports it (e.g., Alpaca streaming).

### Request Tracing with Correlation IDs

Add middleware to generate/propagate a correlation ID across provider calls.

### Circuit Breaker Pattern for Providers

Temporarily disable unhealthy providers to avoid repeated slow failures.

### Watchlist Persistence

Add simple storage (SQLite or file-based) for watchlists.

---

## Newly Noted

- Consolidate repeated `symbolSchema` validation between `packages/screener/src/routes/quotes.ts` and `packages/screener/src/routes/screener.ts`
- Consider removing or using unused helper `raceToSuccess()` in `packages/core/src/lib/timeout.ts`
