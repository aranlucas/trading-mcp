import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  "nested/clone/.git/config",
  "nested/worktree/.git",
  "node_modules/host-marker",
  "packages/core/node_modules/host-marker",
  "dist/host-marker",
  "packages/core/dist/host-marker",
  "coverage/host-marker",
  "packages/core/coverage/host-marker",
  "debug.log",
  "packages/core/.DS_Store",
];

describe("Docker build context", () => {
  let temporary: string | undefined;
  let output: string;

  beforeAll(async () => {
    temporary = await mkdtemp(join(tmpdir(), "trading-docker-context-"));
    const context = join(temporary, "input");
    output = join(temporary, "output");

    // Send synthetic markers to Docker's matcher, never this checkout's contents.
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
      await readFile(new URL("../../.dockerignore", import.meta.url)),
    );

    const result = spawnSync(
      "docker",
      ["build", "--network=none", "--output", `type=local,dest=${output}`, context],
      { encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
    );

    const diagnostics = `Docker context build failed:\n${result.stdout}\n${result.stderr}`;

    assert.ifError(result.error);
    assert.equal(result.status, 0, diagnostics);
  });

  afterAll(async () => {
    if (temporary) {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it.each(excluded)("excludes host/private marker %s", (path) => {
    expect(existsSync(join(output, "context", path)), `Context exposed ${path}`).toBe(false);
  });

  it.each(retained)("retains required input %s", (path) => {
    expect(existsSync(join(output, "context", path)), `Context omitted ${path}`).toBe(true);
  });
});
