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

interface JsonResponse {
  status: number;
  json: z.infer<ReturnType<typeof z.json>>;
  contentType: string | null;
}

async function fetchJson(url: URL, init?: RequestInit): Promise<JsonResponse> {
  const headers = new Headers(init?.headers);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (!headers.has("user-agent")) {
    headers.set("user-agent", "trading-mcp vercel integration tests");
  }

  const res = await fetch(url, { ...init, headers });
  const contentType = res.headers.get("content-type");
  const json = z.json().parse(await res.json());

  return { status: res.status, json, contentType };
}

async function pollDeployment(
  apiUrl: URL,
  deadline: number,
  lastError = "No response",
): Promise<void> {
  if (Date.now() >= deadline) {
    throw new Error(`Deployment did not become ready at ${apiUrl.toString()} (${lastError})`);
  }

  let failure: string;

  try {
    const { status } = await fetchJson(apiUrl);

    if (status >= 200 && status < 300) {
      return;
    }

    failure = `Unexpected status: ${status}`;
  } catch (error) {
    failure = String(error);
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1500);
  });
  await pollDeployment(apiUrl, deadline, failure);
}

function waitForDeployment(baseUrl: URL, timeoutMs: number): Promise<void> {
  return pollDeployment(new URL("/api", baseUrl), Date.now() + timeoutMs);
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
    if (!baseUrl) {
      throw new Error("Deployment base URL is required");
    }

    const url = baseUrl;

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

    const document = z
      .object({
        openapi: z.string(),
        info: z.record(z.string(), z.json()),
        paths: z.record(z.string(), z.json()),
      })
      .parse(json);

    expect(document.openapi).toEqual(expect.any(String));
  });

  test("GET /api/quotes/AAPL returns JSON (quote or public error)", async () => {
    const { status, json, contentType } = await fetchJson(new URL("/api/quotes/AAPL", baseUrl!));

    expect(contentType ?? "").toMatch(/application\/json/i);

    // Yahoo may rate-limit or intermittently fail in CI; validate either response contract.
    const response = z
      .union([
        z.object({ status: z.literal(200), json: z.object({ symbol: z.literal("AAPL") }) }),
        z.object({
          status: z.number().int().min(400).max(599),
          json: z.object({ error: z.string(), code: z.string() }),
        }),
      ])
      .parse({ status, json });

    expect(response.status).toBe(status);
  });
});
