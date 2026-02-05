import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "screener",
    include: ["src/**/*.test.ts"],
  },
});
