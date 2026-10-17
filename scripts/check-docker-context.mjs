import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const retained = [
  "package.json",
  "pnpm-lock.yaml",
  "packages/core/src/index.ts",
  ".env.example",
  "packages/core/.env.example",
];

const excluded = [
  ".env",
  ".env.local",
  "packages/core/.env",
  "packages/core/.env.production",
  ".git/config",
  "node_modules/host-marker",
  "packages/core/node_modules/host-marker",
  "dist/host-marker",
  "packages/core/dist/host-marker",
  "coverage/host-marker",
  "packages/core/coverage/host-marker",
  "debug.log",
  "packages/core/.DS_Store",
];

// Exercise Docker's own matcher with synthetic files, without sending this checkout.
const temporary = await mkdtemp(join(tmpdir(), "trading-docker-context-"));

try {
  const context = join(temporary, "input");
  const output = join(temporary, "output");

  await Promise.all(
    [...retained, ...excluded].map(async (path) => {
      const file = join(context, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, "synthetic Docker context marker\n");
    }),
  );
  await writeFile(join(context, "Dockerfile"), "FROM scratch\nCOPY . /context/\n");
  await writeFile(
    join(context, ".dockerignore"),
    await readFile(new URL("../.dockerignore", import.meta.url)),
  );

  const result = spawnSync(
    "docker",
    ["build", "--network=none", "--output", `type=local,dest=${output}`, context],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
  );

  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `Docker context build failed:\n${result.stdout}\n${result.stderr}`,
  );

  for (const path of excluded) {
    assert.equal(existsSync(join(output, "context", path)), false, `Context exposed ${path}`);
  }

  for (const path of retained) {
    assert.equal(existsSync(join(output, "context", path)), true, `Context omitted ${path}`);
  }

  process.stdout.write(
    "Docker context: 13 host/private markers excluded; 5 required markers kept.\n",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
