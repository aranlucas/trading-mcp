# Trading MCP - Improvement Roadmap

## Current State

**Score:** 8.5/10
**Status:** Production-ready infrastructure complete. Focus now on testing, documentation, and advanced features.

**Guiding Principles**

### Completed Items

- ✅ **Type Safety** - All 64 `any` types replaced with Zod runtime validation
- ✅ **`.env.example`** - Created with all required environment variables
- ✅ **Vercel Deployment** - Screener API configured for Vercel serverless

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

**Test Structure:**

```
packages/
├── core/
│   └── src/
│       └── __tests__/
│           ├── providers/
│           │   ├── yahoo.test.ts      # Mock API responses
│           │   ├── polygon.test.ts
│           │   └── alpaca.test.ts
│           └── config.test.ts
├── mcp/
│   └── src/
│       └── __tests__/
│           └── tools/
│               ├── market.test.ts
│               ├── portfolio.test.ts
│               └── orders.test.ts
└── screener/
    └── src/
        └── __tests__/
            ├── routes/
            └── services/
```

**Priority Tests to Write:**

1. Provider fallback logic (core mechanism)
2. Order placement validation (financial risk)
3. Technical indicator calculations (accuracy critical)
4. Error handling in API calls

### 2. Add OpenAPI Documentation

**Priority:** High

**Action Items:**

- [ ] Add `@hono/swagger-ui` for auto-generated docs
- [ ] Document all endpoints with request/response examples
- [ ] Add error code reference
- [ ] Publish a versioned `/docs` endpoint
- [ ] Add OpenAPI schema validation in CI to prevent drift

**Current Pattern (problematic):**

```typescript
try {
  // ... operation
} catch (error) {
  return null; // Silent failure, no visibility
}
```

**Recommended Pattern:**

```typescript
import { logger } from "@trading/core";

try {
  // ... operation
} catch (error) {
  logger.error("Failed to fetch quote", {
    symbol,
    provider: "yahoo",
    error: error instanceof Error ? error.message : "Unknown error",
  });
  throw new ProviderError("QUOTE_FETCH_FAILED", { symbol, cause: error });
}
```

**Implementation:**

1. Add structured logging (pino or winston)
2. Create custom error classes for each domain
3. Add retry logic with exponential backoff
4. Track error rates per provider

---

### 3. ✅ COMPLETED: Improve Type Safety

**Status:** All 64 instances of `any` replaced with Zod runtime validation.

**What was done:**

- Created `packages/core/src/schemas/index.ts` with 250+ lines of Zod schemas
- Added schemas for Yahoo, Polygon, Finnhub, FRED, Finviz, and Alpaca APIs
- All providers now use `.parse()` or `.safeParse()` for runtime validation
- Types are inferred from schemas (single source of truth)

---

## High Priority

### 4. Add CI/CD Pipeline

**Problem:** No automated testing, linting, or deployment pipeline.

**Recommended GitHub Actions:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
```

---

### 5. Add Input Validation to REST API

**Problem:** User input flows directly to API calls without validation.

**Vulnerable Endpoints:**

- `POST /api/quotes/batch` - Array of symbols not validated
- `POST /api/screener/scan` - Criteria object not validated
- `GET /api/quotes/:symbol/bars` - Date params not validated

**Recommended Solution:**

```typescript
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const BatchQuoteSchema = z.object({
  symbols: z.array(z.string().regex(/^[A-Z]{1,5}$/)).max(100),
});

app.post(
  "/api/quotes/batch",
  zValidator("json", BatchQuoteSchema),
  async (c) => {
    const { symbols } = c.req.valid("json");
    // ... safe to use
  },
);
```

---

### 6. Replace Finviz HTML Scraping

**Problem:** `packages/core/src/providers/finviz.ts` uses regex to parse HTML. This is:

- Brittle (breaks when Finviz changes their UI)
- Legally risky (may violate ToS)
- Unmaintainable

**Current Implementation:**

```typescript
// Scraping HTML with regex - fragile!
const priceMatch = html.match(/class="snapshot-td2-cp">([\d.]+)/);
```

**Alternatives:**

1. **Finviz Elite API** - Official paid API
2. **Alpha Vantage** - Free tier available
3. **Tradier** - Free market data API
4. **IEX Cloud** - Pay-per-call model

---

## New Suggestions

### 7. Add WebSocket Support for Real-time Data

**Priority:** Low
**Value:** Enable real-time price updates

**Recommended Solution:**

```typescript
import Bottleneck from "bottleneck";

const limiter = new Bottleneck({
  reservoir: 5,
  reservoirRefreshAmount: 5,
  reservoirRefreshInterval: 60 * 1000, // 1 minute
});

export async function fetchFromPolygon(endpoint: string) {
  return limiter.schedule(() => fetch(endpoint));
}
```

---

## Medium Priority

### 8. Improve Documentation

**Missing Documentation:**

- [ ] API endpoint documentation (OpenAPI/Swagger)
- [ ] Example requests and responses
- [ ] Error codes and handling guide
- [ ] Provider configuration details
- [ ] Rate limiting documentation
- [ ] Troubleshooting guide
- [x] ~~`.env.example` file~~ ✅ Created

---

### 9. Add Code Quality Tools

**Missing Tools:**

- ESLint for code linting
- Prettier for formatting
- Husky for pre-commit hooks
- lint-staged for staged file linting

**Setup:**

```bash
npm install -D eslint @typescript-eslint/eslint-plugin prettier husky lint-staged

# Add to package.json
{
  "scripts": {
    "lint": "eslint packages/*/src --ext .ts",
    "format": "prettier --write packages/*/src/**/*.ts"
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"]
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

**Problem:** Every request hits external APIs. No caching for:

- Quotes (could cache for 1-5 seconds)
- Market status (could cache for 1 minute)
- Historical bars (could cache indefinitely)

**Recommended Solution:**

```typescript
import { LRUCache } from "lru-cache";

**Priority:** Low
**Value:** Better signal quality

- Combine daily/weekly/monthly signals
- Trend alignment across timeframes
- Higher timeframe confirmation

---

## Suggested Order of Execution

### 11. Improve Provider Fallback Logic

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

## Quick Reference

**Create `Dockerfile`:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/*/package.json ./packages/
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/packages/screener/src/app.js"]
```

---

### 13. Security Hardening

**Issues Found:**

1. API keys could leak in error logs
2. No secrets scanning in CI
3. Some error messages expose internal details

**Recommendations:**

1. Add `@secretlint/secretlint-rule-preset-recommend`
2. Sanitize error messages before returning to clients
3. Use environment variable validation on startup
4. Add security headers to REST API (helmet)

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Set up Vitest and write first 20 tests
- [ ] Add ESLint + Prettier
- [x] ~~Create `.env.example`~~ ✅ Done
- [ ] Add GitHub Actions CI

### Phase 2: Hardening (Week 3-4)

- [x] ~~Reduce `any` usage to <5 instances~~ ✅ Done (0 instances now!)
- [ ] Add structured logging (pino)
- [ ] Add input validation to REST API
- [ ] Add rate limiting

### Phase 3: Quality (Week 5-6)

- [ ] Reach 80% test coverage
- [ ] Add OpenAPI documentation
- [ ] Replace Finviz scraping
- [ ] Add caching layer

### Phase 4: Production (Week 7-8)

- [ ] Add Docker support
- [x] ~~Add Vercel deployment~~ ✅ Done (screener API)
- [ ] Add monitoring/APM hooks
- [ ] Security audit
- [ ] Performance testing

---

## Quick Wins

These can be done immediately with minimal effort:

1. ~~**Create `.env.example`**~~ ✅ Done
2. **Add `npm run typecheck` script** - 2 minutes
3. **Add basic README badges** - 10 minutes
4. **Enable dependabot** - 5 minutes
5. **Add `.gitignore` for `.env`** - 1 minute

---

## Conclusion

This repository has a solid foundation with good architecture and comprehensive features. The main gaps are around production-readiness: testing, error handling, documentation, and CI/CD. Addressing the Critical and High priority items would significantly improve reliability and maintainability.

**Estimated Effort:** 4-6 weeks for a single developer to reach production quality.
