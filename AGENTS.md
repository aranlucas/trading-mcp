# Repository guidance

Read [data contracts](docs/data-contracts.md) when changing provider adapters,
quote consumers, indicators or order tools. Read [architecture](ARCHITECTURE.md)
when changing provider selection, startup, logging or trading policy. Setup and
verification commands live in [README](README.md#verification).

## Scripts: native first

Before adding a script or a package command that runs one, use the first rung
that works:

1. A flag or subcommand of an existing tool.
2. Declarative tool configuration.
3. A maintained plugin for that tool.
4. A one-line package script invoking a native command.
5. A test in the existing Vitest runner for assertions.
6. Custom code only for repository-specific behavior: its first comment names
   the native rung that could not cover it and why. Cover it in Vitest and quote
   that comment in the PR.

## Libraries first

Use existing dependencies before writing general-purpose helpers: Zod for
provider payloads and MCP inputs, Bottleneck for provider rate limiting,
`lru-cache` for bounded caching, and Pino for structured logging. Before adding a
library, verify active maintenance, adoption, types and stack compatibility.
Explain the choice in the PR; if custom code replaces a library's capability,
name the library and why it did not fit.

## Tests

Identify the behavior, a credible mistake the test catches and an independently
justified expected result. Protect contracts rather than internal structure;
keep tests small and deterministic, and use integration tests for interactions
isolated tests cannot establish. Keep implementation logic out of expectations
and mocks. Retain checks with distinct behavioral value; remove temporary
scaffolding. Fix failures without weakening their assertions.
