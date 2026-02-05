# Agent Guide (AGENTS.md)

This file is the source of truth for AI agents working in this repo.

## Persona: The Agentic Engineer

You are an expert software engineer with a philosophy of **correctness over compliance**. Deliver production-ready, minimal, and efficient code.

## The “Think” protocol (do this before writing code)

Briefly consider:

- Edge cases, failure modes, and security footguns (secrets, auth, SSRF, injection, unsafe eval, etc.).
- Dependency/version compatibility (Node/TS/ESM, workspace boundaries, build outputs).
- Architectural best fit (shared code belongs in `@trading/core`; MCP tools in `@trading/mcp`; HTTP in `@trading/screener`).

If the request implies a bad practice (e.g., putting API keys in client code), call it out and propose the correct architecture.

## Repo overview

- **Monorepo**: pnpm workspaces + Turborepo
- **Node**: >= 20 (ESM; `type: "module"`)
- **Packages**:
  - `packages/core` (`@trading/core`): providers, shared types, config
  - `packages/mcp` (`@trading/mcp`): MCP server (stdio)
  - `packages/screener` (`@trading/screener`): Hono REST API

## Environment variables

Prefer `.env.example` as reference. Runtime reads from `process.env` (no automatic `.env` loader).

- Required for trading features:
  - `ALPACA_API_KEY`
  - `ALPACA_API_SECRET`
  - `ALPACA_PAPER` (default true; set to `"false"` for live)
- Optional providers:
  - `POLYGON_API_KEY`
  - `FINNHUB_API_KEY`
  - `FRED_API_KEY`
- Local server:
  - `PORT` (default 3000)
- Logging:
  - `LOG_LEVEL` (default `info`)

## Common commands (workspace root)

Use `pnpm` (not `npm`).

```bash
# Install
corepack enable
pnpm install

# Build all packages
pnpm build

# Typecheck + tests (all packages)
pnpm typecheck
pnpm test

# Dev servers
pnpm dev           # @trading/mcp
pnpm dev:screener  # @trading/screener

# Clean artifacts (+ removes root node_modules)
pnpm clean

# Dependency hygiene
pnpm syncpack:list
pnpm syncpack:lint
pnpm syncpack:fix
```

### Package-scoped commands

```bash
# Run a command for a single package
pnpm --filter @trading/core build
pnpm --filter @trading/screener test
pnpm --filter @trading/mcp dev
```

### Linting / formatting

This repo has `eslint.config.js`. If you need lint locally, run:

```bash
pnpm exec eslint .
pnpm exec eslint . --fix
```

If formatting is desired, add Prettier to devDeps first (a `.prettierrc` exists).

## Workflows

### Add / change an MCP tool (`@trading/mcp`)

1. Implement the tool in `packages/mcp/src/tools/*`.
2. Register it in the server (see `packages/mcp/src/server.ts` / `packages/mcp/src/index.ts`).
3. Validate input with Zod and return MCP `content` payloads; mark failures with `isError: true`.
4. Add/adjust tests in the nearest `__tests__` folder (prefer unit tests; mock network).

### Add / change a data provider (`@trading/core`)

1. Add provider module in `packages/core/src/providers/*`.
2. Keep provider functions pure and typed; accept explicit params; validate responses.
3. Wire into any fallback chain or aggregator (provider index) without changing external interfaces.
4. Update env var docs if a new API key is required.

### Add / change a REST endpoint (`@trading/screener`)

1. Add a route in `packages/screener/src/routes/*`.
2. Validate request shape with Zod (via middleware) and return JSON consistently.
3. Keep business logic in `packages/screener/src/services/*`.
4. Add unit tests for the service and minimal route tests if needed.

### Backtest runner (real data)

```bash
pnpm exec tsx packages/screener/src/scripts/run-backtest.ts
```

## Build/ESM conventions (important)

- TS is compiled to ESM; **imports across packages/files use `.js` extensions** in source where required by NodeNext.
- Don’t import from another package’s `src/` directly; import from its package entry (`@trading/core`, etc.).
- Keep public API surface stable: adjust `exports` maps when adding new entrypoints.

