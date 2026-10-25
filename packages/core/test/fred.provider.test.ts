import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { fred as FredProvider } from "@/providers/fred.js";

const request = vi.fn<(input: string) => Promise<Response>>();

let fred: typeof FredProvider;

beforeEach(async () => {
  vi.stubEnv("FRED_API_KEY", "synthetic-fred-key");
  vi.stubGlobal("fetch", request);
  request.mockReset();
  request.mockRejectedValue(new Error("Unexpected synthetic request"));
  vi.resetModules();
  ({ fred } = await import("@/providers/fred.js"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("FRED observations", () => {
  it("omits missing and malformed values while preserving real zero and negative observations", async () => {
    request.mockResolvedValue(
      Response.json({
        observations: [
          { date: "2026-01-09", value: "." },
          { date: "2026-01-08", value: "0" },
          { date: "2026-01-07", value: "-0.25" },
          { date: "2026-01-06", value: "12oops" },
          { date: "2026-01-05", value: "Infinity" },
          { date: "2026-01-04", value: "" },
          { date: "2026-01-03", value: " " },
          { date: "2026-01-02", value: "4.50" },
        ],
      }),
    );

    expect(await fred.getSeries("TEST", 8)).toEqual([
      { date: "2026-01-08", value: 0 },
      { date: "2026-01-07", value: -0.25 },
      { date: "2026-01-02", value: 4.5 },
    ]);
  });

  it.each([
    { value: ".", expected: null },
    {
      value: "0",
      expected: {
        id: "TEST",
        title: "Synthetic series",
        units: "Percent",
        value: 0,
        date: "2026-01-09",
      },
    },
  ])(
    "reports latest value $value without inventing a zero for missing data",
    async ({ value, expected }) => {
      request.mockImplementation((input) => {
        const url = new URL(input);

        return Promise.resolve(
          Response.json(
            url.pathname.endsWith("/observations")
              ? { observations: [{ date: "2026-01-09", value }] }
              : { seriess: [{ id: "TEST", title: "Synthetic series", units: "Percent" }] },
          ),
        );
      });

      expect(await fred.getLatest("TEST")).toEqual(expected);
    },
  );
});

describe("FRED failed responses", () => {
  it.each([
    {
      name: "observations",
      run: () => fred.getSeries("TEST"),
      payload: { observations: [{ date: "2026-01-09", value: "12" }] },
      empty: [],
    },
    {
      name: "metadata",
      run: () => fred.getSeriesInfo("TEST"),
      payload: { seriess: [{ id: "TEST" }] },
      empty: null,
    },
    {
      name: "search",
      run: () => fred.search("Synthetic"),
      payload: { seriess: [{ id: "TEST" }] },
      empty: [],
    },
    {
      name: "releases",
      run: () => fred.getReleases(),
      payload: { releases: [{ id: 1 }] },
      empty: [],
    },
  ])(
    "does not accept a non-2xx $name payload as successful data",
    async ({ run, payload, empty }) => {
      request.mockResolvedValue(Response.json(payload, { status: 503 }));

      expect(await run()).toEqual(empty);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps transport and invalid-JSON failures unavailable", async () => {
    request.mockRejectedValueOnce(new TypeError("Synthetic connection failure"));
    request.mockResolvedValueOnce(new Response("not json"));

    expect(await fred.getSeries("TEST")).toEqual([]);
    expect(await fred.getSeries("TEST")).toEqual([]);
  });

  it("makes no requests when credentials are absent", async () => {
    vi.stubEnv("FRED_API_KEY", "");
    vi.resetModules();
    const { fred: disabled } = await import("@/providers/fred.js");

    expect(
      await Promise.all([
        disabled.getSeries("TEST"),
        disabled.getSeriesInfo("TEST"),
        disabled.getLatest("TEST"),
        disabled.search("Synthetic"),
        disabled.getReleases(),
      ]),
    ).toEqual([[], null, null, [], []]);
    expect(request).not.toHaveBeenCalled();
  });
});
