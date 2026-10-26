import { expect, it } from "vitest";
import { app } from "@/app.js";

it("documents unavailable screening fields and the required mover percentage in OpenAPI", async () => {
  const response = await app.request("http://test/api/openapi.json");
  expect(response.status).toBe(200);
  const document = await response.json();
  expect(document).toMatchObject({
    paths: {
      "/api/screener/scan": {
        post: {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          required: ["symbol", "price", "volume", "change", "changePercent"],
                          properties: {
                            volume: { type: "number", nullable: true },
                            change: { type: "number", nullable: true },
                            changePercent: { type: "number", nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/screener/movers/{direction}": {
        get: {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    properties: {
                      movers: {
                        type: "array",
                        items: {
                          properties: {
                            changePercent: { type: "number" },
                            change: { type: "number", nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
});
