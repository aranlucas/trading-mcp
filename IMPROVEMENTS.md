# Trading MCP - Remaining Improvements

This document tracks remaining work for the trading-mcp repository.

## Current State

**Score:** 8.8/10
**Status:** Production-ready infrastructure with comprehensive tooling

### Completed

- Type Safety (Zod schemas, no `any` types)
- CI/CD Pipeline (GitHub Actions)
- Input Validation (Zod + @hono/zod-validator)
- Rate Limiting (Bottleneck)
- Structured Logging (Pino)
- Caching Layer (LRU cache)
- Code Quality (ESLint + Prettier + Husky + lint-staged)
- Docker Support
- Vercel Deployment
- Test Suite (41+ tests)
- Security Headers (Hono secureHeaders middleware)
- **Parallel Provider Fallback** (getQuote uses Promise.allSettled with timeouts)
- **Environment Variable Validation** (Zod-based validation at startup)
- **Provider Health Check** (`unified.healthCheck()` and `/health` endpoint)

---

## Remaining Work

### 1. Increase Test Coverage

**Current:** ~40% coverage with 41+ tests
**Target:** 80%+ coverage

**Remaining:**
- Add unit tests for provider fallback logic
- Add tests for order placement validation
- Add error handling tests

**Priority:** High

### 2. Error Handling Improvements

**Current:** Pino structured logging in place

**Remaining:**
- Create custom error classes for each domain
- Add retry logic with exponential backoff
- Track error rates per provider

---

### 3. Replace Finviz HTML Scraping

**Problem:** `packages/core/src/providers/finviz.ts` uses regex to parse HTML - brittle and may violate ToS.

**Alternatives:**
1. Finviz Elite API (paid)
2. Alpha Vantage (free tier)
3. Tradier (free market data)
4. IEX Cloud (pay-per-call)

---

### 4. API Documentation

**Missing:**
- OpenAPI/Swagger specification
- Example requests and responses
- Error codes and handling guide
- Rate limiting documentation

---

### 5. ~~Provider Fallback Optimization~~ (DONE)

~~**Current:** Sequential fallback on failure~~
~~**Improvement:** Parallel requests with first-success pattern~~

**Implemented in `packages/core/src/providers/index.ts`** - `getQuote()` now uses `Promise.allSettled` with 2-second timeouts for all configured providers.

---

### 6. Security Hardening

**Recommendations:**
1. Add `@secretlint/secretlint-rule-preset-recommend`
2. Sanitize error messages before returning to clients
3. ~~Use environment variable validation on startup~~ (done - `packages/core/src/lib/env.ts`)
4. ~~Add security headers to REST API~~ (done - using Hono's secureHeaders)

---

## Implementation Roadmap

### Phase 3: Quality (In Progress)

- [ ] Reach 80% test coverage
- [ ] Add OpenAPI documentation
- [ ] Replace Finviz scraping

### Phase 4: Production

- [ ] Add monitoring/APM hooks
- [ ] Security audit
- [ ] Performance testing

---

## Priority Order

1. **High:** Test coverage to 80%+
2. **High:** OpenAPI documentation
3. **Medium:** Replace Finviz scraping
4. **Medium:** Security hardening (2 remaining items)
5. ~~**Low:** Provider fallback optimization~~ (DONE)

---

## New Improvement Suggestions

### 7. WebSocket Support for Real-time Quotes

**Problem:** Current API is request-response only; clients must poll for updates.

**Recommendation:** Add WebSocket endpoint for real-time price streaming using Alpaca's streaming API.

```typescript
// Example: packages/screener/src/routes/ws.ts
app.get("/ws/quotes", async (c) => {
  const ws = c.req.header("upgrade") === "websocket";
  // Stream real-time quotes via Alpaca WebSocket
});
```

**Benefits:**
- Reduced API calls and latency
- Real-time portfolio updates
- Better UX for trading dashboards

---

### 8. Request Tracing with Correlation IDs

**Problem:** Debugging distributed requests across providers is difficult.

**Recommendation:** Add correlation ID middleware to trace requests across all providers.

```typescript
// Generate or propagate correlation ID
app.use("*", async (c, next) => {
  const correlationId = c.req.header("x-correlation-id") || crypto.randomUUID();
  c.set("correlationId", correlationId);
  c.header("x-correlation-id", correlationId);
  await next();
});
```

**Benefits:**
- Easier debugging
- Better observability
- Audit trail for trading operations

---

### 9. Circuit Breaker Pattern for Providers

**Problem:** Failed providers can slow down the entire system even with timeouts.

**Recommendation:** Implement circuit breaker pattern to temporarily disable unhealthy providers.

```typescript
interface CircuitBreaker {
  state: "closed" | "open" | "half-open";
  failures: number;
  lastFailure: Date | null;
  cooldownMs: number;
}
```

**Benefits:**
- Faster fallback when providers are down
- Prevents cascading failures
- Self-healing when providers recover

---

### 10. Watchlist Persistence

**Problem:** No way to save user watchlists between sessions.

**Recommendation:** Add simple file-based or SQLite storage for watchlists.

**Endpoints:**
- `GET /api/watchlists` - List user watchlists
- `POST /api/watchlists` - Create watchlist
- `PUT /api/watchlists/:id` - Update watchlist
- `DELETE /api/watchlists/:id` - Delete watchlist

---

### 11. Backtesting Support

**Problem:** No way to test trading strategies against historical data.

**Recommendation:** Add backtesting module that simulates trades using historical bars.

**Features:**
- Define entry/exit conditions
- Calculate returns and drawdown
- Compare against buy-and-hold benchmark
