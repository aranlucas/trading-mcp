import { z } from "zod";
import { beforeAll, describe, expect, test } from "vitest";

function normalizeBaseUrl(raw: string): URL {
  const withProtocol =
    raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;

  const url = new URL(withProtocol);
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url;
}

async function fetchJson(
  url: URL,
  init?: RequestInit,
): Promise<{
  status: number;
  json: z.infer<ReturnType<typeof z.json>>;
  contentType: string | null;
}> {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": "trading-mcp vercel integration tests",
      ...init?.headers,
    },
  });

  const contentType = res.headers.get("content-type");
  const json = z.json().parse(await res.json());

  return { status: res.status, json, contentType };
}

async function waitForDeployment(baseUrl: URL, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  const apiUrl = new URL("/api", baseUrl);
  let lastError = "No response";

  while (Date.now() < deadline) {
    try {
      const { status } = await fetchJson(apiUrl);

      if (status >= 200 && status < 300) return;
      lastError = `Unexpected status: ${status}`;
    } catch (err) {
      lastError = String(err);
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error(`Deployment did not become ready at ${apiUrl.toString()} (${String(lastError)})`);
}

const rawBaseUrl = process.env.VERCEL_DEPLOY_URL ?? process.env.INTEGRATION_BASE_URL;

const enabled = process.env.RUN_DEPLOYMENT_E2E === "1";

if (enabled && !rawBaseUrl) {
  throw new Error("Deployment E2E requires VERCEL_DEPLOY_URL or INTEGRATION_BASE_URL");
}

const suite = enabled ? describe : describe.skip;

// An inherited deployment URL alone must not enable requests or even URL parsing.
const baseUrl = enabled && rawBaseUrl ? normalizeBaseUrl(rawBaseUrl) : null;

suite("Vercel Screener deployment", () => {
  beforeAll(async () => {
    expect(baseUrl).not.toBeNull();
    const url = baseUrl!;

    if (url.protocol !== "https:") {
      throw new Error(`Refusing to run against non-HTTPS URL: ${url.toString()}`);
    }

    // Guardrail: this workflow is intended to run against Vercel preview deployments.
    // If you use a custom domain, set `INTEGRATION_BASE_URL`/`VERCEL_DEPLOY_URL` and update this check.
    if (!url.hostname.endsWith(".vercel.app")) {
      throw new Error(`Refusing to run against non-Vercel host: ${url.hostname}`);
    }

    await waitForDeployment(url, 60_000);
  }, 70_000);

  test("GET /api returns service metadata", async () => {
    const { status, json, contentType } = await fetchJson(new URL("/api", baseUrl!));

    expect(contentType ?? "").toMatch(/application\/json/i);
    expect(status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        name: "trading-screener",
        status: "ok",
      }),
    );
  });

  test("GET /api/openapi.json returns an OpenAPI document", async () => {
    const { status, json, contentType } = await fetchJson(new URL("/api/openapi.json", baseUrl!));

    expect(contentType ?? "").toMatch(/application\/json/i);
    expect(status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        openapi: expect.any(String),
        info: expect.any(Object),
        paths: expect.any(Object),
      }),
    );
  });

  test("GET /api/quotes/AAPL returns JSON (quote or public error)", async () => {
    const { status, json, contentType } = await fetchJson(new URL("/api/quotes/AAPL", baseUrl!));

    expect(contentType ?? "").toMatch(/application\/json/i);

    if (status === 200) {
      expect(json).toEqual(expect.objectContaining({ symbol: "AAPL" }));

      return;
    }

    // Yahoo may rate-limit or intermittently fail in CI; validate the contract instead of flaking.
    expect(status).toBeGreaterThanOrEqual(400);
    expect(json).toEqual(
      expect.objectContaining({ error: expect.any(String), code: expect.any(String) }),
    );
  });
});
