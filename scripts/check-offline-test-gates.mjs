import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const require = createRequire(import.meta.url);

const vitest = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");

const expectedFiles = [
  "packages/screener/src/__tests__/backtest-real.test.ts",
  "e2e/vercel-screener.deploy.test.ts",
];

const directory = mkdtempSync(join(tmpdir(), "trading-offline-gates-"));

try {
  for (const flag of [undefined, "0", "true"]) {
    const env = { ...process.env, VERCEL_DEPLOY_URL: "not a valid deployment URL" };
    delete env.RUN_REAL_PROVIDER_TESTS;
    delete env.RUN_DEPLOYMENT_E2E;

    if (flag !== undefined) {
      env.RUN_REAL_PROVIDER_TESTS = flag;
      env.RUN_DEPLOYMENT_E2E = flag;
    }

    const reportPath = join(directory, "report.json");

    const result = spawnSync(
      process.execPath,
      [
        vitest,
        "run",
        "--config",
        "vitest.gates.config.ts",
        "--reporter=json",
        `--outputFile=${reportPath}`,
      ],
      { cwd: root, env, encoding: "utf8", timeout: 30_000 },
    );

    assert.equal(result.status, 0, result.error?.message ?? result.stderr ?? result.stdout);
    const report = JSON.parse(readFileSync(reportPath, "utf8"));

    for (const filename of expectedFiles) {
      const file = report.testResults.find((entry) => entry.name.endsWith(filename));
      assert.ok(file?.assertionResults.length > 0, `No tests discovered in ${filename}`);
      assert.ok(
        file.assertionResults.every((test) => test.status === "skipped"),
        `${filename} ran without explicit opt-in (flag=${flag ?? "unset"})`,
      );
    }

    console.log(`Live-provider and deployment suites stayed skipped with flags ${flag ?? "unset"}`);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
