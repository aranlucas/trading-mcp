# Trading MCP - Improvement Roadmap

## Current State

**Score:** 8.5/10
**Status:** Production-ready infrastructure complete. Focus now on testing, documentation, and advanced features.

**Guiding Principles**

- Ship incremental improvements with measurable outcomes.
- Prefer automation (tests, linting, CI) over manual checks.
- Favor stable APIs/providers over brittle scraping.
- Keep roadmap items scoped to a single, testable outcome when possible.

---

## Remaining Work

### 1. Increase Test Coverage

**Priority:** Critical

**Action Items:**

- [ ] Add unit tests for technical indicator calculations (RSI, SMA)
- [ ] Add integration tests for provider fallback logic
- [ ] Add API route tests with mocked responses
- [ ] Target: 80%+ coverage
- [ ] Add mutation testing or snapshot tests for key outputs

**Definition of Done**

- ✅ 80%+ coverage on `packages/core` and `packages/screener`
- ✅ All critical paths have tests (indicator calc, provider failover, and API routes)

### 2. Add OpenAPI Documentation

**Priority:** High

**Action Items:**

- [ ] Add `@hono/swagger-ui` for auto-generated docs
- [ ] Document all endpoints with request/response examples
- [ ] Add error code reference
- [ ] Publish a versioned `/docs` endpoint
- [ ] Add OpenAPI schema validation in CI to prevent drift

**Definition of Done**

- ✅ Swagger UI loads in dev and production
- ✅ All routes and error responses visible in docs

### 3. Replace Finviz HTML Scraping

**Priority:** High
**Risk:** Brittle, may violate ToS

**Alternatives:**

- Finviz Elite API (paid)
- Alpha Vantage (free tier)
- Tradier (free)
- IEX Cloud (pay-per-call)

**Decision Criteria**

- API reliability and rate limits
- Cost per request at expected volume
- Compliance with ToS and long-term stability

### 4. Add Pre-commit Hooks

**Priority:** Medium

**Action Items:**

- [ ] Add Husky for git hooks
- [ ] Add lint-staged for staged file linting
- [ ] Run typecheck on commit

**Definition of Done**

- ✅ Pre-commit runs `lint` and `typecheck` for staged files only
- ✅ Hooks are documented in README

### 5. Security Hardening

**Priority:** Medium

**Action Items:**

- [ ] Add `helmet` for security headers
- [ ] Add `@secretlint/secretlint-rule-preset-recommend`
- [ ] Sanitize error messages in API responses
- [ ] Validate environment variables on startup

**Definition of Done**

- ✅ Security headers enabled and verified with a simple curl check
- ✅ Secrets scanning integrated in CI
- ✅ Startup fails fast with clear env validation errors

### 6. Monitoring & Observability

**Priority:** Medium

**Action Items:**

- [ ] Integrate Pino logger with cloud logging (Datadog, Axiom, etc.)
- [ ] Add request timing metrics
- [ ] Add provider health monitoring
- [ ] Set up alerts for API errors

**Definition of Done**

- ✅ Structured logs include request IDs and timings
- ✅ Provider health dashboard or a periodic health report

---

## New Suggestions

### 7. Add WebSocket Support for Real-time Data

**Priority:** Low
**Value:** Enable real-time price updates

```typescript
// Example with Hono WebSocket
app.get("/ws/quotes/:symbol", upgradeWebSocket((c) => ({
  onMessage(event, ws) {
    // Stream real-time quotes
  }
})));
```

### 8. Add Portfolio Analytics

**Priority:** Low
**Value:** Advanced portfolio insights

- Sharpe ratio calculation
- Beta vs market index
- Sector allocation breakdown
- Risk metrics (VaR, max drawdown)

### 9. Add Options Greeks Calculator

**Priority:** Low
**Value:** Options trading support

- Black-Scholes implementation
- Delta, Gamma, Theta, Vega calculations
- IV surface visualization data

### 10. Add Backtesting API Endpoint

**Priority:** Medium
**Value:** Run backtests via API instead of CLI

```
POST /api/backtest
{
  "strategy": "RSI_OVERSOLD",
  "symbols": ["AAPL", "MSFT"],
  "period": "1y",
  "params": { "rsiThreshold": 30, "holdingDays": 5 }
}
```

### 11. Add Alert/Notification System

**Priority:** Medium
**Value:** Proactive trading signals

- Price alerts
- RSI threshold alerts
- Unusual volume detection
- Webhook delivery

### 12. Add Multi-timeframe Analysis

**Priority:** Low
**Value:** Better signal quality

- Combine daily/weekly/monthly signals
- Trend alignment across timeframes
- Higher timeframe confirmation

---

## Suggested Order of Execution

1. Increase Test Coverage
2. Add OpenAPI Documentation
3. Replace Finviz HTML Scraping
4. Add Pre-commit Hooks
5. Security Hardening
6. Monitoring & Observability

---

## Quick Reference

| Feature | Status | File/Location |
|---------|--------|---------------|
| CI/CD | Done | `.github/workflows/ci.yml` |
| Screener Workflow | Done | `.github/workflows/screener.yml` |
| Input Validation | Done | `packages/screener/src/routes/*.ts` |
| Rate Limiting | Done | `packages/core/src/lib/rate-limiter.ts` |
| Logging | Done | `packages/core/src/lib/logger.ts` |
| Caching | Done | `packages/core/src/lib/cache.ts` |
| Docker | Done | `Dockerfile` |
| ESLint/Prettier | Done | `eslint.config.js`, `.prettierrc` |
