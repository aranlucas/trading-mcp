import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "vercel",
    include: ["e2e/vercel-screener.deploy.test.ts"],
    testTimeout: 70_000,
    hookTimeout: 70_000,
  },
});

