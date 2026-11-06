import type { E2EConfig } from "e2e";

export default {
  targets: [{ name: "protocol", platform: "api" }],
  tests: "packages/*/e2e/*.e2e.ts",
  workers: 1,
  retries: 0,
  timeout: 15000,
  reporters: ["list", "junit"],
} satisfies E2EConfig;
