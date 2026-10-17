import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "docker-context",
    include: ["test/integration/docker-context.test.ts"],
    // Allow the existing 120-second Docker subprocess bound plus fixture I/O.
    hookTimeout: 130_000,
  },
});
