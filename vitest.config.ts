import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: "entrypoints",
    include: ["test/*.test.ts"],
  },
});
