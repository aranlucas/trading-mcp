# Trading MCP - Remaining Improvements

This document tracks remaining work for the trading-mcp repository.

## Current State

**Score:** 8.5/10
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

### 5. Provider Fallback Optimization

**Current:** Sequential fallback on failure
**Improvement:** Parallel requests with first-success pattern

```typescript
export async function getQuote(symbol: string): Promise<Quote> {
  const results = await Promise.allSettled([
    withTimeout(yahoo.getQuote(symbol), 2000),
    withTimeout(polygon.getQuote(symbol), 2000),
    withTimeout(alpaca.getQuote(symbol), 2000),
  ]);

  const success = results.find((r) => r.status === "fulfilled");
  if (success) return success.value;

  throw new AggregateError(
    results.filter((r) => r.status === "rejected").map((r) => r.reason),
    "All providers failed",
  );
}
```

---

### 6. Security Hardening

**Recommendations:**
1. Add `@secretlint/secretlint-rule-preset-recommend`
2. Sanitize error messages before returning to clients
3. Use environment variable validation on startup
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
4. **Medium:** Security hardening
5. **Low:** Provider fallback optimization
