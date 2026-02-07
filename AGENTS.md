# Agent Guidelines (Type Safety)

- Prefer **real type fixes** over type-escape hatches (`any`, `unknown` casts, `// @ts-ignore`).
- If an interop edge case forces a cast (e.g., CJS/ESM boundary), isolate it to the smallest surface area and keep the rest of the code fully type-checked.
- Keep CI/dev workflows honest: `pnpm -r typecheck` should pass without suppressions.

