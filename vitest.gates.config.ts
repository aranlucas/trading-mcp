import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/screener/src/__tests__/backtest-real.test.ts",
      "e2e/vercel-screener.deploy.test.ts",
    ],
    setupFiles: ["test/block-network.ts"],
    maxWorkers: 1,
  },
});
