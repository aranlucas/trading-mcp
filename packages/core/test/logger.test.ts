import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it.each(["development", "production"])("keeps %s diagnostics off MCP stdout", (environment) => {
  const loggerPath = fileURLToPath(new URL("../dist/lib/logger.js", import.meta.url));

  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'const { logger } = await import(process.argv[1]); logger.warn("diagnostic-marker");',
      loggerPath,
    ],
    { encoding: "utf8", env: { ...process.env, NODE_ENV: environment, LOG_LEVEL: "info" } },
  );

  expect(result.status).toBe(0);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain('"msg":"diagnostic-marker"');
});
