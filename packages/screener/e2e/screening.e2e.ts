import { test, expect } from "e2e";
import { z } from "zod";
import { serve } from "@hono/node-server";
import { yahoo } from "@trading/core";

type ApiFixture = { url: string };

const testApi = test.extend<ApiFixture>({
  url: async (_fixtures, use) => {
    const originalQuotes = yahoo.getQuotes.bind(yahoo);
    const originalHistory = yahoo.getHistory.bind(yahoo);
    const originalFetch = globalThis.fetch;
    const originalProvider = process.env.SCREENER_PROVIDER;
    process.env.SCREENER_PROVIDER = "yahoo";
    yahoo.getQuotes = () =>
      Promise.resolve(
        // SAFETY: SDK quote fixtures deliberately include an invalid price to exercise downstream validation.
        [
          { symbol: "AAPL", regularMarketPrice: 100, regularMarketVolume: 0 },
          { symbol: "ZERO", regularMarketPrice: 0 },
        ] as Awaited<ReturnType<typeof yahoo.getQuotes>>,
      );
    // Inject below the chart adapter: malformed dates must not poison otherwise valid technical history.
    yahoo.getHistory = () =>
      Promise.resolve(
        // SAFETY: Malformed chart data deliberately bypasses SDK validation to exercise the adapter.
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions
        {
          quotes: [
            { date: 1e20, close: 999 },
            ...Array.from({ length: 60 }, (_, i) => ({
              date: new Date(Date.UTC(2026, 0, i + 1)),
              close: 50,
            })),
          ],
        } as unknown as Awaited<ReturnType<typeof yahoo.getHistory>>,
      );
    globalThis.fetch = (input, init) => {
      if (new URL(input instanceof Request ? input.url : input).hostname !== "127.0.0.1") {
        return Promise.reject(new Error("External network is forbidden in this fixture"));
      }

      return originalFetch(input, init);
    };

    const { app } = await import("../dist/app.js");
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });

    try {
      if (!server.listening) {
        await new Promise<void>((resolve) => {
          server.once("listening", resolve);
        });
      }

      const address = server.address();
      const bound = z.object({ port: z.number() }).parse(address);
      await use(`http://127.0.0.1:${bound.port}`);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      yahoo.getQuotes = originalQuotes;
      yahoo.getHistory = originalHistory;
      globalThis.fetch = originalFetch;

      if (originalProvider === undefined) {
        delete process.env.SCREENER_PROVIDER;
      } else {
        process.env.SCREENER_PROVIDER = originalProvider;
      }
    }
  },
});

testApi(
  "reject malformed JSON, screen valid quotes, and retain usable technical history",
  async ({ url }) => {
    const scan = (body: string) =>
      fetch(`${url}/api/screener/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });

    const malformed = await scan("{");
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "Invalid request", code: "VALIDATION_ERROR" });

    const screened = await scan(
      JSON.stringify({ symbols: ["AAPL", "ZERO"], minVolume: 0, aboveSma50: true }),
    );

    expect(screened.status).toBe(200);
    expect(await screened.json()).toEqual({
      results: [
        {
          symbol: "AAPL",
          price: 100,
          volume: 0,
          change: null,
          changePercent: null,
          rsi: 50,
          aboveSma20: true,
          aboveSma50: true,
        },
      ],
    });
    const excluded = await scan(JSON.stringify({ symbols: ["AAPL"], minPrice: 101 }));
    expect(excluded.status).toBe(200);
    expect(await excluded.json()).toEqual({ results: [] });
  },
);
